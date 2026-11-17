"""Compact two-stage quality study deliverable; full event archives are separate."""
from pathlib import Path
import datetime,hashlib,io,json,re,shutil,subprocess,tarfile,tempfile,zipfile
repo=Path(__file__).resolve().parents[1];out=repo.parent/'quality_gap_results';rep=out/'reproduction';base='1f867ad5de47a6e8c40b70cbcb379e8751c72e8a';sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
shutil.copyfile(repo/'docs/QUALITY_GAP_LADDER_AND_VALIDATION_PLAN_2026_11_15.md',out/'QUALITY_GAP_LADDER_AND_VALIDATION_PLAN_2026_11_15.md')
for study,folder in [('quality-control-ladder-001','controls'),('moderate-quality-modifier-validation-001','modifiers')]:
 d=repo/'experiments/v2/runs'/study
 if not d.exists():continue
 dest=out/folder;dest.mkdir(exist_ok=True)
 for name in ['manifest.json','simulation-status.json','simulation.log','preflight-status.json','preflight.log','ledger-audit-status.json','ledger-audit.log','paired-analysis-status.json','paired-analysis.log','independent-recomputation-status.json','independent-recomputation.log','selection-status.json','selection.log','selection-verification-status.json','selection-verification.log']:
  f=d/name
  if f.exists():shutil.copyfile(f,dest/name)
prior=repo.parent/'broad_modifier_results';(rep/'prior-breadth').mkdir(parents=True,exist_ok=True)
for name in ['manifest.json','analysis.json','ledger-verification.json','independent-recomputation.json']:shutil.copyfile(prior/name,rep/'prior-breadth'/name)
commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip();(rep/'source.patch').write_bytes(subprocess.check_output(['git','diff','--binary',base,'HEAD'],cwd=repo));pins={'baseCommit':base,'localPinnedCommit':commit,'patchSHA256':sha(rep/'source.patch')};(rep/'source-pins.json').write_text(json.dumps(pins,indent=2)+'\n')
(rep/'README.txt').write_text('''Century control quality ladder and independent modifier follow-up

Apply source.patch to the exact public baseCommit in source-pins.json. Install locked dependencies (npm ci), use Node24.22.1/no-Maglev as enforced. profiles.json preserves all88 generated counterfactual input versions; no official player data is edited. Exact reconstruction: node scripts/build-quality-gap-profiles.mjs ABS/rebuilt-profiles.json (compare with profiles.json).

Control research: node scripts/run-quality-gap-study.mjs --stage controls --study-id quality-control-ladder-001 --trials 64 --workers 8 --profiles ABS/reproduction/profiles.json --screen-dir ABS/reproduction/prior-breadth
Audit with scripts/audit-quality-gap-study.mjs RAW_DIR OUTPUT_DIR, analyze with scripts/analyze-quality-gap-study.py OUTPUT_DIR, independently verify with scripts/recompute-quality-gap-study.py OUTPUT_DIR. Run scripts/select-quality-gap.py CONTROL_OUTPUT and scripts/verify-quality-gap-selection.py CONTROL_OUTPUT; the runner requires verified evidence and rejects research use of test-only gates.

If confirmed: node scripts/run-quality-gap-study.mjs --stage modifiers --study-id moderate-quality-modifier-validation-001 --trials 96 --workers 8 --profiles ABS/reproduction/profiles.json --screen-dir ABS/reproduction/prior-breadth --selection ABS/controls/selection.json
Use separate supervised stages. Audit/analyze/recompute as above against the new modifier output. The same exact profile file is retained; pilot seeds/results are never pooled or reselected after fresh controls. If no gap qualifies, the fixed protocol does not run or enlarge stage2.

Compact-only verification: run the two Python analysis/recomputation scripts on each completed stage folder. Then re-run selection and independent selection verification on controls. Python standard library is sufficient; report generation also needs Matplotlib.

Eligibility is conditional on fixed synthetic templates, with one family of11 pooled control intervals. Modifier families are separate: ordinary6, psychology6, extreme12; fresh controls3. Subgroups/profile intervals exploratory nominal. This does not certify a league-wide or global ceiling, halftime adaptation, season carryover or adoption.

Large full event ledgers stay separate; original full-ledger proof and checksums are retained here. Compact files alone cannot expose every raw event without deterministic resimulation. Preflight legacy replays used original retained breadth-screen raw fixtures, which are not in this compact package. Official data and deployment remain unchanged.
''')
with tempfile.TemporaryDirectory(prefix='century-quality-source-')as tmp:
 tmp=Path(tmp)
 with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git','archive',base],cwd=repo)))as t:t.extractall(tmp,filter='data')
 subprocess.run(['git','apply','--binary',str(rep/'source.patch')],cwd=tmp,check=True)
 manifests=[json.loads(f.read_text())for f in [out/'controls/manifest.json',out/'modifiers/manifest.json']if f.exists()]
 if manifests:
  lab=tmp/'experiments/v2';rows=[[str(f.relative_to(lab)),sha(f)]for f in sorted(lab.rglob('*'))if f.is_file()and'build'not in f.relative_to(lab).parts and'runs'not in f.relative_to(lab).parts and f.name!='validation.json'];source=hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest();spec=(tmp/'scripts/quality-gap-spec.mjs').read_text();files=re.findall(r"'([^']+)'",re.search(r'PINNED_QUALITY_FILES=\[(.*?)\];',spec,re.S).group(1));h=hashlib.sha256(json.dumps([[f,sha(tmp/f)]for f in files],separators=(',',':')).encode()).hexdigest()
  for m in manifests:assert m['sourceSHA256']==source and m['harnessSHA256']==h
  (rep/'source-reconstruction-proof.json').write_text(json.dumps({'status':'passed','sourceSHA256':source,'harnessSHA256':h,**pins},indent=2)+'\n')
(out/'package-status.json').write_text(json.dumps({'workflow':json.loads((out/'workflow-status.json').read_text()),'packagedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'fullEventLedgersIncluded':False},indent=2)+'\n')
files=[f for f in sorted(out.rglob('*'))if f.is_file()and not any(x.startswith('qualification-')for x in f.relative_to(out).parts)and not('recovery-checkpoints'in f.relative_to(out).parts and(out/'modifiers/ledger-verification.json').exists())and f.name!='package-checksums.json'];checks=[{'path':str(f.relative_to(out)),'bytes':f.stat().st_size,'sha256':sha(f)}for f in files];(out/'package-checksums.json').write_text(json.dumps(checks,indent=2)+'\n')
p=repo.parent/'Century_Quality_Gap_and_Modifier_Validation_2026_11_15.zip'
with zipfile.ZipFile(p,'w',zipfile.ZIP_DEFLATED,compresslevel=9)as z:
 for f in files+[out/'package-checksums.json']:z.write(f,f.relative_to(out))
with zipfile.ZipFile(p)as z:assert z.testzip()is None
assert p.stat().st_size<30*1048576;print(json.dumps({'status':'passed','path':str(p),'bytes':p.stat().st_size,'sha256':sha(p)}))
