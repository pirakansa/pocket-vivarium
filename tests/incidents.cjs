const assert=require('node:assert/strict');
const I=require('../scripts/incidents.cjs'),L=require('../scripts/lifecycle.cjs');
const {step,makeBatch,SLOT_MS}=require('../scripts/update-state.cjs');
const {VillageGeography:G}=require('../dist/geography.js');
const {inputs}=require('../scripts/ai-routines.cjs');
const clone=x=>JSON.parse(JSON.stringify(x)),note=(s,t)=>s.logs.unshift(t);
function world(n=3){return L.initialize({hour:0,food:72,resources:{parts:64},rain:0,logs:[],nextAssemblyHour:1e9,people:Array.from({length:n},(_,i)=>({id:i+1,kind:'mehs',hunger:0,energy:100,social:0,curiosity:0,success:0,discoveries:0,kindness:0,care:1,safe:1,adventure:1,remainingSteps:0,activityArea:'home',action:'整備する'}))});}
function incident(s){I.initialize(s);s.incidentSystem.nextHour=s.hour;I.prepare(s,note);return s.incident;}
function tick(s,n=1){for(let i=0;i<n;i++)s=step(s);return s;}

// Real losses, gradual leakage, once-only start and a three-stage recovery.
let s=world();const e=incident(s),initial=s.food;
assert(initial<62);assert(e.lostCells>=10);const firstId=e.id;
I.prepare(s,note);assert.equal(s.incident.id,firstId);
const stages=new Set();let guard=0;
while(s.incident&&guard++<240){stages.add(s.incident.stage);s=step(s);}
assert(!s.incident,'Recovery must finish');assert.deepEqual([...stages],['diagnosis','isolation','repair']);
assert.equal(s.lastIncident.usedParts,12);assert(s.lastIncident.lostCells>10);
assert(s.incidentSystem.nextHour>=s.hour+18);assert(s.incidentSystem.nextHour<=s.hour+36);
assert(s.people.some(p=>p.skills.diagnosis));assert(s.people.some(p=>p.skills.isolation));
assert(s.people.some(p=>p.skills.repair));assert(s.people.some(p=>p.skills.cooperation));
assert(s.people.some(p=>p.incidentExperience.repair===1));

// Damage is independent of caps. No negative resource values or permanent leak.
const poor=world(0);poor.food=3;incident(poor);assert(!poor.incident);
poor.people=world(1).people;incident(poor);assert.equal(poor.food,0);
poor.hour+=13;I.prepare(poor,note);assert(poor.incident.breakerTripped);assert.equal(poor.food,0);

// Arrival gates work; personal emergencies and an assembly builder are protected.
const trip=world(1);trip.people[0].position={...G.places.forest,area:'forest'};incident(trip);
const travelled=step(trip);assert(travelled.people[0].journey);assert.equal(travelled.incident.progress,0);
const urgent=clone(trip);urgent.people[0].hunger=98;
const urgentResult=step(urgent);assert.equal(urgentResult.incident.progress,0);assert.equal(urgentResult.people[0].journey.plan.a,0);
const building=world();building.assembly={id:4,builderId:1,readyHour:4};incident(building);assert(!building.incident.crew.includes(1));

// Missing parts releases the crew to collect them, including a solo village.
let solo=world(1);incident(solo);solo.incident.stage='repair';solo.incident.progress=0;solo.resources.parts=0;
solo=step(solo);assert(solo.incident.waitingForParts);assert.deepEqual(solo.incident.crew,[]);
let recovered=false;
for(let i=0;i<720;i++){solo=step(solo);if(solo.lastIncident){recovered=true;break;}}
assert(recovered,'Single resident must gather parts and eventually repair');
assert(solo.lastIncident.usedParts===10); // This fixture starts at the final stage.

// Trained procedures change speed; cooperation increases useful work after arrival.
function progress(n,trained){const w=world(n);incident(w);w.incident.stage='repair';w.incident.progress=0;
 for(const p of w.people)if(trained)p.skills={repair:{},cooperation:{}};
 I.prepare(w,note);for(const p of w.people)if(I.assigned(w,p))I.work(w,p,note);I.finishStep(w,note);return w.incident.progress;}
assert(progress(3,false)>progress(1,false));assert(progress(3,true)>progress(3,false));
const interrupted=world();incident(interrupted);interrupted.incident.progress=.2;for(const p of interrupted.people)p.energy=0;
const paused=step(interrupted);assert.equal(paused.incident.progress,.2);

// Communication transfers one procedure at a time, respecting prerequisites.
const sharing=world(),[teacher,pupil]=sharing.people;I.initialize(sharing);
teacher.skills={diagnosis:{},isolation:{},repair:{},cooperation:{}};
I.share(sharing,teacher,[pupil],note);assert(pupil.skills.diagnosis);assert(!pupil.skills.repair);
I.share(sharing,teacher,[pupil],note);assert(pupil.skills.isolation);
I.share(sharing,teacher,[pupil],note);assert(pupil.skills.repair);
I.share(sharing,teacher,[pupil],note);assert(pupil.skills.cooperation);assert.equal(pupil.skills.cooperation.teacherId,teacher.id);
assert.equal(inputs(sharing,pupil).canCooperate,true);

// Persisted scheduling and progress give identical split and uninterrupted runs.
const live=require('../dist/state.json'),before=JSON.stringify(live),slot=Date.parse(live.anchorAt)/SLOT_MS;
const next=makeBatch(live,slot+1),split=makeBatch(next,slot+2),whole=makeBatch(live,slot+2);
assert.deepEqual(next.frames.slice(0,48),live.frames.slice(24));assert.deepEqual(next.frames[48].state,live.endState);
assert.deepEqual(split.frames,whole.frames);assert.deepEqual(split.endState,whole.endState);assert.equal(JSON.stringify(live),before);

// Representative long-run balance: incidents recur, resolve, and stay bounded.
let long=world(5);let losses=0,repairs=0,last=0;
for(let i=0;i<14*24*12;i++){
 long=step(long);
 if(long.lastIncident&&long.lastIncident.id!==last){last=long.lastIncident.id;repairs++;losses+=long.lastIncident.lostCells;}
 assert(long.food>=0&&long.food<=72);assert(long.resources.parts>=0&&long.resources.parts<=64);
 for(const p of long.people)assert(p.hunger>=0&&p.hunger<=100&&p.energy>=0&&p.energy<=100);
}
assert(repairs>=5);assert(losses>100);
console.log(`PASS: multi-stage loss/recovery, skills, emergencies, solo recovery, sharing, exact overlap and deterministic splitting; 14 days: ${repairs} repairs, ${losses.toFixed(1)} cells lost`);
