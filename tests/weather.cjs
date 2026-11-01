const assert=require('node:assert/strict'),fs=require('node:fs');const W=require('../scripts/weather.cjs'),L=require('../scripts/lifecycle.cjs');const {step,makeBatch,SLOT_MS}=require('../scripts/update-state.cjs');const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(rain,action,area){const s={hour:100,food:50,rain,logs:[],nextResidentId:2,nextAssemblyHour:10000,rngState:1234,weather:{raining:rain>0,nextChangeHour:104},people:[{id:1,kind:'mehs',color:'#709e91',hunger:10,energy:90,social:10,curiosity:10,care:1,safe:1,adventure:1,success:0,discoveries:0,kindness:0,remainingSteps:100,action,activityArea:area,activatedHour:0,serviceLifeHours:600}]};return L.initialize(s);}
let rainy=fixture(48,'資源を回収する','forest'),dry=fixture(0,'資源を回収する','forest'),indoor=fixture(48,'充電する','home'),repair=fixture(48,'整備する','home'),explore=fixture(48,'探索する','hill');
for(let i=0;i<12;i++){rainy=step(rainy);dry=step(dry);indoor=step(indoor);repair=step(repair);explore=step(explore);}
const close=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
close(rainy.wearHours||rainy.people[0].wearHours,101.5);close(dry.people[0].wearHours,101);close(indoor.people[0].wearHours,101);close(repair.people[0].rainWearHours,0);close(explore.people[0].rainWearHours,.5);close(rainy.people[0].activatedHour,0);
const edge=fixture(1,'探索する','hill');edge.weather.nextChangeHour=edge.hour+1/12;const after=step(edge);close(after.people[0].rainWearHours,1/24);
const old=fixture(0,'整備する','home');old.people[0].rainWearHours=1;old.people[0].serviceLifeHours=101;L.advance(old);assert.equal(old.people.length,0);assert.equal(old.lineage[1].rainWearHours,1);
const cloud=fixture(0,'整備する','home');cloud.weather.nextChangeHour=cloud.hour;cloud.rngState=1;W.advance(cloud,(s,t)=>s.logs.push(t));assert(cloud.rain>0);assert(cloud.logs.some(x=>x.includes('雨が降り始めた')));const same=clone(cloud);W.advance(cloud,()=>{});assert.deepEqual(cloud,same);
cloud.hour=cloud.weather.nextChangeHour;cloud.rngState=123456789;W.advance(cloud,()=>{});assert.equal(cloud.rain,0);
const data=JSON.parse(fs.readFileSync('dist/state.json')),slot=Date.parse(data.anchorAt)/SLOT_MS;
const split=makeBatch(makeBatch(data,slot+1),slot+2),single=makeBatch(data,slot+2);assert.deepEqual(split.frames,single.frames);assert.deepEqual(split.endState,single.endState);assert.deepEqual(step(data.endState),step(data.endState));
console.log('PASS: rain/exploration 1.5x wear, indoor exemption, age separation, weather transitions, rain expiry, wear-based retirement and reproducible catch-up');
