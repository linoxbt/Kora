import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { Money, minor, parseAmount, calculateQuote, asset, canTransition, signWebhook, verifyWebhook } from '../packages/core/src/index.js';

test('money is exact beyond the JavaScript safe integer limit and serializes as strings', () => {
  const money = new Money('USDC', '9007199254740993');
  assert.equal(money.add(new Money('USDC', '1')).minor, 9007199254740994n);
  assert.equal(JSON.stringify(money), '{"asset":"USDC","minor":"9007199254740993"}');
  assert.ok(Object.isFrozen(money));
});
test('money rejects negative, fractional, noncanonical, oversized and unknown values', () => {
  for (const value of ['-1','1.2','01','1e6','NaN','','1'.repeat(25)]) assert.throws(() => minor(value));
  assert.throws(() => new Money('XYZ' as 'NGN', '1'));
  assert.throws(() => new Money('NGN', '1').sub(new Money('NGN', '2')));
});
test('money requires matching asset identities', () => {
  assert.throws(() => new Money('NGN', '10').add(new Money('KES', '10')), /Asset mismatch/);
  assert.throws(() => new Money('NGN', '10').cmp(new Money('USDC', '10')), /Asset mismatch/);
  assert.equal(asset('USDC').kind, 'stellar');
  assert.equal('issuer' in asset('USDC'), true);
});
test('arithmetic properties hold over 1,000 generated bigint pairs', () => {
  fc.assert(fc.property(fc.bigInt({min:0n,max:10n**20n}), fc.bigInt({min:0n,max:10n**20n}), (a,b) => {
    const x = new Money('NGN',a), y = new Money('NGN',b);
    assert.equal(x.add(y).minor, y.add(x).minor);
    assert.equal(x.add(y).sub(y).minor,a);
    assert.equal(x.cmp(y), a < b ? -1 : a > b ? 1 : 0);
    assert.equal(BigInt(JSON.parse(JSON.stringify(x)).minor),a);
  }), {numRuns:1000});
});
test('decimal parsing respects each asset scale without binary floating point', () => {
  assert.equal(parseAmount('123.45','NGN'),'12345');
  assert.equal(parseAmount('0.000001','USDC'),'1');
  assert.equal(parseAmount('9007199254740993.01','NGN'),'900719925474099301');
  assert.throws(() => parseAmount('0.001','NGN'));
  assert.throws(() => parseAmount('1e5','NGN'));
});
test('quotes round fees up and conversion down at declared sandbox rates', () => {
  assert.deepEqual(calculateQuote('NGN','USDC','160000'), {source_asset:'NGN',destination_asset:'USDC',source_minor:'160000',destination_minor:'995000',fee_minor:'800'});
  assert.equal(calculateQuote('USDC','KES','1000000').destination_minor,'12935');
  assert.throws(() => calculateQuote('NGN','NGN','1000'));
  assert.throws(() => calculateQuote('NGN','USDC','0'));
  assert.throws(() => calculateQuote('NGN','USDC','1'));
});
test('conversion conservatively delivers no more than the exact rational value', () => {
  fc.assert(fc.property(fc.bigInt({min:1000000n,max:10n**18n}), amount => {
    const quote=calculateQuote('NGN','KES',amount.toString());
    const fee=BigInt(quote.fee_minor), delivered=BigInt(quote.destination_minor);
    assert.ok(fee*10000n>=amount*50n);
    assert.ok((fee-1n)*10000n<amount*50n);
    const exactNumerator=(amount-fee)*130n;
    assert.ok(delivered*1600n<=exactNumerator);
    assert.ok((delivered+1n)*1600n>exactNumerator);
  }),{numRuns:1000});
});
test('unknown instructions require recovery and returned payouts remain first-class', () => {
  assert.ok(canTransition('processing','unknown'));
  assert.ok(canTransition('unknown','succeeded'));
  assert.ok(canTransition('succeeded','returned'));
  assert.equal(canTransition('unknown','processing'),false);
  assert.equal(canTransition('failed','succeeded'),false);
});
test('webhook helper rejects tampering, stale timestamps, future timestamps and malformed signatures', () => {
  const body='{"id":"evt_123"}', secret='fixture-secret', timestamp=1700000000;
  const signature=signWebhook(body,secret,timestamp);
  assert.ok(verifyWebhook(body,signature,secret,timestamp));
  assert.equal(verifyWebhook(body+' ',signature,secret,timestamp),false);
  assert.equal(verifyWebhook(body,signature,'wrong',timestamp),false);
  assert.equal(verifyWebhook(body,signature,secret,timestamp+301),false);
  assert.equal(verifyWebhook(body,signature,secret,timestamp-301),false);
  assert.equal(verifyWebhook(body,'t=broken,v1=a',secret,timestamp),false);
});
