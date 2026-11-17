"""Bounded local study stages. Never auto-retry simulations or uncertain delivery."""
import argparse,datetime,json,os,signal,subprocess,sys,time,uuid
from pathlib import Path

def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def read(path):return json.loads(path.read_text())
def atomic(path,value):
 path.parent.mkdir(parents=True,exist_ok=True);tmp=path.with_name(path.name+'.'+uuid.uuid4().hex+'.tmp')
 tmp.write_text(json.dumps(value,indent=2)+'\n');os.replace(tmp,path)
def checkpoint(study):
 m=read(study/'manifest.json')if(study/'manifest.json').exists()else None
 fixtures=m.get('fixtures',[])if m else[]
 files=[study/(f['id']+'.json.gz')for f in fixtures]
 saved=sum(p.is_file()for p in files);summary=read(study/'summary.json')if(study/'summary.json').exists()else None
 expected=len(fixtures);arms=len(m.get('arms',[]))if m else 0
 source=m.get('sourceSHA256','')if m else''
 complete=bool(expected and arms and len({f['id']for f in fixtures})==expected and len(source)==64 and all(c in '0123456789abcdef'for c in source)
  and saved==expected and summary and summary.get('status')=='completed'
  and summary.get('sourceSHA256')==m.get('sourceSHA256')and summary.get('matchedFixtures')==expected
  and summary.get('engineResults')==expected*arms)
 return {'completedFixtures':saved,'expectedFixtures':expected,'outcomesRetained':saved*arms,'recordedStudyComplete':complete}
def main(argv=None):
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--study-dir',type=Path,required=True);p.add_argument('--stage',choices=['simulation','analysis','archive','delivery'],required=True)
 p.add_argument('--status-file',type=Path);p.add_argument('--log-file',type=Path);p.add_argument('--heartbeat-seconds',type=float,default=15)
 p.add_argument('--stall-seconds',type=float,default=300);p.add_argument('--poll-seconds',type=float,default=1);p.add_argument('--kill-grace-seconds',type=float,default=5)
 p.add_argument('--progress-path',type=Path,action='append',default=[]);p.add_argument('--verify-existing',action='store_true');p.add_argument('command',nargs=argparse.REMAINDER)
 a=p.parse_args(argv);command=a.command[1:]if a.command[:1]==['--']else a.command
 if not command:p.error('Supply a command after --')
 if min(a.heartbeat_seconds,a.stall_seconds,a.poll_seconds,a.kill_grace_seconds)<=0:p.error('All time limits must be positive')
 study=a.study_dir.resolve();study.mkdir(parents=True,exist_ok=True);status=a.status_file or study/(a.stage+'-status.json');log=a.log_file or study/(a.stage+'.log')
 if status.exists():
  old=read(status);state=old.get('state',old.get('status'))
  if a.stage=='delivery'and state in ['unconfirmed','unconfirmed-after-timeout','unknown','awaiting_receipt_check']:
   print('Delivery is unconfirmed. Reconcile the original operation before another write.',file=sys.stderr);return 2
 snapshot=checkpoint(study)
 if a.stage=='simulation'and snapshot['recordedStudyComplete']and not a.verify_existing:
  result={'stage':a.stage,'state':'completed','alreadyComplete':True,'updatedAt':utc(),**snapshot,
   'message':'Existing immutable study is complete. No simulation started. Use a new study ID for changed inputs; use its pinned source for explicit verification.'}
  atomic(status,result);print(json.dumps(result),flush=True);return 0
 start=time.monotonic();last_progress=start;last_heartbeat=0;signature=None;process=None;last_log_size=0;last_output=utc()
 def stop():
  if process is None or process.poll()is not None:return
  try:os.killpg(process.pid,signal.SIGTERM)
  except ProcessLookupError:process.wait();return
  try:process.wait(timeout=a.kill_grace_seconds)
  except subprocess.TimeoutExpired:
   try:os.killpg(process.pid,signal.SIGKILL)
   except ProcessLookupError:pass
   process.wait()
 def emit(state,message='',code=None):
  result={'stage':a.stage,'state':state,'updatedAt':utc(),'elapsedSeconds':round(time.monotonic()-start,2),
   'secondsWithoutProgress':round(time.monotonic()-last_progress,2),'lastOutputAt':last_output,
   **snapshot,'command':command,'logFile':str(log),'message':message}
  if process is not None:result['processId']=process.pid
  if code is not None:result['exitCode']=code
  atomic(status,result);print(json.dumps(result),flush=True)
 try:
  log.parent.mkdir(parents=True,exist_ok=True)
  with log.open('ab')as stream:
   process=subprocess.Popen(command,stdout=stream,stderr=subprocess.STDOUT,start_new_session=True)
   while True:
    now=time.monotonic();snapshot=checkpoint(study);log_size=log.stat().st_size
    if log_size!=last_log_size:last_output=utc();last_log_size=log_size
    watched=tuple((str(x),x.stat().st_size,x.stat().st_mtime_ns)for x in a.progress_path if x.exists())
    # Scientific progress is durable fixture completion, not repeated log messages.
    current=(snapshot['completedFixtures'],snapshot['recordedStudyComplete'])if a.stage=='simulation'else(watched,log_size)
    if signature is None or current!=signature:signature=current;last_progress=now
    code=process.poll()
    if code is not None:
     if a.stage=='simulation':
      if code==0 and snapshot['recordedStudyComplete']:emit('completed','Recorded study complete.',code);return 0
      emit('failed','Command ended without a complete validated study checkpoint. Retained fixtures were preserved.',code);return code or 1
     if code==0:
      emit('awaiting_receipt_check'if a.stage=='delivery'else'completed','Process completed. Verify every delivery receipt before declaring files saved.'if a.stage=='delivery'else'Stage completed.',code);return 0
     unknown=a.stage=='delivery'
     emit('unconfirmed'if unknown else'failed','Delivery needs reconciliation; no automatic retry.'if unknown else'Stage failed; prior computation remains intact.',code);return code
    if now-last_progress>=a.stall_seconds:
     stop();emit('unconfirmed'if a.stage=='delivery'else'stalled','No progress within deadline. Child process group stopped; checkpoints preserved. No automatic restart.',124);return 124
    if now-last_heartbeat>=a.heartbeat_seconds:emit('running');last_heartbeat=now
    time.sleep(a.poll_seconds)
 except KeyboardInterrupt:
  stop();emit('unconfirmed'if a.stage=='delivery'else'interrupted','Interrupted; checkpoints preserved.');return 130
 except Exception as e:
  stop();emit('unconfirmed'if a.stage=='delivery'else'failed',str(e));return 1
if __name__=='__main__':raise SystemExit(main())
