const assert=require('node:assert/strict'),fs=require('node:fs');
const power=require('../scripts/power-wear.cjs'),L=require('../scripts/lifecycle.cjs');
const {step,makeBatch,SLOT_MS}=require('../scripts/update-state.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
const close=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function fixture(){return L.initialize({hour:100,food:0,rain:0,logs:[],rngState:1234,nextResidentId:2,nextAssemblyHour:10000,people:[{id:1,hunger:100,energy:90,social:0,curiosity:0,success:0,discoveries:0,kindness:0,care:1,safe:1,adventure:1,remainingSteps:100,action:'整備する',activityArea:'home',activatedHour:0,serviceLifeHours:600}]});}
let s=fixture();
for(let i=0;i<24;i++)s=step(s);
close(s.people[0].powerShortageHours,2);close(s.people[0].powerWearHours||0,0);
for(let i=0;i<12;i++)s=step(s);
close(s.people[0].powerWearHours,.25);close(s.people[0].wearHours,103.25);
// Recovery stops additional wear and a later shortage receives a fresh grace period.
const p=s.people[0];p.hunger=89;power.addExposure(s,1/12);
assert.equal(p.powerShortageHours,0);close(p.powerWearHours,.25);
p.hunger=90;for(let i=0;i<24;i++)power.addExposure(s,1/12);close(p.powerWearHours,.25);
power.addExposure(s,1/12);close(p.powerWearHours,.25+1/48);
// Rain and power wear add independently, using the preceding interval's state.
s=fixture();Object.assign(s.people[0],{powerShortageHours:2,action:'探索する',activityArea:'hill'});
s.rain=48;s.weather={raining:true,nextChangeHour:104};s=step(s);
close(s.people[0].rainWearHours,1/24);close(s.people[0].powerWearHours,1/48);
close(s.people[0].wearHours,100+1/12+1/24+1/48);
// Charging remains available and does not erase already accumulated wear.
s=fixture();s.food=10;Object.assign(s.people[0],{remainingSteps:0,powerShortageHours:3,powerWearHours:1});
s=step(s);assert.equal(s.people[0].action,'充電する');close(s.people[0].hunger,45);
const wear=s.people[0].powerWearHours;s=step(s);close(s.people[0].powerWearHours,wear);assert.equal(s.people[0].powerShortageHours,0);
// No immediate retirement at zero charge; accumulated wear uses the existing lifecycle.
s=fixture();assert.equal(step(s).people.length,1);
s.people[0].powerWearHours=1;s.people[0].serviceLifeHours=101;L.advance(s);
assert.equal(s.people.length,0);assert.equal(s.lineage[1].powerWearHours,1);assert.equal(s.assembly.source,'station');
// Existing timelines and confirmed overlap stay intact; split generation is reproducible.
const data=JSON.parse(fs.readFileSync('dist/state.json')),before=JSON.stringify(data),slot=Date.parse(data.anchorAt)/SLOT_MS;
assert.deepEqual(L.migrateTimeline(data),data);
const next=makeBatch(data,slot+1);assert.deepEqual(next.frames.slice(0,48),data.frames.slice(24));assert.deepEqual(next.frames[48].state,data.endState);
const split=makeBatch(next,slot+2),single=makeBatch(data,slot+2);
assert.deepEqual(split.frames,single.frames);assert.deepEqual(split.endState,single.endState);assert.equal(JSON.stringify(data),before);
console.log('PASS: power-shortage grace, mild wear, recovery/reset, rain combination, charging, lifecycle retirement, unchanged history and deterministic continuation');
