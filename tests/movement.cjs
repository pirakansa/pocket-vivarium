const assert=require('node:assert/strict'),fs=require('node:fs');
const {VillageGeography:G}=require('../dist/geography.js'),L=require('../scripts/lifecycle.cjs'),P=require('../scripts/programs.cjs'),D=require('../scripts/discoveries.cjs'),AI=require('../scripts/ai-routines.cjs');
const {step,makeBatch,SLOT_MS}=require('../scripts/update-state.cjs');
const clone=x=>JSON.parse(JSON.stringify(x)),close=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} != ${b}`),note=(s,t)=>s.logs.push(t);
function world(areas=['home']){return L.initialize({hour:100,food:30,rain:0,logs:[],rngState:1,nextResidentId:areas.length+1,nextAssemblyHour:10000,weather:{raining:false,nextChangeHour:10000},people:areas.map((area,i)=>({id:i+1,kind:'mehs',care:1,safe:1,adventure:1,color:'#709e91',hunger:0,energy:100,social:0,curiosity:0,success:0,discoveries:0,kindness:0,remainingSteps:0,action:'起動チェック',activityArea:area,activatedHour:0,serviceLifeHours:1000}))});}
function force(p,action){p.program={name:'試験ルーチン',source:`return {action: "${action}"};`,authorId:p.id,createdHour:0,runs:0};}
// Choosing a distant action starts a journey without applying its rewards.
let s=world();s.food=0;s.people[0].success=8;force(s.people[0],'recover');
let next=step(s),p=next.people[0];assert.equal(p.action,'移動する');assert.equal(p.journey.to,'forest');assert.equal(p.success,8);assert.equal(p.program.used||0,0);assert.equal(next.food,0);
const start=next.hour,arrive=p.journey.arriveHour,initial=clone(p),expectedArrival=arrive;
while(next.hour+1/12<expectedArrival-1e-7){next=step(next);assert.equal(next.people[0].success,8);assert.equal(next.food,0);}
next=step(next);assert.equal(next.people[0].success,9);assert.equal(next.people[0].action,'資源を回収する');assert.equal(G.areaOf(next.people[0]),'forest');assert(next.food>0);assert.equal(next.people[0].program.used,1);
const frozen=JSON.stringify(initial),mid=G.positionAt(initial,(start+arrive)/2);assert(mid.x>G.places.home.x&&mid.x<G.places.forest.x);assert.equal(JSON.stringify(initial),frozen);
assert.equal(G.travelMinutes({...s.people[0],durability:0},'forest')>G.travelMinutes({...s.people[0],durability:100},'forest'),true);
// Urgent charging must return home rather than charging remotely.
s=world(['forest']);s.people[0].hunger=95;next=step(s);assert.equal(next.people[0].journey.to,'home');assert(next.people[0].hunger>95);const food=s.food;
while(next.people[0].journey)next=step(next);assert.equal(next.people[0].action,'充電する');assert(next.people[0].hunger<50);assert(next.food<food);assert.equal(G.areaOf(next.people[0]),'home');
// Scripts can redirect an existing trip in rain; the route itself is exposed until shelter.
s=world(['forest']);p=s.people[0];G.initialize(p);G.depart(p,'hill',{a:4,why:'試験'},s.hour);force(p,'maintain');s.rain=100;s.weather={raining:true,nextChangeHour:10000};
next=step(s);assert.equal(next.people[0].journey.to,'home');close(next.people[0].rainWearHours,1/24);assert(next.people[0].position.x!==G.places.home.x);
while(next.people[0].journey)next=step(next);const rainWear=next.people[0].rainWearHours;next=step(next);close(next.people[0].rainWearHours,rainWear);
// A new emergency redirects a trip, without immediate charging or teleportation.
s=world();p=s.people[0];G.initialize(p);G.depart(p,'forest',{a:2,why:'試験'},s.hour);p.hunger=95;next=step(s);assert.equal(next.people[0].journey.to,'home');assert.equal(next.people[0].action,'移動する');assert(next.people[0].position.x>G.places.home.x);
// Stock can disappear during travel. Arrival cannot create a free charge or negative stock.
s=world(['forest']);p=s.people[0];G.initialize(p);G.depart(p,'home',{a:0,why:'充電'},s.hour);p.hunger=95;s.food=0;
while(s.people[0].journey)s=step(s);assert.equal(s.food,0);assert(s.people[0].hunger>=95);assert(s.people[0].reason.includes('補給を待って'));
// Communication shares knowledge/programs only with stationary, co-located residents.
s=world(['forest','home']);p=s.people[0];p.success=8;P.recommend(s,p,note);s.finds=[{id:1,name:'試験の発見',kind:'recover'}];p.knowledge=[1];
P.share(s,p,note);D.communicate(s,p,note);assert(!s.people[1].program);assert.equal(s.people[1].hint,undefined);
s.people[1].activityArea='forest';P.share(s,p,note);D.communicate(s,p,note);assert(s.people[1].program);assert.equal(s.people[1].hint.sourceId,p.id);
assert.equal(G.target(s,p,3),'forest','Co-located communication should not require the square');
const q=s.people[1];G.initialize(q);G.depart(q,'home',{a:0,why:'試験'},s.hour);assert.equal(G.peers(s,p).length,0);
// Alone, performing communication neither clears the need nor grants experience.
s=world(['square']);p=s.people[0];G.initialize(p);G.depart(p,'square',{a:3,why:'試験'},s.hour);p.social=100;next=step(s);assert.equal(next.people[0].social,100);assert.equal(next.people[0].kindness,0);
// Assembly requires presence at the workshop; the inherited legacy positions remain readable.
s=world(['forest']);s.food=72;s.resources.parts=64;s.nextAssemblyHour=0;L.advance(s);assert.equal(s.assembly,null);s.people[0].activityArea='home';L.advance(s);assert(s.assembly);
// All arrivals advance before action/contact decisions, independent of resident ordering.
s=world(['home','home']);for(const unit of s.people){G.initialize(unit);G.depart(unit,'square',{a:3,why:'試験'},s.hour);unit.social=80;}
const finish=s.people[0].journey.arriveHour;while(s.hour+1/12<finish-1e-7)s=step(s);s=step(s);assert(s.people.every(unit=>unit.kindness===1));
// Programs can inspect position, local company and travel costs, with all existing restrictions.
s=world(['forest','forest']);const ctx=AI.inputs(s,s.people[0]);assert.equal(ctx.location,'forest');assert.equal(ctx.nearbyCount,1);assert(ctx.minutesHome>0);assert.equal(ctx.minutesForest,0);
const row={residentId:1,baseRevision:null,name:'位置を読む',reason:'距離を確かめる',source:'if (ctx.location === "forest" && ctx.minutesHome > 0 && ctx.nearbyCount > 0) return {action: "communicate"}; return {action: "charge"};'};AI.validate(row,s,s.people[0]);
// The relay is built by two machines on site, then carries actual information and code.
s=world(['lab','square']);s.resources.parts=64;s.people[0].success=8;
let designed=false,working=false;
for(let i=0;i<24&&!s.relay;i++){
 s=step(s);
 designed||=s.people[0].action==='中継器を設計する';
 working||=s.relayProject?.readyHour!==undefined;
 if(!s.relay)assert.equal(s.resources.parts,64);
}
assert(designed&&working);
assert.equal(s.relay?.area,'square');
assert.equal(s.resources.parts,40);
assert(s.logs.some(log=>log.includes('部品24個を使用')));
s=world(['square','forest']);s.relay={area:'square',condition:50};
p=s.people[0];p.social=100;p.knowledge=[1];s.finds=[{id:1,name:'試験の発見',kind:'recover'}];force(p,'communicate');
s.people[1].remainingSteps=1;
assert.equal(AI.inputs(s,p).nearbyCount,0);
assert.equal(AI.inputs(s,p).relayPeers,1);
const connected=step(s);
assert.equal(G.areaOf(connected.people[0]),'square');
assert.equal(connected.people[0].kindness,1);
assert.equal(connected.people[1].hint.sourceId,1);
assert.equal(connected.people[1].program.authorId,1);
assert.equal(connected.relay.lastSignal.from,'square');
assert(connected.relay.condition<49.75);
s.relay.condition=.01;
next=step(s);
assert.equal(next.relay.condition,0);
assert.equal(next.people[0].kindness,0);
assert.equal(AI.inputs(next,next.people[0]).relayPeers,0);
// Worn equipment is maintained, or moved to reach a more active destination.
for(const [areas,destination,expectedParts] of [
 [['square','square'],'square',32],
 [['forest','forest','hill'],'forest',24],
]){
 s=world(areas);s.resources.parts=40;s.relay={area:'square',condition:20};
 s.people.at(-1).social=90;
 if(areas.length===3)s.people[2].remainingSteps=20;
 for(let i=0;i<12&&s.relay.condition<100;i++)s=step(s);
 assert.equal(s.relay.condition,100);
 assert.equal(s.relay.area,destination);
 assert(s.logs.some(log=>log.includes(`部品${40-expectedParts}個を使用`)));
 assert(s.resources.parts>=expectedParts&&s.resources.parts<=expectedParts+3);
}
// Lose a worker to emergency charging before repair completes; do not spend stock.
s=world(['square','square']);s.resources.parts=40;s.relay={area:'square',condition:20};
s=step(s);assert(s.relayProject.readyHour);
s.people[0].hunger=95;s=step(s);
assert.equal(s.people[0].journey.to,'home');
assert.equal(s.relayProject.readyHour,undefined);
assert.equal(s.resources.parts,40);

// Do not backfill or regenerate confirmed frames; replay/batch boundaries are deterministic.
const data=JSON.parse(fs.readFileSync('dist/state.json')),before=JSON.stringify(data),slot=Date.parse(data.anchorAt)/SLOT_MS;
assert.deepEqual(L.migrateTimeline(data),data);const first=makeBatch(data,slot+1);assert.deepEqual(first.frames.slice(0,48),data.frames.slice(24));assert.deepEqual(first.frames[48].state,data.endState);
const second=makeBatch(first,slot+2),single=makeBatch(data,slot+2);assert.deepEqual(second.frames,single.frames);assert.deepEqual(second.endState,single.endState);assert.equal(JSON.stringify(data),before);
for(const f of second.frames)for(const unit of f.state.people){if(!unit.position)continue;assert(Number.isFinite(unit.position.x)&&Number.isFinite(unit.position.y));if(unit.journey){assert.equal(unit.position.area,null);assert(unit.journey.arriveHour>f.state.hour);}}
console.log('PASS: delayed effects, travel/interpolation, urgent return, rain exposure/shelter, script rerouting, stock loss, local contact, simultaneous arrivals, assembly presence, script inputs, relay construction/communication/maintenance and immutable deterministic continuation');
