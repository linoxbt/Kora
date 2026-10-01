import 'dotenv/config';
import { createServer } from 'node:http';
import { verifyWebhook } from '../packages/core/src/index.js';
const secret=process.env.KORA_RECEIVER_SECRET;
if(!secret||secret.length<32)throw new Error('Set KORA_RECEIVER_SECRET to the secret returned when registering the webhook endpoint');
const seen=new Set<string>();
const server=createServer(async(req,res)=>{
  if(req.method!=='POST'||req.url!=='/events'){res.writeHead(404).end();return;}
  let body='';for await(const chunk of req){body+=chunk.toString();if(Buffer.byteLength(body)>65536){res.writeHead(413).end();return;}}
  const signature=req.headers['kora-signature'];
  if(typeof signature!=='string'||!verifyWebhook(body,signature,secret)){res.writeHead(401).end();return;}
  try {
    const event=JSON.parse(body);
    if(!seen.has(event.id)){seen.add(event.id);console.log(`Verified ${event.type} · ${event.id}`);}
    res.writeHead(204).end();
  }catch{res.writeHead(400).end();}
});
server.listen(4311,'127.0.0.1',()=>console.log('Kora webhook receiver: http://127.0.0.1:4311/events'));
process.on('SIGINT',()=>server.close());process.on('SIGTERM',()=>server.close());
