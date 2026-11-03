const {VillageGeography:G}=require('../dist/geography.js');
const crypto=require('node:crypto');
const {compile,execute}=require('./program-runtime.cjs');
const ACTIONS=new Set(['charge','maintain','recover','communicate','explore']);
function revision(p){return p.program?crypto.createHash('sha256').update(JSON.stringify([p.program.authorId,p.program.name,p.program.source,p.program.createdHour])).digest('hex'):null;}
function inputs(s,p){return {location:G.areaOf(p)||"route",destination:p.journey?.to||G.areaOf(p)||"home",moving:!!p.journey,nearbyCount:G.peers(s,p).length,travelRemainingMinutes:p.journey?Math.max(0,(p.journey.arriveHour-s.hour)*60):0,minutesHome:G.travelMinutes(p,"home"),minutesForest:G.travelMinutes(p,"forest"),minutesSquare:G.travelMinutes(p,"square"),minutesHill:G.travelMinutes(p,"hill"),rain:s.rain,hunger:p.hunger,social:p.social,energy:p.energy,curiosity:p.curiosity,food:s.food,parts:s.resources.parts,population:s.people.length,success:p.success,discoveries:p.discoveries,kindness:p.kindness,care:p.care||1,safe:p.safe||1,adventure:p.adventure||1};}
function checkResult(r){if(!r||typeof r!=='object'||Array.isArray(r)||!ACTIONS.has(r.action)||Object.keys(r).some(k=>k!=='action'))throw Error('Invalid action');return r;}
function validate(row,s,p){
 if(!row||!Number.isSafeInteger(row.residentId)||typeof row.name!=='string'||!row.name.trim()||row.name.length>60||typeof row.reason!=='string'||!row.reason.trim()||row.reason.length>240||!(row.baseRevision===null||/^[a-f0-9]{64}$/.test(row.baseRevision)))throw Error('Invalid routine');
 compile(row.source);checkResult(execute(row.source,inputs(s,p)));
 for(let i=0;i<16;i++)checkResult(execute(row.source,{...inputs(s,p),rain:i&1?24:0,hunger:i&2?100:0,energy:i&4?100:0,social:i&8?100:0,food:i&2?72:0,parts:i&4?64:0,curiosity:i&8?100:0,population:i&1?1:12}));
}
function apply(s,time,bundle,note){
 if(!bundle||!Array.isArray(bundle.routines)||!bundle.routines.length)return;
 const start=Date.parse(bundle.date+'T00:00:00+09:00');
 if(!Number.isFinite(start)||time<start||time>=start+48*3600000||s.routineUpdates?.date>=bundle.date)return;
 const report={date:bundle.date,at:new Date(time).toISOString(),results:[]};
 if(bundle.routines.length>3){report.results=[{status:'rejected',reason:'daily-limit'}];s.routineUpdates=report;return;}
 const seen=new Set();
 for(const row of bundle.routines){
  const id=Number.isSafeInteger(row?.residentId)?row.residentId:null,result={residentId:id,status:'rejected'};
  try{
   if(seen.has(id))throw Error('Duplicate resident');seen.add(id);
   const p=s.people.find(p=>p.id===id);
   if(!p){result.status='skipped';result.reason='resident-absent';}
   else if(row.baseRevision!==revision(p)){result.status='skipped';result.reason='routine-changed';}
   else if(Math.max(p.success||0,p.discoveries||0,p.kindness||0)<8){result.status='skipped';result.reason='experience-insufficient';}
   else {
    validate(row,s,p);const old=p.program;
    p.program={name:row.name,source:row.source,authorId:old?.authorId??p.id,modifiedBy:p.id,createdHour:s.hour,origin:'ai',reason:row.reason,generatedDate:bundle.date,revision:(old?.revision||1)+(old?1:0),runs:0,used:0,lastAction:null,...(old?.receivedFrom?{receivedFrom:old.receivedFrom}:{}),experienceAtCreation:{recovery:p.success,exploration:p.discoveries,communication:p.kindness}};
    result.status='applied';result.revision=revision(p);note(s,`MEHS #${p.id}が「${row.name}」を${old?'改良':'作成'}。${row.reason}`);
   }
  }catch{result.reason='invalid-routine';}
  report.results.push(result);
 }
 s.routineUpdates=report;
}
module.exports={revision,inputs,checkResult,validate,apply};
