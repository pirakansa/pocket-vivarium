const {VillageGeography:G}=require('../dist/geography.js');
/* World-hour lifecycle with a persisted, replayable random stream. */
const R=require('./random.cjs');
const discoveries=require('./discoveries.cjs');
const weather=require('./weather.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));
const HOURS={assembly:4,cooldown:12};
function lifeHours(id){return 24*(21+((Math.imul(id,2654435761)>>>0)%15));}
function log(s,text){const m=Math.round(s.hour*60);s.logs.unshift(`第${Math.floor(m/1440)+1}日 ${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(m%60).padStart(2,'0')}　${text}`);s.logs=s.logs.slice(0,35);}
function initialize(s){
 s.people??=[];s.logs??=[];discoveries.initialize(s);s.lifecycleVersion=1;weather.initialize(s);s.resources??={parts:24};s.lineage??={};s.assembly??=null;s.nextAssemblyHour??=s.hour+6;
 for(const p of s.people){
  p.activatedHour??=s.hour;p.serviceLifeHours??=lifeHours(p.id);p.parentIds??=[];p.generation??=1;p.durability??=100;p.rainWearHours??=0;p.wearHours??=Math.max(0,s.hour-p.activatedHour)+p.rainWearHours+(p.powerWearHours||0);
  s.lineage[p.id]??={id:p.id,generation:p.generation,parentIds:clone(p.parentIds),activatedHour:p.activatedHour,serviceLifeHours:p.serviceLifeHours,design:{care:p.care,safe:p.safe,adventure:p.adventure,color:p.color}};
 }
 s.nextResidentId=Math.max(s.nextResidentId||1,1,...Object.keys(s.lineage).map(id=>Number(id)+1),s.assembly?s.assembly.id+1:1);
 return s;
}
function designOf(s,parents,id,rare){
 const value=key=>{const parent=parents[Math.floor(R.next(s)*parents.length)];const span=R.next(s)<.1?1.5:.3;return clamp((parent[key]||1)+(R.next(s)-.5)*span,.5,3.5);};
 const shapes=['square','round','visor'],inherited=parents[0].eyeShape||'square';
 const changeEye=!!rare||R.next(s)<.45;
 const options=rare?shapes.filter(x=>x!==inherited):shapes;
 const eyeShape=changeEye?options[Math.floor(R.next(s)*options.length)]:inherited;
 const colors=['#c38450','#b76a79','#597eab','#648f78','#967ab0','#b2974a'];
 const changeColor=R.next(s)<.45;
 const inheritedColor=parents[0].color||'#709e91';
 return {care:value('care'),safe:value('safe'),adventure:value('adventure'),color:changeColor?colors[Math.floor(R.next(s)*colors.length)]:inheritedColor,eyeShape,variant:rare?'発見部品の特別仕様':changeEye||changeColor?'小さな設計変異':'継承設計'};
}
function trait(d){return d.adventure>=d.care&&d.adventure>=d.safe?'探索を好む設計':d.care>=d.safe?'通信を好む設計':'備えを重視する設計';}
function start(s,parents,station){
 const id=s.nextResidentId++,rare=s.resources.rarePartFinds.shift(),design=designOf(s,parents,id,rare);
 const builder=station?null:parents[0].id;
 s.assembly={id,builderId:builder,parentIds:parents.map(p=>p.id).filter(id=>id>0),generation:Math.max(...parents.map(p=>p.generation||1))+1,design,startedHour:s.hour,readyHour:s.hour+HOURS.assembly,source:station?'station':'mehs',inspirationFindId:rare?.id??null,inspiration:rare||null};
 s.nextAssemblyHour=s.hour+HOURS.assembly+HOURS.cooldown;
 if(rare)log(s,`発見記録 #${rare.id}の光学モジュールをMEHS #${id}の設計へ組み込んだ。`);
 log(s,station?`継承設備がMEHS #${id}の自動組み立てを開始。`:`MEHS #${builder}が新しいMEHS #${id}の組み立てを開始。`);
}
function finish(s){
 const a=s.assembly,p={id:a.id,kind:'mehs',...a.design,trait:trait(a.design),hunger:10,energy:90,social:20,curiosity:35,success:0,discoveries:0,kindness:0,remainingSteps:0,activityArea:'home',action:'起動チェック',reason:`設計元 ${a.parentIds.map(id=>'#'+id).join('・')}の特性を受け継いで起動しました。`,parentIds:a.parentIds,generation:a.generation,activatedHour:s.hour,serviceLifeHours:lifeHours(a.id),durability:100,inspirationFindId:a.inspirationFindId??null,inspiration:a.inspiration||null};
 G.initialize(p);s.people.push(p);initialize(s);s.lineage[p.id].design.eyeShape=p.eyeShape;s.lineage[p.id].design.variant=p.variant;s.lineage[p.id].inspirationFindId=p.inspirationFindId;s.lineage[p.id].inspiration=p.inspiration;s.assembly=null;log(s,`MEHS #${p.id}が起動。第${p.generation}世代・${p.variant}／継承元 ${p.parentIds.map(id=>'#'+id).join('・')}。`);
}
function advance(s){
 initialize(s);
 const alive=[];
 for(const p of s.people){
  const age=Math.max(0,s.hour-p.activatedHour);p.wearHours=age+p.rainWearHours+(p.powerWearHours||0);p.durability=clamp(100*(1-p.wearHours/p.serviceLifeHours),0,100);
  if(p.wearHours+1e-7>=p.serviceLifeHours){
   const record=s.lineage[p.id];record.retiredHour=s.hour;record.wearHours=p.wearHours;record.rainWearHours=p.rainWearHours;record.powerWearHours=p.powerWearHours||0;record.experience={recovery:p.success,exploration:p.discoveries,communication:p.kindness};
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
  const candidates=s.people.filter(p=>p.hunger<70&&p.energy>25&&p.durability>5&&G.areaOf(p)==='home');
  if(candidates.length&&s.food>=reserve+6&&s.resources.parts>=cost){
   s.food-=6;s.resources.parts-=cost;
   const sponsor=candidates[Math.floor(R.next(s)*candidates.length)],others=s.people.filter(p=>p.id!==sponsor.id);
   const weights=others.map(p=>1+['care','safe','adventure'].reduce((sum,key)=>sum+Math.abs((p[key]||1)-(sponsor[key]||1)),0));
   let pick=others.length?R.next(s)*weights.reduce((a,b)=>a+b,0):0,other;
   for(let i=0;i<others.length;i++){pick-=weights[i];if(pick<0){other=others[i];break;}}
   start(s,other?[sponsor,other]:[sponsor],false);
  }
 }
 if(s.assembly){const p=s.people.find(p=>p.id===s.assembly.builderId);if(p){p.action='組み立てる';p.activityArea='home';p.reason=`新しいMEHS #${s.assembly.id}に、自分たちの設計を引き継いでいます。`;p.scores=[];}}
 return s;
}
function migrateTimeline(input){const data=clone(input);const origin=data.frames?.[0]?.state?.hour??data.endState?.hour??0;for(const s of [...(data.frames||[]).map(f=>f.state),data.endState].filter(Boolean)){for(const p of s.people||[])p.activatedHour??=origin;s.nextAssemblyHour??=origin+6;initialize(s);}return data;}
function admitVisitor(s,options={}){
 initialize(s);const id=s.nextResidentId++;
 const p={id,kind:'mehs',care:1,safe:1,adventure:1.2,color:'#967ab0',eyeShape:'round',variant:'外界からの来訪機',trait:'探索を好む設計',hunger:25,energy:80,social:25,curiosity:40,success:0,discoveries:0,kindness:0,remainingSteps:0,activityArea:'square',action:'村を見渡す',reason:'外の世界からたどり着きました。',parentIds:[],generation:1,activatedHour:s.hour,serviceLifeHours:lifeHours(id)};
 if(options.misinformation===true)p.informationStyle='unreliable';
 G.initialize(p);s.people.push(p);initialize(s);s.lineage[id].origin='outside';log(s,`外界からMEHS #${id}が村へ加わった。`);return p;
}
module.exports={admitVisitor,initialize,advance,migrateTimeline,lifeHours,HOURS};
