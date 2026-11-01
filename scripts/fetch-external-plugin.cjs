/* The only source cache is a runner-temporary file, never an artifact. */
const fs=require('node:fs');
async function load(file,{fetcher=fetch,token=process.env.GH_TOKEN,logger=console.log}={}){
 if(!file)throw Error('Missing temporary path');
 try{
  const response=await fetcher('https://api.github.com/repos/pirakansa/pocket-vivarium/issues/1',{headers:{Accept:'application/vnd.github+json',...(token?{Authorization:`Bearer ${token}`}:{})},signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('Fetch failed');const body=(await response.json()).body;
  const blocks=[...(body||'').matchAll(/```json\s*([\s\S]*?)```/g)];const json=blocks[0];if(blocks.length!==1)throw Error('Missing plugin');
  const plugin=require('./external-events.cjs').validate(JSON.parse(json[1]));fs.writeFileSync(file,JSON.stringify(plugin),{mode:0o600});logger('Current external plugin loaded.');return true;
 }catch{fs.rmSync(file,{force:true});logger('External plugin unavailable; ordinary village simulation continues.');return false;}
}
if(require.main===module)load(process.env.EXTERNAL_PLUGIN_PATH).catch(()=>{process.exitCode=1;});

module.exports={load};
