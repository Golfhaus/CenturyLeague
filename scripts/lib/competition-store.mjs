import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
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
  const lock=file+'.lock';let fd;
  try{fd=fs.openSync(lock,'wx',0o600);}catch(e){if(e.code==='EEXIST')throw Error('Competition store is locked; no write performed');throw e;}
  try{fs.writeFileSync(fd,JSON.stringify({pid:process.pid}));fs.fsyncSync(fd);return operation(file);}
  finally{fs.closeSync(fd);fs.unlinkSync(lock);}
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
  return locked(file,p=>{if(fs.existsSync(p))throw Error('Competition store already exists');const state=createCompetition(definition);persist(p,state);return state;});
}
export function activateCompetitionStore(file,revision) {
  return locked(file,p=>{const state=activateCompetition(readCompetitionStore(p),revision);persist(p,state);return state;});
}
export function commitCompetitionStore(file,result,metadata) {
  return locked(file,p=>{const accepted=acceptCompetitionResult(readCompetitionStore(p),result,metadata);if(accepted.added)persist(p,accepted.state);return accepted;});
}
