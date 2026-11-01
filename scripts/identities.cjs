const clone=x=>JSON.parse(JSON.stringify(x));
const LEGACY=new Map([['ハル',1],['ユイ',2],['レン',3]]);
function migrateTimeline(input){
 const data=clone(input),states=[...(data.frames||[]).map(f=>f.state),data.endState].filter(Boolean);
 const existing=states.flatMap(s=>s.people||[]).filter(p=>p.id!==undefined);
 for(const p of existing)if(!Number.isSafeInteger(p.id)||p.id<1)throw Error('Invalid resident ID');
 const mapping=new Map(LEGACY);
 for(const p of existing)if(p.name){const known=mapping.get(p.name);if(known!==undefined&&known!==p.id)throw Error('Conflicting legacy identity');mapping.set(p.name,p.id);}
 let next=Math.max(4,...existing.map(p=>p.id+1),...states.map(s=>s.nextResidentId||1));
 for(const s of states)for(const p of s.people||[]){if(p.id===undefined){if(typeof p.name!=='string')throw Error('Resident has neither ID nor legacy name');if(!mapping.has(p.name))mapping.set(p.name,next++);p.id=mapping.get(p.name);}delete p.name;}
 const replace=text=>{for(const [name,id]of mapping)text=text.split(name).join(`MEHS #${id}`);return text;};
 for(const s of states){
  const ids=(s.people||[]).map(p=>p.id);if(new Set(ids).size!==ids.length)throw Error('Duplicate resident ID');
  s.nextResidentId=Math.max(s.nextResidentId||1,4,...ids.map(id=>id+1));
  s.logs=(s.logs||[]).map(replace);
  for(const p of s.people||[]){if(typeof p.reason==='string')p.reason=replace(p.reason);for(const c of p.scores||[])if(typeof c.why==='string')c.why=replace(c.why);}
 }
 return data;
}
module.exports={migrateTimeline};
