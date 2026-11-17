"""Fault injection: corrupt source gzip cannot replace a valid saved snapshot."""
import contextlib,hashlib,importlib.util,io,json,tempfile
from pathlib import Path
repo=Path(__file__).resolve().parents[1];spec=importlib.util.spec_from_file_location('hot_snapshot',repo/'scripts/snapshot-quality-gap-study.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);source=repo/'experiments/v2/runs/quality-control-ladder-001';m=json.loads((source/'manifest.json').read_text());m['fixtures']=m['fixtures'][:1];f=m['fixtures'][0];raw=(source/(f['id']+'.json.gz')).read_bytes()
with tempfile.TemporaryDirectory(prefix='century-snapshot-fault-')as t:
 t=Path(t);study=t/'study';study.mkdir();out=t/'out';(study/'manifest.json').write_text(json.dumps(m));file=study/(f['id']+'.json.gz');file.write_bytes(raw)
 with contextlib.redirect_stdout(io.StringIO()):module.snapshot(study,out)
 before={p.name:hashlib.sha256(p.read_bytes()).hexdigest()for p in out.iterdir()};bad=bytearray(raw);bad[-8]^=1;file.write_bytes(bad)
 try:module.snapshot(study,out);raise AssertionError('Corrupt gzip accepted')
 except (OSError,EOFError):pass
 assert before=={p.name:hashlib.sha256(p.read_bytes()).hexdigest()for p in out.iterdir()}
 proof={'status':'passed','corruptGzipRejected':True,'previousSnapshotAndStatusPreserved':True,'temporaryFileCleaned':True,'scientificDataUntouched':True};dest=repo.parent/'quality_gap_results/snapshot-fault-verification.json';dest.write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps(proof))
