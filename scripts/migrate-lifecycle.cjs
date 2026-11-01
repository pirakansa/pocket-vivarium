const fs=require('node:fs'),path=require('node:path');const {migrateTimeline}=require('./lifecycle.cjs');
function migrate(root){const file=path.join(root,'dist/state.json'),before=JSON.parse(fs.readFileSync(file)),after=migrateTimeline(before);if(JSON.stringify(before)===JSON.stringify(after))return false;fs.writeFileSync(file,JSON.stringify(after,null,2)+'\n');return true;}
if(require.main===module)console.log('Lifecycle metadata migrated:',migrate(path.resolve(__dirname,'..')));
module.exports={migrate};
