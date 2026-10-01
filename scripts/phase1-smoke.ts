import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { id,pool } from '../packages/database/src/index.js';
import { createMerchant,sandboxFund,invariantReport } from '../packages/ledger/src/index.js';
import { issueApiKey } from '../packages/payments/src/auth.js';
import { verifyWebhook } from '../packages/core/src/index.js';
import { z } from 'zod';
const servers:Server[]=[],children:ChildProcess[]=[];
async function listen(server:Server){servers.push(server);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address!=='object')throw new Error('Unable to allocate local port');return address.port;}
const events:{id:string;type:string;verified:boolean}[]=[];
let receiverSecret='';
try {
  const merchant=id('mcht');await createMerchant(merchant,'Kora Phase 1 HTTP smoke');await sandboxFund(merchant,'NGN','10000000',`${merchant}:fund`);
  const key=await issueApiKey(merchant,'Smoke fixture');
  const receiver=createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk.toString();const event=JSON.parse(body);const verified=verifyWebhook(body,String(req.headers['kora-signature']),receiverSecret);events.push({id:event.id,type:event.type,verified});res.writeHead(verified?204:401).end();});
  const receiverPort=await listen(receiver);
  const reservation=createServer(),port=await listen(reservation);await new Promise<void>(resolve=>reservation.close(()=>resolve()));servers.splice(servers.indexOf(reservation),1);
  const env={...process.env,HOST:'127.0.0.1',PORT:String(port),KORA_WEBHOOK_ALLOWED_ORIGINS:`http://127.0.0.1:${receiverPort}`};
  const api=spawn(process.execPath,['--import','tsx','services/api/src/index.ts'],{cwd:process.cwd(),env,stdio:'ignore'});children.push(api);
  const base=`http://127.0.0.1:${port}`;
  let healthy=false;
  for(let n=0;n<100;n++){try{if((await fetch(`${base}/health`)).ok){healthy=true;break;}}catch{}if(api.exitCode!==null)break;await setTimeout(100);}
  assert.ok(healthy,'API process did not become healthy');
  async function request(path:string,payload?:unknown,idem=id('idem')){
    const response=await fetch(`${base}${path}`,{method:payload?'POST':'GET',headers:{authorization:`Bearer ${key.secret}`,'content-type':'application/json','idempotency-key':idem},body:payload?JSON.stringify(payload):undefined});
    const body=await response.json();assert.ok(response.ok,JSON.stringify(body));return z.object({id:z.string(),state:z.string().optional(),secret:z.string().optional()}).passthrough().parse(body);
  }
  assert.equal((await fetch(`${base}/v1/balances`)).status,401);
  const endpoint=await request('/v1/webhook_endpoints',{url:`http://127.0.0.1:${receiverPort}/events`});assert.ok(endpoint.secret);receiverSecret=endpoint.secret;
  const customer=await request('/v1/customers',{name:'Smoke recipient'});
  const instrument=await request(`/v1/customers/${customer.id}/instruments`,{type:'stellar_account',asset:'USDC',label:'Smoke Stellar account',sandbox_identifier:'sandbox:stellar:smoke'});
  const quote=await request('/v1/quotes',{source_asset:'NGN',destination_asset:'USDC',amount_minor:'160000'});
  const payload={quote_id:quote.id,customer_id:customer.id,destination_instrument_id:instrument.id,reference:'http-smoke',scenario:'timeout'},idem=id('idem');
  const intent=await request('/v1/intents',payload,idem);assert.equal((await request('/v1/intents',payload,idem)).id,intent.id);
  async function worker(){
    await new Promise<void>((resolve,reject)=>{
      const child=spawn(process.execPath,['--import','tsx','services/worker/src/index.ts','--once','--intent',intent.id,'--merchant',merchant],{cwd:process.cwd(),env,stdio:'ignore'});children.push(child);
      child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error(`Worker exited ${code}`)));
    });
  }
  await worker();assert.equal((await request(`/v1/intents/${intent.id}`)).state,'unknown');
  await setTimeout(2200);await worker();await worker();
  assert.equal((await request(`/v1/intents/${intent.id}`)).state,'succeeded');
  const instruction=(await pool.query('SELECT id FROM instructions WHERE intent_id=$1',[intent.id])).rows[0];
  const count=async(table:string)=>(await pool.query(`SELECT count(*)::int n FROM ${table} WHERE instruction_id=$1`,[instruction.id])).rows[0].n;
  assert.equal(await count('fake_provider_movements'),1);assert.equal(await count('receipts'),1);
  assert.deepEqual(events.map(e=>e.type),['intent.created','intent.unknown','intent.succeeded']);assert.ok(events.every(e=>e.verified));
  const ledger=await invariantReport();assert.equal(ledger.violations.length,0);
  console.log(JSON.stringify({phase:1,transport:'HTTP with separate API and worker processes',authentication:true,idempotent_request:true,timeout_recovered:true,provider_movements:1,matched_receipts:1,verified_webhooks:events.length,ledger_invariants:ledger},null,2));
} finally {
  for(const child of children)if(child.exitCode===null){const stopped=new Promise<void>(resolve=>child.once('close',()=>resolve()));child.kill('SIGTERM');await stopped;}
  for(const server of servers)await new Promise<void>(resolve=>server.close(()=>resolve()));await pool.end();
}
