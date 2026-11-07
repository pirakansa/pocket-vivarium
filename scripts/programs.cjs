const {VillageGeography:G}=require('../dist/geography.js');
const {execute}=require('./program-runtime.cjs');
const AI=require('./ai-routines.cjs');
const recipes=[
 {name:'雨を避ける回収ルーチン',source:'if (ctx.rain > 0) return {action: "maintain"}; return {action: "recover"};',experience:p=>p.success},
 {name:'充電を確かめる探索ルーチン',source:'if (ctx.hunger > 60) return {action: "charge"}; return {action: "explore"};',experience:p=>p.discoveries},
 {name:'仲間とつながる通信ルーチン',source:'if (ctx.social > 35) return {action: "communicate"}; return {action: "recover"};',experience:p=>p.kindness}
];
const actions={charge:0,maintain:1,recover:2,communicate:3,explore:4};
function recommend(s,p,note){
 if(!p.program){const r=recipes.filter(r=>r.experience(p)>=8).sort((a,b)=>b.experience(p)-a.experience(p))[0];if(r){p.program={name:r.name,source:r.source,authorId:p.id,createdHour:s.hour,origin:'template',revision:1,runs:0,lastAction:null};note(s,`MEHS #${p.id}が経験から「${r.name}」を組んだ。`);}}
 if(!p.program)return null;
 try{const result=AI.checkResult(execute(p.program.source,AI.inputs(s,p)));if(!result||!Object.hasOwn(actions,result.action))throw Error('Invalid action');delete p.program.error;p.program.runs++;p.program.lastAction=result.action;return actions[result.action];}
 catch{p.program.error='実行に失敗。通常の判断を使用。';return null;}
}
function share(s,p,note,peers=G.peers(s,p)){if(!p.program)return;const other=peers.find(x=>!x.program);if(!other)return;other.program={...p.program,runs:0,used:0,receivedFrom:p.id,receivedHour:s.hour};note(s,`MEHS #${p.id}が#${other.id}へ「${p.program.name}」を渡した。`);}
module.exports={recommend,share};
