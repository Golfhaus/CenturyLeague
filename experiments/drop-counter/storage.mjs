import fs from'node:fs';import{randomUUID}from'node:crypto';import{gzipSync}from'node:zlib';
export function writeOnce(file,value,hook=()=>{}){
 const temp=file+'.'+randomUUID()+'.tmp';
 try{fs.writeFileSync(temp,gzipSync(JSON.stringify(value),{level:1}),{flag:'wx'});hook('before-publication');fs.linkSync(temp,file);hook('after-publication');}
 finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
}
