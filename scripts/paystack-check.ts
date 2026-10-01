import 'dotenv/config';
import { PaystackClient } from '../connectors/paystack/src/index.js';
// Read-only provider readiness check. Never initializes a charge or sends funds.
if (!PaystackClient.configured()) {
  console.error(
    'Paystack is not configured. Set PAYSTACK_SECRET_KEY to a test secret key in .env. Live keys are rejected.',
  );
  process.exitCode = 1;
} else {
  try {
    const client = PaystackClient.fromEnvironment();
    const banks = await client.banks(),
      balances = await client.balances(),
      snapshot = await client.statement();
    console.log(
      JSON.stringify(
        {
          provider: 'paystack-test',
          mode: 'test',
          read_only: true,
          banks: banks.filter((b) => b.active && b.currency === 'NGN').length,
          ngn_balance_available: balances.some((b) => b.currency === 'NGN'),
          statement_rows: snapshot.length,
          scope: 'provider_ledger_snapshot',
          payout_collection_validation: 'not_performed',
        },
        null,
        2,
      ),
    );
  } catch {
    console.error(
      'Paystack test-mode readiness failed. Check the key and provider access; no payment was sent.',
    );
    process.exitCode = 1;
  }
}
