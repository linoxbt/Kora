import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { pool, id, transaction } from '../packages/database/src/index.js';
import { createMerchant, sandboxFund, balances, reserve, release, capture, postJournal, accountId, reverseJournal, invariantReport } from '../packages/ledger/src/index.js';
import { FakeConnector } from '../connectors/fake/src/index.js';
import { ProviderError } from '../packages/provider-sdk/src/index.js';

after(async () => { await pool.end(); });
async function fixture(amount='1000') {
  const merchant=id('test'); await createMerchant(merchant,'Integration fixture');
  const journal=await sandboxFund(merchant,'NGN',amount,`${merchant}:fund`);
  return {merchant,journal};
}
async function amounts(merchant:string) {
  return Object.fromEntries((await balances(merchant)).filter(b=>b.asset==='NGN').map(b=>[b.purpose,b.minor]));
}
test('journal references deduplicate retries and reject changed contents', async () => {
  const {merchant,journal}=await fixture();
  assert.equal(await sandboxFund(merchant,'NGN','1000',`${merchant}:fund`),journal);
  await assert.rejects(sandboxFund(merchant,'NGN','1001',`${merchant}:fund`),{code:'reference_conflict'});
  assert.equal((await amounts(merchant)).available,'1000');
});
test('merchant balances have a business account and canonical asset position', async () => {
  const {merchant}=await fixture();
  const account=(await pool.query(`SELECT a.owner_type,o.legacy_merchant_id,l.asset_position_id
    FROM kora_accounts a JOIN organizations o ON o.id=a.organization_id
    JOIN ledger_accounts l ON l.owner_account_id=a.id
    WHERE o.legacy_merchant_id=$1 AND l.asset='NGN' AND l.purpose='available'`,[merchant])).rows[0];
  assert.deepEqual(account,{owner_type:'business',legacy_merchant_id:merchant,asset_position_id:'pos_ngn_fiat'});
  assert.equal((await balances(merchant)).find(b=>b.asset==='NGN'&&b.purpose==='available')?.asset_position_id,'pos_ngn_fiat');
});
test('journals cannot cancel different positions with the same ticker', async () => {
  const {merchant}=await fixture();
  const suffix=id('alt');
  const position=`pos_${suffix}`;
  await pool.query(`INSERT INTO asset_positions(id,asset_code,network,issuer,form,decimals,environment)
    VALUES($1,'USDC','sandbox',$2,'simulated',6,'sandbox')`,[position,`lookalike-${suffix}`]);
  const lookalike=`sys:USDC:lookalike:${suffix}`;
  await pool.query(`INSERT INTO ledger_accounts(id,asset_position_id,asset,purpose)
    VALUES($1,$2,'USDC','funding')`,[lookalike,position]);
  await assert.rejects(transaction(c=>postJournal(c,{reference:id('crosspos'),description:'Invalid cross-position journal',entries:[
    {account_id:accountId(merchant,'USDC','available'),side:'debit',amount:'10'},
    {account_id:lookalike,side:'credit',amount:'10'},
  ]})),{code:'invalid_journal'});
});
test('unbalanced and cross-asset journals roll back atomically', async () => {
  const {merchant}=await fixture();
  const reference=id('unbalanced');
  await assert.rejects(transaction(c=>postJournal(c,{reference,description:'Unbalanced',entries:[
    {account_id:accountId(merchant,'NGN','available'),side:'debit',amount:'20'},
    {account_id:accountId(null,'NGN','funding'),side:'credit',amount:'10'},
  ]})),{code:'invalid_journal'});
  await assert.rejects(transaction(c=>postJournal(c,{reference,description:'Cross asset',entries:[
    {account_id:accountId(merchant,'NGN','available'),side:'debit',amount:'20'},
    {account_id:accountId(null,'KES','funding'),side:'credit',amount:'20'},
  ]})),{code:'invalid_journal'});
  assert.equal((await pool.query('SELECT 1 FROM journals WHERE reference=$1',[reference])).rowCount,0);
});
test('database independently rejects an unbalanced journal at commit', async () => {
  const {merchant}=await fixture(), journalId=id('jrn');
  await assert.rejects(transaction(async c=>{
    await c.query('INSERT INTO journals(id,reference,fingerprint,description) VALUES($1,$1,$1,$1)',[journalId]);
    await c.query("INSERT INTO ledger_entries(id,journal_id,account_id,side,amount) VALUES($1,$2,$3,'debit',10)",[id('ent'),journalId,accountId(merchant,'NGN','available')]);
  }),/unbalanced/);
  assert.equal((await pool.query('SELECT 1 FROM journals WHERE id=$1',[journalId])).rowCount,0);
});
test('database rejects empty journals', async () => {
  const journalId=id('jrn');
  await assert.rejects(transaction(c=>c.query('INSERT INTO journals(id,reference,fingerprint,description) VALUES($1,$1,$1,$1)',[journalId])),/no entries/);
});
test('posted journals, entries and account identities are immutable', async () => {
  const {merchant,journal}=await fixture();
  await assert.rejects(pool.query("UPDATE ledger_entries SET amount=2000 WHERE journal_id=$1",[journal]),/immutable/);
  await assert.rejects(pool.query('DELETE FROM ledger_entries WHERE journal_id=$1',[journal]),/immutable/);
  await assert.rejects(pool.query("UPDATE journals SET description='changed' WHERE id=$1",[journal]),/immutable/);
  await assert.rejects(pool.query("UPDATE ledger_accounts SET asset='KES' WHERE id=$1",[accountId(merchant,'NGN','available')]),/immutable/);
  await assert.rejects(pool.query("INSERT INTO ledger_entries(id,journal_id,account_id,side,amount) VALUES($1,$2,$3,'debit',10)",[id('ent'),journal,accountId(merchant,'NGN','available')]),/Cannot append/);
});
test('24 concurrent reservations cannot spend more than available funds', async () => {
  const {merchant}=await fixture();
  const results=await Promise.allSettled(Array.from({length:24},(_,i)=>reserve(merchant,'NGN','100',`${merchant}:hold:${i}`)));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,10);
  for (const r of results) if(r.status==='rejected') assert.equal(r.reason.code,'insufficient_funds');
  assert.deepEqual(await amounts(merchant),{available:'0',reserved:'1000'});
});
test('concurrent duplicate hold requests create one reservation', async () => {
  const {merchant}=await fixture();
  const holds=await Promise.all(Array.from({length:12},()=>reserve(merchant,'NGN','400',`${merchant}:hold`)));
  assert.equal(new Set(holds.map(h=>h.id)).size,1);
  assert.deepEqual(await amounts(merchant),{available:'600',reserved:'400'});
  await assert.rejects(reserve(merchant,'NGN','500',`${merchant}:hold`),{code:'reference_conflict'});
});
test('release is idempotent and forbids later capture', async () => {
  const {merchant}=await fixture(), hold=await reserve(merchant,'NGN','400',`${merchant}:hold`);
  await Promise.all([release(hold.id),release(hold.id)]);
  assert.deepEqual(await amounts(merchant),{available:'1000',reserved:'0'});
  await assert.rejects(capture(hold.id),{code:'invalid_hold'});
});
test('capture posts principal and an explicit fee exactly once', async () => {
  const {merchant}=await fixture(), hold=await reserve(merchant,'NGN','400',`${merchant}:hold`);
  await Promise.all([capture(hold.id,'2'),capture(hold.id,'2')]);
  assert.deepEqual(await amounts(merchant),{available:'600',reserved:'0'});
  const entries=(await pool.query('SELECT a.purpose,e.amount::text,e.side FROM ledger_entries e JOIN journals j ON j.id=e.journal_id JOIN ledger_accounts a ON a.id=e.account_id WHERE j.reference=$1 ORDER BY a.purpose',[`capture:${hold.id}`])).rows;
  assert.deepEqual(entries,[{purpose:'clearing',amount:'398',side:'debit'},{purpose:'fees',amount:'2',side:'debit'},{purpose:'reserved',amount:'400',side:'credit'}]);
  await assert.rejects(capture(hold.id,'3'),{code:'reference_conflict'});
  await assert.rejects(release(hold.id),{code:'invalid_hold'});
});
test('invalid capture leaves the hold and ledger unchanged', async () => {
  const {merchant}=await fixture(), hold=await reserve(merchant,'NGN','400',`${merchant}:hold`);
  await assert.rejects(capture(hold.id,'400'),{code:'invalid_hold'});
  assert.deepEqual(await amounts(merchant),{available:'600',reserved:'400'});
  assert.equal((await pool.query('SELECT state FROM holds WHERE id=$1',[hold.id])).rows[0].state,'held');
});
test('corrections use reversing journals and cannot reverse the same original twice', async () => {
  const {merchant,journal}=await fixture();
  const reference=id('reversal');
  const reversal=await reverseJournal(journal,reference,'Fixture correction');
  assert.equal(await reverseJournal(journal,reference,'Fixture correction'),reversal);
  await assert.rejects(reverseJournal(journal,id('reversal'),'Another correction'),{code:'reference_conflict'});
  assert.deepEqual(await amounts(merchant),{available:'0',reserved:'0'});
  assert.equal((await pool.query('SELECT count(*)::int count FROM ledger_entries WHERE journal_id=$1',[journal])).rows[0].count,2);
});
test('fake provider rejects requests not backed by a matching reservation', async () => {
  const {merchant}=await fixture(), hold=await reserve(merchant,'NGN','400',`${merchant}:hold`);
  await assert.rejects(new FakeConnector().payout({instruction_id:id('ins'),hold_id:hold.id,asset:'NGN',amount_minor:'500',beneficiary:'Fixture'}),{code:'rejected'});
});
test('timeout after provider acceptance is recoverable through durable status', async () => {
  const {merchant}=await fixture(), hold=await reserve(merchant,'NGN','400',`${merchant}:hold`), instruction=id('ins');
  await assert.rejects(new FakeConnector().payout({instruction_id:instruction,hold_id:hold.id,asset:'NGN',amount_minor:'400',beneficiary:'Fixture',scenario:'timeout'}),(e:unknown)=>e instanceof ProviderError&&e.code==='timeout'&&e.ambiguous);
  const status=await new FakeConnector().fetchStatus(instruction);
  assert.equal(status?.outcome,'confirmed');
  await capture(hold.id);
  assert.deepEqual(await amounts(merchant),{available:'600',reserved:'0'});
});
test('provider deduplicates concurrent submissions and rejects changed payloads', async () => {
  const {merchant}=await fixture(), hold=await reserve(merchant,'NGN','400',`${merchant}:hold`), instruction=id('ins');
  const request={instruction_id:instruction,hold_id:hold.id,asset:'NGN' as const,amount_minor:'400',beneficiary:'Fixture'};
  const statuses=await Promise.all(Array.from({length:12},()=>new FakeConnector().payout(request)));
  assert.equal(new Set(statuses.map(s=>s.provider_ref)).size,1);
  await assert.rejects(new FakeConnector().payout({...request,beneficiary:'Changed'}),{code:'duplicate'});
  await assert.rejects(new FakeConnector().payout({...request,instruction_id:id('ins')}),{code:'duplicate'});
});
test('provider rejection can release a reservation without a settlement', async () => {
  const {merchant}=await fixture(), hold=await reserve(merchant,'NGN','400',`${merchant}:hold`);
  const result=await new FakeConnector().payout({instruction_id:id('ins'),hold_id:hold.id,asset:'NGN',amount_minor:'400',beneficiary:'Fixture',scenario:'insufficient_float'});
  assert.equal(result.outcome,'rejected');
  await release(hold.id);
  assert.deepEqual(await amounts(merchant),{available:'1000',reserved:'0'});
});
test('provider principal plus explicit fee matches the gross reservation', async () => {
  const {merchant}=await fixture(), hold=await reserve(merchant,'NGN','400',`${merchant}:hold`);
  const request={instruction_id:id('ins'),hold_id:hold.id,asset:'NGN' as const,amount_minor:'398',fee_minor:'2',beneficiary:'Fee fixture'};
  assert.equal((await new FakeConnector().payout(request)).outcome,'confirmed');
  await capture(hold.id,'2');
  const entries=(await pool.query('SELECT a.purpose,e.amount::text FROM ledger_entries e JOIN journals j ON j.id=e.journal_id JOIN ledger_accounts a ON a.id=e.account_id WHERE j.reference=$1 AND a.purpose IN (\'clearing\',\'fees\') ORDER BY a.purpose',[`capture:${hold.id}`])).rows;
  assert.deepEqual(entries,[{purpose:'clearing',amount:request.amount_minor},{purpose:'fees',amount:request.fee_minor}]);
});
test('process termination after provider acceptance recovers without a second movement', async () => {
  const {merchant}=await fixture(), hold=await reserve(merchant,'NGN','400',`${merchant}:hold`), instruction=id('ins');
  const exitCode=await new Promise<number|null>((resolve,reject)=>{
    const child=spawn(process.execPath,['--import','tsx','scripts/crash-fixture.ts',hold.id,instruction],{cwd:process.cwd(),stdio:['ignore','pipe','pipe']});
    let stderr=''; child.stderr.on('data',d=>{stderr+=d.toString();});
    child.on('error',reject); child.on('close',code=>{ if(code!==73)reject(new Error(stderr));else resolve(code); });
  });
  assert.equal(exitCode,73);
  const recovered=await new FakeConnector().fetchStatus(instruction);
  assert.equal(recovered?.outcome,'confirmed');
  await capture(hold.id);
  assert.equal((await pool.query('SELECT count(*)::int count FROM fake_provider_movements WHERE instruction_id=$1',[instruction])).rows[0].count,1);
  assert.deepEqual(await amounts(merchant),{available:'600',reserved:'0'});
});
test('all stored journals satisfy financial invariants after concurrency and recovery tests', async () => {
  assert.deepEqual(await invariantReport(),{balanced:true,nonnegative:true,no_empty_journals:true,violations:[]});
});
