import { randomBytes } from 'node:crypto';
import { readFile, writeFile, chmod } from 'node:fs/promises';
import { parse } from 'dotenv';
const path=new URL('../.env',import.meta.url);
let raw='';try{raw=await readFile(path,'utf8');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
const current=parse(raw);
if(current.KORA_MODE&&current.KORA_MODE!=='sandbox')throw new Error('Sandbox initialization cannot modify a non-sandbox environment');
const defaults={DATABASE_URL:'postgres://kora:kora_local_only@127.0.0.1:55432/kora',KORA_MODE:'sandbox',HOST:'127.0.0.1',PORT:'4310',
  KORA_WEBHOOK_ENCRYPTION_KEY:randomBytes(32).toString('base64'),KORA_PROVIDER_CALLBACK_SECRET:randomBytes(32).toString('hex'),KORA_WEBHOOK_ALLOWED_ORIGINS:'http://127.0.0.1:4311'};
for(const [key,value] of Object.entries(defaults))if(!current[key]){
  const expression=new RegExp(`^${key}=.*$`,'m');
  raw=expression.test(raw)?raw.replace(expression,`${key}=${value}`):`${raw.trimEnd()}\n${key}=${value}\n`;
}
await writeFile(path,raw.trimStart(),{mode:0o600});await chmod(path,0o600);
console.log('Kora sandbox configuration ready in .env. Existing keys were preserved.');
