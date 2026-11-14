const {VillageGeography:G}=require('../dist/geography.js');

const ACTION=6;
const LINKS=G.relayLinks;
const COST={build:24,repair:8,move:16};
const RESERVE=16;
const DESIGN_HOURS=10/60,WORK_HOURS=.5;

function remotePeers(s,p){
 const relay=s.relay,area=G.areaOf(p);
 if(!relay||relay.condition<=0)return [];
 const other=area===relay.area?LINKS[area]:area===LINKS[relay.area]?relay.area:null;
 return other?s.people.filter(q=>G.areaOf(q)===other):[];
}

function use(s,p,q,note){
 const relay=s.relay;
 if(relay.lastLoggedHour!==Math.floor(s.hour)){
  relay.lastLoggedHour=Math.floor(s.hour);
  note(s,`MEHS #${p.id}が中継器で${G.places[G.areaOf(q)].name}の#${q.id}と通信。`);
 }
 relay.lastSignal={from:G.areaOf(p),hour:s.hour};
 relay.condition=Math.max(0,relay.condition-.25);
 if(relay.condition===0)note(s,'通信中継器が摩耗で停止。');
}

function eligible(s,p){
 return !s.incident?.crew?.includes(p.id)&&s.assembly?.builderId!==p.id&&p.hunger<65&&p.energy>40&&(p.durability??100)>5
  &&p.pendingRoutine?.readyHour===undefined&&p.journey?.plan.a!==5;
}

function available(s,area){
 return s.people.filter(p=>eligible(s,p)).sort((a,b)=>G.travelMinutes(a,area)-G.travelMinutes(b,area)||a.id-b.id);
}

function nextProject(s){
 if(!s.relay)return {kind:'build',area:'square'};
 if(s.relay.condition>25)return null;
 const area=s.relay.area,alternative=area==='square'?'forest':'square';
 const demand=site=>s.people.filter(p=>G.areaOf(p)===site&&p.social>=50).length;
 if(demand(LINKS[alternative])>demand(LINKS[area])&&s.resources.parts>=RESERVE+COST.move)return {kind:'move',area:alternative};
 return {kind:'repair',area};
}

function prepare(s,note){
 const relay=s.relay;
 if(relay&&relay.condition>0){
  relay.condition=Math.max(0,relay.condition-100/(72*12));
  if(relay.condition===0)note(s,'通信中継器が摩耗で停止。');
 }
 if(!s.relayProject){
  const next=nextProject(s);
  if(!next||s.resources.parts<RESERVE+COST[next.kind])return;
  const candidates=available(s,next.kind==='build'?'lab':next.area);
  if(candidates.length<2)return;
  if(next.kind==='build'){
   const designer=candidates.find(p=>Math.max(p.kindness||0,p.discoveries||0,p.success||0)>=8);
   if(!designer)return;
   s.relayProject={...next,designerId:designer.id};
  }else{
   s.relayProject={...next,crew:[]};
   note(s,`MEHSたちが通信中継器の${next.kind==='move'?'移設':'修理'}を計画。`);
  }
 }
 const project=s.relayProject;
 if(project.designerId!==undefined){
  const designer=s.people.find(p=>p.id===project.designerId);
  if(!designer||!eligible(s,designer)){delete s.relayProject;return;}
  if(G.areaOf(designer)!=='lab')return;
  project.designReadyHour??=s.hour+DESIGN_HOURS;
  if(s.hour+1e-7<project.designReadyHour)return;
  delete project.designerId;
  delete project.designReadyHour;
  project.crew=[designer.id];
  note(s,`MEHS #${designer.id}が開発室で通信中継器を設計。仲間と広場に設置します。`);
 }
 if(s.resources.parts<RESERVE+COST[project.kind]){
  delete s.relayProject;
  note(s,'部品を備蓄するため、通信中継器の作業を見送りました。');
  return;
 }
 const candidates=available(s,project.area);
 const previousCrew=project.crew,ids=candidates.map(p=>p.id);
 project.crew=ids.length<2?[]:[...new Set([...previousCrew.filter(id=>ids.includes(id)),...ids])].slice(0,2);
 const crew=project.crew.map(id=>candidates.find(p=>p.id===id));
 if(crew.length!==2||!crew.every(p=>G.areaOf(p)===project.area)){
  delete project.readyHour;
  return;
 }
 if(project.crew.some((id,i)=>id!==previousCrew[i]))delete project.readyHour;
 project.readyHour??=s.hour+WORK_HOURS;
 if(s.hour+1e-7<project.readyHour)return;

 s.resources.parts-=COST[project.kind];
 s.relay={...relay,area:project.area,condition:100};
 delete s.relay.lastSignal;
 delete s.relay.lastLoggedHour;
 delete s.relayProject;
 const work={build:'を設置',repair:'を修理',move:'へ移設'}[project.kind];
 note(s,`MEHS #${crew[0].id}と#${crew[1].id}が${project.kind==='move'?'通信中継器を'+G.places[project.area].name:'通信中継器'}${work}。部品${COST[project.kind]}個を使用。`);
}

function assigned(s,p){
 const project=s.relayProject;
 if(!project)return null;
 if(project.designerId===p.id)return {to:'lab',action:'中継器を設計する',why:'開発室で通信中継器の設計をまとめます。'};
 if(!project.crew?.includes(p.id))return null;
 const action={build:'中継器を設置する',repair:'中継器を修理する',move:'中継器を移設する'}[project.kind];
 return {to:project.area,action,why:project.readyHour!==undefined?'仲間と一緒に中継器を作業中です。':'仲間と現地で合流して作業します。'};
}

function work(s,p,job,note){
 if(G.depart(p,job.to,{a:ACTION,why:job.why},s.hour)){
  note(s,`MEHS #${p.id}が中継器の作業で${G.places[job.to].name}へ出発。`);
 }else{
  p.activityArea=job.to;p.action=job.action;p.reason=job.why;p.remainingSteps=0;p.scores=[];
 }
}

module.exports={ACTION,remotePeers,use,prepare,assigned,work};

