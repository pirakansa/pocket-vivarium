/* World-hour based lifecycle. No wall clock or randomness enters simulation. */
const clone=x=>JSON.parse(JSON.stringify(x));
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
const HOURS={assembly:4,cooldown:12};
function lifeHours(id){return 24*(21+((Math.imul(id,2654435761)>>>0)%15));}
function log(s,text){const m=Math.round(s.hour*60);s.logs.unshift(`第${Math.floor(m/1440)+1}日 ${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(m%60).padStart(2,'0')}　${text}`);s.logs=s.logs.slice(0,35);}
function initialize(s){
 s.people??=[];s.logs??=[];s.lifecycleVersion=1;s.resources??={parts:24};s.lineage??={};s.assembly??=null;s.nextAssemblyHour??=s.hour+6;
 for(const p of s.people){
  p.activatedHour??=s.hour;p.serviceLifeHours??=lifeHours(p.id);p.parentIds??=[];p.generation??=1;p.durability??=100;
  s.lineage[p.id]??={id:p.id,generation:p.generation,parentIds:clone(p.parentIds),activatedHour:p.activatedHour,serviceLifeHours:p.serviceLifeHours,design:{care:p.care,safe:p.safe,adventure:p.adventure,color:p.color}};
 }
 s.nextResidentId=Math.max(s.nextResidentId||1,1,...Object.keys(s.lineage).map(id=>Number(id)+1),s.assembly?s.assembly.id+1:1);
 return s;
}
function designOf(parents,id){
 const variation=((id*17)%11-5)/40;
 const value=key=>clamp(parents.reduce((sum,p)=>sum+(p[key]||1),0)/parents.length+variation,.5,3.5);
 return {care:value('care'),safe:value('safe'),adventure:value('adventure'),color:parents[0].color||'#709e91'};
}
function trait(d){return d.adventure>=d.care&&d.adventure>=d.safe?'探索を好む設計':d.care>=d.safe?'通信を好む設計':'備えを重視する設計';}
function start(s,parents,station){
 const id=s.nextResidentId++,design=designOf(parents,id);
 const builder=station?null:parents[0].id;
 s.assembly={id,builderId:builder,parentIds:parents.map(p=>p.id).filter(id=>id>0),generation:Math.max(...parents.map(p=>p.generation||1))+1,design,startedHour:s.hour,readyHour:s.hour+HOURS.assembly,source:station?'station':'mehs'};
 s.nextAssemblyHour=s.hour+HOURS.assembly+HOURS.cooldown;
 log(s,station?`継承設備がMEHS #${id}の自動組み立てを開始。`:`MEHS #${builder}が新しいMEHS #${id}の組み立てを開始。`);
}
function finish(s){
 const a=s.assembly,p={id:a.id,kind:'mehs',...a.design,trait:trait(a.design),hunger:10,energy:90,social:20,curiosity:35,success:0,discoveries:0,kindness:0,remainingSteps:0,activityArea:'home',action:'起動チェック',reason:`設計元 ${a.parentIds.map(id=>'#'+id).join('・')}の特性を受け継いで起動しました。`,parentIds:a.parentIds,generation:a.generation,activatedHour:s.hour,serviceLifeHours:lifeHours(a.id),durability:100};
 s.people.push(p);initialize(s);s.assembly=null;log(s,`MEHS #${p.id}が起動。第${p.generation}世代／継承元 ${p.parentIds.map(id=>'#'+id).join('・')}。`);
}
function advance(s){
 initialize(s);
 const alive=[];
 for(const p of s.people){
  const age=Math.max(0,s.hour-p.activatedHour);p.durability=clamp(100*(1-age/p.serviceLifeHours),0,100);
  if(age+1e-7>=p.serviceLifeHours){
   const record=s.lineage[p.id];record.retiredHour=s.hour;record.experience={recovery:p.success,exploration:p.discoveries,communication:p.kindness};
   s.resources.parts=Math.min(64,s.resources.parts+8);log(s,`MEHS #${p.id}が稼働寿命を迎えて引退。設計を保存し、部品8個を次の機体へ。`);
  }else alive.push(p);
 }
 s.people=alive;
 if(s.assembly&&s.assembly.builderId!==null&&!alive.some(p=>p.id===s.assembly.builderId)){
  s.assembly.builderId=null;s.assembly.source='station';log(s,`継承設備がMEHS #${s.assembly.id}の組み立てを引き継いだ。`);
 }

 // Passive consumption grows with population. A reserve is required before assembly.
 s.food=clamp(s.food-s.people.length*.015,0,72);
 s.resources.parts=clamp(s.resources.parts,0,64);
 if(s.assembly&&s.hour+1e-7>=s.assembly.readyHour)finish(s);
 if(!s.assembly&&s.people.length===0){
  const records=Object.values(s.lineage).sort((a,b)=>(b.retiredHour||0)-(a.retiredHour||0));
  const source=records[0]||{id:0,generation:0,design:{care:1,safe:1,adventure:1,color:'#709e91'}};
  // The installation has a dedicated recovery reserve: no permanent extinction.
  start(s,[{id:source.id,generation:source.generation,...source.design}],true);
 }
 if(!s.assembly&&s.hour>=s.nextAssemblyHour&&s.people.length){
  const n=s.people.length,cost=12+n*4,reserve=12+n*6;
  const candidates=s.people.filter(p=>p.hunger<70&&p.energy>25&&p.durability>5).sort((a,b)=>((b.adventure||1)*b.curiosity/100+(b.care||1)*3/(n+1))-((a.adventure||1)*a.curiosity/100+(a.care||1)*3/(n+1))||a.id-b.id);
  if(candidates.length&&s.food>=reserve+6&&s.resources.parts>=cost){
   s.food-=6;s.resources.parts-=cost;
   const sponsor=candidates[0],other=s.people.filter(p=>p.id!==sponsor.id).sort((a,b)=>b.kindness-a.kindness||a.id-b.id)[0];
   start(s,other?[sponsor,other]:[sponsor],false);
  }
 }
 if(s.assembly){const p=s.people.find(p=>p.id===s.assembly.builderId);if(p){p.action='組み立てる';p.activityArea='home';p.reason=`新しいMEHS #${s.assembly.id}に、自分たちの設計を引き継いでいます。`;p.scores=[];}}
 return s;
}
function migrateTimeline(input){const data=clone(input);const origin=data.frames?.[0]?.state?.hour??data.endState?.hour??0;for(const s of [...(data.frames||[]).map(f=>f.state),data.endState].filter(Boolean)){for(const p of s.people||[])p.activatedHour??=origin;s.nextAssemblyHour??=origin+6;initialize(s);}return data;}
module.exports={initialize,advance,migrateTimeline,lifeHours,HOURS};
