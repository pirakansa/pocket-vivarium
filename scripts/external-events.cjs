const crypto=require('node:crypto');
const {compile,execute}=require('./program-runtime.cjs');
const lifecycle=require('./lifecycle.cjs');
function validate(plugin){
 if(!plugin||!/^\d{4}-\d{2}-\d{2}$/.test(plugin.date)||typeof plugin.title!=='string'||plugin.title.length>60)throw Error('Invalid plugin header');
 compile(plugin.source);return plugin;
}
const day=ms=>new Date(ms+9*3600000).toISOString().slice(0,10);
function apply(s,time,plugin,note){
 if(!plugin||plugin.date!==day(time)||s.externalEvent?.date>=plugin.date)return s;
 // The transaction is pure until the full command list passes validation.
 const hash=crypto.createHash('sha256').update(typeof plugin.source==='string'?plugin.source:'').digest('hex');
 const record={date:plugin.date,title:plugin.title,hash,hour:s.hour,status:'empty'};
 try{
  validate(plugin);
  const roll=parseInt(crypto.createHash('sha256').update(plugin.date+':'+s.rngState).digest('hex').slice(0,8),16)/4294967296;
  const commands=execute(plugin.source,{population:s.people.length,food:s.food,parts:s.resources.parts,rain:s.rain,hour:s.hour,roll});
  if(!Array.isArray(commands)||commands.length>3)throw Error('Command limit');
  let cells=0,parts=0,damage=0,arrivals=0,departures=0;
  for(const c of commands){
   if(!c||typeof c.text!=='string'||c.text.length<1||c.text.length>160)throw Error('Invalid text');
   if(c.kind==='supplies'){if(!Number.isFinite(c.cells)||!Number.isFinite(c.parts)||c.cells<0||c.parts<0)throw Error('Invalid supplies');cells+=c.cells;parts+=c.parts;}
   else if(c.kind==='interference'){if(!Number.isFinite(c.damage)||c.damage<0)throw Error('Invalid damage');damage+=c.damage;}
   else if(c.kind==='arrival')arrivals++;
   else if(c.kind==='departure')departures++;
   else if(c.kind!=='story')throw Error('Unknown event');
  }
  if(cells>6||parts>3||damage>8||arrivals>1||departures>1)throw Error('Effect limit');
  s.food=Math.min(72,s.food+cells);s.resources.parts=Math.min(64,s.resources.parts+parts);
  for(const p of s.people)p.energy=Math.max(0,p.energy-damage);
  for(const c of commands){
   if(c.kind==='arrival'&&s.people.length<12)lifecycle.admitVisitor(s);
   if(c.kind==='departure'&&s.people.length>1){const p=s.people.find(p=>p.id!==s.assembly?.builderId);if(p){s.people=s.people.filter(x=>x.id!==p.id);s.lineage[p.id].departedHour=s.hour;note(s,`MEHS #${p.id}が外の世界へ旅立った。`);}}
   note(s,`外界／${plugin.title}：${c.text}`);
  }
  record.status=commands.length?'applied':'empty';record.results=commands;
 }catch{record.status='rejected';note(s,'外界プログラムを見送り、村の日常を続けた。');}
 s.externalEvent=record;return s;
}
module.exports={validate,apply,day};
