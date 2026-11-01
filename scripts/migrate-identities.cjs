const fs=require('node:fs'),path=require('node:path');const {migrateTimeline}=require('./identities.cjs');
function migrate(root){
 const files=[path.join(root,'dist/state.json')],history=path.join(root,'data/history');
 if(fs.existsSync(history))for(const n of fs.readdirSync(history))if(/\.json$/.test(n))files.push(path.join(history,n));
 let changed=0;
 for(const file of files){const previous=JSON.parse(fs.readFileSync(file,'utf8')),next=migrateTimeline(previous);if(JSON.stringify(previous)!==JSON.stringify(next)){fs.writeFileSync(file,JSON.stringify(next,null,2)+'\n');changed++;}}
 return changed;
}
if(require.main===module)console.log(`Migrated identity records: ${migrate(path.resolve(__dirname,'..'))}`);
module.exports={migrate};
