const {VillageGeography:G}=require('../dist/geography.js');
const R=require('./random.cjs');
const SITES=[{id:'cell-grove',name:'電力セルの隠れた集積地',kind:'recover'},{id:'old-relay',name:'古い通信中継器',kind:'explore'},{id:'workshop-ruins',name:'旧工房の記録',kind:'recover'}];
function initialize(s){R.initialize(s);s.finds??=[];s.sites??=[];s.nextFindId??=1;s.resources??={parts:24};s.resources.rarePartFinds??=[];for(const p of s.people||[]){p.knowledge??=[];p.eyeShape??='square';}return s;}
function event(s,p,text,findId){p.lastEvent={text,findId:findId??null,hour:s.hour,untilHour:s.hour+.5};}
function discover(s,p,action,note){
 initialize(s);if(s.hour<(p.nextDiscoveryHour||0))return;
 const roll=R.next(s),rare=roll<.04,unseen=G.areaOf(p)==='deepForest'?[]:SITES.filter(site=>!s.sites.some(x=>x.id===site.id));
 if(!rare&&!(action===4&&roll<.18&&unseen.length))return;
 const id=s.nextFindId++;let find;
 if(rare){
  find={id,type:'rare-part',name:'光学モジュール',finderId:p.id,hour:s.hour,kind:'recover'};
  s.resources.parts=Math.min(64,s.resources.parts+2);
  if(s.resources.rarePartFinds.length<12)s.resources.rarePartFinds.push({id,finderId:p.id,name:find.name,hour:s.hour});
 }else{
  const site=unseen[Math.floor(R.next(s)*unseen.length)];find={id,type:'site',...site,siteId:site.id,finderId:p.id,hour:s.hour};
  // Keep event IDs numeric and site identifiers separate.
  find.id=id;s.sites.push({id:site.id,name:site.name,findId:id,finderId:p.id});
 }
 s.finds.push(find);s.finds=s.finds.slice(-32);p.knowledge.push(id);p.knowledge=p.knowledge.slice(-16);p.nextDiscoveryHour=s.hour+4;
 const text=`MEHS #${p.id}が${find.name}を発見。${rare?'次の組み立てで特別な目の機体へ。':'新しい行動の手がかりを記録。'}`;note(s,text);event(s,p,text,id);
}
function communicate(s,p,note,peers=G.peers(s,p)){
 const choices=[...peers].sort((a,b)=>(a.knowledge?.length||0)-(b.knowledge?.length||0)||a.id-b.id);
 if(p.informationStyle==='unreliable'&&s.hour>=(p.nextRumorHour||0)){
  const q=choices.find(q=>G.areaOf(q)===G.areaOf(p)&&(!q.hint||q.hint.untilHour<s.hour));
  if(q&&R.next(s)<.2){
   q.hint={kind:'recover',sourceId:p.id,falseReport:true,untilHour:s.hour+2};
   q.informationExperience??={received:0,disproved:0};q.informationExperience.received++;
   q.informationExperience.lastSourceId=p.id;
   p.nextRumorHour=s.hour+6;
   const text=`MEHS #${p.id}が#${q.id}へ「林の奥に未回収のセルがあるらしい」と通信。`;
   note(s,text);event(s,p,text);event(s,q,`#${p.id}から回収情報を受信`);return;
  }
 }
 for(const q of choices){const known=s.finds.find(f=>p.knowledge.includes(f.id)&&!(q.knowledge||[]).includes(f.id));if(!known)continue;
  q.knowledge??=[];q.knowledge.push(known.id);q.knowledge=q.knowledge.slice(-16);q.hint={findId:known.id,sourceId:p.id,kind:known.kind,untilHour:s.hour+6};
  const text=`MEHS #${p.id}が#${q.id}へ「${known.name}」の情報を通信。`;note(s,text);event(s,p,text,known.id);event(s,q,`#${p.id}から発見情報を受信`,known.id);return;
 }
}
module.exports={initialize,discover,communicate};
