const {VillageGeography:G}=require('../dist/geography.js');
const {remotePeers}=require('./relay.cjs');
const crypto=require('node:crypto');
const {compile,execute}=require('./program-runtime.cjs');
const ACTIONS=new Set(['charge','maintain','recover','communicate','explore']);
function revision(p){return p.program?crypto.createHash('sha256').update(JSON.stringify([p.program.authorId,p.program.name,p.program.source,p.program.createdHour])).digest('hex'):null;}
function inputs(s,p){return {incidentStage:s.incident?.stage||'none',incidentLostCells:s.incident?.lostCells||0,incidentWaitingForParts:!!s.incident?.waitingForParts,canDiagnose:!!p.skills?.diagnosis,canIsolate:!!p.skills?.isolation,canRepair:!!p.skills?.repair,canCooperate:!!p.skills?.cooperation,location:G.areaOf(p)||"route",destination:p.journey?.to||G.areaOf(p)||"home",moving:!!p.journey,nearbyCount:G.peers(s,p).length,relayPeers:remotePeers(s,p).length,travelRemainingMinutes:p.journey?Math.max(0,(p.journey.arriveHour-s.hour)*60):0,minutesHome:G.travelMinutes(p,"home"),minutesLab:G.travelMinutes(p,"lab"),minutesForest:G.travelMinutes(p,"forest"),minutesDeepForest:G.travelMinutes(p,"deepForest"),minutesSquare:G.travelMinutes(p,"square"),minutesHill:G.travelMinutes(p,"hill"),misinformationChecks:p.informationExperience?.disproved||0,rain:s.rain,hunger:p.hunger,social:p.social,energy:p.energy,curiosity:p.curiosity,food:s.food,parts:s.resources.parts,population:s.people.length,success:p.success,discoveries:p.discoveries,kindness:p.kindness,care:p.care||1,safe:p.safe||1,adventure:p.adventure||1};}
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
   else if(checkPending(s,p,note)){result.status='skipped';result.reason='development-pending';}
   else if(row.baseRevision!==revision(p)){result.status='skipped';result.reason='routine-changed';}
   else if(Math.max(p.success||0,p.discoveries||0,p.kindness||0)<8){result.status='skipped';result.reason='experience-insufficient';}
   else {
    validate(row,s,p);
    p.pendingRoutine={date:bundle.date,baseRevision:row.baseRevision,name:row.name,reason:row.reason,source:row.source,
      expiresHour:s.hour+(start+48*3600000-time)/3600000};
    result.status='queued';note(s,`MEHS #${p.id}が「${row.name}」の改良案を受け取り、開発室で作業する予定です。`);
   }
  }catch{result.reason='invalid-routine';}
  report.results.push(result);
 }
 s.routineUpdates=report;
}
const WORK_HOURS=2/12;
function result(s,p,status,details={}){
 const job=p.pendingRoutine;
 const record=s.routineUpdates?.date===job.date?s.routineUpdates.results.find(x=>x.residentId===p.id&&x.status==='queued'):null;
 if(record)Object.assign(record,{status,...details});
 delete p.pendingRoutine;
}
function checkPending(s,p,note){
 if(!p.pendingRoutine)return false;
 const reason=s.hour>=p.pendingRoutine.expiresHour?'expired':p.pendingRoutine.baseRevision!==revision(p)?'routine-changed':null;
 if(!reason)return true;
 result(s,p,'skipped',{reason});
 note(s,`MEHS #${p.id}：${reason==='expired'?'開発候補の期限が切れた':'稼働中のルーチンが変わった'}ため改良を見送りました。`);
 return false;
}
function canWork(s,p){
 const minutes=G.travelMinutes(p,'lab')+10+G.travelMinutes({position:G.places.lab,durability:p.durability},'home');
 return p.pendingRoutine&&p.energy>35&&p.hunger+minutes*.18<75&&s.hour+minutes/60<p.pendingRoutine.expiresHour;
}
function work(s,p,note){
 if(G.areaOf(p)!=='lab'||!checkPending(s,p,note))return false;
 const job=p.pendingRoutine;
 p.action='開発する';p.activityArea='lab';p.scores=[];p.remainingSteps=0;
 if(job.readyHour===undefined){
  job.readyHour=s.hour+WORK_HOURS;p.reason='開発室で改良案を試しています。';
  note(s,`MEHS #${p.id}が開発室で「${job.name}」の作業を開始。`);return true;
 }
 if(s.hour+1e-7<job.readyHour)return true;
 const old=p.program;
 p.program={name:job.name,source:job.source,authorId:old?.authorId??p.id,modifiedBy:p.id,createdHour:s.hour,origin:'ai',reason:job.reason,generatedDate:job.date,revision:(old?.revision||1)+(old?1:0),runs:0,used:0,lastAction:null,...(old?.receivedFrom?{receivedFrom:old.receivedFrom}:{}),experienceAtCreation:{recovery:p.success,exploration:p.discoveries,communication:p.kindness}};
 result(s,p,'applied',{revision:revision(p)});
 p.reason=job.reason;note(s,`MEHS #${p.id}が開発室で「${job.name}」を${old?'改良':'作成'}。 ${job.reason}`);
 return true;
}
module.exports={revision,inputs,checkResult,validate,apply,checkPending,canWork,work};

