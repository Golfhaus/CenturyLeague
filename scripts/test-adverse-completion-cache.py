"""Fault injection for safe resumption from already verified compact outputs."""
from pathlib import Path
import json,shutil,tempfile
from adverse_completion_cache import completed_compact
repo=Path(__file__).resolve().parents[1];source=repo.parent/'adverse_confirmation_results';pins=json.loads((source/'preflight-verification.json').read_text());names=['manifest.json','analysis.json','ledger-verification.json','independent-recomputation.json','paired-outcomes.csv.gz'];checks=0
with tempfile.TemporaryDirectory(prefix='century-completed-cache-')as t:
 p=Path(t);assert completed_compact(p,'matched',pins)is False;checks+=1
 for n in names:shutil.copyfile(source/'matched'/n,p/n)
 assert completed_compact(p,'matched',pins)is True;checks+=1
 for name in ['analysis.json','paired-outcomes.csv.gz']:
  f=p/name;original=f.read_bytes();f.write_bytes(original+b' ')
  try:completed_compact(p,'matched',pins);raise RuntimeError('Corrupt completed data accepted')
  except AssertionError:checks+=1
  finally:f.write_bytes(original)
 f=p/'ledger-verification.json';original=f.read_bytes();f.unlink()
 try:completed_compact(p,'matched',pins);raise RuntimeError('Incomplete completed evidence accepted')
 except AssertionError:checks+=1
 finally:f.write_bytes(original)
 for cohort,identity in [('stronger',pins),('matched',{**pins,'sourceSHA256':'0'*64})]:
  try:completed_compact(p,cohort,identity);raise RuntimeError('Wrong completed evidence accepted')
  except AssertionError:checks+=1
proof={'status':'passed','cases':checks,'validCompletedEvidenceRecognized':True,'corruptIncompleteOrWrongEvidenceRejected':True,'noSimulationOrOfficialDataTouched':True};(source/'completion-cache-fault-verification.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps(proof))
