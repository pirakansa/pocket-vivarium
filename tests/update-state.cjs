const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {makeBatch,update,SLOT_MS}=require('../scripts/update-state.cjs');const {VillagePlayer:P}=require('../dist/player.js');
const input=P.validate(JSON.parse(fs.readFileSync('dist/state.json'))),slot=Date.parse(input.anchorAt)/SLOT_MS,original=JSON.stringify(input);
const next=makeBatch(input,slot+1);assert.equal(JSON.stringify(input),original);assert.equal(next.frames.length,72);
assert.deepEqual(next.frames.slice(0,48),input.frames.slice(24));assert.deepEqual(next.frames[48].state,input.endState);
assert.equal(Date.parse(next.windowEnd)-Date.parse(next.windowStart),6*3600000);
const gap=makeBatch(input,slot+3);assert.deepEqual(gap.frames[0].state,input.endState);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'vivarium-live-'));
try{
 fs.mkdirSync(path.join(root,'dist'));fs.writeFileSync(path.join(root,'dist/state.json'),JSON.stringify(input));
 assert.equal(update(root,new Date(slot*SLOT_MS+40*60000)).updated,0);
 assert.equal(update(root,new Date((slot+1)*SLOT_MS+30*60000)).updated,1);
 const saved=P.validate(JSON.parse(fs.readFileSync(path.join(root,'dist/state.json'))));assert.deepEqual(saved.frames,next.frames);
 assert.equal(update(root,new Date((slot+1)*SLOT_MS+50*60000)).updated,0);
 assert.equal(update(root,new Date((slot-1)*SLOT_MS)).updated,0);
 assert.equal(fs.readdirSync(path.join(root,'data/history')).length,1);
 for(const f of saved.frames){assert(f.state.food>=0);for(const p of f.state.people)for(const k of ['hunger','energy','social','curiosity'])assert(p[k]>=0&&p[k]<=100);}
 // v2 migration anchors the old end state without depending on generatedSlot.
 const legacy={schemaVersion:2,frames:[{state:{hour:8}}],endState:input.endState};const migrated=makeBatch(legacy,slot);P.validate(migrated);assert.deepEqual(migrated.frames[0].state.people,legacy.endState.people);
 console.log('PASS: 72 timestamps, exact four-hour overlap, end-state continuity, delayed/missed runs, idempotence, migration');
}finally{fs.rmSync(root,{recursive:true,force:true});}

const {step}=require('../scripts/update-state.cjs');
const daytime=JSON.parse(JSON.stringify(input.endState));daytime.hour=10;
for(const p of daytime.people)p.remainingSteps=0;
const nighttime=JSON.parse(JSON.stringify(daytime));nighttime.hour=22;
const dayResult=step(daytime),nightResult=step(nighttime);
assert.deepEqual(nightResult.people,dayResult.people,'Night must not alter decisions or rest priority');
const exhausted=JSON.parse(JSON.stringify(nighttime));exhausted.food=9;
for(const p of exhausted.people)Object.assign(p,{energy:0,hunger:0,social:0,curiosity:0,success:0});
assert(step(exhausted).people.every(p=>p.action==='休む'),'Fatigued residents still rest');
console.log('PASS: identical day/night decisions; rest remains available when exhausted');
