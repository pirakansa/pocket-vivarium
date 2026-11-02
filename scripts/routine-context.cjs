/* Emit bounded context and exact base revisions for the daily authoring task. */
const fs=require('node:fs');const {revision}=require('./ai-routines.cjs');
function context(data){const s=data.endState;return {windowEnd:data.windowEnd,worldHour:s.hour,food:s.food,parts:s.resources.parts,rain:s.rain,assembly:s.assembly,logs:s.logs.slice(0,15),residents:s.people.map(p=>({id:p.id,baseRevision:revision(p),eligible:Math.max(p.success,p.discoveries,p.kindness)>=8,trait:p.trait,care:p.care,safe:p.safe,adventure:p.adventure,hunger:p.hunger,energy:p.energy,social:p.social,curiosity:p.curiosity,success:p.success,discoveries:p.discoveries,kindness:p.kindness,lastEvent:p.lastEvent,program:p.program||null}))};}
if(require.main===module)console.log(JSON.stringify(context(JSON.parse(fs.readFileSync(process.argv[2]||'dist/state.json','utf8'))),null,2));
module.exports={context};
