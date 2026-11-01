/* The only source cache is a runner-temporary file, never an artifact. */
const fs=require('node:fs');
async function main(){
 const file=process.env.EXTERNAL_PLUGIN_PATH;if(!file)throw Error('Missing temporary path');
 try{
  const response=await fetch('https://api.github.com/repos/pirakansa/pocket-vivarium/issues/1',{headers:{Accept:'application/vnd.github+json',...(process.env.GH_TOKEN?{Authorization:`Bearer ${process.env.GH_TOKEN}`}:{})},signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('Fetch failed');const body=(await response.json()).body;
  const json=/```json\s*([\s\S]*?)```/.exec(body||'');if(!json)throw Error('Missing plugin');
  const plugin=require('./external-events.cjs').validate(JSON.parse(json[1]));fs.writeFileSync(file,JSON.stringify(plugin),{mode:0o600});console.log('Current external plugin loaded.');
 }catch{fs.rmSync(file,{force:true});console.log('External plugin unavailable; ordinary village simulation continues.');}
}
if(require.main===module)main().catch(()=>{process.exitCode=1;});
