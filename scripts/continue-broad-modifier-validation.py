"""Continue fixed breadth study through audit and independent analysis; never auto-retry."""
from pathlib import Path
import datetime,json,subprocess,sys,time
repo=Path(__file__).resolve().parents[1];out=repo.parent/'broad_modifier_results';study=repo/'experiments/v2/runs/broad-modifier-validation-001';status=out/'workflow-status.json'
def emit(stage,**kw):
 d={'stage':stage,'updatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),**kw};status.write_text(json.dumps(d,indent=2)+'\n');print(json.dumps(d),flush=True)
try:
 last=0
 while True:
  p=study/'simulation-status.json';d=json.loads(p.read_text())if p.exists()else{}
  if d.get('state')=='completed':assert d['recordedStudyComplete'];break
  if d.get('state')in ['failed','stalled','interrupted']:raise RuntimeError('Simulation stopped: '+str(d))
  if time.monotonic()-last>30:emit('simulation',completedFixtures=d.get('completedFixtures',0),expectedFixtures=2160);last=time.monotonic()
  time.sleep(5)
 for name,command in [('ledger-audit',['node','scripts/audit-broad-modifier-validation.mjs',str(study),str(out)]),('paired-analysis',[sys.executable,'scripts/analyze-broad-modifier-validation.py',str(out)]),('independent-recomputation',[sys.executable,'scripts/recompute-broad-modifier-validation.py',str(out)])]:
  emit(name);subprocess.run([sys.executable,'scripts/supervise-engine-study.py','--study-dir',str(study),'--stage','analysis','--status-file',str(study/(name+'-status.json')),'--log-file',str(study/(name+'.log')),'--',*command],cwd=repo,check=True,stdout=subprocess.DEVNULL)
 emit('completed-scientific-verification')
except BaseException as e:emit('failed',error=str(e));raise
