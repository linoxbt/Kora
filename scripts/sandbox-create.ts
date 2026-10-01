import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { id, pool } from '../packages/database/src/index.js';
import { createMerchant, sandboxFund } from '../packages/ledger/src/index.js';
import { issueApiKey } from '../packages/payments/src/auth.js';
const args=process.argv.slice(2);
const option=(name:string)=>args.includes(name)?args[args.indexOf(name)+1]:undefined;
try {
  const merchant=id('mcht');await createMerchant(merchant,option('--name')??'Kora development');
  await sandboxFund(merchant,'NGN','100000000',`${merchant}:bootstrap:NGN`);
  await sandboxFund(merchant,'USDC','1000000000',`${merchant}:bootstrap:USDC`);
  const key=await issueApiKey(merchant,'Initial sandbox key');
  const output=JSON.stringify({merchant_id:merchant,api_key_id:key.id,api_key:key.secret,mode:'sandbox',api_url:'http://127.0.0.1:4310'},null,2)+'\n';
  const file=option('--output');
  if(file){await mkdir(dirname(file),{recursive:true});await writeFile(file,output,{mode:0o600,flag:'wx'});console.log(`Created Kora sandbox merchant. Credentials saved to ${file}`);}
  else console.log(output);
}finally{await pool.end();}
