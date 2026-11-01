// Persisted xorshift32. Replaying the same world always consumes the same stream.
const SEED=0x6d2b79f5;
function initialize(s){if(s.rngState===undefined)s.rngState=SEED;if(!Number.isInteger(s.rngState)||s.rngState<=0||s.rngState>0xffffffff)throw Error('Invalid saved random state');return s;}
function next(s){initialize(s);let x=s.rngState|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.rngState=x>>>0;return s.rngState/4294967296;}
function chooseAction(s,choices){
 const best=choices[0];if(best.s<0)throw Error('No valid action');
 // Strong needs always win. Only plausible, nearby priorities enter the lottery.
 const pool=choices.filter(c=>c.s>=0&&c.s>=best.s-8);
 if(pool.length===1)return best;
 const weights=pool.map(c=>Math.exp((c.s-best.s)/4));let pick=next(s)*weights.reduce((a,b)=>a+b,0);
 for(let i=0;i<pool.length;i++){pick-=weights[i];if(pick<=0)return pool[i];}return pool.at(-1);
}
module.exports={initialize,next,chooseAction};
