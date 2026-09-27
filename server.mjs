import http from 'node:http';
import {gzipSync} from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(process.env.DATA_DIR || resolve(root, 'data'));
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(resolve(dataDir, 'demo.sqlite'));
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, expires INTEGER NOT NULL, admin INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS bookings (id TEXT PRIMARY KEY, session TEXT NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, mode TEXT NOT NULL, status TEXT DEFAULT 'active', created TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS unique_slot ON bookings(date,time) WHERE status='active';
CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, session TEXT NOT NULL, sender TEXT NOT NULL, text TEXT NOT NULL, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS blocked (date TEXT NOT NULL, time TEXT NOT NULL, PRIMARY KEY(date,time));`);
for(const [name,type] of [['phone',"TEXT NOT NULL DEFAULT ''"],['duration','INTEGER NOT NULL DEFAULT 50'],['privacy_version','TEXT'],['privacy_read_at','TEXT']]){if(!db.prepare('PRAGMA table_info(bookings)').all().some(c=>c.name===name))db.exec('ALTER TABLE bookings ADD COLUMN '+name+' '+type);}
db.exec("CREATE TABLE IF NOT EXISTS therapy_requests(id TEXT PRIMARY KEY, session TEXT NOT NULL,name TEXT NOT NULL,phone TEXT NOT NULL,email TEXT NOT NULL,mode TEXT NOT NULL,availability TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created TEXT NOT NULL,privacy_version TEXT NOT NULL,privacy_read_at TEXT NOT NULL)");
if(!db.prepare('PRAGMA table_info(therapy_requests)').all().some(c=>c.name==='therapy_type'))db.exec("ALTER TABLE therapy_requests ADD COLUMN therapy_type TEXT NOT NULL DEFAULT 'unspecified'");
const TZ = 'Europe/Madrid';
const times = ['09:00', '10:00', '11:00', '12:00', '16:00', '17:00', '18:00'];
const password = process.env.ADMIN_PASSWORD || 'consultorio-demo';
const isoDate = d => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year:'numeric',month:'2-digit',day:'2-digit' }).format(d);
function toUTC(date, time) {
  const nominal = new Date(`${date}T${time}:00Z`);
  let result = nominal;
  for (let i=0;i<2;i++) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone:TZ, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23' }).formatToParts(result).map(p=>[p.type,p.value]));
    const local = new Date(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    result = new Date(result.getTime() + nominal.getTime() - local.getTime());
  }
  return result;
}
function validDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return false;
  const d = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(+d) || d.toISOString().slice(0,10)!==date) return false;
  const max = new Date(); max.setUTCDate(max.getUTCDate()+90);
  return date >= isoDate(new Date()) && date <= isoDate(max) && ![0,6].includes(d.getUTCDay());
}
function available(date) {
  if (!validDate(date)) return [];
  const occupied = db.prepare("SELECT time FROM bookings WHERE date=? AND status='active' UNION SELECT time FROM blocked WHERE date=?").all(date,date).map(r=>r.time);
  return times.filter(t=>!occupied.includes(t) && +toUTC(date,t)>Date.now()+2*60*60*1000);
}
const limits = new Map();
const adminFailures = new Map();
function error(status,message) { const e=new Error(message); e.status=status; return e; }
function clean(value,max=100) { return typeof value==='string' ? value.trim().slice(0,max) : ''; }
function sameSecret(a,b) { const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length && timingSafeEqual(aa,bb); }
async function readBody(req) {
  let body=''; for await (const chunk of req) { body+=chunk; if(Buffer.byteLength(body)>12000)throw error(413,'El mensaje es demasiado largo.'); }
  try { return JSON.parse(body || '{}'); } catch { throw error(400,'No se han podido leer los datos.'); }
}
const assetCache = new Map();
const server = http.createServer(async (req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  try {
    const url=new URL(req.url,'http://localhost');
    if (!url.pathname.startsWith('/api/')) {
      if (!['GET','HEAD'].includes(req.method)) throw error(405,'Método no permitido.');
      const requested=decodeURIComponent(url.pathname);
      const file=resolve(root,'dist','.'+requested);
      const dist=resolve(root,'dist');
      if (file!==dist && !file.startsWith(dist+'\\') && !file.startsWith(dist+'/')) throw error(403,'Acceso no permitido.');
      const cleanPath=requested.replace(/\/+$/,'');
      if(requested.startsWith('/reflexiones')&&requested!==cleanPath){res.writeHead(301,{Location:cleanPath});res.end();return;}
      const target=requested.startsWith('/reflexiones')?resolve(file,'index.html'):extname(requested)?file:resolve(dist,'index.html');
      if(!existsSync(target)) throw error(404,'No se ha encontrado la página.');
      const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.woff':'font/woff','.svg':'image/svg+xml','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8'};
      const headers={'Content-Type':mime[extname(target)]||'application/octet-stream','Cache-Control':target.includes('assets')?'public,max-age=31536000,immutable':'no-cache','Vary':'Accept-Encoding'};
      let content;
      if(req.headers['accept-encoding']?.includes('gzip') && ['.html','.js','.css'].includes(extname(target))){
        const modified=statSync(target).mtimeMs;let cached=assetCache.get(target);
        if(!cached || cached.modified!==modified){cached={modified,content:gzipSync(readFileSync(target))};assetCache.set(target,cached);}
        content=cached.content;headers['Content-Encoding']='gzip';
      }else content=readFileSync(target);
      res.writeHead(200,headers);res.end(req.method==='HEAD'?undefined:content);return;
    }
    if(req.method!=='GET' && req.headers.origin && req.headers.origin!==`http://${req.headers.host}`)throw error(403,'Origen no permitido.');
    if(req.method!=='GET' && !req.headers['content-type']?.startsWith('application/json'))throw error(415,'Formato no permitido.');
    let sid = req.headers.cookie?.split(';').map(c=>c.trim()).find(c=>c.startsWith('cv_session='))?.slice(11);
    let session = sid && db.prepare('SELECT * FROM sessions WHERE id=? AND expires>?').get(sid,Date.now());
    if(!session) {
      sid=randomBytes(32).toString('hex');
      session={id:sid,admin:0};
      db.prepare('INSERT INTO sessions(id,expires) VALUES(?,?)').run(sid,Date.now()+86400000);
      res.setHeader('Set-Cookie',`cv_session=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`);
    }
    const body=req.method==='GET'?{}:await readBody(req);
    if(req.method!=='GET') {
      const key=req.socket.remoteAddress+':'+sid;
      const recent=(limits.get(key)||[]).filter(t=>t>Date.now()-60000);
      if(recent.length>=35)throw error(429,'Has realizado muchas acciones. Espera un minuto y vuelve a intentarlo.');
      recent.push(Date.now());limits.set(key,recent);
    }
    const path=url.pathname;
    if(path==='/api/status' && req.method==='GET')return send(200,{demo:true,admin:!!session.admin,today:isoDate(new Date()),timezone:TZ});
    if(path==='/api/availability' && req.method==='GET') {
      const month=url.searchParams.get('month');
      if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month||''))throw error(400,'El mes no es válido.');
      const days={}; const count=new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate();
      for(let i=1;i<=count;i++){const date=`${month}-${String(i).padStart(2,'0')}`;days[date]=available(date);}
      return send(200,{days,timezone:TZ});
    }
    if(path==='/api/bookings' && req.method==='GET')return send(200,db.prepare('SELECT id,date,time,name,email,phone,duration,mode,status FROM bookings WHERE session=? ORDER BY date,time').all(sid));
    if(path==='/api/bookings' && req.method==='POST') {
      const {date,time,mode}=body;const name=clean(body.name,80),email=clean(body.email,200),phone=clean(body.phone,25);
      if(name.length<2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || mode!=='online' || body.privacyRead!==true||!/^\+?[0-9 ()−-]{7,25}$/.test(phone)||phone.replace(/\D/g,'').length<7||phone.replace(/\D/g,'').length>15)throw error(400,'Revisa tu nombre completo, teléfono, correo, modalidad online y lectura de privacidad.');
      if(!available(date).includes(time))throw error(409,'Este horario ya no está disponible. Elige otro.');
      if(db.prepare("SELECT count(*) AS n FROM bookings WHERE session=? AND status='active'").get(sid).n>=5)throw error(400,'Puedes tener hasta cinco reservas de prueba activas.');
      const id=randomBytes(12).toString('hex');
      db.prepare('INSERT INTO bookings(id,session,date,time,name,email,mode,created,phone,duration,privacy_version,privacy_read_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,sid,date,time,name,email,mode,new Date().toISOString(),phone,20,'2026-09-21',new Date().toISOString());
      return send(201,{id,date,time,name,email,mode,status:'active'});
    }
    if(/^\/api\/bookings\/[a-f0-9]+\/cancel$/.test(path) && req.method==='POST') {
      const result=db.prepare("UPDATE bookings SET status='cancelled' WHERE id=? AND session=? AND status='active'").run(path.split('/')[3],sid);
      if(!result.changes)throw error(404,'No se ha encontrado una reserva activa.');
      return send(200,{ok:true});
    }
    if(/^\/api\/bookings\/[a-f0-9]+\/calendar$/.test(path) && req.method==='GET') {
      const b=db.prepare("SELECT * FROM bookings WHERE id=? AND session=? AND status='active'").get(path.split('/')[3],sid);
      if(!b)throw error(404,'Reserva no encontrada.');
      const stamp=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
      const start=toUTC(b.date,b.time),end=new Date(+start+(b.duration||50)*60000);
      const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Consultorio Psi · Eugenia Longhi Demo//ES','BEGIN:VEVENT',`UID:${b.id}@consultoriopsi.demo`,`DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(start)}`,`DTEND:${stamp(end)}`,'SUMMARY:Cita de prueba','DESCRIPTION:Demostración. No es una cita real.','END:VEVENT','END:VCALENDAR',''].join('\r\n');
      res.writeHead(200,{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="cita-de-prueba.ics"','Cache-Control':'no-store'});res.end(ics);return;
    }
    if(path==='/api/requests'&&req.method==='POST'){
const name=clean(body.name,80),phone=clean(body.phone,25),email=clean(body.email,200),mode=body.mode,therapyType=body.therapyType,availability=clean(body.availability,800);
if(name.length<2||!/^\+?[0-9 ()−-]{7,25}$/.test(phone)||phone.replace(/\D/g,'').length<7||phone.replace(/\D/g,'').length>15||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['online','presencial'].includes(mode)||!['individual','pareja'].includes(therapyType)||availability.length<5||body.privacyRead!==true)throw error(400,'Completa los datos de contacto, modalidad, disponibilidad y lectura de privacidad.');
const id=randomBytes(12).toString('hex'),created=new Date().toISOString();
const result=db.prepare("INSERT INTO therapy_requests(id,session,name,phone,email,mode,availability,created,privacy_version,privacy_read_at,therapy_type) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT count(*) FROM therapy_requests WHERE session=?)<5").run(id,sid,name,phone,email,mode,availability,created,'2026-09-21',created,therapyType,sid);
if(!result.changes)throw error(400,'Puedes enviar hasta cinco solicitudes de prueba.');return send(201,{id,status:'pending'});
}
if(path==='/api/messages' && req.method==='GET')return send(200,db.prepare('SELECT id,sender,text,created FROM messages WHERE session=? ORDER BY id').all(sid));
    if(path==='/api/messages' && req.method==='POST') {
      const text=clean(body.text,1000);if(!text)throw error(400,'Escribe un mensaje.');
      if(db.prepare('SELECT count(*) AS n FROM messages WHERE session=?').get(sid).n>=100)throw error(400,'Esta conversación ha alcanzado el límite de la demostración.');
      db.prepare('INSERT INTO messages(session,sender,text,created) VALUES(?,?,?,?)').run(sid,'visitor',text,new Date().toISOString());return send(201,{ok:true});
    }
    if(path==='/api/admin/login' && req.method==='POST') {
      const ip=req.socket.remoteAddress, recent=(adminFailures.get(ip)||[]).filter(t=>t>Date.now()-15*60000);
      if(recent.length>=8)throw error(429,'Demasiados intentos. Espera 15 minutos.');
      if(!sameSecret(clean(body.password,200),password)){recent.push(Date.now());adminFailures.set(ip,recent);throw error(401,'La contraseña no es correcta.');}
      db.prepare('UPDATE sessions SET admin=1 WHERE id=?').run(sid);return send(200,{ok:true});
    }
    if(path.startsWith('/api/admin/')) {
      if(!session.admin)throw error(401,'Inicia sesión para acceder.');
      if(path==='/api/admin/logout' && req.method==='POST'){db.prepare('UPDATE sessions SET admin=0 WHERE id=?').run(sid);return send(200,{ok:true});}
      if(path==='/api/admin/data' && req.method==='GET')return send(200,{requests:db.prepare('SELECT * FROM therapy_requests ORDER BY created DESC').all(),bookings:db.prepare('SELECT id,date,time,name,email,phone,duration,mode,status FROM bookings ORDER BY date,time').all(),messages:db.prepare('SELECT * FROM messages ORDER BY id').all(),blocked:db.prepare('SELECT * FROM blocked ORDER BY date,time').all()});
      if(path==='/api/admin/request-status'&&req.method==='POST'){if(!['pending','contacted'].includes(body.status))throw error(400,'Estado no válido.');const r=db.prepare("UPDATE therapy_requests SET status=? WHERE id=?").run(body.status,body.id);if(!r.changes)throw error(404,'Solicitud no encontrada.');return send(200,{ok:true});}
if(path==='/api/admin/reply' && req.method==='POST') {
        const text=clean(body.text,1000);if(!text||!db.prepare('SELECT id FROM messages WHERE session=?').get(body.session))throw error(400,'Revisa el mensaje y la conversación.');
        db.prepare('INSERT INTO messages(session,sender,text,created) VALUES(?,?,?,?)').run(body.session,'professional',text,new Date().toISOString());return send(201,{ok:true});
      }
      if(path==='/api/admin/cancel' && req.method==='POST'){const r=db.prepare("UPDATE bookings SET status='cancelled' WHERE id=? AND status='active'").run(body.id);if(!r.changes)throw error(404,'Reserva no encontrada.');return send(200,{ok:true});}
      if(path==='/api/admin/block' && req.method==='POST') {
        if(!validDate(body.date)||!times.includes(body.time))throw error(400,'Elige un día laborable en los próximos 90 días y una hora válida.');
        if(body.blocked===false)db.prepare('DELETE FROM blocked WHERE date=? AND time=?').run(body.date,body.time);
        else {if(db.prepare("SELECT id FROM bookings WHERE date=? AND time=? AND status='active'").get(body.date,body.time))throw error(409,'Hay una cita en ese horario. Cancélala antes de bloquearlo.');db.prepare('INSERT OR IGNORE INTO blocked(date,time) VALUES(?,?)').run(body.date,body.time);}
        return send(200,{ok:true});
      }
    }
    throw error(404,'No se ha encontrado el recurso.');
  } catch(e) { if(!res.headersSent)send(e.status||500,{error:e.status?e.message:'No se ha podido completar la acción. Vuelve a intentarlo.'});else res.end(); }
});
const port=Number(process.env.PORT||4173);
server.listen(port,'127.0.0.1',()=>console.log(`Web: http://127.0.0.1:${port}\nZona profesional: http://127.0.0.1:${port}/admin\nModo demostración local. Contraseña por defecto: consultorio-demo (cambiable con ADMIN_PASSWORD).`));
function close(){server.close(()=>{db.close();process.exit(0);});}
process.on('SIGTERM',close);process.on('SIGINT',close);


