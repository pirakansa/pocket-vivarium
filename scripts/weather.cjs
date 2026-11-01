const R=require('./random.cjs');
function initialize(s){
 if(!s.weather)s.weather={raining:s.rain>0,nextChangeHour:s.hour+(s.rain>0?s.rain/12:2)};
 return s;
}
function advance(s,note){
 initialize(s);
 if(s.hour+1e-7>=s.weather.nextChangeHour){
  const wasRain=s.weather.raining;s.weather.raining=R.next(s)<.25;s.weather.nextChangeHour=s.hour+2;
  if(wasRain!==s.weather.raining)note(s,s.weather.raining?'雨が降り始めた。屋外での回収・探索は摩耗が少し進みやすい。':'雨がやんだ。屋外の追加摩耗がなくなった。');
 }
 s.rain=s.weather.raining?Math.max(1,Math.ceil((s.weather.nextChangeHour-s.hour)*12-1e-7)):0;
 return s;
}
function addExposure(s,hours){
 for(const p of s.people){
  const outdoors=['資源を回収する','探索する'].includes(p.action)&&['forest','hill'].includes(p.activityArea);
  if(s.rain>0&&outdoors)p.rainWearHours=(p.rainWearHours||0)+hours*.5;
 }
}
module.exports={initialize,advance,addExposure};
