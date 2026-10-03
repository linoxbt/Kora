import { chromium } from '@playwright/test';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
  for(const [name,width,height,path] of [['desktop',1440,900,'/'],['phone',390,844,'/'],['personal',390,844,'/personal/login'],['business',390,844,'/business/login']]){
    const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
    page.on('pageerror',error=>process.stdout.write(`${name} PAGE_ERROR ${error.message}\n`));
    page.on('console',message=>{if(message.type()==='error')process.stdout.write(`${name} CONSOLE_ERROR ${message.text()}\n`);});
    await page.goto(`http://127.0.0.1:5176${path}`,{waitUntil:'networkidle'});
    await page.screenshot({path:`/tmp/kora-v2-${name}.png`,fullPage:true});
    const data=await page.evaluate(()=>({title:document.title,h1:document.querySelector('h1')?.textContent,theme:document.documentElement.dataset.theme,viewport:innerWidth,scroll:document.documentElement.scrollWidth,links:[...document.querySelectorAll('button')].map(x=>x.textContent?.trim()).filter(Boolean).slice(0,12)}));
    process.stdout.write(`${name} ${JSON.stringify(data)}\n`);
    await page.close();
  }
}finally{await browser.close();}
