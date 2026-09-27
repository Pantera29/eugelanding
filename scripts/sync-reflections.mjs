import {readFileSync,writeFileSync} from 'node:fs';
const articles=JSON.parse(readFileSync('content/reflections.json','utf8'));
if(new Set(articles.map(a=>a.path)).size!==articles.length)throw Error('Duplicate reflection URL');
for(const a of articles)if(!a.title||!a.seoTitle||!a.description||!a.body.length)throw Error('Incomplete article');
writeFileSync('content/reflections-index.json',JSON.stringify(articles.map(({body,...a})=>a),null,2)+'\n');
