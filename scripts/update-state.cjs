const fs=require('node:fs'),path=require('node:path');
const {VillagePlayer}=require('../dist/player.js');
const {migrateTimeline}=require('./identities.cjs');
const {translate,convertTimeline}=require('../dist/mehs.js');
const lifecycle=require('./lifecycle.cjs');
const R=require('./random.cjs'),discoveries=require('./discoveries.cjs'),weather=require('./weather.cjs');
const aiRoutines=require('./ai-routines.cjs');
const programs=require('./programs.cjs'),external=require('./external-events.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
const clamp=x=>Math.max(0,Math.min(100,x));
const SLOT_MS=2*60*60*1000,KEEP=360;
function note(state,text){const m=Math.round(state.hour*60);state.logs.unshift(`第${Math.floor(m/1440)+1}日 ${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(m%60).padStart(2,'0')}　${text}`);state.logs=state.logs.slice(0,35);}
function step(previous,context={}){
 const s=lifecycle.initialize(clone(previous));weather.addExposure(s,1/12);s.hour=Math.round((s.hour+1/12)*12)/12;
 weather.advance(s,note);
 if(context.plugin){if(context.plugin.source)external.apply(s,context.time+300000,context.plugin,note);aiRoutines.apply(s,context.time+300000,context.plugin,note);}
 for(const p of s.people){
  p.hunger=clamp(p.hunger+.9);p.energy=clamp(p.energy-.35);p.social=clamp(p.social+.8);p.curiosity=clamp(p.curiosity+.7);
  if(s.assembly?.builderId===p.id&&s.hour<s.assembly.readyHour)continue;
  if(p.remainingSteps>0){p.remainingSteps--;continue;}
  const suggested=programs.recommend(s,p,note);
  const tired=100-p.energy;
  const choices=[
   {a:0,s:s.food>=1?p.hunger*1.3:-1,to:'home',why:'お腹がすいてきた。家で食事をしよう。'},
   {a:1,s:tired*1.2,to:'home',why:'疲れたので、家で少し休もう。'},
   {a:2,s:Math.max(0,9-s.food)*7*(p.safe||1)+12+Math.min(8,p.success)*2-tired*.3-(s.rain?22:0),to:'forest',why:'村の食料を確かめて、森で木の実を集めよう。'},
   {a:3,s:p.social*(p.care||1)*.65,to:'square',why:'広場で仲間の様子を見て、話をしたい。'},
   {a:4,s:p.curiosity*(p.adventure||1)*.45-tired*.5-(s.rain?35:0),to:'hill',why:'丘の向こうを歩いて、新しい景色を探そう。'}
  ].sort((a,b)=>b.s-a.s);
  if(suggested!==null){const target=choices.find(c=>c.a===suggested);if(target.s>=0)target.s+=6;choices.sort((a,b)=>b.s-a.s);}
  const hint=p.hint&&p.hint.untilHour>=s.hour?p.hint:null;
  if(hint){const target=choices.find(c=>c.a===(hint.kind==='recover'?2:4));target.s+=10;target.why=`#${hint.sourceId}から受け取った発見情報を確かめたい。`;choices.sort((a,b)=>b.s-a.s);}
  const c=(p.hunger>=85&&s.food>=1)?choices.find(x=>x.a===0):p.energy<=15?choices.find(x=>x.a===1):R.chooseAction(s,choices);for(const choice of choices)choice.why=translate(choice.why);p.scores=choices;p.activityArea=c.to;p.action=['充電する','整備する','資源を回収する','通信する','探索する'][c.a];p.reason=translate(c.why)+(c!==choices[0]?' 優先度が近い選択肢から、今回はこれを選びました。':'');p.remainingSteps=c.a===1?2:1;
  if(suggested===c.a&&p.program){p.program.used=(p.program.used||0)+1;p.reason+=' 自作ルーチン「'+p.program.name+'」を使いました。';}
  if(c.a===0){s.food--;p.hunger=clamp(p.hunger-55);}
  if(c.a===1)p.energy=clamp(p.energy+18);
  if(c.a===2){if(s.sites.some(site=>site.id==='cell-grove')&&R.next(s)<.25)s.food+=1;s.resources.parts+=.35;s.food+=s.rain?1:2;p.energy=clamp(p.energy-4);p.success++;}
  if(c.a===3){p.social=clamp(p.social-45);p.kindness++;}
  if(c.a===4){p.curiosity=clamp(p.curiosity-55);p.energy=clamp(p.energy-6);p.discoveries++;if(p.discoveries%3===0)s.food+=3;}
  note(s,`MEHS #${p.id}：${p.action}。`);
  if(c.a===2||c.a===4){if(hint&&c.a===(hint.kind==='recover'?2:4))delete p.hint;discoveries.discover(s,p,c.a,note);}
  if(c.a===3){discoveries.communicate(s,p,note);programs.share(s,p,note);}
 }
 return lifecycle.advance(s);
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
