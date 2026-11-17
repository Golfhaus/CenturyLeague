"""Compare reconstructed records with the original durable checkpoint, without analysis."""
from pathlib import Path
import gzip,hashlib,json
repo=Path(__file__).resolve().parents[1];out=repo.parent/'adverse_confirmation_results';saved=out/'recovery-checkpoints/matched/completed-compact-records.jsonl.gz';raw=repo/'experiments/v2/runs/adverse-matched-confirmation-001';count=0
with gzip.open(saved,'rt')as stream:
 for line in stream:
  expected=json.loads(line);file=raw/(expected['fixture']['id']+'.json.gz');assert file.exists(),'Original checkpoint is not yet fully reconstructed'
  content=gzip.decompress(file.read_bytes());prefix,sep,record=content.rpartition(b',"record":');assert sep and record.endswith(b'}');actual=json.loads(record[:-1]);assert actual==expected,'Reconstructed compact record differs: '+expected['fixture']['id'];count+=1
proof={'status':'passed','originalSavedRecordsExactlyMatched':count,'originalCheckpointSHA256':hashlib.sha256(saved.read_bytes()).hexdigest(),'noNewObservationsOrPooling':True};(out/'recovery-record-comparison.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps(proof))
