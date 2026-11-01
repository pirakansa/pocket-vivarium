/* Absolute timestamps select immutable world snapshots. */
(function(root){
 const STEP=300000;
 function validate(d){
  const start=Date.parse(d.windowStart),end=Date.parse(d.windowEnd),anchor=Date.parse(d.anchorAt);
  const valid=s=>s&&Number.isFinite(s.hour)&&Number.isFinite(s.food)&&Array.isArray(s.logs)&&Array.isArray(s.people)&&new Set(s.people.map(p=>p.id)).size===s.people.length&&s.people.every(p=>Number.isSafeInteger(p.id)&&p.id>0&&!Object.hasOwn(p,"name"))&&Number.isSafeInteger(s.nextResidentId)&&s.nextResidentId>Math.max(0,...s.people.map(p=>p.id));
  if(d.schemaVersion!==3||d.mode!=='realtime'||!Number.isFinite(start)||end-start!==21600000||anchor-start!==7200000||d.stepMinutes!==5||!Array.isArray(d.frames)||d.frames.length!==72||!d.frames.every((f,i)=>Date.parse(f.at)===start+i*STEP&&valid(f.state))||!valid(d.endState))throw Error('6時間分の記録が必要です');
  return d;
 }
 function snapshotAt(d,at){const start=Date.parse(d.windowStart);return at>=Date.parse(d.windowEnd)?d.endState:d.frames[Math.max(0,Math.min(71,Math.floor((at-start)/STEP)))].state;}
 function bounds(d,now){const upper=Math.min(now,Date.parse(d.windowEnd));return {min:Math.max(now-7200000,Date.parse(d.windowStart)),max:upper,waiting:now>=Date.parse(d.windowEnd),notStarted:now<Date.parse(d.windowStart)};}
 function position(d,now,selected=null){const b=bounds(d,now);return selected===null?Math.max(Date.parse(d.windowStart),Math.min(now,b.max)):Math.min(selected,now,Date.parse(d.windowEnd));}
 root.VillagePlayer={validate,snapshotAt,bounds,position};
})(typeof module==='object'?module.exports:window);
