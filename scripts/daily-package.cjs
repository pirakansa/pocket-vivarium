const external=require('./external-events.cjs');
function validate(raw){
 if(!raw||typeof raw.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(raw.date))throw Error('Invalid date');
 let event=null;try{event=external.validate(raw);}catch{}
 const routines=Array.isArray(raw.routines)?raw.routines:[];
 if(!event&&!routines.length)throw Error('Empty invalid package');
 // Keep validation independent: a broken event must not discard valid resident routines.
 return {...(event||{date:raw.date}),...(routines.length?{routines}:{} )};
}
module.exports={validate};
