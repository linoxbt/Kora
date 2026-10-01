import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { PaymentError } from './errors.js';
function key() {
  const value = process.env.KORA_WEBHOOK_ENCRYPTION_KEY ?? '';
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length !== 32) throw new PaymentError(503, 'secrets_not_configured', 'Run pnpm sandbox:init to configure local encryption');
  return bytes;
}
export function seal(value: string) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['enc','v1',iv.toString('base64'),cipher.getAuthTag().toString('base64'),data.toString('base64')].join(':');
}
export function unseal(value: string) {
  const [prefix, version, iv, tag, data] = value.split(':');
  if (prefix !== 'enc' || version !== 'v1' || !iv || !tag || data === undefined) throw new Error('Invalid encrypted secret');
  const cipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv,'base64'));
  cipher.setAuthTag(Buffer.from(tag,'base64'));
  return Buffer.concat([cipher.update(Buffer.from(data,'base64')),cipher.final()]).toString('utf8');
}
