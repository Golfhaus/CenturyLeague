"""Compact source/data deliverable; full event ledgers stay separate."""
from pathlib import Path
import hashlib,io,json,subprocess,tarfile,tempfile,zipfile,shutil,datetime,re
repo=Path(__file__).resolve().parents[1];out=repo.parent/'broad_modifier_results';rep=out/'reproduction';study=repo/'experiments/v2/runs/broad-modifier-validation-001';base='1f867ad5de47a6e8c40b70cbcb379e8751c72e8a';sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
for name in ['manifest.json','simulation-status.json','simulation.log','preflight-qualified-status.json','preflight-qualified.log','ledger-audit-status.json','ledger-audit.log','paired-analysis-status.json','paired-analysis.log','independent-recomputation-status.json','independent-recomputation.log','report-status.json','report.log']:
 f=study/name
 if f.exists():shutil.copyfile(f,out/name)
prior=repo.parent/'hot_favored_confirmation_results';(rep/'prior-study').mkdir(parents=True,exist_ok=True)
for name in ['manifest.json','analysis.json','ledger-verification.json','independent-recomputation.json']:shutil.copyfile(prior/name,rep/'prior-study'/name)
shutil.copyfile(prior/'reproduction/copied-profiles.json',rep/'trusted-eight-profiles.json')
commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip();(rep/'source.patch').write_bytes(subprocess.check_output(['git','diff','--binary',base,'HEAD'],cwd=repo));pins={'baseCommit':base,'localPinnedCommit':commit,'patchSHA256':sha(rep/'source.patch')};(rep/'source-pins.json').write_text(json.dumps(pins,indent=2)+'\n')
(rep/'README.txt').write_text('''Century broader modifier breadth screen

Apply source.patch to the exact public baseCommit in source-pins.json. Install locked dependencies (npm ci), retain Node24.22.1/no-Maglev as enforced by the runner. profiles.json contains every exact context, roster and tactic input. The unchanged October31 original teams are in teams.json; source archive checks are in source-verification.json.

Optional exact profile reconstruction:
node scripts/build-broad-modifier-profiles.mjs ABS/reproduction/teams.json ABS/reproduction/trusted-eight-profiles.json ABS/rebuilt-profiles.json
Compare bytes/parsed JSON with the delivered profiles.json.

Research command:
node scripts/run-broad-modifier-validation.mjs --study-id broad-modifier-validation-001 --trials 36 --workers 8 --profiles ABS/reproduction/profiles.json --screen-dir ABS/reproduction/prior-study
Run long stages under scripts/supervise-engine-study.py. Audit using scripts/audit-broad-modifier-validation.mjs RAW_DIR OUTPUT_DIR; analyze and independently recompute with scripts/analyze-broad-modifier-validation.py OUTPUT_DIR and scripts/recompute-broad-modifier-validation.py OUTPUT_DIR. For compact-only verification run those two Python scripts directly against this extracted folder. Reporting additionally needs Matplotlib.

Copied and generated populations are never pooled; synthetic quality strata remain separate. Named primary and secondary copied-club four-comparison families are distinct; subgroup/profile intervals are exploratory nominal. This is a breadth screen with limited contextual precision, not a global ceiling certification or adoption. Moderate regimes are laboratory cases, not empirical season weather. Season feedback, injuries and halftime are absent.

Legacy qualification replayed retained results from the earlier hot-favored confirmation. Repeating that specific legacy full-event check needs those original raw fixtures, which are not in this compact bundle. The new research itself is fully reconstructible from the delivered source/inputs.

Full large research event ledgers are separate. Their original audit proof and per-file checksum index are retained here; compact data cannot independently show every raw event without deterministic resimulation. No official data or deployment was changed.
''')
with tempfile.TemporaryDirectory(prefix='century-broad-source-')as tmp:
 tmp=Path(tmp)
 with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git','archive',base],cwd=repo)))as t:t.extractall(tmp,filter='data')
 subprocess.run(['git','apply','--binary',str(rep/'source.patch')],cwd=tmp,check=True)
 if(out/'manifest.json').exists():
  m=json.loads((out/'manifest.json').read_text());lab=tmp/'experiments/v2';rows=[[str(f.relative_to(lab)),sha(f)]for f in sorted(lab.rglob('*'))if f.is_file()and'build'not in f.relative_to(lab).parts and'runs'not in f.relative_to(lab).parts and f.name!='validation.json'];source=hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest();assert source==m['sourceSHA256']
  spec=(tmp/'scripts/broad-modifier-spec.mjs').read_text();files=re.findall(r"'([^']+)'",re.search(r'PINNED_BROAD_FILES=\[(.*?)\];',spec,re.S).group(1));h=hashlib.sha256(json.dumps([[f,sha(tmp/f)]for f in files],separators=(',',':')).encode()).hexdigest();assert h==m['harnessSHA256'];(rep/'source-reconstruction-proof.json').write_text(json.dumps({'status':'passed','sourceSHA256':source,'harnessSHA256':h,**pins},indent=2)+'\n')
(out/'package-status.json').write_text(json.dumps({'workflow':json.loads((out/'workflow-status.json').read_text()),'packagedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'fullEventLedgersIncluded':False},indent=2)+'\n')
files=[f for f in sorted(out.rglob('*'))if f.is_file()and'qualification-compact'not in f.relative_to(out).parts and not('recovery-checkpoints'in f.relative_to(out).parts and(out/'ledger-verification.json').exists())and f.name!='package-checksums.json'];checks=[{'path':str(f.relative_to(out)),'bytes':f.stat().st_size,'sha256':sha(f)}for f in files];(out/'package-checksums.json').write_text(json.dumps(checks,indent=2)+'\n')
p=repo.parent/'Century_Broad_Modifier_Validation_2026_11_15.zip'
with zipfile.ZipFile(p,'w',zipfile.ZIP_DEFLATED,compresslevel=9)as z:
 for f in files+[out/'package-checksums.json']:z.write(f,f.relative_to(out))
with zipfile.ZipFile(p)as z:assert z.testzip()is None
assert p.stat().st_size<20*1048576;print(json.dumps({'status':'passed','path':str(p),'bytes':p.stat().st_size,'sha256':sha(p)}))
