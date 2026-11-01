/* Relative playback clock. World snapshots are never mutated. */
(function(root){
 function validate(data){
  if(data.schemaVersion!==2||data.mode!=='relative'||data.durationMinutes!==120||data.stepMinutes!==5||!Array.isArray(data.frames)||data.frames.length!==24)throw Error('2時間・5分刻みのデータが必要です');
  const validState=s=>s&&Number.isFinite(s.hour)&&Number.isFinite(s.food)&&Array.isArray(s.logs)&&s.logs.every(x=>typeof x==='string')&&Array.isArray(s.people)&&s.people.length===3&&s.people.every(p=>typeof p.name==='string'&&typeof p.action==='string'&&typeof p.reason==='string'&&['hunger','energy','social','curiosity','success','discoveries','kindness'].every(k=>Number.isFinite(p[k])));
  if(!data.frames.every((f,i)=>f.minute===i*5&&validState(f.state))||!validState(data.endState))throw Error('状態データを読み込めません');
  return data;
 }
 function snapshotAt(data,minute){return minute>=data.durationMinutes?data.endState:data.frames[Math.max(0,Math.min(23,Math.floor(minute/data.stepMinutes)))].state;}
 function advance(minute,seconds,speed,duration){return Math.min(duration,Math.max(0,minute+Math.max(0,seconds)*speed/60));}
 root.VillagePlayer={validate,snapshotAt,advance};
})(typeof module==='object'?module.exports:window);
