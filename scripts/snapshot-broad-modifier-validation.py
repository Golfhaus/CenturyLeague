"""Atomic compact recovery snapshots; no interim aggregate analysis."""
from pathlib import Path
import gzip,hashlib,json,os,sys,uuid

def snapshot(study,out):
 study=Path(study);out=Path(out);out.mkdir(parents=True,exist_ok=True);m=json.loads((study/'manifest.json').read_text());files=[(f,study/(f['id']+'.json.gz'))for f in m['fixtures']if(study/(f['id']+'.json.gz')).is_file()];index=[];target=out/'completed-compact-records.jsonl.gz';tmp=target.with_name(target.name+'.'+uuid.uuid4().hex+'.tmp')
 try:
  with gzip.open(tmp,'wb',compresslevel=6)as stream:
   for f,p in files:
    b=p.read_bytes();raw=gzip.decompress(b);prefix,sep,record=raw.rpartition(b',"record":');assert sep and record.endswith(b'}');record=record[:-1];parsed=json.loads(record);assert parsed['fixture']==f;assert len(parsed['arms'])==len(m['arms']);stream.write(record+b'\n');index.append({'fixture':f['id'],'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b)})
    if len(index)%100==0:print(json.dumps({'compactRecordsPreserved':len(index),'snapshotTarget':len(files)}),flush=True)
  status={'classification':'incomplete, unanalysed recovery snapshot; not a full-ledger audit','sourceSHA256':m['sourceSHA256'],'harnessSHA256':m['harnessSHA256'],'completedRecords':len(index),'expectedRecords':len(m['fixtures']),'compactFileSHA256':hashlib.sha256(tmp.read_bytes()).hexdigest(),'ledgers':index}
  os.replace(tmp,target);st=out/('snapshot-status.'+uuid.uuid4().hex+'.tmp');st.write_text(json.dumps(status,indent=2)+'\n');os.replace(st,out/'snapshot-status.json');print(json.dumps({'status':'completed','compactRecordsPreserved':len(index)}))
 finally:
  if tmp.exists():tmp.unlink()
if __name__=='__main__':
 repo=Path(__file__).resolve().parents[1];snapshot(sys.argv[1]if len(sys.argv)>1 else repo/'experiments/v2/runs/broad-modifier-validation-001',sys.argv[2]if len(sys.argv)>2 else repo.parent/'broad_modifier_results/recovery-checkpoints')
