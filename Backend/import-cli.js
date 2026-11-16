const {importLegacy}=require('./database/import-legacy');
importLegacy(process.argv[2],process.argv[3]).then(result=>console.log(JSON.stringify(result))).catch(e=>{console.error(e.message);process.exitCode=1;});
