const fs=require('node:fs'),path=require('node:path');
const {VillagePlayer}=require('../dist/player.js');
const {migrateTimeline}=require('./identities.cjs');
const {translate,convertTimeline}=require('../dist/mehs.js');
const lifecycle=require('./lifecycle.cjs');
const {VillageGeography:G}=require('../dist/geography.js');
const relay=require('./relay.cjs');
const incidents=require('./incidents.cjs');
const powerWear=require('./power-wear.cjs');
const R=require('./random.cjs'),discoveries=require('./discoveries.cjs'),weather=require('./weather.cjs');
const aiRoutines=require('./ai-routines.cjs');
const programs=require('./programs.cjs'),external=require('./external-events.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
const clamp=x=>Math.max(0,Math.min(100,x));
const SLOT_MS=2*60*60*1000,KEEP=360;
function note(state,text){const m=Math.round(state.hour*60);state.logs.unshift(`第${Math.floor(m/1440)+1}日 ${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(m%60).padStart(2,'0')}　${text}`);state.logs=state.logs.slice(0,35);}
function perform(s,p,c,note){
 p.scores=c.scores||[];p.activityArea=G.areaOf(p);p.action=['充電する','整備する','資源を回収する','通信する','探索する'][c.a];p.reason=translate(c.why);p.remainingSteps=c.a===1?2:1;
 const hint=p.hint&&p.hint.untilHour>=s.hour?p.hint:null;
 if(c.a===0){
  if(s.food<1){p.reason='充電の工房へ到着しましたが、電力セルの補給を待っています。';p.remainingSteps=0;return;}
  s.food--;p.hunger=clamp(p.hunger-55);
 }
 if(c.programRevision&&p.program&&c.programRevision===aiRoutines.revision(p)){p.program.used=(p.program.used||0)+1;p.reason+=' 自作ルーチン「'+p.program.name+'」を使いました。';}
 if(c.a===1)p.energy=clamp(p.energy+18);
 if(c.a===2&&p.activityArea==='deepForest'&&hint?.falseReport){
  delete p.hint;p.energy=clamp(p.energy-4);
  p.informationExperience??={received:0,disproved:0};p.informationExperience.disproved++;
  p.informationExperience.lastSourceId=hint.sourceId;p.informationExperience.lastCheckedHour=s.hour;
  p.reason=`#${hint.sourceId}の情報を確かめましたが、セルは見つかりませんでした。`;
  note(s,`MEHS #${p.id}：#${hint.sourceId}から教わった場所を確かめたが、何も見つからなかった。`);
  p.lastEvent={text:p.reason,findId:null,hour:s.hour,untilHour:s.hour+.5};return;
 }
 if(c.a===2&&p.activityArea==='deepForest'){p.reason='回収情報の期限が切れたため、林の奥での回収を見送りました。';p.remainingSteps=0;note(s,`MEHS #${p.id}：林の奥の回収情報が期限切れ。`);return;}
 if(c.a===2){const found=(s.rain?1:2)+(s.sites.some(site=>site.id==='cell-grove')&&R.next(s)<.25?1:0);const stored=found*(s.incident?(s.incident.stage==='repair'?.5:.25):1);s.food+=stored;if(s.incident)s.incident.discardedCells=(s.incident.discardedCells||0)+found-stored;s.resources.parts+=.35;p.energy=clamp(p.energy-4);p.success++;}
 if(c.a===3){
  const local=G.peers(s,p),remote=local.length?[]:relay.remotePeers(s,p);
  const peers=local.length?local:remote;
  if(peers.length){
   p.social=clamp(p.social-45);p.kindness++;
   discoveries.communicate(s,p,note,peers);programs.share(s,p,note,peers);incidents.share(s,p,peers,note);
   if(remote.length){p.reason='中継器を使って離れた場所の仲間と通信しました。';relay.use(s,p,remote[0],note);}
  }
  else p.reason='仲間の到着を待ちながら、通信できる相手を探しています。';
 }
 if(c.a===4){p.curiosity=clamp(p.curiosity-55);p.energy=clamp(p.energy-6);p.discoveries++;if(p.activityArea!=='deepForest'&&p.discoveries%3===0)s.food+=3;}
 note(s,`MEHS #${p.id}：${p.action}。`);
 if(c.a===2||c.a===4){if(hint&&!hint.falseReport&&c.a===(hint.kind==='recover'?2:4))delete p.hint;discoveries.discover(s,p,c.a,note);}
}
function emergency(s,p){return p.hunger>=85&&s.food>=1?0:p.energy<=15?1:null;}
function dispatch(s,p,c,note){
 const hint=p.hint?.untilHour>=s.hour?p.hint:null,area=G.areaOf(p);
 let to=c.a===3&&relay.remotePeers(s,p).length?area:G.target(s,p,c.a);
 if(c.a===2&&hint?.falseReport)to='deepForest';
 if(c.a===4&&!s.rain&&area==='forest'&&hint?.kind!=='explore'&&R.next(s)<.15)to='deepForest';
 if(G.depart(p,to,c,s.hour))note(s,`MEHS #${p.id}が${G.places[to].name}へ出発。`);else if(c.a===5)aiRoutines.work(s,p,note);else perform(s,p,c,note);
}
function step(previous,context={}){
 const s=lifecycle.initialize(clone(previous));
 for(const p of s.people){G.initialize(p);if(p.hint?.falseReport&&p.hint.untilHour<s.hour)delete p.hint;}
 powerWear.addExposure(s,1/12);weather.addExposure(s,1/12);s.hour=Math.round((s.hour+1/12)*12)/12;
 weather.advance(s,note);
 if(context.plugin){if(context.plugin.source)external.apply(s,context.time+300000,context.plugin,note);aiRoutines.apply(s,context.time+300000,context.plugin,note);}
 // Advance everyone first so contact does not depend on the order of arrivals.
 const arrivals=new Map();for(const p of s.people){const plan=G.advance(p,s.hour);if(plan)arrivals.set(p.id,plan);}
 for(const p of s.people){
  p.hunger=clamp(p.hunger+.9);p.energy=clamp(p.energy-.35);p.social=clamp(p.social+.8);p.curiosity=clamp(p.curiosity+.7);
 }
 incidents.prepare(s,note);
 relay.prepare(s,note);
 for(const p of s.people){
  const pending=aiRoutines.checkPending(s,p,note);
  if(s.assembly?.builderId===p.id&&s.hour<s.assembly.readyHour)continue;
  const urgent=emergency(s,p),arrived=arrivals.get(p.id);
  if(urgent===null&&incidents.assigned(s,p)){incidents.work(s,p,note);continue;}
  if(p.journey?.plan.a===incidents.ACTION){delete p.journey;p.remainingSteps=0;}
  if(pending&&p.pendingRoutine.readyHour!==undefined){
   if(urgent===null&&aiRoutines.work(s,p,note))continue;
   delete p.pendingRoutine.readyHour;
  }
  if(p.journey?.plan.a===5){
   if(urgent!==null)dispatch(s,p,{a:urgent,why:'開発より充電・整備を優先します。'},note);
   continue;
  }
  if(arrived?.a===5){
   if(urgent!==null){dispatch(s,p,{a:urgent,why:'開発より充電・整備を優先します。'},note);continue;}
   if(pending&&aiRoutines.canWork(s,p)&&aiRoutines.work(s,p,note))continue;
  }
  const job=urgent===null?relay.assigned(s,p):null;
  if(job){
   if(p.journey?.plan.a!==relay.ACTION||p.journey.to!==job.to)relay.work(s,p,job,note);
   continue;
  }
  if(p.journey?.plan.a===relay.ACTION){delete p.journey;p.remainingSteps=0;}
  if(p.journey){
   const suggested=programs.recommend(s,p,note),a=urgent??suggested;
   if(a!==null&&a!==p.journey.plan.a){
    const plan={a,why:urgent!==null?'充電・整備を優先して行き先を変えます。':'自作ルーチンで行き先を見直しました。',programRevision:urgent===null?aiRoutines.revision(p):null};
    dispatch(s,p,plan,note);
   }
   continue;
  }
  if(arrived&&arrived.a!==5&&arrived.a!==relay.ACTION&&arrived.a!==incidents.ACTION){
   // Conditions and stock may have changed while travelling.
   if(urgent!==null&&urgent!==arrived.a)dispatch(s,p,{a:urgent,why:'到着時の機体状態から充電・整備を優先します。'},note);
   else perform(s,p,arrived,note);
   continue;
  }
  if(p.remainingSteps>0){p.remainingSteps--;continue;}
  if(urgent===null&&pending&&aiRoutines.canWork(s,p)){dispatch(s,p,{a:5,why:'改良案を開発室で試します。'},note);continue;}
  const suggested=programs.recommend(s,p,note),tired=100-p.energy;
  const choices=[
   {a:0,s:s.food>=1?p.hunger*1.3:-1,why:'充電の工房で電力を補給しよう。'},
   {a:1,s:tired*1.2,why:'充電の工房で機体を整備しよう。'},
   {a:2,s:Math.max(0,9-s.food)*7*(p.safe||1)+12+(s.incident?.waitingForParts?45:0)+Math.min(8,p.success)*2-tired*.3-(s.rain?22:0),why:'村の備蓄を確かめて、林で資源を回収しよう。'},
   {a:3,s:p.social*(p.care||1)*.65,why:'仲間と通信して、情報を交換したい。'},
   {a:4,s:p.curiosity*(p.adventure||1)*.45-tired*.5-(s.rain?35:0),why:'丘へ向かい、新しい発見を探そう。'}
  ].sort((a,b)=>b.s-a.s);
  if(suggested!==null){const target=choices.find(c=>c.a===suggested);if(target.s>=0)target.s+=6;choices.sort((a,b)=>b.s-a.s);}
  const hint=p.hint&&p.hint.untilHour>=s.hour?p.hint:null;
  if(hint){const target=choices.find(c=>c.a===(hint.kind==='recover'?2:4));target.s+=10;target.why=`#${hint.sourceId}から受け取った発見情報を確かめたい。`;choices.sort((a,b)=>b.s-a.s);}
  const c=urgent!==null?choices.find(c=>c.a===urgent):R.chooseAction(s,choices);
  const plan={a:c.a,why:c.why+(c!==choices[0]?' 優先度が近い選択肢から、今回はこれを選びました。':''),scores:choices,programRevision:suggested===c.a?aiRoutines.revision(p):null};
  p.scores=choices;dispatch(s,p,plan,note);
 }
 incidents.finishStep(s,note);
 lifecycle.advance(s);
 for(const result of s.routineUpdates?.results||[]){
  if(result.status==='queued'&&!s.people.some(p=>p.id===result.residentId)){
   result.status='skipped';result.reason='resident-absent';
  }
 }
 return s;
}
function makeBatch(previous,slot,options={}){
 previous=lifecycle.migrateTimeline(convertTimeline(migrateTimeline(previous)));
 const anchor=slot*SLOT_MS,start=anchor-SLOT_MS,end=anchor+2*SLOT_MS;
 let frames=[],state,time,origin;
 if(previous.schemaVersion===3){
  VillagePlayer.validate(previous);
  if(anchor<Date.parse(previous.anchorAt))throw Error('Clock moved backwards');
  if(anchor===Date.parse(previous.anchorAt))return clone(previous);
  frames=clone(previous.frames);state=clone(previous.endState);time=Date.parse(previous.windowEnd);origin=previous.worldOrigin;
 }else{
  if(!previous.endState||!Array.isArray(previous.endState.people))throw Error('Missing migration state');
  state=clone(previous.endState);time=start;
  origin=new Date(Math.floor((start+9*3600000)/86400000)*86400000-9*3600000).toISOString();
  state.hour=(start-Date.parse(origin))/3600000;
 }
 if((end-time)/300000>105120)throw Error('More than one year of catch-up requires manual review');
 while(time<end){frames.push({at:new Date(time).toISOString(),state:clone(state)});state=step(state,{time,plugin:options.plugin});time+=300000;}
 frames=frames.filter(f=>Date.parse(f.at)>=start&&Date.parse(f.at)<end);
 return VillagePlayer.validate({schemaVersion:3,mode:'realtime',title:'こもれびの村・6時間の記録',stepMinutes:5,windowStart:new Date(start).toISOString(),anchorAt:new Date(anchor).toISOString(),windowEnd:new Date(end).toISOString(),worldOrigin:origin,generatedAt:new Date().toISOString(),frames,endState:state});
}
function update(root,now=new Date(),options={}){
 const file=path.join(root,'dist/state.json'),previous=JSON.parse(fs.readFileSync(file,'utf8'));
 const target=Math.floor(now.getTime()/SLOT_MS);if(!Number.isSafeInteger(target))throw Error('Invalid execution time');
 const history=path.join(root,'data/history');fs.mkdirSync(history,{recursive:true});
 if(previous.schemaVersion===3&&target*SLOT_MS<=Date.parse(previous.anchorAt)){VillagePlayer.validate(previous);return {updated:0};}
 const batch=makeBatch(previous,target,options);
 const key=previous.schemaVersion===3?String(Date.parse(previous.anchorAt)):String(Math.round(previous.frames[0].state.hour*60));
 fs.writeFileSync(path.join(history,key.padStart(13,'0')+'.json'),JSON.stringify(previous,null,2)+'\n');
 const files=fs.readdirSync(history).filter(n=>/^\d{12,13}\.json$/.test(n)).sort();
 for(const name of files.slice(0,Math.max(0,files.length-KEEP)))fs.unlinkSync(path.join(history,name));
 const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(batch,null,2)+'\n');fs.renameSync(temp,file);
 return {updated:1,windowStart:batch.windowStart,windowEnd:batch.windowEnd};
}
if(require.main===module){let plugin=null;try{if(process.env.EXTERNAL_PLUGIN_PATH)plugin=require('./daily-package.cjs').validate(JSON.parse(fs.readFileSync(process.env.EXTERNAL_PLUGIN_PATH,'utf8')));}catch{console.warn('External plugin unavailable.');}console.log(JSON.stringify(update(path.resolve(__dirname,'..'),new Date(),{plugin})));}
module.exports={step,makeBatch,update,SLOT_MS};

