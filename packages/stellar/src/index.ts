import { recordUsage } from '../../controls/src/index.js';
import { createHash } from 'node:crypto';
import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { StellarTestnetConnector, units } from '../../../connectors/stellar/src/index.js';
import { id, type Client } from '../../database/src/index.js';
import {
  postJournal,
  accountId,
  reserveInTransaction,
  captureInTransaction,
} from '../../ledger/src/index.js';
import { assertEnabled, createIntent, publicIntent } from '../../payments/src/index.js';
import { PaymentError } from '../../payments/src/errors.js';
async function emitStellar(c: Client, m: string, type: string, data: unknown) {
  const eid = id('evt');
  await c.query('INSERT INTO events(id,merchant_id,type,data) VALUES($1,$2,$3,$4)', [
    eid,
    m,
    type,
    data,
  ]);
  await c.query(
    "INSERT INTO webhook_deliveries(id,endpoint_id,event_id) SELECT $1||'_'||id,id,$2 FROM webhook_endpoints WHERE merchant_id=$3 AND active=true ON CONFLICT DO NOTHING",
    [id('dlv'), eid, m],
  );
}
export function accountChallenge(
  merchant: string,
  customer: string,
  address: string,
  connector: StellarTestnetConnector,
) {
  if (!StrKey.isValidEd25519PublicKey(address))
    throw new PaymentError(422, 'invalid_address', 'Use a Stellar G address');
  return createHash('sha256')
    .update(`Kora Testnet account:${merchant}:${customer}:${address}:${connector.binding}`)
    .digest();
}
async function allowed(c: Client, m: string, customer: string) {
  await assertEnabled(c, m);
  const row = (
    await c.query(
      'SELECT verification_state FROM customers WHERE id=$1 AND merchant_id=$2 FOR SHARE',
      [customer, m],
    )
  ).rows[0];
  if (!row) throw new PaymentError(404, 'customer_not_found', 'Customer not found');
  if (row.verification_state !== 'sandbox_verified')
    throw new PaymentError(422, 'compliance_hold', 'Customer is held');
}
export async function registerStellarAccount(
  c: Client,
  m: string,
  customer: string,
  connector: StellarTestnetConnector,
  input: { address: string; signature: string; label: string },
) {
  await allowed(c, m, customer);
  if (!StrKey.isValidEd25519PublicKey(input.address))
    throw new PaymentError(422, 'invalid_address', 'Use a Stellar G address');
  if (input.address === connector.config.treasury || input.address === connector.config.issuer)
    throw new PaymentError(422, 'invalid_address', 'Choose a customer account');
  if (
    !/^[a-f0-9]{128}$/.test(input.signature) ||
    !Keypair.fromPublicKey(input.address).verify(
      accountChallenge(m, customer, input.address, connector),
      Buffer.from(input.signature, 'hex'),
    )
  )
    throw new PaymentError(
      422,
      'ownership_proof_required',
      'Sign the account challenge with the customer wallet',
    );
  await connector.trustline(input.address);
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
    `stellar-address:${input.address}:${connector.binding}`,
  ]);
  const existing = (
    await c.query('SELECT * FROM stellar_accounts WHERE address=$1 AND binding=$2', [
      input.address,
      connector.binding,
    ])
  ).rows[0];
  if (existing) {
    if (existing.merchant_id !== m || existing.customer_id !== customer)
      throw new PaymentError(409, 'account_claimed', 'Account already registered');
    return existing;
  }
  const instrument = id('insm');
  await c.query(
    "INSERT INTO instruments(id,merchant_id,customer_id,type,asset,label,sandbox_identifier,verified) VALUES($1,$2,$3,'stellar_account','KUSD',$4,$5,true)",
    [instrument, m, customer, input.label, `testnet:${input.address}`],
  );
  return (
    await c.query(
      "INSERT INTO stellar_accounts(instrument_id,merchant_id,customer_id,address,issuer,network,asset_code,binding) VALUES($1,$2,$3,$4,$5,'testnet','KUSD',$6) RETURNING *",
      [instrument, m, customer, input.address, connector.config.issuer, connector.binding],
    )
  ).rows[0];
}
export async function purchase(
  c: Client,
  m: string,
  connector: StellarTestnetConnector,
  input: {
    customer_id: string;
    destination_instrument_id: string;
    amount_minor: string;
    reference: string;
  },
) {
  await allowed(c, m, input.customer_id);
  const account = (
    await c.query(
      'SELECT * FROM stellar_accounts WHERE instrument_id=$1 AND merchant_id=$2 AND customer_id=$3',
      [input.destination_instrument_id, m, input.customer_id],
    )
  ).rows[0];
  if (!account || account.binding !== connector.binding)
    throw new PaymentError(
      422,
      'stellar_account_required',
      'A wallet verified under the current issuer configuration is required',
    );
  const gross = BigInt(input.amount_minor),
    fee = (gross * 50n + 9999n) / 10000n,
    amount = ((gross - fee) * 10000000n) / 160000n;
  if (amount <= 0n) throw new PaymentError(422, 'invalid_amount', 'Amount is too small');
  await connector.trustline(account.address, amount);
  await connector.trustline(connector.config.treasury, amount, true);
  const quote = (
    await c.query(
      "INSERT INTO quotes(id,merchant_id,provider,source_asset,destination_asset,source_minor,destination_minor,fee_minor,route,expires_at) VALUES($1,$2,'stellar-testnet','NGN','KUSD',$3,$4,$5,$6,now()+interval '5 minutes') RETURNING *",
      [
        id('qte'),
        m,
        gross.toString(),
        amount.toString(),
        fee.toString(),
        JSON.stringify([
          {
            name: 'Fixture FX: 1600 NGN per KUSD',
            rail: 'Testnet staging liquidity',
            asset: 'NGN',
          },
          {
            name: `KUSD issuer ${connector.config.issuer}`,
            rail: 'Stellar Testnet',
            asset: 'KUSD',
          },
        ]),
      ],
    )
  ).rows[0];
  return publicIntent(
    await createIntent(c, m, {
      quote_id: quote.id,
      customer_id: input.customer_id,
      destination_instrument_id: account.instrument_id,
      type: 'asset_purchase',
      reference: input.reference,
      scenario: 'success',
    }),
  );
}
export async function deposit(
  c: Client,
  m: string,
  connector: StellarTestnetConnector,
  input: { customer_id: string; instrument_id: string; transaction_hash: string },
) {
  await allowed(c, m, input.customer_id);
  const account = (
    await c.query(
      'SELECT * FROM stellar_accounts WHERE instrument_id=$1 AND merchant_id=$2 AND customer_id=$3',
      [input.instrument_id, m, input.customer_id],
    )
  ).rows[0];
  if (!account || account.binding !== connector.binding)
    throw new PaymentError(
      422,
      'stellar_account_required',
      'A verified customer wallet is required',
    );
  const result = await connector.transaction(input.transaction_hash);
  if (!result?.record.successful)
    throw new PaymentError(
      422,
      'deposit_not_confirmed',
      'A successful Testnet transaction is required',
    );
  const op = result.tx.operations[0];
  if (
    result.tx.operations.length !== 1 ||
    op.type !== 'payment' ||
    (op.source ?? result.tx.source) !== account.address ||
    op.destination !== connector.config.treasury ||
    op.asset.code !== 'KUSD' ||
    op.asset.issuer !== connector.config.issuer
  )
    throw new PaymentError(
      422,
      'deposit_mismatch',
      'Deposit must be one KUSD payment from the registered customer to treasury',
    );
  const amount = units(op.amount).toString();
  if (BigInt(amount) <= 0n)
    throw new PaymentError(422, 'deposit_mismatch', 'Deposit amount must be positive');
  await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
    `stellar-deposit:${input.transaction_hash}`,
  ]);
  const existing = (
    await c.query('SELECT * FROM stellar_deposits WHERE transaction_hash=$1', [
      input.transaction_hash,
    ])
  ).rows[0];
  if (existing) {
    if (existing.merchant_id !== m || existing.customer_id !== input.customer_id)
      throw new PaymentError(409, 'deposit_claimed', 'Deposit already attributed');
    return existing;
  }
  // Deposits cannot also be consumed as an outbound settlement receipt.
  if (
    (
      await c.query('SELECT 1 FROM stellar_transactions WHERE transaction_hash=$1', [
        input.transaction_hash,
      ])
    ).rowCount
  )
    throw new PaymentError(422, 'deposit_mismatch', 'Outbound transactions cannot fund a deposit');
  const journal = await postJournal(c, {
    reference: `stellar-deposit:${input.transaction_hash}`,
    description: 'Verified KUSD Testnet deposit',
    entries: [
      { account_id: accountId(m, 'KUSD', 'available'), side: 'debit', amount },
      { account_id: accountId(null, 'KUSD', 'clearing'), side: 'credit', amount },
    ],
  });
  const row = (
    await c.query(
      'INSERT INTO stellar_deposits(id,merchant_id,customer_id,instrument_id,transaction_hash,amount_minor,journal_id,evidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [
        id('sdep'),
        m,
        input.customer_id,
        account.instrument_id,
        input.transaction_hash,
        amount,
        journal,
        {
          network: 'testnet',
          issuer: connector.config.issuer,
          code: 'KUSD',
          source: account.address,
          destination: connector.config.treasury,
          ledger: result.record.ledger,
          fee_stroops: result.record.fee_charged,
        },
      ],
    )
  ).rows[0];
  await emitStellar(c, m, 'stellar.deposit_confirmed', row);
  return row;
}
export async function redeem(c: Client, m: string, input: { amount_minor: string }) {
  const merchant = await assertEnabled(c, m);
  if (BigInt(input.amount_minor) > BigInt(merchant.max_source_minor))
    throw new PaymentError(
      422,
      'limit_exceeded',
      'Source amount exceeds the sandbox transaction limit',
    );
  const amount = BigInt(input.amount_minor),
    ngn = (amount * 160000n) / 10000000n;
  if (ngn <= 0n) throw new PaymentError(422, 'invalid_amount', 'Redemption is too small');
  const resource = id('sred');
  await recordUsage(c, m, 'KUSD', amount.toString(), resource);
  const hold = await reserveInTransaction(
    c,
    m,
    'KUSD',
    amount.toString(),
    `stellar-redemption:${resource}`,
  );
  await captureInTransaction(c, hold.id);
  const journal = await postJournal(c, {
    reference: `stellar-redemption:${resource}`,
    description: 'Fixture liquidity conversion: KUSD to NGN, 1600 NGN per KUSD',
    entries: [
      { account_id: accountId(m, 'NGN', 'available'), side: 'debit', amount: ngn.toString() },
      { account_id: accountId(null, 'NGN', 'funding'), side: 'credit', amount: ngn.toString() },
    ],
  });
  const row = (
    await c.query(
      "INSERT INTO stellar_redemptions(id,merchant_id,hold_id,source_minor,destination_minor,journal_id,rate_basis) VALUES($1,$2,$3,$4,$5,$6,'fixture_1600_ngn_per_kusd') RETURNING *",
      [resource, m, hold.id, amount.toString(), ngn.toString(), journal],
    )
  ).rows[0];
  await emitStellar(c, m, 'stellar.redeemed', row);
  return row;
}
