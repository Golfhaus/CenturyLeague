"""Preserve completed compact records without interim outcome analysis."""
import gzip,json,hashlib,sys
from pathlib import Path
repo=Path(__file__).resolve().parents[1];root=repo.parent/'modifier_stages_results';study=repo/'experiments/v2/runs'/sys.argv[1];m=json.loads((study/'manifest.json').read_text());dest=root/'recovery-checkpoints';dest.mkdir(exist_ok=True);index=[]
with gzip.open(dest/(m['studyId']+'-partial-records.jsonl.gz'),'wt',compresslevel=6)as out:
 for f in m['fixtures']:
  p=study/(f['id']+'.json.gz')
  if not p.exists():continue
  b=p.read_bytes();d=json.loads(gzip.decompress(b));assert d['fixture']==f;out.write(json.dumps(d['record'],separators=(',',':'))+'\n');index.append({'fixture':f['id'],'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
  if len(index)%100==0:print(json.dumps({'compactRecordsPreserved':len(index)}),flush=True)
(dest/(m['studyId']+'-partial-status.json')).write_text(json.dumps({'classification':'incomplete unanalysed recovery snapshot; not full-ledger verification','sourceSHA256':m['sourceSHA256'],'completedRecords':len(index),'expectedRecords':len(m['fixtures']),'ledgers':index},indent=2)+'\n');print(json.dumps({'completedCompactRecordsPreserved':len(index),'expected':len(m['fixtures'])}),flush=True)
