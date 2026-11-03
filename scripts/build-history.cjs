const fs=require('node:fs'),path=require('node:path');
const DAY=86400000;
// Later snapshots replace overlapping timestamps; the latest state is processed last.
function build(root,now=new Date()){
 const until=now.getTime(),since=until-30*DAY,points=new Map(),events=new Map();
 if(!Number.isFinite(until))throw Error('Invalid history cutoff');
 const dir=path.join(root,'data/history');
 const files=fs.existsSync(dir)?fs.readdirSync(dir).filter(n=>/^\d{12,13}\.json$/.test(n)).sort().map(n=>path.join(dir,n)):[];
 files.push(path.join(root,'dist/state.json'));
 let skippedLegacy=0;
 for(const file of files){
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  if(data.schemaVersion!==3){skippedLegacy++;continue;}
  const origin=Date.parse(data.worldOrigin);
  function collect(at,state){
   const time=Date.parse(at);if(!Number.isFinite(time))throw Error(`Invalid timestamp in ${file}`);
   if(time<since||time>until)return;
   const cells=state.food,parts=Number.isFinite(state.resources?.parts)?state.resources.parts:null;
   if(!Array.isArray(state.people)||!Number.isFinite(cells))throw Error(`Invalid history metrics in ${file}`);
   points.set(time,{at:new Date(time).toISOString(),population:state.people.length,cells,parts});
   if(!Number.isFinite(origin))return;
   for(const record of Object.values(state.lineage||{})){
    if(!Number.isSafeInteger(record.id))continue;
    for(const [kind,hour] of [['start',record.activatedHour],['retire',record.retiredHour]]){
     if(!Number.isFinite(hour))continue;
     const eventAt=origin+Math.round(hour*3600000);
     if(eventAt<since||eventAt>time)continue;
     events.set(`${kind}:${record.id}`,{at:new Date(eventAt).toISOString(),kind,id:record.id,outside:record.origin==='outside'});
    }
   }
  }
  for(const frame of data.frames||[])collect(frame.at,frame.state);
  if(data.endState)collect(data.windowEnd,data.endState);
 }
 const series=[...points.values()].sort((a,b)=>a.at.localeCompare(b.at));
 const start=series[0]?.at,end=series.at(-1)?.at;
 return {schemaVersion:1,generatedAt:now.toISOString(),windowDays:30,stepMinutes:5,skippedLegacy,points:series,events:[...events.values()].filter(e=>e.at>=start&&e.at<=end).sort((a,b)=>a.at.localeCompare(b.at)||a.id-b.id||a.kind.localeCompare(b.kind))};
}
function write(root,now=new Date()){
 const data=build(root,now);fs.writeFileSync(path.join(root,'dist/history.json'),JSON.stringify(data)+'\n');return {points:data.points.length,events:data.events.length};
}
if(require.main===module)console.log(JSON.stringify(write(path.resolve(__dirname,'..'))));
module.exports={build,write};
