import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { spawn } from 'node:child_process';
import { pool, id } from '../packages/database/src/index.js';
import { createMerchant, sandboxFund, balances, invariantReport } from '../packages/ledger/src/index.js';
import { issueApiKey } from '../packages/payments/src/auth.js';
import { buildApi, type ApiOptions } from '../services/api/src/app.js';
import { runOnce } from '../services/worker/src/worker.js';
import { processIntent, type Checkpoint } from '../packages/payments/src/index.js';
import { deliverOne } from '../packages/payments/src/webhooks.js';
import { FakeConnector } from '../connectors/fake/src/index.js';
import { signWebhook, verifyWebhook, type AssetId } from '../packages/core/src/index.js';
import type { ProviderStatus, PayoutRequest } from '../packages/provider-sdk/src/index.js';

process.env.KORA_WEBHOOK_ENCRYPTION_KEY=randomBytes(32).toString('base64');
process.env.KORA_PROVIDER_CALLBACK_SECRET=randomBytes(32).toString('hex');
const apps:Awaited<ReturnType<typeof buildApi>>[]=[];
const servers:Server[]=[];
after(async()=>{for(const app of apps)await app.close();for(const server of servers)await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await pool.end();});
async function fixture(options:ApiOptions={}) {
  const merchant=id('test');await createMerchant(merchant,'Phase 1 integration');
  await sandboxFund(merchant,'NGN','10000000',`${merchant}:fund`);
  const key=await issueApiKey(merchant,'Integration fixture');
  const app=await buildApi({rateLimitMax:10000,...options});apps.push(app);
  const headers={authorization:`Bearer ${key.secret}`};
  const get=async(url:string)=>app.inject({method:'GET',url,headers});
  const post=async(url:string,payload:unknown,idem=id('idem'))=>app.inject({method:'POST',url,headers:{...headers,'idempotency-key':idem},payload:payload as Record<string,unknown>});
  const customerResponse=await post('/v1/customers',{name:'Sandbox recipient'});assert.equal(customerResponse.statusCode,201,customerResponse.body);
  const customer=customerResponse.json();
  async function instrument(code:AssetId='USDC') {
    const response=await post(`/v1/customers/${customer.id}/instruments`,{type:code==='USDC'?'stellar_account':'bank_account',asset:code,label:'Fixture account',sandbox_identifier:`sandbox:${code}:beneficiary`});
    assert.equal(response.statusCode,201,response.body);return response.json();
  }
  const destination=await instrument();
  async function quote() {const response=await post('/v1/quotes',{source_asset:'NGN',destination_asset:'USDC',amount_minor:'160000'});assert.equal(response.statusCode,201,response.body);return response.json();}
  async function intent(scenario='success') {
    const q=await quote();const response=await post('/v1/intents',{quote_id:q.id,customer_id:customer.id,destination_instrument_id:destination.id,reference:id('order'),scenario});
    assert.equal(response.statusCode,201,response.body);return response.json();
  }
  return {merchant,key,app,headers,get,post,customer,destination,instrument,quote,intent};
}
async function ngn(merchant:string){return Object.fromEntries((await balances(merchant)).filter(b=>b.asset==='NGN').map(b=>[b.purpose,b.minor]));}
async function instruction(intentId:string){return (await pool.query('SELECT * FROM instructions WHERE intent_id=$1',[intentId])).rows[0];}
async function ready(intentId:string){await pool.query("UPDATE outbox SET available_at=now(),locked_until=NULL,locked_by=NULL WHERE intent_id=$1",[intentId]);}

