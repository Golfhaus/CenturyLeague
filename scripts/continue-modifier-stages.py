"""Continue fixed stages after supervised completion; stop on any failed audit or gate."""
import json,subprocess,sys,time,datetime
from pathlib import Path
repo=Path(__file__).resolve().parents[1];root=repo.parent/'modifier_stages_results';runs=repo/'experiments/v2/runs';status=root/'workflow-status.json'
def write(stage,**kw):
 d={'stage':stage,'updatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),**kw};status.write_text(json.dumps(d,indent=2)+'\n');print(json.dumps(d),flush=True)
def wait_sim(study):
 f=runs/study/'simulation-status.json';last=0
 while True:
  d=json.loads(f.read_text())if f.exists()else{}
  if d.get('state')=='completed':assert d['recordedStudyComplete'];return
  if d.get('state')in ['failed','stalled','interrupted']:raise RuntimeError('Simulation stopped: '+str(d))
  if time.monotonic()-last>=30:write(study+'-running',completedFixtures=d.get('completedFixtures'),expectedFixtures=d.get('expectedFixtures'));last=time.monotonic()
  time.sleep(5)
def run_stage(study,name,command):
 write(name,studyId=study)
 subprocess.run([sys.executable,'scripts/supervise-engine-study.py','--study-dir',str(runs/study),'--stage','analysis','--status-file',str(runs/study/(name+'-status.json')),'--log-file',str(runs/study/(name+'.log')),'--',*command],cwd=repo,check=True,stdout=subprocess.DEVNULL)
def audit_analyze(study,folder):
 out=root/folder;out.mkdir(parents=True,exist_ok=True)
 for name,command in [('ledger-audit',['node','scripts/audit-modifier-stage.mjs',str(runs/study),str(out)]),('paired-analysis',[sys.executable,'scripts/analyze-modifier-stage.py',str(out)]),('independent-recomputation',[sys.executable,'scripts/recompute-modifier-stage.py',str(out)])]:run_stage(study,name,command)
 return out
try:
 cold='cold-adverse-confirmation-001';combined='copied-club-combined-modifiers-001'
 wait_sim(cold);out=audit_analyze(cold,'confirmation');run_stage(cold,'confirmation-gate',['node','scripts/write-cold-confirmation-gate.mjs',str(out)])
 gate=out/'cold-confirmation-gate.json';g=json.loads(gate.read_text())
 if not g['confirmed']:write('completed-gate-not-confirmed',gate=g);sys.exit(0)
 write('cold-confirmed-starting-combined',primary=g['primary'])
 subprocess.run([sys.executable,'scripts/supervise-engine-study.py','--study-dir',str(runs/combined),'--stage','simulation','--','node','experiments/v2/run-modifier-stage.mjs','--stage','combined','--study-id',combined,'--trials','256','--workers','8','--profiles',str(root/'reproduction/copied-profiles.json'),'--gate',str(gate)],cwd=repo,check=True,stdout=subprocess.DEVNULL)
 audit_analyze(combined,'combined');write('completed-both-stages-verified')
except BaseException as e:
 if isinstance(e,SystemExit)and e.code==0:raise
 write('failed',error=str(e));raise
