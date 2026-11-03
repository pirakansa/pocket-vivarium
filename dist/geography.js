/* Shared logical map. Only the generator changes positions; the viewer interpolates them. */
(function(root){
 const places={home:{x:240,y:395,name:'充電の工房',indoors:true},forest:{x:795,y:245,name:'資源の林',indoors:false},square:{x:525,y:360,name:'語らいの広場',indoors:false},hill:{x:735,y:475,name:'見晴らしの丘',indoors:false}};
 const actionAreas={charge:'home',maintain:'home',recover:'forest',communicate:'square',explore:'hill'};
 const oldAreas={'充電する':'home','整備する':'home','組み立てる':'home','資源を回収する':'forest','通信する':'square','探索する':'hill'};
 const SPEED=1200,STEP=1/12;
 function areaOf(p){return p.journey?null:p.position?p.position.area:(places[p.activityArea]?p.activityArea:oldAreas[p.action]||'home');}
 function positionAt(p,hour){
  const j=p.journey;
  if(j){const target=j.target||places[j.to];const f=Math.max(0,Math.min(1,(hour-j.startedHour)/(j.arriveHour-j.startedHour)));return {x:j.from.x+(target.x-j.from.x)*f,y:j.from.y+(target.y-j.from.y)*f,area:f>=1?j.to:null};}
  return p.position?{...p.position}:{...places[areaOf(p)],area:areaOf(p)};
 }
 function initialize(p){if(!p.position){const a=areaOf(p);p.position={x:places[a].x,y:places[a].y,area:a};}return p;}
 function speed(p){return SPEED*(.45+.55*(p.durability??100)/100);}
 function travelMinutes(p,to){const at=p.position||positionAt(p,0);const distance=Math.hypot(at.x-places[to].x,at.y-places[to].y);return Math.max(0,Math.ceil(distance/speed(p)/STEP-1e-9)*5);}
 function peers(s,p){const a=areaOf(p);return a===null?[]:s.people.filter(q=>q.id!==p.id&&areaOf(q)===a);}
 function target(s,p,a){return a===3&&areaOf(p)!==null&&peers(s,p).length?areaOf(p):['home','home','forest','square','hill'][a];}
 function depart(p,to,plan,hour){
  initialize(p);
  const minutes=travelMinutes(p,to);if(minutes===0){p.position={x:places[to].x,y:places[to].y,area:to};delete p.journey;return false;}
  p.journey={from:{x:p.position.x,y:p.position.y},target:{x:places[to].x,y:places[to].y},to,startedHour:hour,arriveHour:Math.round((hour+minutes/60)*12)/12,plan};
  p.position.area=null;p.activityArea='route';p.action='移動する';p.reason=`${places[to].name}へ向かっています。 ${plan.why}`;p.remainingSteps=0;return true;
 }
 function advance(p,hour){
  initialize(p);if(!p.journey)return null;
  const j=p.journey;p.position=positionAt(p,hour);
  if(hour+1e-7<j.arriveHour)return null;
  const plan=j.plan;p.position={x:(j.target||places[j.to]).x,y:(j.target||places[j.to]).y,area:j.to};p.activityArea=j.to;delete p.journey;return plan;
 }
 root.VillageGeography={places,actionAreas,SPEED,STEP,areaOf,positionAt,initialize,speed,travelMinutes,peers,target,depart,advance};
})(typeof module==='object'?module.exports:window);
