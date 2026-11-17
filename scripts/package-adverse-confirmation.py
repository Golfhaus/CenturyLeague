"""Small review bundle and reconstructible pinned source; full event ledgers separate."""
from pathlib import Path
import datetime,hashlib,io,json,shutil,subprocess,sys,tarfile,tempfile,zipfile
repo=Path(__file__).resolve().parents[1];out=Path(sys.argv[1]).resolve()if len(sys.argv)>1 else repo.parent/'adverse_confirmation_results';rep=out/'reproduction';base='1f867ad5de47a6e8c40b70cbcb379e8751c72e8a';sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
rep.mkdir(parents=True,exist_ok=True);shutil.copyfile(repo/'docs/ADVERSE_MODIFIER_CONFIRMATION_PLAN_2026_11_16.md',out/'ADVERSE_MODIFIER_CONFIRMATION_PLAN_2026_11_16.md')
shutil.copyfile(repo/'docs/ADVERSE_RESUME_OPERATIONS_2026_11_16.md',out/'ADVERSE_RESUME_OPERATIONS_2026_11_16.md')
for cohort in ['matched','stronger']:
 raw=repo/'experiments/v2/runs'/('adverse-'+cohort+'-confirmation-001')
 if not raw.exists():continue
 dest=out/cohort;dest.mkdir(exist_ok=True);ops=dest/'operations';ops.mkdir(exist_ok=True)
 for f in raw.iterdir():
  if f.name=='manifest.json':shutil.copyfile(f,dest/f.name)
  elif f.name.endswith(('-status.json','.log')):shutil.copyfile(f,ops/f.name)
prior=repo.parent/'quality_gap_results'
for cohort in ['controls','modifiers']:
 d=rep/'prior-screen'/cohort;d.mkdir(parents=True,exist_ok=True)
 for name in ['manifest.json','analysis.json','ledger-verification.json','independent-recomputation.json','paired-outcomes.csv.gz',*(['selection.json','selection-verification.json']if cohort=='controls'else[])]:shutil.copyfile(prior/cohort/name,d/name)
commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip();(rep/'source.patch').write_bytes(subprocess.check_output(['git','diff','--binary',base,'HEAD'],cwd=repo));pins={'baseCommit':base,'localPinnedCommit':commit,'patchSHA256':sha(rep/'source.patch')};(rep/'source-pins.json').write_text(json.dumps(pins,indent=2)+'\n')
with tempfile.TemporaryDirectory(prefix='century-adverse-source-')as t:
 t=Path(t)
 with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git','archive',base],cwd=repo)))as f:f.extractall(t,filter='data')
 subprocess.run(['git','apply','--binary',str(rep/'source.patch')],cwd=t,check=True)
 code="import{sourceFingerprint}from'./experiments/v2/tools.mjs';import{adverseHarnessFingerprint}from'./scripts/adverse-confirmation-spec.mjs';console.log(JSON.stringify({sourceSHA256:sourceFingerprint(),harnessSHA256:adverseHarnessFingerprint()}));"
 proof=json.loads(subprocess.check_output(['node','--no-maglev','--input-type=module','-e',code],cwd=t,text=True))
 for m in [json.loads(p.read_text())for p in [out/'matched/manifest.json',out/'stronger/manifest.json']if p.exists()]:assert m['sourceSHA256']==proof['sourceSHA256']and m['harnessSHA256']==proof['harnessSHA256']
 (rep/'source-reconstruction-proof.json').write_text(json.dumps({'status':'passed',**proof,**pins},indent=2)+'\n')
(rep/'README.txt').write_text('''Independent adverse modifier confirmation, fixed protocol November16,2026.
Apply source.patch to exact public baseCommit in source-pins.json. Use qualified Node/no-Maglev; install locked dependencies when required. The fixed88-profile file is byte-identical to the preceding control/quality study. Rebuild it with node scripts/build-quality-gap-profiles.mjs ABS/rebuilt.json and compare bytes.

Research: node scripts/run-adverse-confirmation.mjs --cohort matched --trials 512 --workers 8 --profiles ABS/reproduction/profiles.json --screen-dir ABS/reproduction/prior-screen
Repeat for --cohort stronger. Each has4096 clusters; matched has12288 outcomes, stronger8192. Input date remains2026-11-15. Preflight temporary IDs/results are excluded from primary data. Historical full replay qualification used retained prior-study ledgers, which are not in this compact bundle.

For each cohort, audit full retained raw ledgers with node scripts/audit-adverse-confirmation.mjs RAW OUTPUT. Then python3 scripts/analyze-adverse-confirmation.py OUTPUT and python3 scripts/recompute-adverse-confirmation.py OUTPUT. Compact-only analysis and independent recomputation need Python standard library. The three primary contrasts share family3 across both cohorts; fresh controls separately family2. No pilot pooling. Other subgroup contrasts nominal exploratory.

For continuation, scripts/continue-adverse-confirmation.py validates completed compact evidence and skips that cohort without claiming a new full-event replay. A partially retained cohort still fully replays every saved result before adding new ones; resume-policy.json documents the extended startup allowance for that work. Saved completed data and partial saved data have separate recovery paths.

The prior-screen data are included solely as verification/selection provenance and separate comparison evidence. No prior results enter confirmation estimates. Large event ledgers are retained separately; complete raw-event inspection needs deterministic resimulation. No global ceiling, halftime/season, tuning or adoption claim. Check workflow/package status: partial checkpoints do not claim completed confirmation.
''')
workflow=json.loads((out/'workflow-status.json').read_text())if(out/'workflow-status.json').exists()else{'stage':'fixed-plan-before-research'};(out/'package-status.json').write_text(json.dumps({'workflow':workflow,'packagedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'fullEventLedgersIncluded':False},indent=2)+'\n')
files=[]
for f in sorted(out.rglob('*')):
 if not f.is_file()or f.name=='package-checksums.json'or any(x.startswith('qualification-')for x in f.relative_to(out).parts):continue
 if'recovery-checkpoints'in f.relative_to(out).parts:
  cohort=f.relative_to(out).parts[1]
  if(out/cohort/'ledger-verification.json').exists():continue
 files.append(f)
payloads=[(str(f.relative_to(out)),f.read_bytes())for f in files]
checks=json.dumps([{'path':name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}for name,b in payloads],indent=2)+'\n';(out/'package-checksums.json').write_text(checks);payloads.append(('package-checksums.json',checks.encode()))
archive=Path(sys.argv[2]).resolve()if len(sys.argv)>2 else repo.parent/'Century_Adverse_Modifier_Confirmation_2026_11_16.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=9)as z:
 for name,b in payloads:z.writestr(name,b)
with zipfile.ZipFile(archive)as z:
 assert z.testzip()is None
 for c in json.loads(z.read('package-checksums.json')):assert len(z.read(c['path']))==c['bytes']and hashlib.sha256(z.read(c['path'])).hexdigest()==c['sha256']
assert archive.stat().st_size<45*1048576;print(json.dumps({'status':'passed','path':str(archive),'bytes':archive.stat().st_size,'sha256':sha(archive)}))
