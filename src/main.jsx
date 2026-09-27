import GoogleBooking from './GoogleBooking.jsx';
import Assistant,{WHATSAPP} from './Assistant.jsx';
import {ReflectionsPreview} from './ReflectionsPreview.jsx';
import {TherapyAreas, About, Starting, LegalContent, CookiesContent} from './ProfessionalContent.jsx';
import {Logo, ContactFields, PrivacyContent} from './ContactForms.jsx';
import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, ArrowRight, ArrowLeft, FlowerLotus, ChatCircle, CalendarBlank, Clock, VideoCamera, MapPin, CaretLeft, CaretRight, X, List, Heart, Leaf, Waves, Sun, Moon, Check, CheckCircle, PaperPlaneTilt, LockSimple, DownloadSimple, Plus, Minus, IconContext } from '@phosphor-icons/react';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import './styles.css';
const Admin = lazy(()=>import('./Admin.jsx'));
export async function api(path,body) {
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
  try { const res=await fetch('/api'+path,{signal:controller.signal,headers:body?{'Content-Type':'application/json'}:undefined,method:body?'POST':'GET',body:body?JSON.stringify(body):undefined});
    const data=await res.json();if(!res.ok)throw new Error(data.error||'No se ha podido completar la acción.');return data;
  } catch(e) {if(e.name==='AbortError')throw new Error('La conexión tarda demasiado. Vuelve a intentarlo.');throw e;} finally{clearTimeout(timeout);}
}
const longDate=d=>new Date(d+'T12:00:00').toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
const monthKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
export function Modal({title,children,onClose,className=''}) {
  const ref=useRef(null);
  useEffect(()=>{const el=ref.current;el.showModal();return()=>el.close();},[]);
  return <dialog ref={ref} className={'modal '+className} aria-label={title} onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="modal-inner"><button className="icon-button close" aria-label="Cerrar" onClick={onClose}><X/></button>{children}</div></dialog>;
}
export function Notice({children}) {return children?<p className="error" role="alert">{children}</p>:null;}
function Brand(){return <a className="brand" href="/" aria-label="Consultorio Psi · Eugenia Longhi, inicio"><Logo/><span>consultorio psi<small>EUGENIA LONGHI · PSICÓLOGA</small></span></a>;}
const services=[
{title:'Ansiedad y malestar emocional',desc:'Ansiedad · angustia · ataques de pánico · miedos · sobrepensamiento · somatizaciones',Icon:Waves},
{title:'Autoestima y relación con uno mismo',desc:'Inseguridad · autoexigencia · dificultad para poner límites · dependencia emocional · crisis personales',Icon:Heart},
{title:'Vínculos y relaciones',desc:'Conflictos de pareja · dificultades vinculares · problemas familiares · separaciones · patrones que se repiten',Icon:ChatCircle},
{title:'Cambios, pérdidas y procesos migratorios',desc:'Duelos · crisis vitales · procesos migratorios · adaptación · desarraigo · cambios importantes',Icon:Leaf}
];
const faqs=[
['¿Qué puedo esperar de la terapia?',[
'Las primeras sesiones son un espacio para conocernos y comprender qué te está llevando a consultar, cómo estás viviendo ese malestar y qué aspectos de tu historia, tus vínculos o tu situación actual pueden estar influyendo.',
'A partir de ahí iremos construyendo conjuntamente un proceso terapéutico adaptado a vos, profundizando en aquello que necesite ser trabajado y estableciendo objetivos de acuerdo con tus necesidades y tu momento vital.',
'No existe una duración predeterminada para una terapia. Cada proceso tiene sus propios tiempos y puede ir modificándose a medida que avanzamos.']],
['¿Cuánto dura una sesión?',['Entre 45 y 50 minutos.']],
['¿Con qué frecuencia se realizan?',['En general semanalmente, aunque la frecuencia puede ajustarse según cada proceso.']],
['¿Cuánto tiempo dura un proceso terapéutico?',['No existe una duración predeterminada. Depende del motivo de consulta, los objetivos y el proceso de cada persona.']]
];
function Privacy({onClose}) {return <Modal title="Política de Privacidad" onClose={onClose}><PrivacyContent/></Modal>;}
function App(){

 const [chat,setChat]=useState(false),[privacy,setPrivacy]=useState(false),[menu,setMenu]=useState(false),[theme,setTheme]=useState(()=>(() => {try{return localStorage.getItem('consultorio-theme')||'light';}catch{return 'light';}})());
 useEffect(()=>{document.documentElement.dataset.theme=theme;try{localStorage.setItem('consultorio-theme',theme);}catch{}},[theme]);
 useEffect(()=>{const section=document.getElementById('cita');if(!section)return;const observer=new IntersectionObserver(([entry])=>document.body.classList.toggle('booking-in-view',entry.isIntersecting));observer.observe(section);return()=>{observer.disconnect();document.body.classList.remove('booking-in-view');};},[]);
 const toggleTheme=()=>setTheme(t=>(t==='dark'||(t==='auto'&&matchMedia('(prefers-color-scheme:dark)').matches))?'light':'dark');
 if(['/aviso-legal','/cookies'].includes(location.pathname))return <main className="privacy-page wrap"><a className="text-button" href="/">Volver a Consultorio Psi</a>{location.pathname==='/cookies'?<CookiesContent/>:<LegalContent/>}</main>;
 if(location.pathname==='/privacidad')return <main className="privacy-page wrap"><a className="text-button" href="/">Volver a Consultorio Psi</a><PrivacyContent/></main>;
 if(location.pathname==='/admin')return <Suspense fallback={<p className="page-loading">Preparando tu espacio…</p>}><Admin/></Suspense>;
 return <><a href="#contenido" className="skip">Saltar al contenido</a><header className="header"><div className="header-inner"><Brand/><nav aria-label="Navegación principal" className={menu?'nav open':'nav'}><a href="#sobre-mi" onClick={()=>setMenu(false)}>Sobre mí</a><a href="#acompanamiento" onClick={()=>setMenu(false)}>Motivos de consulta</a><a href="#preguntas" onClick={()=>setMenu(false)}>Preguntas frecuentes</a><a href="/reflexiones">Reflexiones</a><a className="button nav-book" href="#cita" onClick={()=>setMenu(false)}>Primera conversación gratuita <ArrowUpRight/></a></nav><div className="header-controls"><button className="icon-button theme" onClick={toggleTheme} aria-label="Cambiar entre tema claro y oscuro"><Sun className="sun"/><Moon className="moon"/></button><button className="icon-button menu-button" aria-label={menu?'Cerrar menú':'Abrir menú'} aria-expanded={menu} onClick={()=>setMenu(!menu)}>{menu?<X/>:<List/>}</button></div></div></header>
 <main id="contenido"><section className="hero wrap"><div className="hero-copy"><p className="eyebrow">CONSULTORIO PSI · MADRID</p><h1>Psicoterapia para adultos y parejas</h1><p className="hero-credential">Psicóloga General Sanitaria · M-45148</p><p className="hero-specialty">Eugenia Longhi</p><p className="hero-promise">Comprender lo que te está pasando puede ayudarte a reconocer patrones, entender tus vínculos y encontrar nuevas formas de afrontar lo que hoy te genera malestar.</p><p>Presencial · Online</p><div className="hero-actions"><a className="button" href="#cita">Agendar primera conversación gratuita <ArrowUpRight/></a><p className="hero-cta-note">20 minutos · online · sin compromiso</p><a className="subtle-link" href="#acompanamiento">Conocé cómo puedo acompañarte <ArrowRight/></a></div></div><div className="hero-image"><img src="/images/consulta.webp" srcSet="/images/consulta-800.webp 800w, /images/consulta.webp 1400w" sizes="(max-width: 640px) calc(100vw - 44px), (max-width: 1280px) 45vw, 556px" alt="Imagen ilustrativa de una consulta luminosa con sillones, una mesa de madera y plantas" width="1400" height="933" fetchPriority="high"/></div></section>
 <section className="intro-strip wrap" aria-label="Experiencia y acreditación profesional"><span><Clock/>+6 años de experiencia clínica</span><span><CheckCircle/>Experiencia en consulta privada y ámbito hospitalario</span><span><MapPin/>Atención online o presencial en Madrid · zona Metro Avenida de América</span></section>
 <section id="acompanamiento" className="section wrap services"><div className="section-heading"><p className="eyebrow">MOTIVOS DE CONSULTA</p><h2>¿Qué puede llevarte a terapia?</h2><p>No siempre es fácil poner en palabras qué nos pasa o saber si es un motivo para consultar. Estos son algunos de los temas que podemos trabajar en terapia.</p></div><div className="services-grid">{services.map(({title,desc,Icon})=><article className="service service-static" key={title}><Icon className="service-icon" size={30} weight="light"/><div><h3>{title}</h3><p>{desc}</p></div></article>)}</div><div className="services-closing"><p>No es necesario que lo que te ocurre encaje exactamente en una de estas categorías. Si no sabes bien cómo definir lo que estás atravesando, podemos hablarlo en una primera conversación.</p><a className="text-button" href="#cita">Agendar primera conversación gratuita <ArrowRight/></a></div></section>
 <TherapyAreas onConsult={()=>window.open(WHATSAPP,'_blank','noopener,noreferrer')}/><About/><Starting/>
 <section className="section wrap faq" id="preguntas"><div><h2>Es normal tener preguntas.</h2><p>Antes de empezar, también hay espacio para tus dudas.</p><button className="text-button" onClick={()=>window.open(WHATSAPP,'_blank','noopener,noreferrer')}>Pregúntame por chat <ChatCircle/></button></div><div className="faq-list">{faqs.map(([q,a])=><details key={q}><summary>{q}<Plus className="plus"/><Minus className="minus"/></summary>{a.map(p=><p key={p}>{p}</p>)}</details>)}</div></section>
 <div className="wrap"><GoogleBooking onPrivacy={()=>setPrivacy(true)}/></div>
 <ReflectionsPreview/>
 <section className="contact-section wrap" id="contacto"><div><ChatCircle size={35} weight="light"/><h2>¿Prefieres hablar conmigo antes de reservar?</h2><p>Si tienes alguna duda o quieres contarme brevemente qué estás buscando antes de agendar, puedes escribirme por WhatsApp. Te responderé personalmente.</p><p className="small">Psicoterapia presencial en Madrid y online.</p></div><a className="button" href={WHATSAPP} target="_blank" rel="noreferrer">Escribirme por WhatsApp <ArrowUpRight/></a></section></main>
 <footer className="footer wrap"><div><Brand/><p><strong>Eugenia Longhi</strong><br/>Psicóloga General Sanitaria<br/>Colegiada M-45148<br/>Madrid · España</p><a className="text-button" href="tel:+34651197405">+34 651 197 405</a></div><div className="footer-right"><a href="/aviso-legal">Aviso legal</a><a href="/privacidad">Política de privacidad</a><a href="/cookies">Política de cookies</a><a href="https://www.instagram.com/_consultoriopsi/" target="_blank" rel="noreferrer">@_consultoriopsi <ArrowUpRight size={12}/></a><a href="/admin">Zona profesional</a><small>Reservas gestionadas con Google Calendar.</small></div></footer>
 <button className="chat-launcher" aria-label="Abrir asistente virtual" onClick={()=>setChat(true)}><ChatCircle size={25}/><span>¿Tienes una duda?</span></button>{chat&&<Assistant Modal={Modal} onClose={()=>setChat(false)}/>} {privacy&&<Privacy onClose={()=>setPrivacy(false)}/>}</>;
}
createRoot(document.getElementById('root')).render(<IconContext.Provider value={{size:20,weight:'regular'}}><App/></IconContext.Provider>);





