import fs from'node:fs';import os from'node:os';import path from'node:path';import assert from'node:assert/strict';
import{writeOnce}from'./storage.mjs';import{readGzip,hash,atomicJSON}from'./tools.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'century-drop-counter-storage-'));
try{
 const a=path.join(dir,'before.gz');assert.throws(()=>writeOnce(a,{n:1},s=>{if(s==='before-publication')throw Error('injected');}));assert.ok(!fs.existsSync(a));assert.equal(fs.readdirSync(dir).length,0);
 const b=path.join(dir,'after.gz');assert.throws(()=>writeOnce(b,{n:2},s=>{if(s==='after-publication')throw Error('injected');}));assert.deepEqual(readGzip(b),{n:2});
 assert.throws(()=>writeOnce(b,{n:3}),{code:'EEXIST'});assert.deepEqual(readGzip(b),{n:2});
 const bytes=fs.readFileSync(b);bytes[bytes.length-6]^=255;const bad=path.join(dir,'bad.gz');fs.writeFileSync(bad,bytes);assert.throws(()=>readGzip(bad));
 const proof={status:'passed',faults:['before publication','after publication','duplicate write','corrupt gzip'],storageSHA256:hash(fs.readFileSync(new URL('./storage.mjs',import.meta.url)))};
 if(process.argv[2])atomicJSON(process.argv[2],proof);console.log(JSON.stringify(proof));
}finally{fs.rmSync(dir,{recursive:true,force:true});}
