/* A deliberately small JavaScript interpreter. No eval, host objects or calls. */
function compile(source){
 if(typeof source!=='string'||source.length>4096)throw Error('Source limit');
 const tokens=[];let pos=0;
 while(pos<source.length){
  const rest=source.slice(pos),ws=/^\s+/.exec(rest);if(ws){pos+=ws[0].length;continue;}
  const m=/^(?:"(?:[^"\\\n]|\\["\\nrt])*"|\d+(?:\.\d+)?|[A-Za-z_$][\w$]*|===|!==|>=|<=|&&|\|\||[{}()[\].,:;!<>+*\/-])/.exec(rest);
  if(!m)throw Error('Unsupported token');tokens.push(m[0]);pos+=m[0].length;if(tokens.length>1024)throw Error('Token limit');
 }
 let i=0,depth=0;const peek=()=>tokens[i],take=x=>{if(tokens[i++]!==x)throw Error('Expected '+x);};
 const prec={'||':1,'&&':2,'===':3,'!==':3,'>':4,'<':4,'>=':4,'<=':4,'+':5,'-':5,'*':6,'/':6};
 function expr(min=0){
  if(++depth>40)throw Error('Depth limit');let a,t=peek();
  if(t==='!'||t==='-'){i++;a=['unary',t,expr(7)];}
  else if(t==='('){i++;a=expr();take(')');}
  else if(t==='['){i++;const list=[];while(peek()!==']'){list.push(expr());if(peek()!==',')break;i++;}take(']');a=['array',list];}
  else if(t==='{'){i++;const pairs=[];while(peek()!=='}'){const key=tokens[i++];if(!/^[a-zA-Z][\w]*$/.test(key)||['constructor','prototype','__proto__'].includes(key))throw Error('Invalid key');take(':');pairs.push([key,expr()]);if(peek()!==',')break;i++;}take('}');a=['object',pairs];}
  else if(t==='ctx'){i++;take('.');const key=tokens[i++];if(!/^[a-zA-Z][\w]*$/.test(key))throw Error('Invalid input');a=['input',key];}
  else if(t==='true'||t==='false'||t==='null'){i++;a=['literal',JSON.parse(t)];}
  else if(t&&(/^"/.test(t)||/^\d/.test(t))){i++;a=['literal',JSON.parse(t)];}
  else throw Error('Unsupported expression');
  while(prec[peek()]>=min){const op=tokens[i++];a=['binary',op,a,expr(prec[op]+1)];}
  depth--;return a;
 }
 function statement(){if(++depth>40)throw Error('Depth limit');let node;
  if(peek()==='{'){i++;const body=[];while(peek()!=='}'&&i<tokens.length)body.push(statement());take('}');node=['block',body];}
  else if(peek()==='if'){i++;take('(');const test=expr();take(')');const yes=statement();let no=null;if(peek()==='else'){i++;no=statement();}node=['if',test,yes,no];}
  else {take('return');node=['return',expr()];take(';');}depth--;return node;
 }
 const body=[];while(i<tokens.length)body.push(statement());return ['block',body];
}
function execute(source,ctx){
 const ast=compile(source);let budget=2048;const spend=()=>{if(--budget<0)throw Error('Instruction limit');};
 function value(n){spend();const [kind,a,b,c]=n;
  if(kind==='literal')return a;
  if(kind==='input'){if(!Object.hasOwn(ctx,a)||!['number','boolean','string'].includes(typeof ctx[a]))throw Error('Unknown input');return ctx[a];}
  if(kind==='array')return a.map(value);
  if(kind==='object')return Object.fromEntries(a.map(([k,v])=>[k,value(v)]));
  if(kind==='unary')return a==='!'?!value(b):-value(b);
  const left=value(b);if(a==='&&')return left&&value(c);if(a==='||')return left||value(c);const right=value(c);
  switch(a){case '===':return left===right;case '!==':return left!==right;case '>':return left>right;case '<':return left<right;case '>=':return left>=right;case '<=':return left<=right;case '+':return left+right;case '-':return left-right;case '*':return left*right;case '/':return left/right;default:throw Error('Invalid operation');}
 }
 function run(n){spend();if(n[0]==='return')return {result:value(n[1])};if(n[0]==='if')return run(value(n[1])?n[2]:n[3]||['block',[]]);for(const child of n[1]){const r=run(child);if(r)return r;}}
 return run(ast)?.result??null;
}
module.exports={compile,execute};
