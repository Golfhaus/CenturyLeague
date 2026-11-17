"""Fault-injection checks for liveness, completed checkpoints and uncertain writes."""
import io,json,os,shutil,signal,subprocess,sys,tarfile,tempfile,time,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];SUP=ROOT/'scripts/supervise-engine-study.py';PLAN=ROOT/'scripts/plan-study-delivery.py'
class SupervisionTests(unittest.TestCase):
 def setUp(self):self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name);self.study=self.root/'study';self.study.mkdir();self.manifest(3)
 def tearDown(self):self.temp.cleanup()
 def manifest(self,n):
  (self.study/'manifest.json').write_text(json.dumps({'sourceSHA256':'a'*64,'fixtures':[{'id':f'f-{i}'}for i in range(n)],'arms':[{},{}]}))
 def run_stage(self,code,stage='simulation',stall=.4):
  return subprocess.run([sys.executable,str(SUP),'--study-dir',str(self.study),'--stage',stage,'--heartbeat-seconds','.05','--poll-seconds','.03','--stall-seconds',str(stall),'--kill-grace-seconds','.1','--',sys.executable,'-c',code],capture_output=True,text=True,timeout=10)
 def status(self,stage='simulation'):return json.loads((self.study/(stage+'-status.json')).read_text())
 def complete(self):
  for i in range(3):(self.study/f'f-{i}.json.gz').write_bytes(b'test-checkpoint')
  (self.study/'summary.json').write_text(json.dumps({'status':'completed','sourceSHA256':'a'*64,'matchedFixtures':3,'engineResults':6}))
 def test_silent_child_is_stopped_with_checkpoint_preserved(self):
  (self.study/'f-0.json.gz').write_bytes(b'partial');r=self.run_stage('import time;time.sleep(20)')
  self.assertEqual(r.returncode,124,r.stderr);self.assertEqual(self.status()['state'],'stalled');self.assertEqual(self.status()['completedFixtures'],1)
  self.assertEqual((self.study/'f-0.json.gz').read_bytes(),b'partial')
  with self.assertRaises(ProcessLookupError):os.kill(self.status()['processId'],0)
 def test_log_spam_does_not_count_as_simulation_progress(self):
  r=self.run_stage('import time\nwhile True:\n print("alive",flush=True);time.sleep(.02)')
  self.assertEqual(r.returncode,124);self.assertEqual(self.status()['state'],'stalled')
 def test_checkpoint_progress_keeps_a_live_run_alive(self):
  code='import time,json\nfrom pathlib import Path\np=Path('+repr(str(self.study))+')\nfor i in range(3):\n time.sleep(.16);(p/("f-"+str(i)+".json.gz")).write_bytes(b"checkpoint")\n(p/"summary.json").write_text(json.dumps({"status":"completed","sourceSHA256":"a"*64,"matchedFixtures":3,"engineResults":6}))'
  r=self.run_stage(code,stall=.3);self.assertEqual(r.returncode,0,r.stderr);self.assertEqual(self.status()['state'],'completed');self.assertGreaterEqual(len(r.stdout.splitlines()),3)
 def test_complete_study_is_not_restarted(self):
  self.complete();r=self.run_stage('raise SystemExit(99)');self.assertEqual(r.returncode,0);self.assertTrue(self.status()['alreadyComplete']);self.assertFalse((self.study/'simulation.log').exists())
 def test_zero_exit_without_complete_results_is_failure(self):
  r=self.run_stage('pass');self.assertEqual(r.returncode,1);self.assertEqual(self.status()['state'],'failed')
 def test_delivery_timeout_blocks_automatic_second_write(self):
  r=self.run_stage('import sys;print("The read operation timed out",file=sys.stderr);sys.exit(1)',stage='delivery')
  self.assertEqual(r.returncode,1);self.assertEqual(self.status('delivery')['state'],'unconfirmed')
  marker=self.root/'second-write';r=self.run_stage('from pathlib import Path;Path('+repr(str(marker))+').touch()',stage='delivery')
  self.assertEqual(r.returncode,2);self.assertFalse(marker.exists())
 def test_successful_delivery_process_still_requires_receipt_checks(self):
  r=self.run_stage('pass',stage='delivery');self.assertEqual(r.returncode,0);self.assertEqual(self.status('delivery')['state'],'awaiting_receipt_check')
  r=self.run_stage('raise SystemExit(99)',stage='delivery');self.assertEqual(r.returncode,2)
 def test_receipt_gate_rejects_partial_delivery_and_accepts_verified_files(self):
  request=self.root/'request.json';receipts=self.root/'receipts.json';status=self.study/'delivery-status.json';path=str(self.root/'report.html')
  request.write_text(json.dumps({'uploads':[{'local_path':path}]}));receipts.write_text(json.dumps({'results':[{'local_path':path,'status':'failed'}]}))
  command=[sys.executable,str(ROOT/'scripts/confirm-study-delivery.py'),str(request),str(receipts),str(status)]
  r=subprocess.run(command,capture_output=True,text=True);self.assertEqual(r.returncode,1);self.assertEqual(self.status('delivery')['state'],'unconfirmed')
  receipts.write_text(json.dumps({'results':[{'local_path':path,'status':'succeeded','local_metadata_applied':True,'library_file_id':'libfile_test','file_id':'file_test'}]}))
  r=subprocess.run(command,capture_output=True,text=True);self.assertEqual(r.returncode,0);self.assertEqual(self.status('delivery')['verifiedFiles'],1)
 def test_new_delivery_plan_prioritizes_small_files_and_preserves_inputs(self):
  bulk=self.root/'events.tar';core=self.root/'report.html';bulk.write_bytes(b'event');core.write_text('report');request=self.root/'uploads.json'
  items=[{'local_path':str(q),'purpose':'create_library_file'}for q in [bulk,core]];request.write_text(json.dumps({'uploads':items}));before=request.read_bytes();dest=self.root/'plan'
  r=subprocess.run([sys.executable,str(PLAN),str(request),str(dest)],capture_output=True,text=True);self.assertEqual(r.returncode,0,r.stderr)
  self.assertEqual(json.loads((dest/'review-files.json').read_text())['uploads'],[items[1]]);self.assertEqual(request.read_bytes(),before)
 def test_unconfirmed_delivery_cannot_be_reordered(self):
  q=self.root/'uploads.json';q.write_text('{"uploads":[]}');state=self.root/'state.json';state.write_text('{"status":"unconfirmed-after-timeout"}');dest=self.root/'plan'
  r=subprocess.run([sys.executable,str(PLAN),str(q),str(dest),'--attempt-status',str(state)],capture_output=True,text=True)
  self.assertNotEqual(r.returncode,0);self.assertFalse(dest.exists())

