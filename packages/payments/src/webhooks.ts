import { pool, id, transaction } from '../../database/src/index.js';
import { signWebhook } from '../../core/src/index.js';
import { seal, unseal } from './secrets.js';
import { PaymentError } from './errors.js';
export function validateWebhookUrl(value:string) {
  let url:URL;
  try {url=new URL(value);} catch {throw new PaymentError(400,'invalid_webhook_url','Use an absolute webhook URL');}
  const allowed=(process.env.KORA_WEBHOOK_ALLOWED_ORIGINS ?? 'http://127.0.0.1:4311').split(',').map(x=>x.trim());
  if(!['http:','https:'].includes(url.protocol) || url.username || url.password || url.hash || !allowed.includes(url.origin)) throw new PaymentError(422,'webhook_origin_not_allowed','Webhook origin must be explicitly configured in KORA_WEBHOOK_ALLOWED_ORIGINS');
  return url.toString();
}
export function encryptWebhookSecret(secret:string) {return seal(secret);}
export interface DeliveryOptions { onlyMerchant?:string; leaseMs?:number; timeoutMs?:number }
export async function deliverOne(options:DeliveryOptions={}):Promise<boolean> {
  const token=id('lease');
  const delivery=await transaction(async c=>{
    const found=(await c.query("SELECT d.* FROM webhook_deliveries d JOIN webhook_endpoints e ON e.id=d.endpoint_id WHERE d.state='pending' AND e.active AND d.next_attempt_at<=now() AND (d.locked_until IS NULL OR d.locked_until<now()) AND ($1::text IS NULL OR e.merchant_id=$1) ORDER BY d.next_attempt_at,d.id FOR UPDATE OF d SKIP LOCKED LIMIT 1",[options.onlyMerchant ?? null])).rows[0];
    if(!found) return null;
    return (await c.query("UPDATE webhook_deliveries SET locked_by=$2,locked_until=now()+($3::integer*interval '1 millisecond'),attempts=attempts+1 WHERE id=$1 RETURNING *",[found.id,token,options.leaseMs ?? 30000])).rows[0];
  });
  if(!delivery) return false;
  const row=(await pool.query('SELECT e.url,e.secret,v.id,v.type,v.data,v.created_at FROM webhook_endpoints e JOIN events v ON v.id=$2 WHERE e.id=$1',[delivery.endpoint_id,delivery.event_id])).rows[0];
  let statusCode:number|null=null, error:string|null=null;
  try {
    const url=validateWebhookUrl(row.url);
    const body=JSON.stringify({id:row.id,object:'event',type:row.type,data:row.data,created_at:row.created_at,mode:'sandbox'});
    const response=await fetch(url,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(options.timeoutMs ?? 5000),headers:{'content-type':'application/json','kora-signature':signWebhook(body,unseal(row.secret)),'x-kora-event-id':row.id},body});
    statusCode=response.status;
    await response.body?.cancel();
    if(statusCode<200 || statusCode>=300) error=`http_${statusCode}`;
  } catch(e) {error=e instanceof PaymentError?e.code:'delivery_unavailable';}
  const state=error ? delivery.attempts>=8?'failed':'pending' : 'delivered';
  const delay=Math.min(300,2**Math.min(delivery.attempts,8));
  await pool.query('UPDATE webhook_deliveries SET state=$3,status_code=$4,last_error=$5,next_attempt_at=now()+($6::integer*interval \'1 second\'),locked_by=NULL,locked_until=NULL WHERE id=$1 AND locked_by=$2',[delivery.id,token,state,statusCode,error,delay]);
  return true;
}
