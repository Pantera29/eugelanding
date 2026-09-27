// Cloudflare Workers adapter. The visual React application is unchanged.
const TZ='Europe/Madrid';
const times=['09:00','10:00','11:00','12:00','16:00','17:00','18:00'];
const isoDate=d=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const random=n=>Array.from(crypto.getRandomValues(new Uint8Array(n)),b=>b.toString(16).padStart(2,'0')).join('');
const clean=(v,max=100)=>typeof v==='string'?v.trim().slice(0,max):'';
function fail(status,message){const e=new Error(message);e.status=status;return e;}
function database(binding){if(!binding)throw fail(503,'La agenda no está disponible en este momento. Vuelve a intentarlo.');return {
 all:async(sql,...values)=>(await binding.prepare(sql).bind(...values).all()).results,
 get:async(sql,...values)=>binding.prepare(sql).bind(...values).first(),
 run:async(sql,...values)=>(await binding.prepare(sql).bind(...values).run()).meta,
};}
function toUTC(date,time){const nominal=new Date(`${date}T${time}:00Z`);let result=nominal;for(let i=0;i<2;i++){const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(result).map(p=>[p.type,p.value]));const local=new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);result=new Date(+result + +nominal - +local);}return result;}
function validDate(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return false;const d=new Date(date+'T12:00:00Z');if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==date)return false;const max=new Date();max.setUTCDate(max.getUTCDate()+90);return date>=isoDate(new Date())&&date<=isoDate(max)&&![0,6].includes(d.getUTCDay());}
function slots(date,occupied){if(!validDate(date))return [];return times.filter(t=>!occupied.includes(t)&&+toUTC(date,t)>Date.now()+7200000);}
async function secretMatches(a,b){if(!b)return false;const enc=new TextEncoder();const [x,y]=await Promise.all([crypto.subtle.digest('SHA-256',enc.encode(a)),crypto.subtle.digest('SHA-256',enc.encode(b))]);const aa=new Uint8Array(x),bb=new Uint8Array(y);let diff=0;for(let i=0;i<aa.length;i++)diff|=aa[i]^bb[i];return diff===0;}
async function jsonBody(request){const reader=request.body?.getReader();if(!reader)return {};let size=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>12000){await reader.cancel();throw fail(413,'El mensaje es demasiado largo.');}chunks.push(value);}const all=new Uint8Array(size);let pos=0;for(const c of chunks){all.set(c,pos);pos+=c.length;}try{const b=JSON.parse(new TextDecoder().decode(all)||'{}');if(!b||Array.isArray(b)||typeof b!=='object')throw Error();return b;}catch{throw fail(400,'No se han podido leer los datos.');}}
const security={'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"};
export async function handleApi(request,env){const headers={...security,'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8'};const send=(status,data)=>new Response(JSON.stringify(data),{status,headers});try{
 const url=new URL(request.url),path=url.pathname,method=request.method;
 if(!['GET','POST'].includes(method))throw fail(405,'Método no permitido.');
 if(method==='POST'&&request.headers.get('origin')&&request.headers.get('origin')!==url.origin)throw fail(403,'Origen no permitido.');
 if(method==='POST'&&!request.headers.get('content-type')?.startsWith('application/json'))throw fail(415,'Formato no permitido.');
 const db=database(env.DB);
 let sid=request.headers.get('cookie')?.split(';').map(c=>c.trim()).find(c=>c.startsWith('cv_session='))?.slice(11);
 if(!/^[a-f0-9]{64}$/.test(sid||''))sid='';
 let session=sid&&await db.get('SELECT * FROM sessions WHERE id=? AND expires>?',sid,Date.now());
 if(!session){sid=random(32);session={id:sid,admin:0};await db.run('INSERT INTO sessions(id,expires) VALUES(?,?)',sid,Date.now()+86400000);headers['Set-Cookie']=`cv_session=${sid}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`;}
 const body=method==='GET'?{}:await jsonBody(request);
 if(method==='POST'){
  const ip=request.headers.get('CF-Connecting-IP')||'unknown',window=Math.floor(Date.now()/60000),key=`write:${ip}:${window}`;
  const limit=await db.get('INSERT INTO limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',key,Date.now()+120000);
  if(limit.count>60)throw fail(429,'Has realizado muchas acciones. Espera un minuto y vuelve a intentarlo.');
 }
 if(path==='/api/status'&&method==='GET')return send(200,{demo:true,hosted:true,admin:!!session.admin,today:isoDate(new Date()),timezone:TZ});
 if(path==='/api/availability'&&method==='GET'){
  const month=url.searchParams.get('month');if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month||''))throw fail(400,'El mes no es válido.');
  const taken=await db.all("SELECT date,time FROM bookings WHERE date LIKE ? AND status='active' UNION SELECT date,time FROM blocked WHERE date LIKE ?",month+'-%',month+'-%');
  const grouped=new Map();for(const r of taken){if(!grouped.has(r.date))grouped.set(r.date,[]);grouped.get(r.date).push(r.time);}
  const days={},count=new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate();for(let i=1;i<=count;i++){const date=`${month}-${String(i).padStart(2,'0')}`;days[date]=slots(date,grouped.get(date)||[]);}return send(200,{days,timezone:TZ});
 }
 if(path==='/api/bookings'&&method==='GET')return send(200,await db.all('SELECT id,date,time,name,email,phone,duration,mode,status FROM bookings WHERE session=? ORDER BY date,time',sid));
 if(path==='/api/bookings'&&method==='POST'){
  const {date,time,mode}=body;const name=clean(body.name,80),email=clean(body.email,200),phone=clean(body.phone,25);
  if(name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||mode!=='online'||body.privacyRead!==true||!/^\+?[0-9 ()−-]{7,25}$/.test(phone)||phone.replace(/\D/g,'').length<7||phone.replace(/\D/g,'').length>15)throw fail(400,'Revisa tu nombre completo, teléfono, correo, modalidad online y lectura de privacidad.');
  if(!slots(date,[]).includes(time))throw fail(409,'Este horario no está disponible. Elige otro.');
  const id=random(12);
  const result=await db.run("INSERT INTO bookings(id,session,date,time,name,email,mode,created,phone,duration,privacy_version,privacy_read_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM blocked WHERE date=? AND time=?) AND (SELECT count(*) FROM bookings WHERE session=? AND status='active')<5",id,sid,date,time,name,email,mode,new Date().toISOString(),phone,20,'2026-09-21',new Date().toISOString(),date,time,sid);
  if(!result.changes)throw fail(409,'El horario no está disponible o ya tienes cinco reservas activas.');
  return send(201,{id,date,time,name,email,mode,status:'active'});
 }
 if(/^\/api\/bookings\/[a-f0-9]+\/cancel$/.test(path)&&method==='POST'){const r=await db.run("UPDATE bookings SET status='cancelled' WHERE id=? AND session=? AND status='active'",path.split('/')[3],sid);if(!r.changes)throw fail(404,'No se ha encontrado una reserva activa.');return send(200,{ok:true});}
 if(/^\/api\/bookings\/[a-f0-9]+\/calendar$/.test(path)&&method==='GET'){
  const b=await db.get("SELECT * FROM bookings WHERE id=? AND session=? AND status='active'",path.split('/')[3],sid);if(!b)throw fail(404,'Reserva no encontrada.');const stamp=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');const start=toUTC(b.date,b.time),end=new Date(+start+(b.duration||50)*60000);
  const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Consultorio Psi Demo//ES','BEGIN:VEVENT',`UID:${b.id}@consultoriopsi.demo`,`DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(start)}`,`DTEND:${stamp(end)}`,'SUMMARY:Cita de prueba','DESCRIPTION:Demostracion. No es una cita real.','END:VEVENT','END:VCALENDAR',''].join('\r\n');return new Response(ics,{headers:{...headers,'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="cita-de-prueba.ics"'}});
 }
 if(path==='/api/requests'&&method==='POST'){
const name=clean(body.name,80),phone=clean(body.phone,25),email=clean(body.email,200),mode=body.mode,therapyType=body.therapyType,availability=clean(body.availability,800);
if(name.length<2||!/^\+?[0-9 ()−-]{7,25}$/.test(phone)||phone.replace(/\D/g,'').length<7||phone.replace(/\D/g,'').length>15||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['online','presencial'].includes(mode)||!['individual','pareja'].includes(therapyType)||availability.length<5||body.privacyRead!==true)throw fail(400,'Completa los datos de contacto, modalidad, disponibilidad y lectura de privacidad.');
const id=random(12),created=new Date().toISOString();
const result=await db.run("INSERT INTO therapy_requests(id,session,name,phone,email,mode,availability,created,privacy_version,privacy_read_at,therapy_type) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT count(*) FROM therapy_requests WHERE session=?)<5",id,sid,name,phone,email,mode,availability,created,'2026-09-21',created,therapyType,sid);
if(!result.changes)throw fail(400,'Puedes enviar hasta cinco solicitudes de prueba.');return send(201,{id,status:'pending'});
}
if(path==='/api/messages'&&method==='GET')return send(200,await db.all('SELECT id,sender,text,created FROM messages WHERE session=? ORDER BY id',sid));
 if(path==='/api/messages'&&method==='POST'){
  const text=clean(body.text,1000);if(!text)throw fail(400,'Escribe un mensaje.');const r=await db.run('INSERT INTO messages(session,sender,text,created) SELECT ?,?,?,? WHERE (SELECT count(*) FROM messages WHERE session=?)<100',sid,'visitor',text,new Date().toISOString(),sid);if(!r.changes)throw fail(400,'Esta conversación ha alcanzado el límite de la demostración.');return send(201,{ok:true});
 }
 if(path==='/api/admin/login'&&method==='POST'){
  const ip=request.headers.get('CF-Connecting-IP')||'unknown',window=Math.floor(Date.now()/900000),key=`login:${ip}:${window}`;
  const r=await db.get('INSERT INTO limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',key,Date.now()+1800000);
  if(r.count>8)throw fail(429,'Demasiados intentos. Espera 15 minutos.');if(!await secretMatches(clean(body.password,200),env.ADMIN_PASSWORD))throw fail(401,'La contraseña no es correcta.');
  await db.run('UPDATE sessions SET admin=1 WHERE id=?',sid);return send(200,{ok:true});
 }
 if(path.startsWith('/api/admin/')){
  if(!session.admin)throw fail(401,'Inicia sesión para acceder.');
  if(path==='/api/admin/logout'&&method==='POST'){await db.run('UPDATE sessions SET admin=0 WHERE id=?',sid);return send(200,{ok:true});}
  if(path==='/api/admin/data'&&method==='GET'){const [bookings,messages,blocked]=await Promise.all([db.all('SELECT id,date,time,name,email,phone,duration,mode,status FROM bookings ORDER BY date,time'),db.all('SELECT * FROM messages ORDER BY id'),db.all('SELECT * FROM blocked ORDER BY date,time')]);return send(200,{bookings,messages,blocked,requests:await db.all('SELECT * FROM therapy_requests ORDER BY created DESC')});}
  if(path==='/api/admin/request-status'&&method==='POST'){if(!['pending','contacted'].includes(body.status))throw fail(400,'Estado no válido.');const r=await db.run("UPDATE therapy_requests SET status=? WHERE id=?",body.status,body.id);if(!r.changes)throw fail(404,'Solicitud no encontrada.');return send(200,{ok:true});}
if(path==='/api/admin/reply'&&method==='POST'){const text=clean(body.text,1000);if(!text||!await db.get('SELECT id FROM messages WHERE session=?',body.session))throw fail(400,'Revisa el mensaje y la conversación.');await db.run('INSERT INTO messages(session,sender,text,created) VALUES(?,?,?,?)',body.session,'professional',text,new Date().toISOString());return send(201,{ok:true});}
  if(path==='/api/admin/cancel'&&method==='POST'){const r=await db.run("UPDATE bookings SET status='cancelled' WHERE id=? AND status='active'",body.id);if(!r.changes)throw fail(404,'Reserva no encontrada.');return send(200,{ok:true});}
  if(path==='/api/admin/block'&&method==='POST'){
   if(!validDate(body.date)||!times.includes(body.time))throw fail(400,'Elige un día laborable en los próximos 90 días y una hora válida.');
   if(body.blocked===false)await db.run('DELETE FROM blocked WHERE date=? AND time=?',body.date,body.time);
   else{const r=await db.run("INSERT OR IGNORE INTO blocked(date,time) SELECT ?,? WHERE NOT EXISTS(SELECT 1 FROM bookings WHERE date=? AND time=? AND status='active')",body.date,body.time,body.date,body.time);if(!r.changes&&!await db.get('SELECT date FROM blocked WHERE date=? AND time=?',body.date,body.time))throw fail(409,'Hay una cita en ese horario. Cancélala antes de bloquearlo.');}
   return send(200,{ok:true});
  }
 }
 throw fail(404,'No se ha encontrado el recurso.');
}catch(e){if(/UNIQUE constraint failed: bookings/.test(e.message))return send(409,{error:'Este horario ya no está disponible. Elige otro.'});return send(e.status||500,{error:e.status?e.message:'No se ha podido completar la acción. Vuelve a intentarlo.'});}}
export default {async fetch(request,env){const url=new URL(request.url);if(url.pathname.startsWith('/api/'))return handleApi(request,env);if(!['GET','HEAD'].includes(request.method))return new Response('Método no permitido',{status:405});if(url.pathname.startsWith('/reflexiones')&&url.pathname.endsWith('/'))return Response.redirect(url.origin+url.pathname.replace(/\/+$/,'')+url.search,301);let key=url.pathname==='/'||url.pathname==='/admin'||['/privacidad','/aviso-legal','/cookies'].includes(url.pathname)?'/index.html':url.pathname;if(url.pathname.startsWith('/reflexiones'))key=url.pathname+'/index.html';const asset=ASSET_FILES[key];if(!asset)return new Response('No encontrado',{status:404});const data=Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0));return new Response(request.method==='HEAD'?null:data,{headers:{...security,'Content-Type':asset.type,'Cache-Control':key.includes('/assets/')?'public,max-age=31536000,immutable':'no-cache'}});}};
