// Account for the preceding interval, before charging or choosing a new action.
const LOW_CHARGE=10,GRACE_HOURS=2,EXTRA_RATE=.25;
function addExposure(state,hours){
 for(const p of state.people){
  if(p.hunger<100-LOW_CHARGE){p.powerShortageHours=0;continue;}
  const before=p.powerShortageHours||0,after=before+hours;
  p.powerShortageHours=after;
  const exposed=Math.max(0,after-GRACE_HOURS)-Math.max(0,before-GRACE_HOURS);
  if(exposed>1e-10)p.powerWearHours=(p.powerWearHours||0)+exposed*EXTRA_RATE;
 }
}
module.exports={addExposure,LOW_CHARGE,GRACE_HOURS,EXTRA_RATE};
