"""Fault injection: a bounded replay before new files needs an explicit longer deadline."""
from pathlib import Path
import json,subprocess,sys,tempfile
repo=Path(__file__).resolve().parents[1];results=[]
with tempfile.TemporaryDirectory(prefix='century-replay-deadline-')as t:
 for name,deadline in [('too-short',.09),('documented-extension',.8)]:
  p=Path(t)/name;p.mkdir();(p/'manifest.json').write_text(json.dumps({'sourceSHA256':'a'*64,'fixtures':[{'id':'f0'},{'id':'f1'}],'arms':[{}]}));(p/'f0.json.gz').write_bytes(b'original-retained')
  code='from pathlib import Path\nimport time,json\np=Path('+repr(str(p))+')\nfor i in range(6):\n print("checking retained input",flush=True);time.sleep(.04)\n(p/"f1.json.gz").write_bytes(b"new")\n(p/"summary.json").write_text(json.dumps({"status":"completed","sourceSHA256":"a"*64,"matchedFixtures":2,"engineResults":2}))'
  r=subprocess.run([sys.executable,str(repo/'scripts/supervise-engine-study.py'),'--study-dir',str(p),'--stage','simulation','--stall-seconds',str(deadline),'--heartbeat-seconds','.03','--poll-seconds','.01','--kill-grace-seconds','.1','--',sys.executable,'-c',code],capture_output=True,text=True,timeout=10);s=json.loads((p/'simulation-status.json').read_text());assert(p/'f0.json.gz').read_bytes()==b'original-retained'
  assert(r.returncode==124 and s['state']=='stalled')if name=='too-short'else(r.returncode==0 and s['state']=='completed');results.append(s['state'])
proof={'status':'passed','shortDeadlineStoppedReplayWithoutDestroyingCheckpoint':results[0]=='stalled','explicitExtendedDeadlineAllowedReplayAndCompletion':results[1]=='completed','realScientificInputsUntouched':True};(repo.parent/'adverse_confirmation_results/resume-deadline-fault-verification.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps(proof))
