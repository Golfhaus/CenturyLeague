import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { competitionJSON, createCompetition, activateCompetition, acceptCompetitionResult,
  validateCompetitionState } from '../../packages/simulation-core/dist/competition/index.js';

// Local rehearsal adapter. PostgreSQL remains the authoritative live-store target.
const format='century-competition-rehearsal-v0.2';
const digest=state=>createHash('sha256').update(competitionJSON(state)).digest('hex');
export function readCompetitionStore(file,{replay=false}={}) {
  const envelope=JSON.parse(fs.readFileSync(file,'utf8'));
  if(envelope.format!==format||envelope.authority!=='local-rehearsal'||digest(envelope.state)!==envelope.sha256)throw Error('Competition store format/checksum mismatch');
  validateCompetitionState(envelope.state,replay);return envelope.state;
}
function locked(file,operation) {
  file=path.resolve(file);fs.mkdirSync(path.dirname(file),{recursive:true});
  const worker=fileURLToPath(new URL('./competition-store-worker.mjs',import.meta.url));
  const run=spawnSync('flock',['--exclusive','--nonblock','--conflict-exit-code','73',file+'.writer-lock',process.execPath,worker,file],
    {input:JSON.stringify(operation),encoding:'utf8',maxBuffer:256*1024*1024});
  if(run.status===73)throw Error('Competition store is locked; no write performed');
  if(run.error)throw Error(run.error.code==='ENOENT'?`Local rehearsal writer requires Linux flock: ${run.error.message}`:`Competition writer I/O failed: ${run.error.message}`);
  if(run.status!==0)throw Error(run.stderr.trim()||'Competition writer failed; inspect store before retrying');
  return JSON.parse(run.stdout);
}
function persist(file,state) {
  const envelope={format,authority:'local-rehearsal',sha256:digest(state),state};
  const temporary=file+`.tmp-${process.pid}`;let fd;
  try{
    fd=fs.openSync(temporary,'wx',0o600);fs.writeFileSync(fd,JSON.stringify(envelope));fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;
    fs.renameSync(temporary,file);
    const directory=fs.openSync(path.dirname(file),'r');try{fs.fsyncSync(directory);}finally{fs.closeSync(directory);}
  }finally{if(fd!==undefined)fs.closeSync(fd);if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
}
export function initializeCompetitionStore(file,definition) {
  return locked(file,{command:'init',definition});
}
export function activateCompetitionStore(file,revision) {
  return locked(file,{command:'activate',revision});
}
export function commitCompetitionStore(file,result,metadata) {
  return locked(file,{command:'accept',result,metadata});
}
/** Internal worker entry; callers use the locked APIs above. Not an authorization boundary. */
export function executeCompetitionMutation(file,operation) {
  if(operation.command==='init'){if(fs.existsSync(file))throw Error('Competition store already exists');const state=createCompetition(operation.definition);persist(file,state);return state;}
  if(operation.command==='activate'){const state=activateCompetition(readCompetitionStore(file),operation.revision);persist(file,state);return state;}
  if(operation.command==='accept'){const accepted=acceptCompetitionResult(readCompetitionStore(file),operation.result,operation.metadata);if(accepted.added)persist(file,accepted.state);return accepted;}
  throw Error('Unknown internal competition operation');
}
