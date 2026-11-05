const assert=require('node:assert/strict');
const AI=require('../scripts/ai-routines.cjs'),P=require('../scripts/programs.cjs'),L=require('../scripts/lifecycle.cjs'),D=require('../scripts/daily-package.cjs');
const {VillageGeography:G}=require('../dist/geography.js');
const {step,makeBatch,SLOT_MS}=require('../scripts/update-state.cjs');
const clone=x=>JSON.parse(JSON.stringify(x)),note=(s,t)=>s.logs.unshift(t);
const time=Date.parse('2026-11-02T16:00:00Z');
function world(){return L.initialize({hour:0,food:30,rain:0,logs:[],nextResidentId:4,nextAssemblyHour:1e9,people:[1,2].map(id=>({id,kind:'mehs',care:1,safe:1,adventure:1,color:'#709e91',hunger:20,energy:80,social:60,curiosity:30,success:9,discoveries:0,kindness:0,remainingSteps:0,action:'整備する',activityArea:'home'}))});}
function row(p){return {residentId:p.id,baseRevision:AI.revision(p),name:'備蓄を見て回収',reason:'セル不足を経験したため備蓄と雨を比較する',source:'if (ctx.food < 40 && ctx.energy > 30) return {action: "recover"}; if (ctx.rain > 0) return {action: "maintain"}; return {action: "explore"};'};}
function bundle(rows){return {date:'2026-11-02',title:'静かな外界',source:'return [];',routines:rows};}
function complete(s,p){
 if(G.areaOf(p)!=='lab')assert.equal(AI.work(s,p,note),false,'Cannot work outside the lab');
 p.position={...G.places.lab,area:'lab'};
 assert(AI.work(s,p,note));const old=p.program;
 s.hour+=1/12;AI.work(s,p,note);assert.equal(p.program,old);
 s.hour+=1/12;AI.work(s,p,note);assert(!p.pendingRoutine);
}
const s=world(),p=s.people[0];P.recommend(s,p,note);assert.equal(p.program.origin,'template');const old=clone(p.program),r=row(p);
AI.apply(s,time,bundle([r]),note);assert.deepEqual(p.program,old);assert.equal(s.routineUpdates.results[0].status,'queued');complete(s,p);assert.equal(p.program.origin,'ai');assert.equal(p.program.authorId,1);assert.equal(p.program.modifiedBy,1);assert.equal(P.recommend(s,p,note),2);assert.equal(p.program.runs,1);assert.equal(s.routineUpdates.results[0].status,'applied');
const saved=clone(p.program);AI.apply(s,time,bundle([{...r,baseRevision:AI.revision(p),source:'return {action: "charge"};'}]),note);assert.deepEqual(p.program,saved);
s.people[1].position={...G.places.lab,area:'lab'};P.share(s,p,note);assert.equal(s.people[1].program.authorId,1);assert.equal(s.people[1].program.origin,'ai');
const improved={...row(s.people[1]),name:'共有後の改良'};AI.apply(s,time+86400000,{...bundle([improved]),date:'2026-11-03'},note);complete(s,s.people[1]);assert.equal(s.people[1].program.authorId,1);assert.equal(s.people[1].program.modifiedBy,2);
const stale=world();P.recommend(stale,stale.people[0],note);const staleRow=row(stale.people[0]);stale.people[0].program.source='return {action: "communicate"};';const current=clone(stale.people[0].program);AI.apply(stale,time,bundle([staleRow]),note);assert.equal(stale.routineUpdates.results[0].reason,'routine-changed');assert.deepEqual(stale.people[0].program,current);
const broken=world();for(const unit of broken.people)P.recommend(broken,unit,note);const unchanged=clone(broken.people[0].program);AI.apply(broken,time,bundle([{...row(broken.people[0]),source:'return {action:"destroy"};'},row(broken.people[1])]),note);assert.equal(broken.routineUpdates.results[0].status,'rejected');assert.deepEqual(broken.people[0].program,unchanged);complete(broken,broken.people[1]);assert.equal(broken.people[1].program.origin,'ai');
const absent=world();AI.apply(absent,time,bundle([{...row(absent.people[0]),residentId:999}]),note);assert.equal(absent.routineUpdates.results[0].reason,'resident-absent');
const young=world();young.people[0].success=0;AI.apply(young,time,bundle([row(young.people[0])]),note);assert(!young.people[0].program);assert.equal(young.routineUpdates.results[0].reason,'experience-insufficient');
const expired=world();AI.apply(expired,time+48*3600000,bundle([row(expired.people[0])]),note);assert(!expired.routineUpdates);
const future=world();AI.apply(future,Date.parse('2026-11-01T00:00:00Z'),bundle([row(future.people[0])]),note);assert(!future.routineUpdates);
const cap=world();AI.apply(cap,time,bundle(Array.from({length:4},()=>row(cap.people[0]))),note);assert.equal(cap.routineUpdates.results[0].reason,'daily-limit');assert(!cap.people[0].program);
const unsafe=world();AI.apply(unsafe,time,bundle([{...row(unsafe.people[0]),source:'return process.env;'}]),note);assert(!unsafe.people[0].program);P.recommend(unsafe,unsafe.people[0],note);assert.equal(unsafe.people[0].program.origin,'template');
const legacy=D.validate({date:'2026-11-02',title:'従来版',source:'return [];'});assert(!legacy.routines);
const packageWithBrokenEvent=D.validate({...bundle([row(world().people[0])]),source:'while(true) {}'});assert(!packageWithBrokenEvent.source);assert.equal(packageWithBrokenEvent.routines.length,1);
const after=step(world(),{time,plugin:packageWithBrokenEvent});assert(after.people[0].pendingRoutine);assert.equal(after.people[0].journey?.to,'lab');assert(!after.externalEvent);
const emptyEvent=world();const emptyAfter=step(emptyEvent,{time:Date.parse('2026-11-02T01:00:00Z'),plugin:bundle([row(emptyEvent.people[0])])});assert.equal(emptyAfter.externalEvent.status,'empty');assert(emptyAfter.people[0].pendingRoutine);
const urgent=world();urgent.people[0].hunger=95;const urgentAfter=step(urgent,{time,plugin:bundle([row(urgent.people[0])])});assert.equal(urgentAfter.people[0].action,'充電する');
const input=makeBatch({schemaVersion:2,endState:world()},Date.parse('2026-11-02T12:00:00Z')/SLOT_MS);
const pkg=bundle([row(input.endState.people[0])]);const next=makeBatch(input,Date.parse(input.anchorAt)/SLOT_MS+1,{plugin:pkg});assert.deepEqual(next.frames.slice(0,48),input.frames.slice(24));assert.deepEqual(next.frames[48].state,input.endState);assert(next.frames[49].state.people[0].pendingRoutine);assert(next.frames.slice(49).some(f=>f.state.people[0].action==='開発する'));assert.equal(next.endState.people[0].program.origin,'ai');assert.equal(next.frames[49].state.externalEvent,undefined); // Event expired; resident improvement remains valid at the future frontier.
assert.deepEqual(makeBatch(next,Date.parse(next.anchorAt)/SLOT_MS,{plugin:pkg}),next);
const delayed=world();P.recommend(delayed,delayed.people[0],note);delayed.people[0].hunger=95;
let trip=step(delayed,{time,plugin:bundle([row(delayed.people[0])])});
assert(trip.people[0].pendingRoutine);assert(!trip.people[0].journey);
for(let i=0;i<24&&trip.people[0].pendingRoutine;i++)trip=step(trip);
assert.equal(trip.people[0].program.origin,'ai');
const cancelled=world();AI.apply(cancelled,time,bundle([row(cancelled.people[0])]),note);
P.recommend(cancelled,cancelled.people[0],note);assert(!AI.checkPending(cancelled,cancelled.people[0],note));
assert.equal(cancelled.routineUpdates.results[0].reason,'routine-changed');
const timedOut=world();AI.apply(timedOut,time,bundle([row(timedOut.people[0])]),note);
timedOut.hour=timedOut.people[0].pendingRoutine.expiresHour;
assert(!AI.checkPending(timedOut,timedOut.people[0],note));assert.equal(timedOut.routineUpdates.results[0].reason,'expired');
// An old proposal expiring on the intake step must not block the newer daily proposal.
const renewal=world();AI.apply(renewal,time,bundle([row(renewal.people[0])]),note);
renewal.hour=renewal.people[0].pendingRoutine.expiresHour;
const fresh={...row(renewal.people[0]),name:'新しい改良案'};
AI.apply(renewal,time+48*3600000,{...bundle([fresh]),date:'2026-11-04'},note);
assert.equal(renewal.routineUpdates.results[0].status,'queued');
assert.equal(renewal.people[0].pendingRoutine.name,fresh.name);
// A retired or departed resident cannot still have a queued result.
for(const leave of ['retirement','departure']){
 const gone=world(),target=gone.people[0];
 AI.apply(gone,time,bundle([row(target)]),note);
 if(leave==='retirement')target.activatedHour=gone.hour-target.serviceLifeHours;
 const options=leave==='departure'?{time,plugin:{date:'2026-11-03',title:'旅立ち',source:'return [{kind:"departure",text:"旅立った"}];'}}:{};
 const end=step(gone,options);
 assert(!end.people.some(p=>p.id===target.id));
 assert.equal(end.routineUpdates.results[0].status,'skipped');
 assert.equal(end.routineUpdates.results[0].reason,'resident-absent');
}
const solo=world();const beforeSource=old.source;solo.people[0].program=clone(old);step(solo);assert.equal(solo.people[0].program.source,beforeSource);
console.log('PASS: template/AI coexistence, rich inputs, authorship/sharing, independent validation, stale/missing/young targets, expiry, daily cap, urgent charging and exact overlap');
