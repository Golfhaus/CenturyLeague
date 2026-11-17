"""One compact, CRC-checked package. Large full event ledgers are excluded."""
from pathlib import Path
import hashlib,json,subprocess,sys,zipfile,datetime,shutil,tempfile
repo=Path(__file__).resolve().parents[1];root=repo.parent/'modifier_stages_results';base='1f867ad5de47a6e8c40b70cbcb379e8751c72e8a';rep=root/'reproduction';rep.mkdir(exist_ok=True)
commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip();patch=subprocess.check_output(['git','diff','--binary',base,'HEAD'],cwd=repo);(rep/'source.patch').write_bytes(patch)
(rep/'source-pins.json').write_text(json.dumps({'baseCommit':base,'localPinnedCommit':commit,'patchSHA256':hashlib.sha256(patch).hexdigest(),'classification':'laboratory only; no adoption or deployment'},indent=2)+'\n')
for study,folder in [('cold-adverse-confirmation-001','confirmation'),('copied-club-combined-modifiers-001','combined')]:
 d=repo/'experiments/v2/runs'/study
 if not d.exists():continue
 dest=root/folder;dest.mkdir(exist_ok=True)
 scientific=['simulation','ledger-audit','paired-analysis','independent-recomputation','confirmation-gate','report']
 keep={'manifest.json',*[x+'-status.json'for x in scientific],*[x+'.log'for x in scientific]}
 for f in dest.iterdir():
  if (f.name.endswith('-status.json')or f.suffix=='.log')and f.name not in keep:f.unlink()
 for f in d.iterdir():
  if f.name in keep:shutil.copyfile(f,dest/f.name)
(root/'package-status.json').write_text(json.dumps({'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'workflow':json.loads((root/'workflow-status.json').read_text()),'fullEventLedgersIncluded':False,'warning':'Only stages with passed full-ledger and independent-recomputation proofs are verified. A checkpoint may contain an incomplete stage.'},indent=2)+'\n')
(rep/'README.txt').write_text('''Century modifier study reproduction

1. Check out the public CenturyLeague repository at the exact baseCommit in source-pins.json.
2. Apply source.patch with git apply --binary; install locked dependencies with npm ci.
3. Use Node v24.22.1 with the qualified no-Maglev worker policy. Runtime checks are enforced by the runner.
4. Place copied-profiles.json at a fixed absolute path and run each manifest's declared study ID, trials and stage. For cold: node experiments/v2/run-modifier-stage.mjs --stage cold-confirmation --study-id cold-adverse-confirmation-001 --trials 2560 --workers 8 --profiles ABSOLUTE_PROFILE_PATH
5. Audit under scripts/supervise-engine-study.py with scripts/audit-modifier-stage.mjs, then analyze-modifier-stage.py and recompute-modifier-stage.py. Create the cold gate using write-cold-confirmation-gate.mjs. A combined research runner requires that verified gate and the same laboratory source fingerprint.
6. For combined, use --stage combined --study-id copied-club-combined-modifiers-001 --trials 256 --workers 8 --profiles ABSOLUTE_PROFILE_PATH --gate ABSOLUTE_VERIFIED_GATE_PATH; then audit/analyze/recompute similarly. Do not pool prior data or change inputs under either ID.

To verify the compact package without simulating: run analyze-modifier-stage.py and recompute-modifier-stage.py separately on each completed output folder. They need Python 3 standard library only. report-modifier-stages.py additionally requires Matplotlib.

The package preserves all compact outcomes with weather/lab telemetry and each full ledger's checksum index; it does not contain the large full event ledgers. Full-ledger proofs refer to the raw files audited in the original run. Compact files alone cannot recreate or independently inspect every raw event; deterministic resimulation is needed for a new full-ledger audit.

No official write, deployment or coefficient adoption is authorized by reproduction. Halftime adaptation remains unimplemented.
''')
# Verify source patch independently in a fresh base tree; dependencies are unnecessary for fingerprinting.
with tempfile.TemporaryDirectory(prefix='century-patch-check-')as tmp:
 tmp=Path(tmp);arc=subprocess.check_output(['git','archive',base],cwd=repo);import tarfile,io
 with tarfile.open(fileobj=io.BytesIO(arc))as t:t.extractall(tmp,filter='data')
 subprocess.run(['git','apply','--binary',str(rep/'source.patch')],cwd=tmp,check=True)
 def fingerprint(tree):
  lab=tree/'experiments/v2';files=sorted(f for f in lab.rglob('*')if f.is_file()and'build'not in f.relative_to(lab).parts and'runs'not in f.relative_to(lab).parts and f.name!='validation.json')
  rows=[[str(f.relative_to(lab)),hashlib.sha256(f.read_bytes()).hexdigest()]for f in files]
  return hashlib.sha256(json.dumps(rows,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
 live=fingerprint(repo);rebuilt=fingerprint(tmp);assert live==rebuilt
 for folder in ['confirmation','combined']:
  f=root/folder/'manifest.json'
  if f.exists():assert json.loads(f.read_text())['sourceSHA256']==rebuilt
 (rep/'source-reconstruction-proof.json').write_text(json.dumps({'status':'passed','baseCommit':base,'localPinnedCommit':commit,'patchSHA256':hashlib.sha256(patch).hexdigest(),'reconstructedLabSourceSHA256':rebuilt,'matchesAllStageManifests':True},indent=2)+'\n')
def included(f):return not(('recovery-checkpoints'in f.relative_to(root).parts or f==root/'checkpoint-status.json')and(root/'confirmation/ledger-verification.json').exists())
checks=[]
for f in sorted(root.rglob('*')):
 if f.is_file()and included(f)and f.name!='package-checksums.json':checks.append({'path':str(f.relative_to(root)),'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
(root/'package-checksums.json').write_text(json.dumps(checks,indent=2)+'\n')
p=repo.parent/'Century_Cold_Confirmation_and_Combined_Modifiers_2026_11_14.zip'
with zipfile.ZipFile(p,'w',zipfile.ZIP_DEFLATED,compresslevel=9)as z:
 for f in sorted(root.rglob('*')):
  if f.is_file()and included(f):z.write(f,f.relative_to(root))
with zipfile.ZipFile(p)as z:assert z.testzip()is None
assert p.stat().st_size<50_000_000
print(json.dumps({'status':'passed','path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'sourceReconstructionVerified':True}))
