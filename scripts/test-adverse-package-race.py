"""Fault injection: volatile progress changes during packaging cannot invalidate checksums."""
from pathlib import Path
import hashlib,json,shutil,subprocess,sys,tempfile,threading,time,zipfile
repo=Path(__file__).resolve().parents[1];source=repo.parent/'adverse_confirmation_results'
with tempfile.TemporaryDirectory(prefix='century-package-race-')as t:
 t=Path(t);out=t/'results';shutil.copytree(source,out,ignore=shutil.ignore_patterns('qualification-*'));archive=t/'test.zip';stop=threading.Event();counter=[0]
 def mutate():
  while not stop.is_set():
   counter[0]+=1;tmp=out/'workflow-status.injected.tmp';tmp.write_text(json.dumps({'stage':'fault-injected-progress-only','counter':counter[0]}));tmp.replace(out/'workflow-status.json');time.sleep(.005)
 worker=threading.Thread(target=mutate);worker.start()
 try:subprocess.run([sys.executable,str(repo/'scripts/package-adverse-confirmation.py'),str(out),str(archive)],check=True,stdout=subprocess.DEVNULL)
 finally:stop.set();worker.join()
 assert counter[0]>10
 with zipfile.ZipFile(archive)as z:
  assert z.testzip()is None
  for c in json.loads(z.read('package-checksums.json')):
   b=z.read(c['path']);assert len(b)==c['bytes']and hashlib.sha256(b).hexdigest()==c['sha256']
  assert json.loads(z.read('workflow-status.json'))['counter']>0
 proof={'status':'passed','progressChangedDuringPackaging':True,'progressUpdatesInjected':counter[0],'allFrozenByteChecksumsVerified':True,'zipCRCVerified':True,'actualScientificInputsAndProgressUntouched':True};(source/'package-race-fault-verification.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps(proof))
