import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs';
import {resolve,extname} from 'node:path';
const root=process.cwd(),dist=resolve(root,'dist'),assets={};
const types={'.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.woff':'font/woff'};
function collect(dir,prefix=''){for(const e of readdirSync(dir,{withFileTypes:true})){if(['server','.openai','consulta.png'].includes(e.name))continue;const file=resolve(dir,e.name),key=prefix+'/'+e.name;if(e.isDirectory())collect(file,key);else if(types[extname(e.name)])assets[key]={type:types[extname(e.name)],data:readFileSync(file).toString('base64')};}}
collect(dist);const manifest=JSON.parse(readFileSync(resolve(root,'.openai/hosting.json'),'utf8').replace(/^\uFEFF/,''));
mkdirSync(resolve(dist,'server'),{recursive:true});mkdirSync(resolve(dist,'.openai'),{recursive:true});
writeFileSync(resolve(dist,'server/index.js'),`const ASSET_FILES=${JSON.stringify(assets)};\n`+readFileSync(resolve(root,'worker/index.js'),'utf8'));
writeFileSync(resolve(dist,'.openai/hosting.json'),JSON.stringify(manifest,null,2)+'\n');console.log(`Worker ready: ${Object.keys(assets).length} embedded assets.`);
