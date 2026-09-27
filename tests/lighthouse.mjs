import {chromium} from 'playwright';
import lighthouse from 'lighthouse';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--remote-debugging-port=9224'],headless:true});
try{const r=await lighthouse('http://127.0.0.1:4173',{port:9224,output:'json',logLevel:'error',onlyCategories:['performance','accessibility','best-practices']});await writeFile('../../work/lighthouse-final.json',r.report);console.log(JSON.stringify({scores:Object.fromEntries(Object.entries(r.lhr.categories).map(([k,v])=>[k,v.score])),LCP:r.lhr.audits['largest-contentful-paint'].displayValue,CLS:r.lhr.audits['cumulative-layout-shift'].displayValue,TBT:r.lhr.audits['total-blocking-time'].displayValue}));}finally{await browser.close();}
