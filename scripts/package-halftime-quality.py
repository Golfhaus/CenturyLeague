"""Compact review-first package; no repository code or full event archives."""
import argparse,json,hashlib,subprocess,zipfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('report',type=Path);p.add_argument('output',type=Path);a=p.parse_args();base=Path('experiments/halftime-review/runs');study=base/'validation';fixed=Path('experiments/halftime-boundary/runs');proof=json.loads((study/'ledger-verification.json').read_text());confirm=json.loads((fixed/'confirmation-canonical/confirmation.json').read_text());assert proof['fullOutcomesVerified']==768 and confirm['status']=='passed'
items={}
for name in ['manifest.json','summary.json','outcomes.csv','analysis.json','ledger-verification.json','independent-recomputation.json','recipe-boundary-review.json']:items['original-policy-study/'+name]=(study/name).read_bytes()
for name in ['manifest.json','summary.json','outcomes.csv','confirmation.json','independent-recomputation.json']:items['corrected-policy-confirmation/'+name]=(fixed/'confirmation-canonical'/name).read_bytes()
items['historical-review.json']=(base/'historical-review/historical-review.json').read_bytes();items['reproduction/profiles.json']=Path('experiments/halftime-review/profiles.json').read_bytes();items['report/'+a.report.name]=a.report.read_bytes()
for path in Path('docs/verification/halftime-decision-quality-2026-11-17').glob('*.json'):items['verification/'+path.name]=path.read_bytes()
for name in ['halftime-decision-quality-plan-2026-11-17.json','halftime-boundary-confirmation-plan-2026-11-17.json','halftime-boundary-canonical-confirmation-plan-2026-11-17.json']:items['plans/'+name]=(Path('docs')/name).read_bytes()
for src,name in [(fixed/'qualification-final/checks/qualification.json','corrected-qualification.json'),(fixed/'qualification-final/boundary-checks.json','corrected-boundary-checks.json'),(fixed/'qualification-final/behavior-checks.json','corrected-behavior-checks.json'),(base/'preflight/ledger-verification.json','excluded-preflight-proof.json'),(fixed/'confirmation/simulation-status.json','failed-confirmation-status.json')]:items['verification/'+name]=src.read_bytes()
revision=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip();items['README.txt']=f'''Century halftime coaching: decision quality and boundary correction

Completed original-policy evaluation: 384 paired cases / 768 full matches.
Separate corrected-policy engineering confirmation: 64 cases / 192 full outcomes.
Do not pool original and corrected candidates or treat confirmation as a powered
policy-utility trial. All prospective plans, technical failure disclosure and
independent aggregate proofs are included. Four preflight outcomes are excluded.
The first correction confirmation failed before its first durable completed case
because diagnostic -0 did not survive JSON copying. A new qualified source canonicalizes
zero. The corrected confirmation preserves the same64 planned seeds; no winner-based
change or automatic retry was used. All earlier source identities remain preserved.

Exact generated48-profile bytes are included. Complete event ledgers remain local;
this compact package preserves every outcome CSV, result hash and key audit receipt.
Repository code is maintained separately on Golfhaus/CenturyLeague branch
lab/drop-counter-recovery-2026-11-17, checkpoint {revision}.
Use recorded source/harness hashes to distinguish the candidates and reproduce inputs.

Independent aggregate checks in the matching repository checkout:
python3 experiments/halftime-review/recompute.py PATH/original-policy-study
python3 scripts/recompute-halftime-confirmation.py PATH/corrected-policy-confirmation

This does not change the current tournament engine, complete holistic v2 validation,
authorize release activation or establish natural league adoption frequencies.
'''.encode();digests={n:hashlib.sha256(b).hexdigest()for n,b in items.items()};items['SHA256SUMS.json']=(json.dumps(digests,indent=2)+'\n').encode();a.output.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(a.output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6)as z:
 for n,b in items.items():z.writestr(n,b)
with zipfile.ZipFile(a.output)as z:
 assert z.testzip()is None
 for n,h in digests.items():assert hashlib.sha256(z.read(n)).hexdigest()==h
print(json.dumps({'status':'passed','files':len(items),'bytes':a.output.stat().st_size,'sha256':hashlib.sha256(a.output.read_bytes()).hexdigest()}))
