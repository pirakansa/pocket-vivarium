const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const L=require('../scripts/lifecycle.cjs'),E=require('../scripts/external-events.cjs');
const {step,makeBatch,SLOT_MS}=require('../scripts/update-state.cjs');
const {convertTimeline}=require('../dist/mehs.js'),{migrateTimeline}=require('../scripts/identities.cjs');
const {load}=require('../scripts/fetch-external-plugin.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
function world(n=2){return L.initialize({hour:0,food:30,rain:0,logs:[],nextResidentId:n+1,nextAssemblyHour:1e9,people:Array.from({length:n},(_,i)=>({id:i+1,kind:'mehs',color:'#709e91',care:1,safe:1,adventure:1,hunger:20,energy:80,social:60,curiosity:30,success:0,discoveries:0,kindness:0,remainingSteps:0,action:'整備する',activityArea:'home'}))});}
const time=Date.parse('2026-11-02T01:00:00Z'),note=(s,t)=>{s.logs.unshift(t);s.logs=s.logs.slice(0,35);};
const plugin=(source,at=time)=>({date:E.day(at),title:'日替わり確認',source});
const apply=(s,source,at=time)=>E.apply(s,at,plugin(source,at),note);
const story='return [{kind:"story",text:"住人がハルの家で食べるという古い記録を発見"}];';
const modern=world();apply(modern,story);
assert.deepEqual(convertTimeline({endState:modern}),{endState:modern});
assert.deepEqual(migrateTimeline({endState:modern}),{endState:modern});
const input=makeBatch({schemaVersion:2,endState:world()},Date.parse('2026-11-02T00:00:00Z')/SLOT_MS);
for(const frame of [...input.frames,{state:input.endState}]){frame.state.logs=['外界：住人がハルの家を見つけた'];}
const shifted=makeBatch(input,Date.parse(input.anchorAt)/SLOT_MS+1);
assert.deepEqual(shifted.frames.slice(0,48),input.frames.slice(24));assert.deepEqual(shifted.frames[48].state,input.endState);
const clean=world();apply(clean,'return [{kind:"story",text:"記録",source:"return [];",damage:999,extra:{code:"x"}}];');
assert.deepEqual(Object.keys(clean.externalEvent.results[0]).sort(),['kind','status','text']);assert(!JSON.stringify(clean.externalEvent).includes('return []'));
for(const n of [0,1,12]){
 const s=world(n);apply(s,'return [{kind:"arrival",text:"来訪した"}];');assert.equal(s.people.length,n<12?n+1:n);assert.equal(s.externalEvent.status,n<12?'applied':'skipped');if(n===12)assert.equal(s.externalEvent.results[0].reason,'population-limit');
 const d=world(n);apply(d,'return [{kind:"departure",text:"旅立った"}];');assert.equal(d.people.length,n>1?n-1:n);assert.equal(d.externalEvent.status,n>1?'applied':'skipped');
}
const builder=world();builder.assembly={builderId:1};apply(builder,'return [{kind:"departure",text:"旅立ち"}];');assert.deepEqual(builder.people.map(p=>p.id),[1]);assert.equal(builder.externalEvent.results[0].residentId,2);
// A visitor must not consume the slot reserved for a pending activation.
for(const n of [10,11]){
 const s=world(n),id=s.nextResidentId++;
 s.assembly={id,builderId:1,parentIds:[1],generation:2,design:{care:1,safe:1,adventure:1},readyHour:s.hour};
 apply(s,'return [{kind:"arrival",text:"来訪した"}];');
 assert.equal(s.externalEvent.status,n===10?'applied':'skipped');
 if(n===11)assert.equal(s.externalEvent.results[0].reason,'population-limit');
 L.advance(s);
 assert.equal(s.people.length,12);assert(s.people.some(p=>p.id===id));assert.equal(s.assembly,null);
}
const full=world();full.food=72;full.resources.parts=64;apply(full,'return [{kind:"supplies",cells:6,parts:3,text:"補給"}];');assert.equal(full.externalEvent.status,'skipped');assert.equal(full.externalEvent.results[0].cells,0);
const partial=world(12);apply(partial,'return [{kind:"arrival",text:"来訪"},{kind:"story",text:"遠くの影"}];');assert.equal(partial.externalEvent.status,'partial');assert(!partial.logs.some(t=>t.endsWith('：来訪')));
const weak=world(1);weak.people[0].energy=3;apply(weak,'return [{kind:"interference",damage:8,text:"障害"}];');assert.equal(weak.people[0].energy,0);assert.deepEqual(weak.externalEvent.results[0].losses,[{residentId:1,damage:3}]);
for(const source of ['return [{kind:"supplies",cells:7,parts:0,text:"上限"}];','return [{kind:"interference",damage:1/0,text:"非有限"}];','return [{kind:"supplies",cells:-1,parts:0,text:"負数"}];','return [{kind:"story",text:"先に適用しない"},{kind:"unknown",text:"不明"}];','return ctx.missing;']){
 const s=world(),before=clone(s);apply(s,source);assert.equal(s.externalEvent.status,'rejected');for(const k of ['people','food','resources','lineage'])assert.deepEqual(s[k],before[k]);
 const record=clone(s.externalEvent);apply(s,'return [{kind:"arrival",text:"同日差し替え"}];');assert.deepEqual(s.externalEvent,record);
}
const daily=world();apply(daily,'return [];');const once=clone(daily);apply(daily,story);assert.deepEqual(daily,once);apply(daily,story,time+86400000);assert.equal(daily.externalEvent.status,'applied');
const expired=world();E.apply(expired,time,plugin(story,time-86400000),note);assert.equal(expired.externalEvent,undefined);
const boundary=Date.parse('2026-11-02T14:55:00Z'),w=world();w.hour=23+55/60;
assert.equal(step(w,{time:boundary,plugin:plugin(story,boundary)}).externalEvent,undefined);
const nextDay=step(w,{time:boundary,plugin:plugin(story,boundary+300000)});assert.equal(nextDay.externalEvent.date,'2026-11-03');assert.equal(nextDay.externalEvent.at,'2026-11-02T15:00:00.000Z');assert.equal(nextDay.externalEvent.hour,24);
// Exercise changing daily events across lifetimes; only invariants are fixed.
let long=world();long.people[0].activatedHour=-long.people[0].serviceLifeHours+.5;long.lineage[1].activatedHour=long.people[0].activatedHour;const start=Date.parse('2026-11-01T15:00:00Z');let retirements=0;
const sources=['return [];','return [{kind:"arrival",text:"来訪"}];','return [{kind:"interference",damage:8,text:"障害"}];','return [{kind:"supplies",cells:6,parts:3,text:"補給"}];','return [{kind:"departure",text:"旅立ち"}];',story];
for(let i=0;i<30*288;i++){
 const previousEvent=clone(long.externalEvent||null);const at=start+i*300000;long=step(long,{time:at,plugin:plugin(sources[Math.floor(i/288)%sources.length],at+300000)});
 if(previousEvent?.date===E.day(at+300000))assert.deepEqual(long.externalEvent,previousEvent);
 for(const [value,max] of [[long.food,72],[long.resources.parts,64]])assert(Number.isFinite(value)&&value>=0&&value<=max);
 for(const p of long.people)for(const key of ['hunger','energy','social','curiosity','durability'])assert(Number.isFinite(p[key])&&p[key]>=0&&p[key]<=100);
 assert(long.people.length<=12);
 assert.equal(new Set(long.people.map(p=>p.id)).size,long.people.length);assert(long.people.every(p=>p.id<long.nextResidentId));
}
retirements=Object.values(long.lineage).filter(p=>p.retiredHour!==undefined).length;assert(retirements>0);
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'vivarium-plugin-')),file=path.join(root,'current.json');
 try{
  const valid='```json\n'+JSON.stringify(plugin(story))+'\n```';
  for(const fetcher of [async()=>{throw Error('Network');},async()=>({ok:false}),async()=>({ok:true,json:async()=>({body:'invalid'})}),async()=>({ok:true,json:async()=>({body:valid+'\n'+valid})}),async()=>({ok:true,json:async()=>({body:'```json\n'+JSON.stringify(plugin('while(true) {}'))+'\n```'})})]){
   fs.writeFileSync(file,'stale source');assert.equal(await load(file,{fetcher,logger:()=>{}}),false);assert(!fs.existsSync(file));
  }
  assert.equal(await load(file,{fetcher:async()=>({ok:true,json:async()=>({body:valid})}),logger:()=>{}}),true);assert.equal(JSON.parse(fs.readFileSync(file)).source,plugin(story).source);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
 console.log('PASS: immutable narratives, normalized results, population/builder limits, actual outcomes, atomic rejection, daily replacement, midnight, 30-day invariants and fetch failure fallback');
})().catch(e=>{console.error(e);process.exitCode=1;});
