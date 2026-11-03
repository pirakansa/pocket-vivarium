const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {build,write}=require('../scripts/build-history.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'vivarium-history-'));
const origin=Date.parse('2026-11-01T00:00:00Z'),iso=ms=>new Date(ms).toISOString(),now=new Date(origin+3*3600000);
const state=(n,cells,parts,lineage={})=>({people:Array.from({length:n},(_,i)=>({id:i+1})),food:cells,...(parts===null?{}:{resources:{parts}}),lineage});
const records={1:{id:1,activatedHour:1,retiredHour:2},2:{id:2,activatedHour:2},3:{id:3,activatedHour:5}};
function batch(frames){return {schemaVersion:3,worldOrigin:iso(origin),frames:frames.map(([hour,s])=>({at:iso(origin+hour*3600000),state:s})),windowEnd:iso(origin+6*3600000),endState:state(9,99,99,records)};}
try{
 fs.mkdirSync(path.join(root,'dist'));fs.mkdirSync(path.join(root,'data/history'),{recursive:true});
 const history=path.join(root,'data/history/1793491200000.json'),latest=path.join(root,'dist/state.json');
 fs.writeFileSync(history,JSON.stringify(batch([[-24*31,state(1,1,1)],[1,state(1,5,null,records)],[2,state(1,10,20,records)],[3,state(1,11,21,records)],[4,state(8,99,99,records)]])));
 fs.writeFileSync(path.join(root,'data/history/0000000000480.json'),JSON.stringify({schemaVersion:2,frames:[]}));
 fs.writeFileSync(latest,JSON.stringify(batch([[2,state(1,12,22,records)],[3,state(1,13,23,records)],[4,state(8,99,99,records)]])));
 const originals=[history,latest].map(f=>fs.readFileSync(f,'utf8'));
 const result=build(root,now);assert.equal(result.skippedLegacy,1);assert.equal(result.points.length,3);assert.equal(result.points[0].parts,null);assert.equal(result.points[1].cells,12);assert.equal(result.points[2].parts,23);
 assert(result.points.every(p=>Date.parse(p.at)<=now));assert.equal(result.events.length,3);
 assert.equal(result.events.filter(e=>e.at===iso(origin+2*3600000)).length,2,'Simultaneous start and retirement must both survive');
 assert(!result.events.some(e=>e.id===3));assert.deepEqual([history,latest].map(f=>fs.readFileSync(f,'utf8')),originals);
 assert.deepEqual(write(root,now),{points:3,events:3});assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'dist/history.json'))),result);
 const frozen=build(root,new Date(origin-32*86400000));assert.equal(frozen.points.length,0);assert.equal(frozen.events.length,0);
 console.log('PASS: history deduplication, latest precedence, past-only window, missing parts, simultaneous lifecycle events, legacy skip, immutable input, compact output');
}finally{fs.rmSync(root,{recursive:true,force:true});}
