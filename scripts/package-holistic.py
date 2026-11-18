"""Build a compact, verified review package from completed holistic evidence."""
import hashlib,json,subprocess,sys,zipfile
from pathlib import Path
repo=Path(__file__).resolve().parents[1];report=Path(sys.argv[1]).resolve();out=Path(sys.argv[2]).resolve();publication=Path(sys.argv[3]).resolve();out.parent.mkdir(parents=True,exist_ok=True)
proof=json.loads(publication.read_text());assert proof['status']=='verified';assert report.is_file();entries={}
def add(name,p):
 p=Path(p);assert p.is_file(),str(p);assert name not in entries;entries[name]=p.read_bytes()
for study in ['screen','confirmation']:
 b=repo/'experiments/holistic/runs'/study
 for name in ['manifest.json','summary.json','outcomes.csv','analysis.json','ledger-verification.json','independent-recomputation.json','event-exposures.csv','event-exposures-verification.json','event-exposures-independent.json','simulation-status.json','audit-status.json','recomputation-status.json','exposures-status.json']:
  add(study+'/'+name,b/name)
 for name in ['ledger-verification.json','independent-recomputation.json','event-exposures-verification.json','event-exposures-independent.json']:assert json.loads((b/name).read_text())['status']=='passed'
for name in ['inference.json','review-summary.json','profile-mixture-counts.json']:add('confirmation/'+name,repo/'experiments/holistic/runs/confirmation'/name)
for p in sorted((repo/'docs/verification/holistic-2026-11-18').glob('*.json')):add('verification/'+p.name,p)
add('verification/shared-storage-fault-injection.json',repo/'docs/verification/drop-counter-targeted-2026-11-17/storage-faults.json')
for name in ['holistic-factorial-plan-2026-11-18.json','holistic-selected-confirmation-plan-2026-11-18.json','HOLISTIC_MODIFIER_RESULTS_2026_11_18.md','ENGINE_V2_HOLISTIC_TEST_DESIGN_2026_11_18.md','ENGINE_V2_SEASON_ROLLOUT_2026_11_17.md']:add('plans-and-review/'+name,repo/'docs'/name)
add('reproduction/profiles.json',repo/'experiments/holistic/profiles.json')
add('future-validation/roster-snapshots-NOT-USED-IN-THIS-STUDY.json',repo.parent/'recovery/copied-clubs-20261118/roster-snapshots.json')
add('verification/publication-receipt.json',publication)
add('Century_Holistic_Modifier_Testing_2026_11_18.pdf',report)
source=json.loads((repo/'experiments/holistic/runs/confirmation/manifest.json').read_text());assert hashlib.sha256(entries['reproduction/profiles.json']).hexdigest()==source['profilesSHA256']
readme=f'''Century holistic modifier review - 18 November 2026

COMPLETED RESEARCH, NOT ENGINE ACTIVATION
Screen: 480 paired clusters x8 arms =3,840 full outcomes.
Fresh confirmation: 512 paired clusters x3 arms =1,536 outcomes.
All 5,376 retained scientific outcomes were audited; 336 planned scientific
full-result replays passed. Qualification/preflight/artificial math fixtures
are separate and excluded. No historical sample is pooled.

READ FIRST
Open the report PDF, then confirmation/inference.json and review-summary.json.
Screen cells and interactions are descriptive. Confirmation covers the frozen
synthetic profile-mixture target at selected hot-favored/cold-adverse corners,
not a natural population of real clubs. The four signed differences use
simultaneous family-wise95% bounds. This does not establish universal safety,
optimal halftime decisions or production acceptance.

ARMS (P W H)
P confidence/frustration/home support; W weather+temperature tolerance;
H both coaches automatic (otherwise both Hold).
Screen:000,001,010,011,100,101,110,111. Confirmation:000,110,111.
No gameplay coefficients were modified between stages.

IMPORTANT DENOMINATOR NOTE
Use event-exposures.csv for contacts, foul incidents and serious fouls in all
arms. These supplemental counts are reconstructed from retained raw events,
verified against team statistics and independently regrouped. In the frozen
outcomes.csv optional focal/opponent contacts, severity incidents and serious
foul telemetry counters are ZERO WHEN PSYCHOLOGY TELEMETRY IS DISABLED.
Those zeros mean unavailable telemetry, not zero actual fouls. Mean severity
probability uses incident denominators, never total contacts or total matches.

REPRODUCTION
Gameplay source SHA256: {source['sourceSHA256']}
Harness SHA256: {source['harnessSHA256']}
Exact profiles SHA256: {source['profilesSHA256']}
Repository: https://github.com/Golfhaus/CenturyLeague
Branch: lab/drop-counter-recovery-2026-11-17
Verified published result commit: {proof['branchHead']}
Prespecified source/plans and supplemental scripts are Git-backed; code is not
duplicated here. Prospective checkpoint mappings are in the publication receipt.
Use Node24.22.1 with --no-maglev and the pinned candidate/harness. Extract
reproduction/profiles.json to experiments/holistic/profiles.json. Use fresh run
directories; frozen results must not be overwritten or silently resumed under
a different source. Frozen plans contain every seed, orientation/profile draw,
fixed environment and sample count. Keep original and regenerated results
separate. For the fresh confirmation, the uniform mixture includes the profile
draw and is unconditional on its realized counts; do not condition the exact
binomial construction on those counts.

Full event ledgers remain in the active workspace, not this compact package.
Result hashes in outcomes.csv identify them, and frozen inputs permit separate
reproduction. The package is not a full event-level archive or a guarantee of
indefinite local ledger retention. The audit verified every retained ledger and
hash, with exact reruns only for the prospective subset. Hidden RNG draws are
not independently reconstructed for every event.

FUTURE VALIDATION INPUT
future-validation contains read-only copied snapshots of18 clubs/630 players,
captured from CenturyLeague on18 November. NOT used in the above scientific
sample. Preserve provenance; do not write this copy into official records.
Copied-club/history validation, an isolated season rehearsal and explicit
competition-scoped release remain. Current tournament engine is unchanged.

INTEGRITY
SHA256SUMS.json lists every other member; ZIP CRC and all listed digests were
verified after writing. A correct compact package does not itself approve
deployment or change official match results.
'''
entries['README.txt']=readme.encode();entries['SHA256SUMS.json']=(json.dumps({k:hashlib.sha256(v).hexdigest()for k,v in sorted(entries.items())},indent=2)+'\n').encode()
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=6)as z:
 for name,data in entries.items():z.writestr(name,data)
with zipfile.ZipFile(out)as z:
 assert z.testzip()is None;digests=json.loads(z.read('SHA256SUMS.json'))
 for name,digest in digests.items():assert hashlib.sha256(z.read(name)).hexdigest()==digest
 assert len(z.namelist())==len(digests)+1
result={'status':'passed','archive':str(out),'bytes':out.stat().st_size,'members':len(entries),'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'zipCRCVerified':True,'memberSHA256Verified':True,'reportSHA256':hashlib.sha256(report.read_bytes()).hexdigest(),'branchHead':proof['branchHead']}
(repo/'experiments/holistic/runs/confirmation/archive-verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
