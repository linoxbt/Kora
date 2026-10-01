import { Keypair, Networks, Transaction, TransactionBuilder } from '@stellar/stellar-sdk';
import { StellarTestnetConnector, LocalTestnetSigner } from '../connectors/stellar/src/index.js';
export function stellarHarness() {
  const issuer = Keypair.random(),
    treasury = Keypair.random(),
    customer = Keypair.random();
  const records = new Map<
    string,
    { hash: string; successful: boolean; ledger: number; envelope_xdr: string; fee_charged: string }
  >();
  const sequences = new Map<string, string>();
  let submissions = 0,
    statusUnavailable = false,
    dropAfterAccept = false,
    authorized = true,
    wrongIssuer = false,
    wrongNetwork = false,
    capacity = '1000000.0000000',
    success = true;
  const fake: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.origin !== 'https://horizon-testnet.stellar.org') throw new Error('Unexpected network');
    let body: unknown;
    if (url.pathname === '/')
      body = { network_passphrase: wrongNetwork ? Networks.PUBLIC : Networks.TESTNET };
    else if (url.pathname.startsWith('/accounts/')) {
      const account = url.pathname.split('/').at(-1)!;
      body = {
        account_id: account,
        sequence: sequences.get(account) ?? '100',
        balances: [
          {
            asset_type: 'credit_alphanum4',
            asset_code: 'KUSD',
            asset_issuer: wrongIssuer ? Keypair.random().publicKey() : issuer.publicKey(),
            balance: account === treasury.publicKey() ? '10000.0000000' : '100.0000000',
            limit: capacity,
            is_authorized: authorized,
            buying_liabilities: '0.0000000',
            selling_liabilities: '0.0000000',
          },
        ],
      };
    } else if (url.pathname === '/transactions' && init?.method === 'POST') {
      submissions++;
      const xdr = new URLSearchParams(String(init.body)).get('tx')!,
        tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET) as Transaction,
        hash = Buffer.from(tx.hash()).toString('hex');
      records.set(hash, {
        hash,
        successful: success,
        ledger: 1234,
        envelope_xdr: xdr,
        fee_charged: '1000',
      });
      sequences.set(tx.source, tx.sequence);
      body = records.get(hash);
      if (dropAfterAccept) {
        dropAfterAccept = false;
        statusUnavailable = true;
        throw new Error('Acknowledgement lost');
      }
    } else if (url.pathname.startsWith('/transactions/')) {
      if (statusUnavailable) throw new Error('Status unavailable');
      body = records.get(url.pathname.split('/').at(-1)!);
      if (!body) return new Response('{}', { status: 404 });
    } else throw new Error('Unknown Horizon route');
    return Response.json(body);
  };
  const connector = new StellarTestnetConnector({
    issuer: issuer.publicKey(),
    treasury: treasury.publicKey(),
    signer: new LocalTestnetSigner(treasury.secret(), issuer.publicKey()),
    fetch: fake,
  });
  return {
    issuer,
    treasury,
    customer,
    connector,
    records,
    get submissions() {
      return submissions;
    },
    set statusUnavailable(v: boolean) {
      statusUnavailable = v;
    },
    set dropAfterAccept(v: boolean) {
      dropAfterAccept = v;
    },
    set authorized(v: boolean) {
      authorized = v;
    },
    set wrongIssuer(v: boolean) {
      wrongIssuer = v;
    },
    set wrongNetwork(v: boolean) {
      wrongNetwork = v;
    },
    set capacity(v: string) {
      capacity = v;
    },
    set success(v: boolean) {
      success = v;
    },
  };
}
