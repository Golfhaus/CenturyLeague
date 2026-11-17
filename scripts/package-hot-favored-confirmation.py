"""Small confirmation package with source and data identities; no bulk event archive."""
from pathlib import Path
import hashlib,io,json,subprocess,tarfile,tempfile,zipfile,shutil,datetime
repo=Path(__file__).resolve().parents[1];out=repo.parent/'hot_favored_confirmation_results';rep=out/'reproduction';study=repo/'experiments/v2/runs/hot-favored-combined-confirmation-001';base='1f867ad5de47a6e8c40b70cbcb379e8751c72e8a';sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
for name in ['manifest.json','simulation-status.json','simulation.log','preflight-qualified-status.json','preflight-qualified.log','ledger-audit-status.json','ledger-audit.log','paired-analysis-status.json','paired-analysis.log','independent-recomputation-status.json','independent-recomputation.log','report-status.json','report.log']:
 f=study/name
 if f.exists():shutil.copyfile(f,out/name)
prior=repo.parent/'modifier_stages_results';(rep/'prior-screen').mkdir(parents=True,exist_ok=True)
for name in ['manifest.json','analysis.json','ledger-verification.json','independent-recomputation.json']:shutil.copyfile(prior/'combined'/name,rep/'prior-screen'/name)
shutil.copyfile(prior/'confirmation/cold-confirmation-gate.json',rep/'cold-confirmation-gate.json')
commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip();(rep/'source.patch').write_bytes(subprocess.check_output(['git','diff','--binary',base,'HEAD'],cwd=repo));pins={'baseCommit':base,'localPinnedCommit':commit,'patchSHA256':sha(rep/'source.patch')};(rep/'source-pins.json').write_text(json.dumps(pins,indent=2)+'\n')
(rep/'README.txt').write_text('''Century hot/favorable combined confirmation

Apply source.patch to the exact public baseCommit in source-pins.json. Install locked dependencies (npm ci). Use the qualified Node v24.22.1/no-Maglev runtime enforced by the runner. All four copied pairings, fixed seeds and both arms are in manifest.json.

Research command (substitute absolute paths):
node scripts/run-hot-favored-confirmation.mjs --study-id hot-favored-combined-confirmation-001 --trials 2560 --workers 8 --profiles ABS/reproduction/copied-profiles.json --gate ABS/reproduction/cold-confirmation-gate.json --screen-dir ABS/reproduction/prior-screen

Run long stages under scripts/supervise-engine-study.py. Audit with scripts/audit-hot-favored-confirmation.mjs RAW_STUDY_DIR OUTPUT_DIR, copy prior-comparison/combined-screen-analysis.json into that output, then run scripts/analyze-hot-favored-confirmation.py OUTPUT_DIR and scripts/recompute-hot-favored-confirmation.py OUTPUT_DIR. Python standard library is sufficient for compact analysis; reporting additionally needs Matplotlib.

Compact-only check: run those two Python analysis/recomputation scripts against this extracted folder. No historical outcomes are pooled. The package contains the earlier screening comparison and verification evidence, not its entire raw events. Preflight legacy full-result replays used original retained prior-screen files; repeating that specific legacy check requires their raw fixtures from the earlier run. The new research study can be deterministically resimulated from these inputs.

Large full research ledgers are separate. Their original audit and checksum index are included, but compact data cannot independently expose every raw event without resimulation. All results are lab-only, provisional and not adopted or deployed.
''')
with tempfile.TemporaryDirectory(prefix='century-hot-source-')as tmp:
 tmp=Path(tmp);b=subprocess.check_output(['git','archive',base],cwd=repo)
 with tarfile.open(fileobj=io.BytesIO(b))as t:t.extractall(tmp,filter='data')
 subprocess.run(['git','apply','--binary',str(rep/'source.patch')],cwd=tmp,check=True)
 if(out/'manifest.json').exists():
  m=json.loads((out/'manifest.json').read_text());lab=tmp/'experiments/v2';rows=[[str(f.relative_to(lab)),sha(f)]for f in sorted(lab.rglob('*'))if f.is_file()and'build'not in f.relative_to(lab).parts and'runs'not in f.relative_to(lab).parts and f.name!='validation.json'];source=hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest();assert source==m['sourceSHA256']
  spec=(tmp/'scripts/hot-favored-confirmation-spec.mjs').read_text();import re
  paths=re.search(r'PINNED_HARNESS_FILES=\[(.*?)\];',spec,re.S).group(1);files=re.findall(r"'([^']+)'",paths);h=hashlib.sha256(json.dumps([[f,sha(tmp/f)]for f in files],separators=(',',':')).encode()).hexdigest();assert h==m['harnessSHA256']
  (rep/'source-reconstruction-proof.json').write_text(json.dumps({'status':'passed','sourceSHA256':source,'harnessSHA256':h,**pins},indent=2)+'\n')
state=json.loads((out/'workflow-status.json').read_text());(out/'package-status.json').write_text(json.dumps({'workflow':state,'packagedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'fullEventLedgersIncluded':False},indent=2)+'\n')
files=[f for f in sorted(out.rglob('*'))if f.is_file()and'qualification-compact'not in f.relative_to(out).parts and not('recovery-checkpoints'in f.relative_to(out).parts and(out/'ledger-verification.json').exists())and f.name!='package-checksums.json']
checks=[{'path':str(f.relative_to(out)),'bytes':f.stat().st_size,'sha256':sha(f)}for f in files];(out/'package-checksums.json').write_text(json.dumps(checks,indent=2)+'\n')
p=repo.parent/'Century_Hot_Favored_Combined_Confirmation_2026_11_15.zip'
with zipfile.ZipFile(p,'w',zipfile.ZIP_DEFLATED,compresslevel=9)as z:
 for f in files+[out/'package-checksums.json']:z.write(f,f.relative_to(out))
with zipfile.ZipFile(p)as z:assert z.testzip()is None
assert p.stat().st_size<20*1048576
print(json.dumps({'status':'passed','path':str(p),'bytes':p.stat().st_size,'sha256':sha(p)}))
