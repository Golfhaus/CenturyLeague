"""Freeze compact natural-policy results; exclude repository code and bulk ledgers."""
import argparse,hashlib,json,subprocess,zipfile
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('study',type=Path);p.add_argument('profiles',type=Path);p.add_argument('report',type=Path);p.add_argument('output',type=Path);a=p.parse_args()
v=json.loads((a.study/'analysis.json').read_text());proof=json.loads((a.study/'ledger-verification.json').read_text());ind=json.loads((a.study/'independent-recomputation.json').read_text());m=json.loads((a.study/'manifest.json').read_text());assert v['outcomes']==proof['fullOutcomesVerified']==1536 and ind['status']=='passed'
assert hashlib.sha256(a.profiles.read_bytes()).hexdigest()==m['profilesSHA256'];items={}
for name in ['manifest.json','summary.json','outcomes.csv','analysis.json','ledger-verification.json','independent-recomputation.json']:items['study/'+name]=(a.study/name).read_bytes()
items['verification/crossarm-verification.json']=(a.study/'crossarm-verification.json').read_bytes()
items['report/'+a.report.name]=a.report.read_bytes();items['reproduction/profiles.json']=a.profiles.read_bytes();items['verification/fixed-design.json']=Path('docs/halftime-natural-policy-plan-2026-11-17.json').read_bytes()
for src,name in [(a.study.parent/'qualification/checks/qualification.json','qualification.json'),(a.study.parent/'qualification/behavior-checks.json','behavior-checks.json'),(a.study.parent/'preflight/ledger-verification.json','preflight-verification.json'),(Path('docs/verification/halftime-natural-policy-2026-11-17/initial-design-before-interval-amendment.json'),'initial-design-before-interval-amendment.json'),(Path('docs/verification/drop-counter-targeted-2026-11-17/storage-faults.json'),'shared-storage-fault-proof.json')]:items['verification/'+name]=src.read_bytes()
revision=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
items['README.txt']=f'''Century automatic halftime policy: fresh natural-history validation

384 paired cases / 1536 full matches, 24 fixed synthetic profiles, four coaching arms.
Eight separate preflight outcomes are excluded. All first halves play naturally.
Candidate restored-halftime-policy-v1 preserves the earlier graded costs and thresholds.
Historical restoration matches 96 policy and 96 diagnostic choices, not missing source bytes.
One primary contrast: focal-only minus neither adapting. Its conservative 95% Hoeffding
bound was fixed prospectively for heterogeneous profiles before scientific outcomes.
The initial binomial proposal and its prospective amendment remain available as evidence.
Other arm comparisons, interactions, decision coverage and subgroup estimates are descriptive.

Source branch: Golfhaus/CenturyLeague / lab/drop-counter-recovery-2026-11-17
Local working checkpoint: {revision}
API publication may assign another commit ID while preserving the exact Git file tree.
Use recorded source/harness checksums to identify the qualified source for reproduction.
Source SHA256: {v['sourceSHA256']}
Harness SHA256: {v['harnessSHA256']}
Outcome CSV SHA256: {v['outcomesCSVSHA256']}

Repository code is not duplicated here. Full event ledgers remain local and are excluded.
Exact original profile input bytes are included, including unused profiles needed to preserve
their source-file identity; manifest fixtures identify the 24 used profiles and all fresh seeds.

Aggregate recomputation in the matching source checkout:
  python3 experiments/halftime-policy/recompute.py PATH/TO/study

Build using load() from experiments/halftime-policy/tools.mjs under Node v24.22.1 --no-maglev.
Construct each input using inputFor with the selected fixture profile, balanced team order,
fixture.id, fixture.seed and date 2026-11-17. Apply spec.mjs controls(arm, focalSide).
Every stored full-result hash is retained in outcomes.csv. Future explicit replay is a
separate verification operation, never a replacement for completed scientific outcomes.

This study does not adopt a policy, settle optimal coaching behavior, complete holistic v2
validation, change the current tournament engine or activate the December-season release.
'''.encode()
digests={n:hashlib.sha256(b).hexdigest()for n,b in items.items()};items['SHA256SUMS.json']=(json.dumps(digests,indent=2)+'\n').encode();a.output.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(a.output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6)as z:
 for n,b in items.items():z.writestr(n,b)
with zipfile.ZipFile(a.output)as z:
 assert z.testzip()is None
 for n,h in digests.items():assert hashlib.sha256(z.read(n)).hexdigest()==h
print(json.dumps({'status':'passed','files':len(items),'bytes':a.output.stat().st_size,'sha256':hashlib.sha256(a.output.read_bytes()).hexdigest(),'fullFutureLedgersIncluded':False,'sourceCodeIncluded':False}))
