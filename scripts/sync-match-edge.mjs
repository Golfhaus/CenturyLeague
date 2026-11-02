import fs from 'node:fs';
import path from 'node:path';
const files=['types.ts','config.ts','random.ts','roleRatings.ts',...['match','competition','competitive'].flatMap(dir=>fs.readdirSync('packages/simulation-core/src/'+dir).filter(x=>x.endsWith('.ts')).map(x=>dir+'/'+x))];
const verify=process.argv.includes('--check');
for(const file of files){
 const source=fs.readFileSync('packages/simulation-core/src/'+file,'utf8').replace(/(from\s+['"]\.{1,2}\/[^'"]+)\.js(['"])/g,'$1.ts$2');
 const dest='supabase/functions/manage-matches/simulation/'+file;
 if(verify){if(!fs.existsSync(dest)||fs.readFileSync(dest,'utf8')!==source)throw Error('Match edge mirror drift: '+file);}
 else {fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,source);}
}
console.log(JSON.stringify({files:files.length,status:verify?'verified':'synced'}));
