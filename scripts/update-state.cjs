const fs=require('node:fs'),path=require('node:path');
const {VillagePlayer}=require('../dist/player.js');
const clone=x=>JSON.parse(JSON.stringify(x));
const clamp=x=>Math.max(0,Math.min(100,x));
const SLOT_MS=2*60*60*1000,KEEP=168;
function note(state,text){const m=Math.round(state.hour*60);state.logs.unshift(`第${Math.floor(m/1440)+1}日 ${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(m%60).padStart(2,'0')}　${text}`);state.logs=state.logs.slice(0,35);}
function step(previous){
 const s=clone(previous);s.hour=Math.round((s.hour+1/12)*12)/12;
 if(s.rain>0)s.rain=Math.max(0,s.rain-1);
 for(const p of s.people){
  p.hunger=clamp(p.hunger+.9);p.energy=clamp(p.energy-.35);p.social=clamp(p.social+.8);p.curiosity=clamp(p.curiosity+.7);
  if(p.remainingSteps>0){p.remainingSteps--;continue;}
  const tired=100-p.energy,night=s.hour%24>=21||s.hour%24<6;
  const choices=[
   {a:0,s:s.food>=1?p.hunger*1.3:-1,to:'home',why:'お腹がすいてきた。家で食事をしよう。'},
   {a:1,s:tired*1.2+(night?35:0),to:'home',why:night?'夜になったので、家でゆっくり休もう。':'疲れたので、家で少し休もう。'},
   {a:2,s:Math.max(0,9-s.food)*7*(p.safe||1)+12+Math.min(8,p.success)*2-tired*.3-(s.rain?22:0),to:'forest',why:'村の食料を確かめて、森で木の実を集めよう。'},
   {a:3,s:p.social*(p.care||1)*.65,to:'square',why:'広場で仲間の様子を見て、話をしたい。'},
   {a:4,s:p.curiosity*(p.adventure||1)*.45-tired*.5-(s.rain?35:0),to:'hill',why:'丘の向こうを歩いて、新しい景色を探そう。'}
  ].sort((a,b)=>b.s-a.s);
  const c=choices[0];p.scores=choices;p.activityArea=c.to;p.action=['食べる','休む','採集する','交流する','探検する'][c.a];p.reason=c.why;p.remainingSteps=c.a===1?2:1;
  if(c.a===0){s.food--;p.hunger=clamp(p.hunger-55);}
  if(c.a===1)p.energy=clamp(p.energy+18);
  if(c.a===2){s.food+=s.rain?1:2;p.energy=clamp(p.energy-4);p.success++;}
  if(c.a===3){p.social=clamp(p.social-45);p.kindness++;}
  if(c.a===4){p.curiosity=clamp(p.curiosity-55);p.energy=clamp(p.energy-6);p.discoveries++;if(p.discoveries%3===0)s.food+=3;}
  note(s,`${p.name}：${p.action}。`);
 }
 return s;
}
function makeBatch(previous,slot){
 let state=clone(previous.endState);const frames=[];
 for(let minute=0;minute<120;minute+=5){frames.push({minute,state:clone(state)});state=step(state);}
 return VillagePlayer.validate({schemaVersion:2,mode:'relative',title:'こもれびの村・2時間の記録',durationMinutes:120,stepMinutes:5,generatedSlot:slot,generatedAt:new Date(slot*SLOT_MS).toISOString(),frames,endState:state});
}
function update(root,now=new Date()){
 const file=path.join(root,'dist/state.json');let batch=VillagePlayer.validate(JSON.parse(fs.readFileSync(file,'utf8')));
 const target=Math.floor(now.getTime()/SLOT_MS);if(!Number.isFinite(target))throw Error('Invalid execution time');
 const last=batch.generatedSlot;
 if(last!==undefined&&!Number.isSafeInteger(last))throw Error('Invalid generatedSlot');
 if(last!==undefined&&target<=last)return {updated:0,remaining:0};
 const first=last===undefined?target:last+1;
 // Bound work per run after a long pause; subsequent runs continue from this slot.
 const stop=Math.min(target,first+83),history=path.join(root,'data/history');fs.mkdirSync(history,{recursive:true});
 for(let slot=first;slot<=stop;slot++){
  const start=Math.round(batch.frames[0].state.hour*60);
  fs.writeFileSync(path.join(history,`${String(start).padStart(12,'0')}.json`),JSON.stringify(batch,null,2)+'\n');
  batch=makeBatch(batch,slot);
 }
 const files=fs.readdirSync(history).filter(n=>/^\d{12}\.json$/.test(n)).sort();
 for(const name of files.slice(0,Math.max(0,files.length-KEEP)))fs.unlinkSync(path.join(history,name));
 fs.writeFileSync(file,JSON.stringify(batch,null,2)+'\n');
 return {updated:stop-first+1,remaining:target-stop};
}
if(require.main===module){const result=update(path.resolve(__dirname,'..'));console.log(JSON.stringify(result));}
module.exports={step,makeBatch,update,SLOT_MS};
