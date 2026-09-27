import {chromium} from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const work=resolve('../../work');await mkdir(work,{recursive:true});
const server=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'4280',DATA_DIR:resolve(work,'browser-data-'+Date.now())},stdio:'pipe'});
await new Promise((r,j)=>{server.stdout.once('data',r);server.once('error',j);});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const errors=[];const report={};
try{
 const visitor=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'light'});const p=await visitor.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:4280');await p.getByRole('button',{name:'09:00',exact:true}).waitFor();await p.evaluate(()=>document.fonts.ready);await p.screenshot({path:resolve(work,'desktop-light.png')});await p.screenshot({path:resolve(work,'full-light.png'),fullPage:true});
 assert.equal(await p.locator('h1').innerText(),'Eugenia Longhi');
 assert.deepEqual(await p.locator('#preguntas summary').allTextContents(),['¿Qué puedo esperar de la terapia?','¿Cuánto dura una sesión?','¿Con qué frecuencia se realizan?','¿Cuánto tiempo dura un proceso terapéutico?']);report.desktopA11y=(await new AxeBuilder({page:p}).analyze()).violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>n.target)}));
 await p.getByRole('button',{name:'09:00',exact:true}).click();await p.getByRole('button',{name:'Continuar con la reserva'}).click();
 const dialog=p.getByRole('dialog',{name:'Completar reserva'});await dialog.getByLabel('Nombre completo').fill('Visitante de prueba');await dialog.getByLabel('Teléfono',{exact:true}).fill('+34 600 000 000');await dialog.getByLabel('Correo electrónico').fill('visitante@example.com');await dialog.locator('input[name=privacyRead]').check();
 report.formA11y=(await new AxeBuilder({page:p}).analyze()).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}));
 await p.getByRole('button',{name:'Confirmar reserva de prueba'}).click();await p.getByRole('heading',{name:'Tu prueba está reservada.'}).waitFor();
 const download=await Promise.all([p.waitForEvent('download'),p.getByRole('link',{name:'Añadir a mi calendario'}).click()]);assert.equal(download[0].suggestedFilename(),'cita-de-prueba.ics');
 await p.getByRole('button',{name:'Cerrar',exact:true}).click();await p.getByRole('button',{name:'Mis reservas',exact:true}).click();await p.getByRole('button',{name:'Cancelar reserva',exact:true}).click();await p.getByRole('button',{name:'Sí, cancelar',exact:true}).click();await p.getByText('Online · Cancelada',{exact:true}).waitFor();await p.getByRole('button',{name:'Cerrar',exact:true}).click();report.booking='Reservation, download and cancellation passed';
 assert.equal(await p.locator('.therapy-form').count(),0);
await p.getByRole('button',{name:'Abrir chat con Eugenia'}).click();await p.getByLabel('Tu mensaje',{exact:true}).fill('Hola, me gustaría saber cómo son las sesiones.');await p.getByRole('button',{name:'Enviar mensaje',exact:true}).click();await p.locator('.bubble.outgoing').waitFor();
 const professional=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'light'});const a=await professional.newPage();a.on('pageerror',e=>errors.push(e.message));await a.goto('http://127.0.0.1:4280/admin');await a.getByLabel('Contraseña',{exact:true}).fill('consultorio-demo');await a.getByRole('button',{name:'Entrar',exact:true}).click();await a.getByRole('heading',{name:'Hola, Eugenia.'}).waitFor();await a.getByRole('button',{name:/Mensajes/}).click();await a.getByRole('button',{name:/Visitante 1/}).click();await a.getByLabel('Tu respuesta',{exact:true}).fill('Hola, podemos dedicar la primera sesión a conocer lo que necesitas.');await a.getByRole('button',{name:'Enviar respuesta'}).click();await p.getByText('Hola, podemos dedicar la primera sesión a conocer lo que necesitas.',{exact:true}).waitFor({timeout:10000});await p.screenshot({path:resolve(work,'chat.png')});await a.screenshot({path:resolve(work,'admin.png')});report.chat='Visitor message, professional reply and visitor reception passed';
 report.chatA11y=(await new AxeBuilder({page:p}).analyze()).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}));report.adminA11y=(await new AxeBuilder({page:a}).analyze()).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}));
 await p.getByRole('button',{name:'Cerrar',exact:true}).click();await p.getByRole('button',{name:'Cambiar entre tema claro y oscuro'}).click();await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:resolve(work,'desktop-dark.png')});report.darkA11y=(await new AxeBuilder({page:p}).analyze()).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}));
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:1,colorScheme:'light'});const m=await mobile.newPage();m.on('pageerror',e=>errors.push(e.message));await m.goto('http://127.0.0.1:4280');await m.getByRole('button',{name:'10:00',exact:true}).waitFor();await m.evaluate(()=>document.fonts.ready);await m.screenshot({path:resolve(work,'mobile.png')});await m.screenshot({path:resolve(work,'mobile-full.png'),fullPage:true});assert.ok(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await m.getByRole('button',{name:'Abrir menú',exact:true}).click();await m.getByRole('link',{name:'Reserva tu cita',exact:true}).click();await m.getByRole('button',{name:'10:00',exact:true}).click();await m.screenshot({path:resolve(work,'mobile-booking.png')});report.mobileA11y=(await new AxeBuilder({page:m}).analyze()).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}));report.mobile='390px layout, menu, calendar and no horizontal overflow passed';
 await m.setViewportSize({width:320,height:740});assert.ok(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));report.smallMobile='320px no horizontal overflow';
 report.errors=errors;await writeFile(resolve(work,'browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));assert.equal(errors.length,0);
}finally{await browser.close();server.kill();}



