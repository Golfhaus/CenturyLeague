"""Fixed two-stage control-selection/fresh-modifier workflow. No retries or sample expansion."""
from pathlib import Path
import datetime,hashlib,json,subprocess,sys,time
repo=Path(__file__).resolve().parents[1];out=repo.parent/'quality_gap_results';runs=repo/'experiments/v2/runs';status=out/'workflow-status.json';profiles=out/'reproduction/profiles.json';prior=repo.parent/'broad_modifier_results'
def emit(stage,**kw):
 d={'stage':stage,'updatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),**kw};status.write_text(json.dumps(d,indent=2)+'\n');print(json.dumps(d),flush=True)
def wait(study):
 last=0
 while True:
  p=runs/study/'simulation-status.json';d=json.loads(p.read_text())if p.exists()else{}
  if d.get('state')=='completed':assert d['recordedStudyComplete'];return
  if d.get('state')in ['failed','stalled','interrupted']:raise RuntimeError('Simulation stopped: '+str(d))
  if time.monotonic()-last>30:emit(study+'-running',completedFixtures=d.get('completedFixtures',0),expectedFixtures=d.get('expectedFixtures',0));last=time.monotonic()
  time.sleep(5)
def run(study,name,command):
 emit(name,studyId=study);subprocess.run([sys.executable,'scripts/supervise-engine-study.py','--study-dir',str(runs/study),'--stage','analysis','--status-file',str(runs/study/(name+'-status.json')),'--log-file',str(runs/study/(name+'.log')),'--',*command],cwd=repo,check=True,stdout=subprocess.DEVNULL)
def audit_analyze(study,folder):
 dest=out/folder;dest.mkdir(exist_ok=True)
 for name,command in [('ledger-audit',['node','scripts/audit-quality-gap-study.mjs',str(runs/study),str(dest)]),('paired-analysis',[sys.executable,'scripts/analyze-quality-gap-study.py',str(dest)]),('independent-recomputation',[sys.executable,'scripts/recompute-quality-gap-study.py',str(dest)])]:run(study,name,command)
 return dest
try:
 control='quality-control-ladder-001';modifier='moderate-quality-modifier-validation-001';wait(control);d=audit_analyze(control,'controls');run(control,'selection',[sys.executable,'scripts/select-quality-gap.py',str(d)]);run(control,'selection-verification',[sys.executable,'scripts/verify-quality-gap-selection.py',str(d)]);gate=d/'selection.json';g=json.loads(gate.read_text())
 if not g['confirmed']:emit('completed-no-eligible-gap');sys.exit(0)
 m=json.loads((d/'manifest.json').read_text());assert hashlib.sha256(profiles.read_bytes()).hexdigest()==m['profileFileSHA256'],'Original input profiles changed after control selection'
 emit('selected-gap-starting-fresh-modifiers',selectedMagnitude=g['selectedMagnitude'])
 subprocess.run([sys.executable,'scripts/supervise-engine-study.py','--study-dir',str(runs/modifier),'--stage','simulation','--','node','scripts/run-quality-gap-study.mjs','--stage','modifiers','--study-id',modifier,'--trials','96','--workers','8','--profiles',str(profiles),'--screen-dir',str(prior),'--selection',str(gate)],cwd=repo,check=True,stdout=subprocess.DEVNULL)
 audit_analyze(modifier,'modifiers');emit('completed-both-stages-verified')
except BaseException as e:
 if isinstance(e,SystemExit)and e.code==0:raise
 emit('failed',error=str(e));raise
