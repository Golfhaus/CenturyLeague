"""Run the two fixed confirmations, stopping on a technical failure without retry."""
from pathlib import Path
import datetime,hashlib,json,subprocess,sys,time
from adverse_completion_cache import completed_compact
repo=Path(__file__).resolve().parents[1];out=repo.parent/'adverse_confirmation_results';runs=repo/'experiments/v2/runs';profiles=out/'reproduction/profiles.json';prior=repo.parent/'quality_gap_results'
def emit(stage,**kw):
 d={'stage':stage,'updatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),**kw};(out/'workflow-status.json').write_text(json.dumps(d,indent=2)+'\n');print(json.dumps(d),flush=True)
def run(cohort,stage,command):
 study='adverse-'+cohort+'-confirmation-001';d=runs/study;retained=len(list(d.glob(study+'-*.json.gz')))if stage=='simulation'else 0;resume=stage=='simulation'and 0<retained<4096;deadline=1800 if resume else 300
 log=stage+('-resume-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S')if resume else'')+'.log'
 if resume:(out/'resume-policy.json').write_text(json.dumps({'cohort':cohort,'retainedSeedsAtResume':retained,'fixedExpectedSeeds':4096,'stallSeconds':deadline,'reason':'Saved results are fully replayed before new durable fixtures appear; allow30 minutes for the roughly10–15 minute initial replay. Separate replay log counters remain visible. No sample/seed/coefficient changes or automatic retry.'},indent=2)+'\n')
 cmd=[sys.executable,'scripts/supervise-engine-study.py','--study-dir',str(d),'--stage','simulation'if stage=='simulation'else'analysis','--status-file',str(d/(stage+'-status.json')),'--log-file',str(d/log),'--stall-seconds',str(deadline),'--',*command];emit(stage,cohort=cohort,resume=resume,retainedSeedsAtStart=retained,stallSeconds=deadline)
 child=subprocess.Popen(cmd,cwd=repo,stdout=subprocess.DEVNULL)
 while child.poll()is None:
  p=d/(stage+'-status.json');status=json.loads(p.read_text())if p.exists()else{};emit(stage,cohort=cohort,state=status.get('state'),completedFixtures=status.get('completedFixtures',0),expectedFixtures=status.get('expectedFixtures',0));time.sleep(15)
 if child.returncode:raise RuntimeError(f'{cohort} {stage} failed ({child.returncode}); checkpoint preserved, no retry')
try:
 proof=json.loads((out/'preflight-verification.json').read_text());assert proof['status']=='passed'
 if(out/'environment-recovery.json').exists():
  q=json.loads((out/'recovery-qualification.json').read_text());assert q['status']=='passed'and q['sourceSHA256']==proof['sourceSHA256']and q['harnessSHA256']==proof['harnessSHA256']
 for cohort in ['matched','stronger']:
  study='adverse-'+cohort+'-confirmation-001';dest=out/cohort
  if completed_compact(dest,cohort,proof):
   emit('saved-completed-cohort-verified-no-simulation',cohort=cohort);continue
  run(cohort,'simulation',['node','scripts/run-adverse-confirmation.mjs','--cohort',cohort,'--trials','512','--workers','8','--profiles',str(profiles),'--screen-dir',str(prior)])
  for stage,command in [('ledger-audit',['node','scripts/audit-adverse-confirmation.mjs',str(runs/study),str(dest)]),('paired-analysis',[sys.executable,'scripts/analyze-adverse-confirmation.py',str(dest)]),('independent-recomputation',[sys.executable,'scripts/recompute-adverse-confirmation.py',str(dest)])]:run(cohort,stage,command)
  if cohort=='matched'and(out/'environment-recovery.json').exists():
   recovery=json.loads((out/'environment-recovery.json').read_text())
   for name,want in recovery['expectedMatchedSHA256'].items():assert hashlib.sha256((dest/name).read_bytes()).hexdigest()==want,'Reconstructed original evidence differs: '+name
   recovery['state']='completed-matched-evidence-exactly-reconstructed';(out/'environment-recovery.json').write_text(json.dumps(recovery,indent=2)+'\n');emit('matched-original-evidence-hashes-verified')
 emit('completed-both-confirmations-verified')
except BaseException as e:emit('failed',error=str(e));raise
