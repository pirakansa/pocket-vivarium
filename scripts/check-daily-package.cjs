const fs=require('node:fs'),assert=require('node:assert/strict');
const {validate}=require('./daily-package.cjs'),external=require('./external-events.cjs'),AI=require('./ai-routines.cjs');
function check(raw,state){
 const bundle=validate(raw);external.validate(raw);
 assert(!raw.routines||Array.isArray(raw.routines));assert((raw.routines||[]).length<=3);
 const seen=new Set();for(const row of raw.routines||[]){assert(!seen.has(row.residentId),'Duplicate resident');seen.add(row.residentId);const p=state.people.find(p=>p.id===row.residentId);assert(p,'Missing resident');assert.equal(row.baseRevision,AI.revision(p),'Stale base revision');assert(Math.max(p.success,p.discoveries,p.kindness)>=8,'Insufficient experience');AI.validate(row,state,p);}
 return bundle;
}
if(require.main===module){try{check(JSON.parse(fs.readFileSync(process.argv[2],'utf8')),JSON.parse(fs.readFileSync(process.argv[3]||'dist/state.json','utf8')).endState);console.log('PASS: daily package and resident routines');}catch(e){console.error(e.message);process.exitCode=1;}}
module.exports={check};
