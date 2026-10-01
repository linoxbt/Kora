import 'dotenv/config';
import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import {
  Asset,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
const file = new URL('../.sandbox/stellar-testnet.json', import.meta.url),
  envFile = new URL('../.env', import.meta.url);
let keys: { issuer: string; treasury: string; customer: string };
try {
  keys = JSON.parse(await readFile(file, 'utf8'));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  keys = {
    issuer: Keypair.random().secret(),
    treasury: Keypair.random().secret(),
    customer: Keypair.random().secret(),
  };
  await mkdir(new URL('../.sandbox/', import.meta.url), { recursive: true });
  await writeFile(file, JSON.stringify(keys), { mode: 0o600 });
}
const issuer = Keypair.fromSecret(keys.issuer),
  treasury = Keypair.fromSecret(keys.treasury),
  customer = Keypair.fromSecret(keys.customer),
  asset = new Asset('KUSD', issuer.publicKey());
const server = new Horizon.Server('https://horizon-testnet.stellar.org');
try {
  const root = await server.root();
  if (root.network_passphrase !== Networks.TESTNET) throw new Error('Wrong network');
  for (const key of [issuer, treasury, customer]) {
    try {
      await server.loadAccount(key.publicKey());
    } catch (error) {
      if ((error as { response?: { status?: number } }).response?.status !== 404) throw error;
      const r = await fetch(`https://friendbot.stellar.org?addr=${key.publicKey()}`, {
        redirect: 'error',
        signal: AbortSignal.timeout(30000),
      });
      if (!r.ok) throw new Error('Friendbot failed');
    }
  }
  async function send(key: Keypair, operations: ReturnType<typeof Operation.payment>[]) {
    const account = await server.loadAccount(key.publicKey());
    const tx = new TransactionBuilder(account, {
      fee: '1000',
      networkPassphrase: Networks.TESTNET,
    });
    for (const op of operations) tx.addOperation(op);
    const built = tx.setTimeout(300).build();
    built.sign(key);
    await server.submitTransaction(built);
  }
  for (const key of [treasury, customer]) {
    const account = await server.loadAccount(key.publicKey());
    if (
      !account.balances.some(
        (b) =>
          'asset_code' in b && b.asset_code === 'KUSD' && b.asset_issuer === issuer.publicKey(),
      )
    )
      await send(key, [Operation.changeTrust({ asset, limit: '1000000' })]);
  }
  const account = await server.loadAccount(treasury.publicKey());
  const line = account.balances.find(
    (b) => 'asset_code' in b && b.asset_code === 'KUSD' && b.asset_issuer === issuer.publicKey(),
  );
  if (!line || BigInt(line.balance.replace('.', '')) < 10000000000n)
    await send(issuer, [
      Operation.payment({ destination: treasury.publicKey(), asset, amount: '10000' }),
    ]);
  let env = await readFile(envFile, 'utf8');
  env = env.replace(/^STELLAR_TESTNET_(ISSUER|TREASURY_SECRET)=.*\n?/gm, '');
  await writeFile(
    envFile,
    env.trimEnd() +
      `\nSTELLAR_TESTNET_ISSUER=${issuer.publicKey()}\nSTELLAR_TESTNET_TREASURY_SECRET=${keys.treasury}\n`,
  );
  await chmod(envFile, 0o600);
  console.log(
    JSON.stringify(
      {
        network: 'testnet',
        asset: 'KUSD',
        name: 'Kora Test USD',
        issuer: issuer.publicKey(),
        treasury: treasury.publicKey(),
        customer: customer.publicKey(),
        secret_storage: '.sandbox/stellar-testnet.json (private)',
        partner_fx: false,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error('Stellar Testnet setup failed:', error instanceof Error ? error.name : 'Error');
  process.exitCode = 1;
}
