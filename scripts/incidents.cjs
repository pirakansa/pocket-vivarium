/* Persisted multi-step incidents; all timing uses simulation hours. */
const {VillageGeography:G}=require('../dist/geography.js');
const R=require('./random.cjs');
const ACTION=7,STEP=1/12;
const SKILLS={diagnosis:'漏電診断',isolation:'応急切り離し',repair:'保管庫修理',cooperation:'共同復旧'};
function initialize(s){
 s.incidentSystem??={nextHour:s.hour+2+R.next(s)*4,count:0};
 for(const p of s.people){p.skills??={};p.incidentExperience??={diagnosis:0,isolation:0,repair:0,cooperation:0};}
}
function learn(s,p,key,note,teacher){
 if(p.skills[key])return;
 p.skills[key]={learnedHour:s.hour,origin:teacher?'communication':'practice',...(teacher?{teacherId:teacher.id}:{})};
 note(s,`MEHS #${p.id}が${teacher?'#'+teacher.id+'から':'実作業から'}「${SKILLS[key]}」を覚えた。`);
}
function share(s,p,peers,note){
 // Advanced procedures require the recipient's earlier skills; one lesson per contact.
 for(const key of Object.keys(SKILLS)){
  if(!p.skills?.[key])continue;
  const q=peers.find(q=>!q.skills?.[key]&&(key==='diagnosis'||q.skills?.diagnosis)&&(key!=='cooperation'||q.skills?.repair));
  if(q){q.skills??={};learn(s,q,key,note,p);return;}
 }
}
function eligible(s,p){
 return p.hunger<70&&p.energy>30&&(p.durability??100)>5&&s.assembly?.builderId!==p.id
  &&p.pendingRoutine?.readyHour===undefined&&p.journey?.plan.a!==5;
}
function assigned(s,p){return s.incident?.crew?.includes(p.id);}
function start(s,note){
 const n=s.incidentSystem;
 const loss=Math.min(s.food,10+Math.floor(R.next(s)*5));s.food-=loss;
 s.incident={id:++n.count,kind:'cell-leak',stage:'diagnosis',startedHour:s.hour,progress:0,crew:[],lostCells:loss,usedParts:0,discardedCells:0,contributors:{}};
 note(s,`セル保管庫で漏電が発生。セル${loss}個を失い、今も電力が漏れています。保管庫への受け入れも制限され、診断と復旧が必要です。`);
}
function prepare(s,note){
 initialize(s);
 if(!s.incident&&s.hour+1e-7>=s.incidentSystem.nextHour&&s.people.length)start(s,note);
 const event=s.incident;if(!event)return;
 // A hardware breaker stops unbounded losses, but does not repair the store.
 if(!event.breakerTripped&&s.hour-event.startedHour>=12){
  event.breakerTripped=true;note(s,'保管庫の保護遮断器が作動し、漏電が停止。設備の修理はまだ必要です。');
 }
 if(!event.breakerTripped){
  const loss=Math.min(s.food,(event.stage==='repair'?1:5)*STEP);
  s.food-=loss;event.lostCells+=loss;
 }
 const candidates=s.people.filter(p=>eligible(s,p)).sort((a,b)=>{
  const trained=p=>Number(!!p.skills[event.stage])+Number(event.stage==='repair'&&!!p.skills.cooperation);
  return trained(b)-trained(a)||Number(assigned(s,b))-Number(assigned(s,a))||G.travelMinutes(a,'home')-G.travelMinutes(b,'home')||a.id-b.id;
 });
 // Keep some residents free to collect resources. A single resident can also recover.
 const count=event.stage==='repair'&&s.people.length>=3?2:1;
 event.crew=candidates.slice(0,count).map(p=>p.id);
 event.waitingForParts=s.resources.parts<(event.stage==='isolation'?2:event.stage==='repair'?10:0);
 if(event.waitingForParts)event.crew=[];
}
function work(s,p,note){
 const e=s.incident;if(!e||!assigned(s,p))return false;
 const stage=e.stage;
 const names={diagnosis:'漏電を診断する',isolation:'漏電を切り離す',repair:'保管庫を修理する'};
 if(G.areaOf(p)!=='home'){
  if(p.journey?.plan.a!==ACTION&&G.depart(p,'home',{a:ACTION,why:'保管庫の漏電に対処するため工房へ戻ります。'},s.hour))note(s,`MEHS #${p.id}が保管庫の復旧へ向かいます。`);
  return true;
 }
 p.action=names[stage];p.activityArea='home';p.remainingSteps=0;p.scores=[];
 p.reason=e.waitingForParts?'復旧用の部品が足りません。資源を集める仲間を待っています。':stage==='diagnosis'?'漏電箇所を調べ、安全な復旧手順を確認しています。':stage==='isolation'?'故障部分を切り離して、セルの損失を抑えています。':e.crew.length>1?'仲間と保管庫を修理しています。揃って作業すると早く復旧できます。':'単独で修理しています。仲間がいなくても、少しずつ復旧できます。';
 return true;
}
function finishStep(s,note){
 const e=s.incident;if(!e)return;
 const crew=s.people.filter(p=>assigned(s,p)&&G.areaOf(p)==='home'&&eligible(s,p)&&p.action===({diagnosis:'漏電を診断する',isolation:'漏電を切り離す',repair:'保管庫を修理する'}[e.stage]));
 // Work only counts after arrival and actual dispatch. Partial work survives interruptions.
 if(!crew.length||e.waitingForParts)return;
 const stage=e.stage;
 for(const p of crew){
  p.hunger=Math.min(100,p.hunger+.6);p.energy=Math.max(0,p.energy-.4);
  e.contributors[p.id]??={};e.contributors[p.id][stage]=true;
  if(stage==='repair'&&crew.length>1)e.contributors[p.id].cooperation=true;
 }
 const speed=stage==='repair'?crew.reduce((v,p)=>v+(p.skills.repair?1.5:1)*(crew.length>1&&p.skills.cooperation?1.25:1),0):crew[0].skills[stage]?2:1;
 e.progress+=STEP*speed;
 const required={diagnosis:.5,isolation:1/3,repair:2}[stage];
 if(e.progress+1e-7<required)return;
 const cost={diagnosis:0,isolation:2,repair:10}[stage];
 if(s.resources.parts<cost)return;
 s.resources.parts-=cost;e.usedParts+=cost;
 for(const p of s.people){
  const contribution=e.contributors[p.id];if(!contribution?.[stage])continue;
  p.incidentExperience[stage]++;learn(s,p,stage,note);
  if(stage==='repair'&&contribution.cooperation){p.incidentExperience.cooperation++;learn(s,p,'cooperation',note);}
 }
 if(stage==='repair'){
  s.lastIncident={...e,stage:'resolved',resolvedHour:s.hour,progress:1};
  s.incidentSystem.nextHour=s.hour+18+R.next(s)*18;
  note(s,`セル保管庫が復旧。セル損失${e.lostCells.toFixed(1)}個、部品${e.usedParts}個を使用。`);
  delete s.incident;
 }else{
  e.stage=stage==='diagnosis'?'isolation':'repair';e.progress=0;e.crew=[];
  note(s,stage==='diagnosis'?'保管庫の故障箇所を特定。次は応急切り離しです。':'故障部分を切り離し、漏電を毎時5個から1個に抑制。部品2個を使用し、本修理へ進みます。');
 }
}
module.exports={ACTION,SKILLS,initialize,assigned,prepare,work,finishStep,share};
