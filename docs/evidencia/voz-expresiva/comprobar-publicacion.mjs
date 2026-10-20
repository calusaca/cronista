import {chromium,expect} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base=JSON.parse(readFileSync('docs/evidencia/azure-arena-publicacion.json','utf8')).url;
const folder='docs/evidencia/voz-expresiva';
const report={checkedUtc:new Date().toISOString(),scope:'public_azure_container_app_real_speech',url:base,playbackAcceleratedBySeeking:true,newTeamModelCalls:0,newAnalystCalls:0,samples:[],segments:[],errors:[]};
let browser;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
try{
 for(const name of ['calma-es','ataque-es','gol-es','gol-es-sereno','gol-en','duelo-es-completo']){
  const path=`/experimentos/voz-expresiva/${name}.mp3`;
  const r=await fetch(base+path,{signal:AbortSignal.timeout(60000)});
  assert.equal(r.status,200,path);
  assert.match(r.headers.get('content-type'),/audio/);
  const bytes=Buffer.from(await r.arrayBuffer());
  assert.equal(hash(bytes),hash(readFileSync('public'+path)),path);
  report.samples.push({name,http:r.status,bytes:bytes.length,sha256:hash(bytes)});
 }
 browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('response',async r=>{if(r.url().includes('/relato')&&r.request().method()==='POST'){
  try{const body=await r.json();report.segments.push({http:r.status(),desdeTick:body.desdeTick,hastaTick:body.hastaTick,voiceVersion:body.audio?.version,voice:body.audio?.voz,events:body.fuentes,narratedEvents:body.eventosNarrados,carryFrames:body.fotogramas,emotions:body.fragmentos?.map(f=>f.emocion),bytes:Buffer.from(body.audio?.base64??'','base64').length});}catch(e){report.errors.push(e.message);}
 }});
 await page.goto(base+'/arena',{timeout:90000});
 await page.getByRole('button',{name:'Switch to Spanish'}).click();
 await page.getByRole('button',{name:'Cargar duelo de modelos grabado'}).click();
 const voice=page.getByTestId('arena-narration');
 await expect(voice).toContainText('La voz aumenta la tensión');
 await voice.getByRole('button',{name:'Activar narración de esta grabación'}).click();
 await expect(voice.getByRole('button',{name:'Escuchar desde el inicio'})).toBeEnabled({timeout:30000});
 await voice.getByRole('button',{name:'Escuchar desde el inicio'}).click();
 for(let i=0;i<6;i++){
  await expect(voice.locator('summary')).toContainText(`${i*10}–${(i+1)*10} s`,{timeout:45000});
  await expect.poll(()=>voice.locator('audio').evaluate(a=>Number.isFinite(a.duration)&&a.duration>0),{timeout:15000}).toBe(true);
  const duration=await voice.locator('audio').evaluate(a=>a.duration);
  report.segments[i].decodedDurationSeconds=duration;
  assert.equal(report.segments[i].voiceVersion,'voz-expresiva-v1');
  assert.equal(report.segments[i].http,200);
  await voice.locator('audio').evaluate(a=>{a.currentTime=Math.max(0,a.duration-.08);void a.play();});
 }
 await expect(voice.getByRole('status')).toHaveText('Fin de la narración',{timeout:15000});
 await voice.locator('details').evaluate(d=>{d.open=true;});
 await voice.screenshot({path:`${folder}/narracion-publica-escritorio.png`});
 await page.setViewportSize({width:360,height:780});
 await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});
 report.mobileOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>360);
 assert.equal(report.mobileOverflow,false);
 await voice.screenshot({path:`${folder}/narracion-publica-movil.png`});
 const recorded=JSON.parse(readFileSync('public/experimentos/arena-duelo-v3.json','utf8'));
 const covered=new Set(report.segments.flatMap(s=>s.events));
 report.recordedEvents=recorded.eventos.length;
 report.allRecordedEventsCovered=recorded.eventos.every(e=>covered.has(e.id));
 assert.equal(report.allRecordedEventsCovered,true);
 assert.equal(report.segments.length,6);
 assert.equal(report.errors.length,0);
 assert(report.segments.some(s=>s.emotions.includes('jubilo')));
 report.status='passed';
}catch(e){report.status='failed';report.error=e.message;process.exitCode=1;}
finally{
 await browser?.close();
 report.finishedUtc=new Date().toISOString();
 writeFileSync(`${folder}/navegador-publico.json`,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,error:report.error,samples:report.samples.length,audioSegments:report.segments.length,events:report.recordedEvents,allCovered:report.allRecordedEventsCovered,errors:report.errors}));
}
