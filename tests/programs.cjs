const assert=require('node:assert/strict');
const {execute,compile}=require('../scripts/program-runtime.cjs');
const programs=require('../scripts/programs.cjs'),external=require('../scripts/external-events.cjs');
const {makeBatch,SLOT_MS}=require('../scripts/update-state.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
const lifecycle=require('../scripts/lifecycle.cjs');
// Explicit fixtures: live residents may already own programs or daily event records.
function resident(id){return {id,kind:'mehs',care:1,safe:1,adventure:1,hunger:20,energy:80,social:60,curiosity:30,success:0,discoveries:0,kindness:0,remainingSteps:0,activityArea:'home',action:'起動チェック',reason:'テスト用機体',color:'#709e91'};}
function world(){return lifecycle.initialize({hour:0,food:30,rain:0,logs:[],people:[resident(1),resident(2)],nextResidentId:3,assembly:null,nextAssemblyHour:1e9});}
const input=makeBatch({schemaVersion:2,endState:world()},Date.parse('2026-11-01T12:00:00Z')/SLOT_MS);
assert.deepEqual(execute('if (ctx.rain > 0) return {action: "maintain"}; return {action: "recover"};',{rain:1}),{action:'maintain'});
assert.equal(execute('return (ctx.x + 2) * 3;',{x:4}),18);
for(const code of ['return process.env;','return ctx.constructor;','while (true) {}','return fetch("url");','return {__proto__: 1};','return ctx.x = 1;','return '+ '!'.repeat(10000)+'true;'])assert.throws(()=>execute(code,{x:1}));
assert.throws(()=>compile('return '+ '('.repeat(70)+'1'+')'.repeat(70)+';'));
const s=world(),p=s.people[0];p.success=9;
assert.equal(programs.recommend(s,p,()=>{}),s.rain?1:2);assert.equal(p.program.runs,1);programs.share(s,p,()=>{});assert.equal(s.people[1].program.authorId,p.id);assert.equal(s.people[1].program.runs,0);
// Existing programs continue counting; they are not recreated by later runs.
p.program.runs=11;programs.recommend(s,p,()=>{});assert.equal(p.program.runs,12);assert.equal(p.program.authorId,p.id);
const time=Date.parse(input.windowEnd),date=external.day(time),plugin={date,title:'テスト外界',source:'return [{kind: "supplies", cells: 2, parts: 1, text: "補給を発見"}];'};
s.food=10;s.resources.parts=10;external.apply(s,time,plugin,()=>{});assert.equal(s.food,12);assert.equal(s.resources.parts,11);assert(!JSON.stringify(s.externalEvent).includes('return ['));
external.apply(s,time,{...plugin,source:'return [{kind: "supplies", cells: 6, parts: 3, text: "二重"}];'},()=>{});assert.equal(s.food,12);
let bad=clone(s);delete bad.externalEvent;external.apply(bad,time,{...plugin,source:'return [{kind: "supplies", cells: 2, parts: 1, text: "先に実行しない"}, {kind: "interference", damage: 99, text: "上限超過"}];'},()=>{});assert.equal(bad.food,12);assert.equal(bad.externalEvent.status,'rejected');
const future=makeBatch(input,Date.parse(input.anchorAt)/SLOT_MS+1,{plugin});assert.deepEqual(future.frames.slice(0,48),input.frames.slice(24));assert.deepEqual(future.frames[48].state,input.endState);assert.equal(future.frames[49].state.externalEvent.date,date);assert.equal(future.endState.externalEvent.status,'applied');
assert.deepEqual(makeBatch(future,Date.parse(future.anchorAt)/SLOT_MS,{plugin:{...plugin,source:'return [];'}}),future);
const visit=clone(s);delete visit.externalEvent;const count=visit.people.length;external.apply(visit,time,{...plugin,source:'return [{kind: "arrival", text: "来訪"}];'},()=>{});assert.equal(visit.people.length,count+1);assert.equal(new Set(visit.people.map(p=>p.id)).size,count+1);
const empty=clone(s);delete empty.externalEvent;external.apply(empty,time,{...plugin,source:'return [];'},()=>{});assert.equal(empty.externalEvent.status,'empty');
console.log('PASS: restricted JS execution, unsafe syntax rejection, authored/shared programs, transactional bounded events, once/day, immutable overlap and idempotent batches');
