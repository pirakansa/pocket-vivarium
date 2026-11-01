const assert=require('node:assert/strict'),fs=require('node:fs');const {convertTimeline,translate}=require('../dist/mehs.js');
const state={hour:8,food:9,rain:0,nextResidentId:2,people:[{id:1,hunger:41,energy:67,action:'食べる',reason:'お腹がすいてきた。家で食事をしよう。',scores:[{s:54,why:'疲れたので、家で少し休もう。'}]}],logs:['住人 #1：採集する。']};
const original={schemaVersion:3,windowStart:'2026-11-01T10:00:00Z',frames:[{at:'2026-11-01T10:00:00Z',state}],endState:state};const before=JSON.stringify(original),after=convertTimeline(original);
assert.equal(JSON.stringify(original),before);assert.deepEqual(convertTimeline(after),after);
assert.equal(after.frames[0].state.people[0].action,'充電する');assert.equal(after.endState.food,9);assert.equal(after.endState.people[0].energy,67);assert.equal(after.endState.people[0].hunger,41);assert.equal(after.endState.people[0].id,1);assert.equal(after.windowStart,original.windowStart);assert.equal(after.frames[0].at,original.frames[0].at);assert.equal(after.endState.people[0].kind,'mehs');
assert.equal(translate('住人 #1：休む。'),'MEHS #1：整備する。');
const data=JSON.parse(fs.readFileSync('dist/state.json'));for(const f of [...data.frames,{state:data.endState}]){assert(f.state.people.every(p=>p.kind==='mehs'));assert(f.state.people.every(p=>!['食べる','休む','採集する','交流する','探検する'].includes(p.action))); }
console.log('PASS: MEHS vocabulary migration, idempotence, IDs/numeric values/timestamps retained');
