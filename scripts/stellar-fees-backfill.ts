import { pool, transaction } from '../packages/database/src/index.js';
import { postJournal, accountId } from '../packages/ledger/src/index.js';
// Idempotent accounting repair for pre-fee-journal Phase 4 development receipts.
const rows = (
  await pool.query(
    "SELECT i.intent_id,r.payload->'stellar_data'->>'fee_stroops' fee FROM receipts r JOIN instructions i ON i.id=r.instruction_id WHERE i.provider='stellar-testnet' AND r.payload ? 'stellar_data' AND NOT EXISTS(SELECT 1 FROM journals j WHERE j.reference='stellar-fee:'||i.intent_id)",
  )
).rows;
for (const row of rows)
  if (BigInt(row.fee) > 0n)
    await transaction((c) =>
      postJournal(c, {
        reference: `stellar-fee:${row.intent_id}`,
        description: 'Verified Testnet transaction fee paid by treasury',
        entries: [
          { account_id: accountId(null, 'XLM', 'provider_fees'), side: 'debit', amount: row.fee },
          { account_id: accountId(null, 'XLM', 'funding'), side: 'credit', amount: row.fee },
        ],
      }),
    );
console.log('Stellar network fee journals reconciled');
await pool.end();
