const assert=require('node:assert/strict'),fs=require('node:fs');const L=require('../scripts/lifecycle.cjs');const {step,makeBatch,SLOT_MS}=require('../scripts/update-state.cjs');const {VillagePlayer:P}=require('../dist/player.js');const clone=x=>JSON.parse(JSON.stringify(x));
const data=P.validate(JSON.parse(fs.readFileSync('dist/state.json'))),base={hour:100,food:72,rain:0,nextResidentId:4,logs:[],people:[1,2,3].map(id=>({id,kind:'mehs',color:'#709e91',care:1,safe:1,adventure:1,hunger:10,energy:90,social:20,curiosity:40,success:0,discoveries:0,kindness:0,remainingSteps:0,activityArea:'home',action:'整備する',reason:'テスト用機体'}))};L.initialize(base);
assert(base.people.every(p=>p.serviceLifeHours>=21*24&&p.serviceLifeHours<=35*24));
const s=clone(base);s.nextAssemblyHour=s.hour;s.food=72;s.resources.parts=64;
for(const p of s.people){p.hunger=0;p.energy=100;p.durability=100;}
const before=s.nextResidentId;L.advance(s);assert(s.assembly);assert.equal(s.assembly.id,before);assert.equal(s.nextResidentId,before+1);assert.equal(s.people.length,base.people.length);const a=clone(s.assembly),expectedParents=a.parentIds;assert.equal(a.readyHour-a.startedHour,4);
s.hour=a.readyHour;L.advance(s);const child=s.people.find(p=>p.id===before);assert(child);assert.deepEqual(child.parentIds,expectedParents);assert.equal(child.generation,a.generation);assert.equal(child.success,0);assert.equal(child.color,a.design.color);assert.equal(child.adventure,a.design.adventure);assert(s.lineage[child.id]);assert.equal(s.assembly,null);
const poor=clone(base);poor.nextAssemblyHour=0;poor.food=0;poor.resources.parts=0;L.advance(poor);assert.equal(poor.assembly,null);
const retire=clone(base);const elder=retire.people[0];elder.activatedHour=retire.hour-elder.serviceLifeHours;const oldId=elder.id,oldCounter=retire.nextResidentId,parts=retire.resources.parts;L.advance(retire);assert(!retire.people.some(p=>p.id===oldId));assert.equal(retire.lineage[oldId].retiredHour,retire.hour);assert(retire.resources.parts>=parts);assert.equal(retire.nextResidentId,oldCounter);
const all=clone(base);for(const p of all.people)p.activatedHour=all.hour-p.serviceLifeHours;all.food=0;all.resources.parts=0;L.advance(all);assert.equal(all.people.length,0);assert.equal(all.assembly.source,'station');const nextId=all.assembly.id;assert(nextId>=base.nextResidentId);all.hour=all.assembly.readyHour;L.advance(all);assert.equal(all.people.length,1);assert.equal(all.people[0].id,nextId);assert(all.people[0].parentIds.length>0);assert.equal(all.people[0].generation,2);
const exhausted=clone(base);exhausted.nextAssemblyHour=Infinity;exhausted.food=0;for(const p of exhausted.people){p.hunger=100;p.energy=0;p.remainingSteps=0;}assert.equal(step(exhausted).people.length,base.people.length,'Power shortage must not retire young units');
const slot=Date.parse(data.anchorAt)/SLOT_MS;const future=makeBatch(data,slot+1);assert.deepEqual(future.frames.slice(0,48),data.frames.slice(24));assert.deepEqual(future.frames[48].state,data.endState);
const takeover=clone(base);takeover.nextAssemblyHour=0;takeover.resources.parts=64;L.advance(takeover);const sponsor=takeover.people.find(p=>p.id===takeover.assembly.builderId);sponsor.activatedHour=takeover.hour-sponsor.serviceLifeHours;L.advance(takeover);assert.equal(takeover.assembly.builderId,null);assert.equal(takeover.assembly.source,'station');
// Replaying the same world state produces exactly the same assembly and IDs.
assert.deepEqual(step(base),step(base));assert.deepEqual(L.migrateTimeline(data),data);
// Exercise both sides of the colour threshold and every palette slot, including the inherited colour.
const R=require('../scripts/random.cjs'),savedNext=R.next;
try{
 for(const roll of [.449999,.45])for(const pick of [0,.21,.41,.61,.81,.999999]){
  const sample=clone(base);sample.people.forEach(p=>p.color='#b76a79');
  sample.nextAssemblyHour=0;sample.resources.parts=64;
  const values=[0,0,.9,roll,...Array(9).fill(.5),pick];R.next=()=>values.length?values.shift():.5;
  L.advance(sample);
  assert(sample.assembly);
  if(roll<.45)assert.equal(sample.assembly.design.color,['#c38450','#b76a79','#597eab','#648f78','#967ab0','#b2974a'][Math.floor(pick*6)]);
  else assert.equal(sample.assembly.design.color,'#b76a79');
 }
}finally{R.next=savedNext;}
const savedEyeNext=R.next;
try{
 for(const rare of [false,true])for(const roll of [.449999,.45])for(const pick of [0,.4,.9]){
  const sample=clone(base);sample.nextAssemblyHour=0;sample.resources.parts=64;
  if(rare)sample.resources.rarePartFinds=[{id:1,name:'光学モジュール'}];
  const values=rare?[0,0,pick]:[0,0,roll,pick];R.next=()=>values.length?values.shift():.9;
  L.advance(sample);
  const eye=sample.assembly.design.eyeShape;
  if(rare)assert.notEqual(eye,'square');
  else assert.equal(eye,roll<.45?['square','round','visor'][Math.floor(pick*3)]:'square');
 }
}finally{R.next=savedEyeNext;}
// Fixed synthetic worlds: selection diversity and per-trait inheritance are independent of live population.
const sponsors=new Set(),pairCounts={same:0,different:0};let mixed=0,large=0;
for(let seed=1;seed<=1500;seed++){
 const sample=clone(base);sample.rngState=seed*100000;sample.nextAssemblyHour=0;sample.resources.parts=64;
 sample.people[0].care=3;sample.people[0].safe=.6;sample.people[0].adventure=.6;
 sample.people[1].care=3;sample.people[1].safe=.6;sample.people[1].adventure=.6;
 sample.people[2].care=.6;sample.people[2].safe=3;sample.people[2].adventure=3;
 L.advance(sample);const a=sample.assembly;assert(a);sponsors.add(a.builderId);
 const parents=a.parentIds.map(id=>sample.people.find(p=>p.id===id));
 const different=parents[0].care!==parents[1].care;pairCounts[different?'different':'same']++;
 const origins=[];
 for(const key of ['care','safe','adventure']){
  const v=a.design[key];assert(v>=.5&&v<=3.5);
  const distances=parents.map(p=>Math.abs(v-p[key]));
  if(distances.every(d=>d>.150001))large++;
  origins.push(distances.indexOf(Math.min(...distances)));
 }
 if(different&&new Set(origins).size>1)mixed++;
}
assert.equal(sponsors.size,3);assert(pairCounts.different>pairCounts.same);assert(mixed>0);assert(large>0);
console.log('PASS: four-hour assembly, inherited designs, resource constraints, 21–35 day life, parts recycling, autonomous restart, unique IDs, overlap/determinism');
