import { pool, id } from '../packages/database/src/index.js';
import { createMerchant, sandboxFund, reserve, capture, balances, invariantReport } from '../packages/ledger/src/index.js';
import { FakeConnector } from '../connectors/fake/src/index.js';
import { ProviderError } from '../packages/provider-sdk/src/index.js';

try {
  const merchant = id('mcht');
  await createMerchant(merchant, 'Kora sandbox demonstration');
  await sandboxFund(merchant, 'NGN', '10000000', `demo:${merchant}:fund`);
  const hold = await reserve(merchant, 'NGN', '2500000', `demo:${merchant}:payout`);
  const connector = new FakeConnector();
  const instruction = id('ins');
  console.log('Kora · financial core · sandbox');
  console.log('Funded NGN 100,000; reserved NGN 25,000.');
  try {
    await connector.payout({ instruction_id: instruction, hold_id: hold.id, asset: 'NGN', amount_minor: '2487500', fee_minor: '12500', beneficiary: 'Sandbox beneficiary', scenario: 'timeout' });
  } catch (error) {
    if (!(error instanceof ProviderError) || !error.ambiguous) throw error;
    console.log('Acknowledgement lost. Querying status without resending.');
  }
  const status = await new FakeConnector().fetchStatus(instruction);
  if (status?.outcome !== 'confirmed') throw new Error('Unable to confirm settlement');
  await capture(hold.id, '12500');
  console.log('Confirmed one simulated payout; captured principal and explicit NGN 125 fee.');
  console.table(await balances(merchant));
  const report = await invariantReport();
  console.log('Ledger invariants:', report);
  if (report.violations.length) process.exitCode = 1;
} catch (error) { console.error(error); process.exitCode = 1; }
finally { await pool.end(); }