test('API authenticates hashed sandbox keys, rejects revoked/live keys, and emits request IDs',async()=>{
  const f=await fixture();
  const missing=await f.app.inject({method:'GET',url:'/v1/balances'});assert.equal(missing.statusCode,401);assert.ok(missing.headers['x-request-id']);
  assert.equal((await f.app.inject({method:'GET',url:'/v1/balances',headers:{authorization:'Bearer kora_live_deadbeef'}})).statusCode,401);
  const stored=(await pool.query('SELECT hash FROM api_keys WHERE id=$1',[f.key.id])).rows[0];assert.equal(stored.hash.includes(f.key.secret),false);assert.equal(stored.hash.length,64);
  assert.equal((await f.get('/v1/me')).json().id,f.merchant);
  await pool.query('UPDATE api_keys SET revoked_at=now() WHERE id=$1',[f.key.id]);assert.equal((await f.get('/v1/me')).statusCode,401);
});
test('scoped keys cannot perform mutations without write permissions',async()=>{
  const f=await fixture(),key=await issueApiKey(f.merchant,'Read only',['payments:read']);
  const headers={authorization:`Bearer ${key.secret}`,'idempotency-key':'scope-test'};
  assert.equal((await f.app.inject({method:'GET',url:'/v1/balances',headers})).statusCode,200);
  assert.equal((await f.app.inject({method:'POST',url:'/v1/quotes',headers,payload:{source_asset:'NGN',destination_asset:'USDC',amount_minor:'160000'}})).statusCode,403);
});
test('tenant isolation applies to customers, quotes, intents and instrument creation',async()=>{
  const a=await fixture(),b=await fixture(),q=await a.quote(),intent=await a.intent();
  for(const url of [`/v1/customers/${a.customer.id}`,`/v1/quotes/${q.id}`,`/v1/intents/${intent.id}`])assert.equal((await b.get(url)).statusCode,404);
  assert.equal((await b.post(`/v1/customers/${a.customer.id}/instruments`,{type:'bank_account',asset:'NGN',label:'Foreign',sandbox_identifier:'sandbox:foreign'})).statusCode,404);
  const response=await b.post('/v1/intents',{quote_id:q.id,customer_id:a.customer.id,destination_instrument_id:a.destination.id,reference:'foreign'});
  assert.equal(response.statusCode,404);
  assert.equal((await b.get('/v1/intents')).json().data.length,0);
});
test('all public mutations require idempotency keys and reject unknown/unsafe fields',async()=>{
  const f=await fixture();
  assert.equal((await f.app.inject({method:'POST',url:'/v1/customers',headers:f.headers,payload:{name:'Missing key'}})).statusCode,400);
  assert.equal((await f.post('/v1/quotes',{source_asset:'NGN',destination_asset:'USDC',amount_minor:160000})).statusCode,400);
  assert.equal((await f.post('/v1/customers',{name:'Injected',merchant_id:'other'})).statusCode,400);
  assert.equal((await f.post('/v1/quotes',{source_asset:'NGN',destination_asset:'USDC',amount_minor:'01'})).statusCode,400);
});
test('idempotency canonicalizes object keys, preserves original responses and rejects changed bodies',async()=>{
  const f=await fixture(),key=id('idem');
  const first=await f.post('/v1/quotes',{source_asset:'NGN',destination_asset:'USDC',amount_minor:'160000'},key);
  const replay=await f.post('/v1/quotes',{amount_minor:'160000',destination_asset:'USDC',source_asset:'NGN'},key);
  assert.equal(replay.statusCode,201);assert.deepEqual(replay.json(),first.json());assert.equal(replay.headers['idempotency-replayed'],'true');
  const changed=await f.post('/v1/quotes',{source_asset:'NGN',destination_asset:'USDC',amount_minor:'320000'},key);assert.equal(changed.statusCode,409);assert.equal(changed.json().error.code,'idempotency_conflict');
});
test('concurrent identical API requests commit one intent, hold, outbox job and creation event',async()=>{
  const f=await fixture(),q=await f.quote(),key=id('idem');
  const payload={quote_id:q.id,customer_id:f.customer.id,destination_instrument_id:f.destination.id,reference:'duplicate'};
  const responses=await Promise.all(Array.from({length:12},()=>f.post('/v1/intents',payload,key)));
  for(const r of responses)assert.equal(r.statusCode,201,r.body);
  const ids=new Set(responses.map(r=>r.json().id));assert.equal(ids.size,1);const intentId=responses[0].json().id;
  for(const table of ['intents','outbox','events']){
    const column=table==='intents'?'id':'intent_id';assert.equal((await pool.query(`SELECT count(*)::int n FROM ${table} WHERE ${column}=$1`,[intentId])).rows[0].n,1);
  }
  assert.deepEqual(await ngn(f.merchant),{available:'9840000',reserved:'160000'});
});
test('intent creation rollback includes journals, holds, events, outbox and idempotency',async()=>{
  const f=await fixture({beforeIntentCommit:async()=>{throw new Error('Injected transaction failure');}}),q=await f.quote();
  const response=await f.post('/v1/intents',{quote_id:q.id,customer_id:f.customer.id,destination_instrument_id:f.destination.id,reference:'rollback'},'rollback-key');
  assert.equal(response.statusCode,500);
  assert.deepEqual(await ngn(f.merchant),{available:'10000000',reserved:'0'});
  assert.equal((await pool.query('SELECT count(*)::int n FROM intents WHERE merchant_id=$1',[f.merchant])).rows[0].n,0);
  assert.equal((await pool.query('SELECT count(*)::int n FROM holds WHERE merchant_id=$1',[f.merchant])).rows[0].n,0);
  assert.equal((await pool.query('SELECT count(*)::int n FROM events WHERE merchant_id=$1',[f.merchant])).rows[0].n,0);
  assert.equal((await pool.query("SELECT count(*)::int n FROM idempotency WHERE merchant_id=$1 AND key='rollback-key'",[f.merchant])).rows[0].n,0);
});
test('quotes cannot be reused across intents and expired quotes cannot reserve funds',async()=>{
  const f=await fixture(),q=await f.quote(),payload={quote_id:q.id,customer_id:f.customer.id,destination_instrument_id:f.destination.id,reference:'first'};
  assert.equal((await f.post('/v1/intents',payload)).statusCode,201);
  assert.equal((await f.post('/v1/intents',{...payload,reference:'second'})).statusCode,409);
  const expired=id('qte');
  await pool.query("INSERT INTO quotes(id,merchant_id,source_asset,destination_asset,source_minor,destination_minor,fee_minor,route,expires_at) SELECT $1,merchant_id,source_asset,destination_asset,source_minor,destination_minor,fee_minor,route,now()-interval '1 minute' FROM quotes WHERE id=$2",[expired,q.id]);
  const response=await f.post('/v1/intents',{...payload,quote_id:expired});assert.equal(response.statusCode,422);assert.equal(response.json().error.code,'quote_expired');
});
test('compliance holds, transaction limits, destination mismatch and insufficient funds block intent writes',async()=>{
  const f=await fixture(),q=await f.quote();
  const payload={quote_id:q.id,customer_id:f.customer.id,destination_instrument_id:f.destination.id,reference:'controls'};
  await pool.query("UPDATE customers SET verification_state='held' WHERE id=$1",[f.customer.id]);assert.equal((await f.post('/v1/intents',payload)).json().error.code,'compliance_hold');
  await pool.query("UPDATE customers SET verification_state='sandbox_verified' WHERE id=$1",[f.customer.id]);
  const local=await f.instrument('KES');assert.equal((await f.post('/v1/intents',{...payload,destination_instrument_id:local.id})).json().error.code,'asset_mismatch');
  await pool.query('UPDATE merchants SET max_source_minor=100 WHERE id=$1',[f.merchant]);assert.equal((await f.post('/v1/intents',payload)).json().error.code,'limit_exceeded');
  await pool.query('UPDATE merchants SET max_source_minor=1000000000000 WHERE id=$1',[f.merchant]);
  const large=await f.post('/v1/quotes',{source_asset:'NGN',destination_asset:'USDC',amount_minor:'20000000'});
  assert.equal((await f.post('/v1/intents',{...payload,quote_id:large.json().id})).json().error.code,'insufficient_funds');
  await pool.query('UPDATE merchants SET enabled=false WHERE id=$1',[f.merchant]);assert.equal((await f.post('/v1/intents',payload)).json().error.code,'merchant_disabled');
  assert.deepEqual(await ngn(f.merchant),{available:'10000000',reserved:'0'});
});
test('successful execution matches a receipt and journals both assets before emitting success',async()=>{
  const f=await fixture(),i=await f.intent();assert.equal(await runOnce({onlyIntent:i.id}),true);
  const result=(await f.get(`/v1/intents/${i.id}`)).json();assert.equal(result.state,'succeeded');assert.equal(result.history.at(-1).state,'succeeded');
  assert.deepEqual(await ngn(f.merchant),{available:'9840000',reserved:'0'});
  const ins=await instruction(i.id);assert.equal(ins.state,'confirmed');
  assert.equal((await pool.query('SELECT count(*)::int n FROM receipts WHERE instruction_id=$1',[ins.id])).rows[0].n,1);
  const destination=(await pool.query("SELECT a.asset,e.amount::text,e.side FROM ledger_entries e JOIN journals j ON j.id=e.journal_id JOIN ledger_accounts a ON a.id=e.account_id WHERE j.reference=$1 ORDER BY e.side",[`destination:${i.id}`])).rows;
  assert.equal(destination.length,2);assert.ok(destination.every(e=>e.asset==='USDC'&&e.amount==='995000'));
  assert.equal((await pool.query('SELECT processed_at IS NOT NULL done FROM outbox WHERE intent_id=$1',[i.id])).rows[0].done,true);
  // Mutation retry returns the original snapshot even after the resource advances.
  assert.equal(await processIntent(i.id),'terminal');
  assert.equal((await pool.query('SELECT count(*)::int n FROM fake_provider_movements WHERE instruction_id=$1',[ins.id])).rows[0].n,1);
});
test('worker releases an expired quote before any provider submission',async()=>{
  const f=await fixture(),i=await f.intent();
  await runOnce({onlyIntent:i.id,clock:()=>new Date(Date.now()+600000)});
  assert.equal((await f.get(`/v1/intents/${i.id}`)).json().state,'failed');
  assert.equal(await instruction(i.id),undefined);
  assert.deepEqual(await ngn(f.merchant),{available:'10000000',reserved:'0'});
});
test('quote expiry between instruction preparation and sending also releases unsent funds',async()=>{
  const f=await fixture(),i=await f.intent();let expired=false;
  await runOnce({onlyIntent:i.id,clock:()=>new Date(Date.now()+(expired?600000:0)),checkpoint:async point=>{if(point==='instruction_committed')expired=true;}});
  const ins=await instruction(i.id);assert.equal(ins.state,'rejected');
  assert.equal((await f.get(`/v1/intents/${i.id}`)).json().state,'failed');
  assert.equal((await pool.query('SELECT count(*)::int n FROM fake_provider_movements WHERE instruction_id=$1',[ins.id])).rows[0].n,0);
  assert.deepEqual(await ngn(f.merchant),{available:'10000000',reserved:'0'});
});
test('known provider acceptance is reconciled even if its quote expires during recovery',async()=>{
  const f=await fixture(),i=await f.intent('timeout');await runOnce({onlyIntent:i.id});await ready(i.id);
  await runOnce({onlyIntent:i.id,clock:()=>new Date(Date.now()+600000)});
  assert.equal((await f.get(`/v1/intents/${i.id}`)).json().state,'succeeded');
  assert.deepEqual(await ngn(f.merchant),{available:'9840000',reserved:'0'});
});
test('expired quote after a possible submission cannot release funds or trigger a resend',async()=>{
  const f=await fixture(),i=await f.intent();
  await assert.rejects(processIntent(i.id,{checkpoint:async point=>{if(point==='before_provider_call')throw new Error('Possible submission');}}));
  let sends=0;const connector=new FakeConnector();
  await processIntent(i.id,{clock:()=>new Date(Date.now()+600000),connector:{id:connector.id,capabilities:connector.capabilities,idempotentInstructions:true,fetchStatus:async()=>null,payout:async()=>{sends++;throw new Error('Do not send an expired quote');}}});
  assert.equal(sends,0);assert.equal((await f.get(`/v1/intents/${i.id}`)).json().state,'unknown');
  assert.deepEqual(await ngn(f.merchant),{available:'9840000',reserved:'160000'});
});
test('asset purchase and redemption use the same engine with direction validation',async()=>{
  const f=await fixture(),q=await f.quote();
  const purchase=await f.post('/v1/intents',{quote_id:q.id,customer_id:f.customer.id,destination_instrument_id:f.destination.id,type:'asset_purchase',reference:'purchase'});
  assert.equal(purchase.statusCode,201);await runOnce({onlyIntent:purchase.json().id});assert.equal((await f.get(`/v1/intents/${purchase.json().id}`)).json().state,'succeeded');
  await sandboxFund(f.merchant,'USDC','1000000',`${f.merchant}:USDC-fund`);
  const local=await f.instrument('NGN'),redemptionQuote=await f.post('/v1/quotes',{source_asset:'USDC',destination_asset:'NGN',amount_minor:'1000000'});
  const payload={quote_id:redemptionQuote.json().id,customer_id:f.customer.id,destination_instrument_id:local.id,type:'asset_redemption',reference:'redeem'};
  assert.equal((await f.post('/v1/intents',{...payload,type:'asset_purchase'})).statusCode,422);
  const redemption=await f.post('/v1/intents',payload);assert.equal(redemption.statusCode,201);await runOnce({onlyIntent:redemption.json().id});assert.equal((await f.get(`/v1/intents/${redemption.json().id}`)).json().state,'succeeded');
});
test('concurrent worker instances can contend for one job without duplicate instructions',async()=>{
  const f=await fixture(),i=await f.intent();await Promise.all(Array.from({length:6},()=>runOnce({onlyIntent:i.id})));
  assert.equal((await f.get(`/v1/intents/${i.id}`)).json().state,'succeeded');
  const ins=await instruction(i.id);assert.equal((await pool.query('SELECT count(*)::int n FROM fake_provider_movements WHERE instruction_id=$1',[ins.id])).rows[0].n,1);
});
test('ambiguous timeout retains funds and resolves through status without a new instruction',async()=>{
  const f=await fixture(),i=await f.intent('timeout');await runOnce({onlyIntent:i.id});
  assert.equal((await f.get(`/v1/intents/${i.id}`)).json().state,'unknown');assert.deepEqual(await ngn(f.merchant),{available:'9840000',reserved:'160000'});
  const ins=await instruction(i.id);const connector=new FakeConnector();
  await ready(i.id);await runOnce({onlyIntent:i.id,connector:{id:connector.id,capabilities:connector.capabilities,idempotentInstructions:true,fetchStatus:key=>connector.fetchStatus(key),payout:async()=>{throw new Error('Recovery must not resend a confirmed instruction');}}});
  assert.equal((await f.get(`/v1/intents/${i.id}`)).json().state,'succeeded');
  assert.equal((await instruction(i.id)).id,ins.id);
  assert.equal((await pool.query('SELECT state FROM reconciliation_items WHERE intent_id=$1',[i.id])).rows[0].state,'resolved');
});
test('confirmed provider rejection releases the hold and emits a failed event',async()=>{
  const f=await fixture(),i=await f.intent('insufficient_float');await runOnce({onlyIntent:i.id});
  assert.equal((await f.get(`/v1/intents/${i.id}`)).json().state,'failed');assert.deepEqual(await ngn(f.merchant),{available:'10000000',reserved:'0'});
  const events=(await f.get('/v1/events')).json().data;assert.ok(events.some((e:{type:string})=>e.type==='intent.failed'));
});
test('cancellation releases funds before execution and is blocked after submission',async()=>{
  const f=await fixture(),i=await f.intent();const canceled=await f.post(`/v1/intents/${i.id}/cancel`,{});assert.equal(canceled.statusCode,200);assert.equal(canceled.json().state,'canceled');
  assert.deepEqual(await ngn(f.merchant),{available:'10000000',reserved:'0'});assert.equal(await runOnce({onlyIntent:i.id}),false);
  const unknown=await f.intent('timeout');await runOnce({onlyIntent:unknown.id});assert.equal((await f.post(`/v1/intents/${unknown.id}/cancel`,{})).statusCode,409);
});
test('worker rechecks disabled merchants before sending and keeps funds reserved',async()=>{
  const f=await fixture(),i=await f.intent();await pool.query('UPDATE merchants SET enabled=false WHERE id=$1',[f.merchant]);await runOnce({onlyIntent:i.id});
  assert.equal(await instruction(i.id),undefined);assert.deepEqual(await ngn(f.merchant),{available:'9840000',reserved:'160000'});
  await pool.query('UPDATE merchants SET enabled=true WHERE id=$1',[f.merchant]);await ready(i.id);await runOnce({onlyIntent:i.id});assert.equal((await f.get(`/v1/intents/${i.id}`)).json().state,'succeeded');
});
test('receipt mismatch cannot capture funds or create a success event',async()=>{
  const f=await fixture(),i=await f.intent(),connector=new FakeConnector();
  await runOnce({onlyIntent:i.id,connector:{id:connector.id,capabilities:connector.capabilities,idempotentInstructions:true,fetchStatus:key=>connector.fetchStatus(key),payout:async req=>{const status=await connector.payout(req);return {...status,evidence:{...status.evidence!,destination_minor:'1'}};}}});
  assert.equal((await f.get(`/v1/intents/${i.id}`)).json().state,'unknown');assert.deepEqual(await ngn(f.merchant),{available:'9840000',reserved:'160000'});
  assert.equal((await pool.query('SELECT count(*)::int n FROM receipts WHERE instruction_id=$1',[(await instruction(i.id)).id])).rows[0].n,0);
  await ready(i.id);await runOnce({onlyIntent:i.id});assert.equal((await f.get(`/v1/intents/${i.id}`)).json().state,'succeeded');
});
test('settlement rollback preserves the reservation and emits no premature success',async()=>{
  const f=await fixture(),i=await f.intent();
  await assert.rejects(processIntent(i.id,{checkpoint:async p=>{if(p==='before_settlement_commit')throw new Error('Settlement fault');}}),/Settlement fault/);
  assert.equal((await f.get(`/v1/intents/${i.id}`)).json().state,'processing');assert.deepEqual(await ngn(f.merchant),{available:'9840000',reserved:'160000'});
  const ins=await instruction(i.id);assert.equal((await pool.query('SELECT count(*)::int n FROM receipts WHERE instruction_id=$1',[ins.id])).rows[0].n,0);
  assert.equal((await pool.query("SELECT count(*)::int n FROM events WHERE intent_id=$1 AND type='intent.succeeded'",[i.id])).rows[0].n,0);
  await runOnce({onlyIntent:i.id});assert.equal((await f.get(`/v1/intents/${i.id}`)).json().state,'succeeded');
});
test('non-idempotent provider with no known outcome stays unknown without a resend',async()=>{
  const f=await fixture(),i=await f.intent();
  await assert.rejects(processIntent(i.id,{checkpoint:async p=>{if(p==='before_provider_call')throw new Error('Lost execution context');}}));
  let sends=0;
  await processIntent(i.id,{connector:{id:'non-idempotent-fixture',capabilities:['payout','status'],idempotentInstructions:false,fetchStatus:async()=>null,payout:async()=>{sends++;throw new Error('Must not send');}}});
  assert.equal(sends,0);assert.equal((await f.get(`/v1/intents/${i.id}`)).json().state,'unknown');assert.deepEqual(await ngn(f.merchant),{available:'9840000',reserved:'160000'});
});
test('authenticated duplicate callbacks settle once; wrong amounts, issuers and signatures are rejected',async()=>{
  const f=await fixture(),i=await f.intent('timeout');await runOnce({onlyIntent:i.id});const ins=await instruction(i.id);
  const status=(await new FakeConnector().fetchStatus(ins.id))!;
  const callback=async(value:ProviderStatus,signature?:string)=>{const body=JSON.stringify(value);return f.app.inject({method:'POST',url:'/internal/providers/fake/callback',headers:{'content-type':'application/json','kora-signature':signature??signWebhook(body,process.env.KORA_PROVIDER_CALLBACK_SECRET!)},payload:body});};
  assert.equal((await callback(status,'invalid')).statusCode,401);
  assert.equal((await callback({...status,evidence:{...status.evidence!,destination_minor:'999999'}})).statusCode,422);
  assert.equal((await callback({...status,evidence:{...status.evidence!,destination_identity:{...status.evidence!.destination_identity,issuer:'wrong-issuer'}}})).statusCode,422);
  assert.equal((await callback({...status,evidence:{...status.evidence!,destination_identity:{...status.evidence!.destination_identity,network:'public'}}})).statusCode,422);
  const responses=await Promise.all([callback(status),callback(status),callback(status)]);assert.ok(responses.every(r=>r.statusCode===200));
  assert.equal((await f.get(`/v1/intents/${i.id}`)).json().state,'succeeded');
  assert.equal((await pool.query('SELECT count(*)::int n FROM receipts WHERE instruction_id=$1',[ins.id])).rows[0].n,1);
  assert.equal((await pool.query("SELECT count(*)::int n FROM events WHERE intent_id=$1 AND type='intent.succeeded'",[i.id])).rows[0].n,1);
});
for(const point of ['instruction_committed','before_provider_call','provider_accepted','before_settlement_commit','settlement_committed'] as Checkpoint[])test(`worker process death at ${point} recovers one payment and one settlement`,async()=>{
  const f=await fixture(),i=await f.intent();
  await new Promise<void>((resolve,reject)=>{
    const child=spawn(process.execPath,['--import','tsx','scripts/engine-crash-fixture.ts',i.id,point],{cwd:process.cwd(),stdio:['ignore','pipe','pipe']});let stderr='';
    child.stderr.on('data',b=>{stderr+=b.toString();});child.on('error',reject);child.on('close',code=>code===73?resolve():reject(new Error(`Crash fixture exited ${code}: ${stderr}`)));
  });
  const original=await instruction(i.id);assert.ok(original);await runOnce({onlyIntent:i.id});
  assert.equal((await f.get(`/v1/intents/${i.id}`)).json().state,'succeeded');assert.equal((await instruction(i.id)).id,original.id);
  for(const table of ['fake_provider_movements','receipts'])assert.equal((await pool.query(`SELECT count(*)::int n FROM ${table} WHERE instruction_id=$1`,[original.id])).rows[0].n,1);
  assert.equal((await pool.query("SELECT count(*)::int n FROM journals WHERE reference=$1",[`capture:${(await pool.query('SELECT hold_id FROM intents WHERE id=$1',[i.id])).rows[0].hold_id}`])).rows[0].n,1);
  assert.deepEqual(await ngn(f.merchant),{available:'9840000',reserved:'0'});
});
test('pagination is stable and tenant-scoped, and invalid cursors fail clearly',async()=>{
  const f=await fixture();for(let n=0;n<4;n++)await f.post('/v1/customers',{name:`Page ${n}`});
  const first=(await f.get('/v1/customers?limit=2')).json();assert.equal(first.data.length,2);assert.equal(first.has_more,true);assert.ok(first.next_cursor);
  const second=(await f.get(`/v1/customers?limit=2&after=${first.next_cursor}`)).json();assert.equal(second.data.length,2);assert.equal(new Set([...first.data,...second.data].map(c=>c.id)).size,4);
  assert.equal((await f.get('/v1/customers?after=broken')).statusCode,400);
});
test('signed webhook delivery encrypts secrets, retries failures, and replays a stable event ID',async()=>{
  const f=await fixture();let receiverSecret='',fail=true;const received:{id:string;verified:boolean;type:string}[]=[];
  const server=createServer(async(req,res)=>{let body='';for await(const c of req)body+=c.toString();const event=JSON.parse(body);received.push({id:event.id,type:event.type,verified:verifyWebhook(body,String(req.headers['kora-signature']),receiverSecret)});res.writeHead(fail?500:204).end();});servers.push(server);
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address==='object');const origin=`http://127.0.0.1:${address.port}`;
  process.env.KORA_WEBHOOK_ALLOWED_ORIGINS=origin;
  const endpoint=await f.post('/v1/webhook_endpoints',{url:`${origin}/events`},'webhook-create');assert.equal(endpoint.statusCode,201,endpoint.body);receiverSecret=endpoint.json().secret;
  const replay=await f.post('/v1/webhook_endpoints',{url:`${origin}/events`},'webhook-create');assert.equal(replay.json().secret,receiverSecret);
  const stored=(await pool.query('SELECT secret FROM webhook_endpoints WHERE id=$1',[endpoint.json().id])).rows[0].secret;assert.ok(stored.startsWith('enc:v1:'));assert.equal(stored.includes(receiverSecret),false);
  const cache=(await pool.query("SELECT response FROM idempotency WHERE merchant_id=$1 AND key='webhook-create'",[f.merchant])).rows[0];assert.equal(JSON.stringify(cache).includes(receiverSecret),false);
  assert.equal(JSON.stringify((await f.get('/v1/webhook_endpoints')).json()).includes(receiverSecret),false);
  const i=await f.intent();await deliverOne({onlyMerchant:f.merchant});assert.equal(received.length,1);assert.equal(received[0].verified,true);
  let delivery=(await f.get('/v1/webhook_deliveries')).json().data[0];assert.equal(delivery.state,'pending');assert.equal(delivery.attempts,1);assert.equal(delivery.last_error,'http_500');
  fail=false;await pool.query('UPDATE webhook_deliveries SET next_attempt_at=now() WHERE endpoint_id=$1',[endpoint.json().id]);await deliverOne({onlyMerchant:f.merchant});
  assert.equal(received[1].id,received[0].id);delivery=(await f.get('/v1/webhook_deliveries')).json().data[0];assert.equal(delivery.state,'delivered');assert.equal(delivery.attempts,2);
  assert.equal((await f.post(`/v1/events/${received[0].id}/replay`,{})).statusCode,202);await deliverOne({onlyMerchant:f.merchant});assert.equal(received[2].id,received[0].id);
  await runOnce({onlyIntent:i.id});await deliverOne({onlyMerchant:f.merchant});assert.equal(received.at(-1)?.type,'intent.succeeded');assert.ok(received.every(e=>e.verified));
  assert.equal((await f.post(`/v1/webhook_endpoints/${endpoint.json().id}/disable`,{})).json().active,false);
});
test('webhook origin validation blocks unconfigured destinations and redirects are not followed',async()=>{
  const f=await fixture();process.env.KORA_WEBHOOK_ALLOWED_ORIGINS='http://127.0.0.1:4311';
  for(const url of ['http://169.254.169.254/latest','http://127.0.0.1:55432','https://user:pass@example.com/events'])assert.equal((await f.post('/v1/webhook_endpoints',{url})).statusCode,422);
  let secondHits=0;
  const server=createServer((req,res)=>{if(req.url==='/redirect')res.writeHead(302,{location:'/target'}).end();else{secondHits++;res.writeHead(204).end();}});servers.push(server);
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address==='object');const origin=`http://127.0.0.1:${address.port}`;process.env.KORA_WEBHOOK_ALLOWED_ORIGINS=origin;
  assert.equal((await f.post('/v1/webhook_endpoints',{url:`${origin}/redirect`})).statusCode,201);await f.intent();await deliverOne({onlyMerchant:f.merchant});assert.equal(secondHits,0);assert.equal((await f.get('/v1/webhook_deliveries')).json().data[0].last_error,'http_302');
});
test('immutable evidence and state guards remain enforced in PostgreSQL',async()=>{
  const f=await fixture(),i=await f.intent();await runOnce({onlyIntent:i.id});
  await assert.rejects(pool.query("UPDATE intents SET state='processing' WHERE id=$1",[i.id]),/Invalid intent state transition/);
  await assert.rejects(pool.query("UPDATE intents SET source_minor=1 WHERE id=$1",[i.id]),/immutable/);
  await assert.rejects(pool.query("UPDATE receipts SET payload='{}'::jsonb WHERE instruction_id=$1",[(await instruction(i.id)).id]),/immutable/);
  await assert.rejects(pool.query("UPDATE instructions SET request='{}'::jsonb WHERE intent_id=$1",[i.id]),/immutable/);
  await assert.rejects(pool.query("UPDATE instructions SET state='submitting' WHERE intent_id=$1",[i.id]),/Invalid provider instruction transition/);
  await assert.rejects(pool.query("UPDATE holds SET amount=1 WHERE id=(SELECT hold_id FROM intents WHERE id=$1)",[i.id]),/immutable/);
  assert.deepEqual(await invariantReport(),{balanced:true,nonnegative:true,no_empty_journals:true,violations:[]});
});
