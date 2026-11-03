const crypto=require('node:crypto');
const {compile,execute}=require('./program-runtime.cjs');
const lifecycle=require('./lifecycle.cjs');
function validate(plugin){
 if(!plugin||!/^\d{4}-\d{2}-\d{2}$/.test(plugin.date)||typeof plugin.title!=='string'||plugin.title.length>60)throw Error('Invalid plugin header');
 compile(plugin.source);return {date:plugin.date,title:plugin.title,source:plugin.source};
}
const day=ms=>new Date(ms+9*3600000).toISOString().slice(0,10);
function normalize(commands){
 if(!Array.isArray(commands)||commands.length>3)throw Error('Command limit');
 let cells=0,parts=0,damage=0,arrivals=0,departures=0;
 const results=commands.map(c=>{
  if(!c||typeof c.text!=='string'||c.text.length<1||c.text.length>160)throw Error('Invalid text');
  const result={kind:c.kind,text:c.text};
  if(c.kind==='supplies'){if(!Number.isFinite(c.cells)||!Number.isFinite(c.parts)||c.cells<0||c.parts<0)throw Error('Invalid supplies');cells+=c.cells;parts+=c.parts;result.cells=c.cells;result.parts=c.parts;}
  else if(c.kind==='interference'){if(!Number.isFinite(c.damage)||c.damage<0)throw Error('Invalid damage');damage+=c.damage;result.damage=c.damage;}
  else if(c.kind==='arrival')arrivals++;
  else if(c.kind==='departure')departures++;
  else if(c.kind!=='story')throw Error('Unknown event');
  return result;
 });
 if(cells>6||parts>3||damage>8||arrivals>1||departures>1)throw Error('Effect limit');
 return results;
}
function apply(s,time,plugin,note){
 if(!plugin||plugin.date!==day(time)||s.externalEvent?.date>=plugin.date)return s;
 const hash=crypto.createHash('sha256').update(typeof plugin.source==='string'?plugin.source:'').digest('hex');
 const record={date:plugin.date,title:plugin.title,hash,hour:s.hour,at:new Date(time).toISOString(),status:'empty'};
 try{
  validate(plugin);
  const roll=parseInt(crypto.createHash('sha256').update(plugin.date+':'+s.rngState).digest('hex').slice(0,8),16)/4294967296;
  const commands=normalize(execute(plugin.source,{population:s.people.length,food:s.food,parts:s.resources.parts,rain:s.rain,hour:s.hour,roll}));
  // Validate every command, then apply to a copy. Never persist arbitrary plugin fields.
  const draft=JSON.parse(JSON.stringify(s));
  record.results=commands.map(c=>{
   const result={...c,status:'applied'};
   if(c.kind==='supplies'){
    result.cells=Math.min(c.cells,Math.max(0,72-draft.food));result.parts=Math.min(c.parts,Math.max(0,64-draft.resources.parts));
    draft.food+=result.cells;draft.resources.parts+=result.parts;
    if(result.cells===0&&result.parts===0){result.status='skipped';result.reason='storage-full';}
   }
   if(c.kind==='interference'){
    result.losses=draft.people.filter(p=>p.energy>0&&c.damage>0).map(p=>({residentId:p.id,damage:Math.min(p.energy,c.damage)}));
    for(const p of draft.people)p.energy=Math.max(0,p.energy-c.damage);
    if(!result.losses.length){result.status='skipped';result.reason='no-affected-residents';}
   }
   if(c.kind==='arrival'){
    if(draft.people.length+(draft.assembly?1:0)<12)result.residentId=lifecycle.admitVisitor(draft).id;
    else {result.status='skipped';result.reason='population-limit';}
   }
   if(c.kind==='departure'){
    const p=draft.people.length>1?draft.people.find(p=>p.id!==draft.assembly?.builderId):null;
    if(p){draft.people=draft.people.filter(x=>x.id!==p.id);draft.lineage[p.id].departedHour=draft.hour;result.residentId=p.id;note(draft,`MEHS #${p.id}が外の世界へ旅立った。`);}
    else {result.status='skipped';result.reason='protected-residents';}
   }
   // A skipped narrative may describe an outcome which did not actually happen.
   note(draft,result.status==='skipped'?`外界／${plugin.title}：${c.kind}を見送った（${result.reason}）。`:`外界／${plugin.title}：${c.text}`);
   return result;
  });
  const applied=record.results.filter(c=>c.status==='applied').length;
  record.status=!commands.length?'empty':applied===commands.length?'applied':applied?'partial':'skipped';
  Object.assign(s,draft);
 }catch{record.status='rejected';note(s,'外界プログラムを見送り、村の日常を続けた。');}
 s.externalEvent=record;return s;
}
module.exports={validate,apply,day};