class WorkerExitTests(unittest.TestCase):
 def test_compact_report_needs_no_bulk_archives_or_temporary_proof_files(self):
  with tempfile.TemporaryDirectory(prefix='century-compact-report-')as folder:
   out=Path(folder)/'review';sources=ROOT.parent/'factorial_sources'
   r=subprocess.run([sys.executable,str(ROOT/'scripts/report-weather-factorial.py'),str(ROOT),str(out),str(sources),'--compact-only','--evidence-dir',str(Path(folder)/'empty-evidence')],capture_output=True,text=True,timeout=60)
   self.assertEqual(r.returncode,0,r.stderr);self.assertFalse(list(out.glob('*.tar')))
   self.assertEqual(json.loads((out/'archive-status.json').read_text())['state'],'deferred')
   items=json.loads((out/'uploads.json').read_text())['uploads'];self.assertEqual(len(items),2)
   self.assertTrue(all(v=='unavailable'for v in json.loads((out/'evidence-status.json').read_text()).values()))
   self.assertLess(sum(Path(x['local_path']).stat().st_size for x in items),20*1048576)
   expected=json.loads((ROOT.parent/'factorial_results/independent-analysis.json').read_text())
   self.assertEqual(json.loads((out/'independent-analysis.json').read_text())['overall'],expected['overall'])
 def test_report_does_not_overwrite_an_uncertain_delivery(self):
  with tempfile.TemporaryDirectory()as folder:
   out=Path(folder);state=out/'save-status.json';state.write_text('{"status":"unconfirmed-after-timeout"}');sentinel=out/'manifest.json';sentinel.write_text('preserve-this')
   r=subprocess.run([sys.executable,str(ROOT/'scripts/report-weather-factorial.py'),str(ROOT),str(out),str(ROOT.parent/'factorial_sources'),'--compact-only'],capture_output=True,text=True)
   self.assertNotEqual(r.returncode,0);self.assertEqual(sentinel.read_text(),'preserve-this');self.assertIn('unconfirmed',r.stderr)
 def test_actual_runners_reject_an_unexpected_zero_exit(self):
  # An isolated tracked checkout prevents fake workers from touching real studies.
  with tempfile.TemporaryDirectory(prefix='century-worker-exit-')as folder:
   root=Path(folder);archive=subprocess.run(['git','archive','HEAD'],cwd=ROOT,capture_output=True,check=True).stdout
   with tarfile.open(fileobj=io.BytesIO(archive))as tar:tar.extractall(root,filter='data')
   for name in ['run-streaks.mjs','run-thermal-reduction.mjs','run-weather-factorial.mjs']:
    shutil.copy2(ROOT/'experiments/v2'/name,root/'experiments/v2'/name)
   for name in ['streak-worker.mjs','factorial-worker.mjs']:(root/'experiments/v2'/name).write_text('process.exit(0);\n')
   profiles=ROOT.parent/'factorial_sources/copied-profiles.json';self.assertTrue(profiles.is_file())
   commands=[['run-streaks.mjs','--arms','psychology-weather-confirm','--psychology-candidate','reduced-020'],['run-thermal-reduction.mjs','--cohort','main'],['run-weather-factorial.mjs']]
   for i,command in enumerate(commands):
    with self.subTest(runner=command[0]):
     cmd=['node',str(root/'experiments/v2'/command[0]),*command[1:],'--study-id',f'exit-zero-test-{i}','--trials','2','--workers','2','--profiles',str(profiles)]
     process=subprocess.Popen(cmd,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,start_new_session=True)
     try:out,err=process.communicate(timeout=15)
     except subprocess.TimeoutExpired:
      os.killpg(process.pid,signal.SIGKILL);process.communicate();self.fail('Runner hung after a worker exited with code 0')
     self.assertNotEqual(process.returncode,0,out+err);self.assertIn('before the study completed',out+err)
if __name__=='__main__':unittest.main(verbosity=2)
