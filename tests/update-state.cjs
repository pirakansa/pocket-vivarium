const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {makeBatch,update,SLOT_MS}=require('../scripts/update-state.cjs');
const {VillagePlayer}=require('../dist/player.js');
const input=JSON.parse(fs.readFileSync('dist/state.json','utf8')),original=JSON.stringify(input);
const next=makeBatch(input,1000);assert.equal(JSON.stringify(input),original);
assert.deepEqual(next.frames[0].state,input.endState);
assert.equal(Math.round((next.endState.hour-next.frames[0].state.hour)*60),120);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'vivarium-'));
try{
 fs.mkdirSync(path.join(root,'dist'));fs.writeFileSync(path.join(root,'dist/state.json'),JSON.stringify(next));
 assert.equal(update(root,new Date(1000*SLOT_MS)).updated,0);
 assert.equal(update(root,new Date(1003*SLOT_MS)).updated,3);
 let state=JSON.parse(fs.readFileSync(path.join(root,'dist/state.json')));assert.equal(state.generatedSlot,1003);
 assert.equal(state.frames[0].state.hour,next.endState.hour+4);
 assert.equal(fs.readdirSync(path.join(root,'data/history')).length,3);
 assert.equal(update(root,new Date(1003*SLOT_MS)).updated,0);
 update(root,new Date(1200*SLOT_MS));update(root,new Date(1200*SLOT_MS));update(root,new Date(1200*SLOT_MS));
 state=JSON.parse(fs.readFileSync(path.join(root,'dist/state.json')));assert.equal(state.generatedSlot,1200);assert.equal(fs.readdirSync(path.join(root,'data/history')).length,168);
 VillagePlayer.validate(state);
 for(const f of [...state.frames,{state:state.endState}]){assert(f.state.food>=0);for(const p of f.state.people)for(const key of ['hunger','energy','social','curiosity'])assert(p[key]>=0&&p[key]<=100);}
 console.log('PASS: continuity, 24 frames, idempotence, missed slots, bounded catch-up, history retention, valid values');
}finally{fs.rmSync(root,{recursive:true,force:true});}
