const assert=require('node:assert/strict');const {migrateTimeline}=require('../scripts/identities.cjs');const {VillagePlayer:P}=require('../dist/player.js');const fs=require('node:fs');
const world={people:[{name:'ユイ'},{name:'ハル'},{name:'レン'}],logs:['ハルがユイと話した。']};
const source={frames:[{state:world}],endState:world},original=JSON.stringify(source),m=migrateTimeline(source);
assert.equal(JSON.stringify(source),original);assert.deepEqual(m.endState.people.map(p=>p.id),[2,1,3]);assert(!JSON.stringify(m).includes('ハル'));assert.equal(m.endState.nextResidentId,4);assert.deepEqual(migrateTimeline(m),m);
const future=migrateTimeline({endState:{people:[{id:42}],nextResidentId:100,logs:[]}});assert.equal(future.endState.nextResidentId,100);
assert.throws(()=>migrateTimeline({endState:{people:[{id:1},{id:1}],logs:[]}}));
const data=JSON.parse(fs.readFileSync('dist/state.json'));P.validate(data);
for(const f of [...data.frames,{state:data.endState}]){assert.deepEqual(f.state.people.map(p=>p.id).sort(),[1,2,3]);assert(f.state.people.every(p=>!Object.hasOwn(p,'name')));assert(f.state.nextResidentId>=4);}
const empty=JSON.parse(JSON.stringify(data));for(const f of [...empty.frames,{state:empty.endState}])f.state.people=[];P.validate(empty);
const added=JSON.parse(JSON.stringify(data));for(const f of [...added.frames,{state:added.endState}]){f.state.people.push({...f.state.people[0],id:4});f.state.nextResidentId=5;}P.validate(added);
console.log('PASS: stable IDs across snapshots, name/log migration, counter retention, idempotence, duplicates, variable population');
