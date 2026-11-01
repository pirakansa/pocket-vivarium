const fs=require('node:fs'),path=require('node:path');const {convertTimeline}=require('../dist/mehs.js');
function migrate(root){const files=[path.join(root,'dist/state.json')],history=path.join(root,'data/history');if(fs.existsSync(history))for(const name of fs.readdirSync(history))if(name.endsWith('.json'))files.push(path.join(history,name));let changed=0;for(const file of files){const before=JSON.parse(fs.readFileSync(file)),after=convertTimeline(before);if(JSON.stringify(before)!==JSON.stringify(after)){fs.writeFileSync(file,JSON.stringify(after,null,2)+'\n');changed++;}}return changed;}
if(require.main===module)console.log(`MEHS records migrated: ${migrate(path.resolve(__dirname,'..'))}`);
module.exports={migrate};
