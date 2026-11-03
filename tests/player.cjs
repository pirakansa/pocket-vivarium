const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {VillagePlayer:P}=require('../dist/player.js'),{makeBatch,SLOT_MS}=require('../scripts/update-state.cjs');
const data=P.validate(JSON.parse(fs.readFileSync('dist/state.json'))),start=Date.parse(data.windowStart),anchor=Date.parse(data.anchorAt),end=Date.parse(data.windowEnd),original=JSON.stringify(data);
assert.equal(P.snapshotAt(data,start+299999),data.frames[0].state);assert.equal(P.snapshotAt(data,start+300000),data.frames[1].state);assert.equal(P.snapshotAt(data,end),data.endState);
assert.equal(P.position(data,end+10000),end);assert.equal(P.bounds(data,end+10000).waiting,true);assert.equal(P.bounds(data,start-1).notStarted,true);assert.throws(()=>P.validate({...data,frames:data.frames.slice(1)}));
let now=anchor+3600000,responseData=data,fail=false,frame,visibility;const elements={},context=new Proxy({},{get:()=>()=>{},set:()=>true});
class Clock extends Date{static now(){return now;}}
const sandbox={Date:Clock,Intl,console,Math,Map,VillagePlayer:P,VillageGeography:require('../dist/geography.js').VillageGeography,setInterval:()=>{},requestAnimationFrame:f=>{frame=f},fetch:async()=>({ok:!fail,status:503,json:async()=>responseData}),document:{hidden:false,addEventListener:(n,fn)=>visibility=fn,getElementById:id=>elements[id]??=(id==='world'?{getContext:()=>context}:{textContent:'',innerHTML:'',value:'',setAttribute(){},classList:{toggle(){}}})}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('dist/index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1],sandbox);const v=s=>vm.runInContext(s,sandbox);
assert(v('programCard('+JSON.stringify({program:{name:'<img>',source:'return "<script>";',authorId:1,runs:2}})+')').includes('&lt;script&gt;'));
setImmediate(async()=>{
 assert.equal(v('displayAt'),now);assert.equal(v('state'),data.frames[36].state);
 // New spatial frames interpolate the saved trip, while rewind stays fixed.
 const sample={id:777,action:'移動する',position:{x:240,y:395,area:null},journey:{from:{x:240,y:395},to:'forest',startedHour:v('state.hour')-.5,arriveHour:v('state.hour')+.5,plan:{a:2}}};
 const sampleText=JSON.stringify(sample),drawn=v('motion('+sampleText+',0,.1,1000)');
 assert(Math.abs(drawn.x-(240+795)/2-Math.cos(777*2.4)*18)<1e-6);
 assert(v('locationLabel('+sampleText+')').includes('資源の林'));
 assert.deepEqual(v('motion('+sampleText+',0,.1,50000)'),drawn,'Rendering time alone must not advance the saved journey');

 elements.seek.value='0';elements.seek.oninput();const selected=v('selectedAt'),snapshot=v('state');assert.equal(selected,now-7200000);
 // The reviewed snapshot rolls out of the new payload; preserve both its absolute time and state.
 responseData=makeBatch(data,anchor/SLOT_MS+1);now+=SLOT_MS;await v('loadState()');assert.equal(v('displayAt'),selected);assert.equal(v('state'),snapshot);
 elements.live.onclick();assert.equal(v('selectedAt'),null);assert.equal(v('displayAt'),now);
 now=Date.parse(responseData.windowEnd)+3600000;v('refresh()');assert(elements.status.textContent.includes('更新待ち'));assert.equal(v('state'),responseData.endState);
 fail=true;await v('loadState()');assert.equal(v('state'),responseData.endState);assert(elements.status.textContent.includes('取得に失敗'));
 fail=false;responseData=JSON.parse(JSON.stringify(responseData));for(const f of [...responseData.frames,{state:responseData.endState}]){f.state.people=[];f.state.logs=['継承設備が自動復旧を開始'];f.state.assembly={id:99,source:'station',parentIds:[1],generation:2,startedHour:f.state.hour,readyHour:f.state.hour+4};f.state.nextResidentId=100;}await v('loadState()');assert(elements.detail.textContent.includes('0機'));assert(elements.population.innerHTML.includes('自動復旧'));assert(elements.log.innerHTML.includes('自動復旧'));
 frame(0);frame(1000);assert.equal(JSON.stringify(data),original);console.log('PASS: live time, rewind, absolute position across refresh, no future selection, stale/error fallback, immutable source');
});
