import { chromium } from '@playwright/test';
import { buildApi } from '../services/api/src/app.js';
import { pool, id } from '../packages/database/src/index.js';
const origin='http://127.0.0.1:4310';
const codes=new Map();
const app=await buildApi({serveWeb:false,rateLimitMax:10000,personal:{codeSecret:'browser-check-only-secret',sendCode:async(email,code)=>{codes.set(email,code);}}});
async function login(realm){
  const email=`${id(realm)}@example.test`;
  const start=await app.inject({method:'POST',url:`/${realm}/api/auth/start`,headers:{origin},payload:{email}});
  if(start.statusCode!==200)throw new Error(start.body);
  const verify=await app.inject({method:'POST',url:`/${realm}/api/auth/verify`,headers:{origin},payload:{challenge_id:start.json().challenge_id,code:codes.get(email)}});
  if(verify.statusCode!==200)throw new Error(verify.body);
  return {cookie:String(verify.headers['set-cookie']).split(';')[0],csrf:verify.json().csrf_token};
}
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
  for(const realm of ['personal','business']){
    const auth=await login(realm),[name,value]=auth.cookie.split('=');
    const context=await browser.newContext({viewport:{width:390,height:844}});
    await context.addCookies([{name,value,domain:'127.0.0.1',path:'/'}]);
    const page=await context.newPage();
    page.on('pageerror',e=>process.stdout.write(`${realm} PAGE_ERROR ${e.message}\n`));
    await page.goto(`http://127.0.0.1:5176/${realm==='personal'?'personal/home':'app/overview'}`,{waitUntil:'networkidle'});
    await page.screenshot({path:`/tmp/kora-v2-${realm}-signed-in.png`,fullPage:true});
    const data=await page.evaluate(()=>({h1:document.querySelector('h1')?.textContent,viewport:innerWidth,scroll:document.documentElement.scrollWidth,body:document.body.textContent?.slice(0,220)}));
    process.stdout.write(`${realm} ${JSON.stringify(data)}\n`);
    await context.close();
  }
}finally{await browser.close();await app.close();await pool.end();}
