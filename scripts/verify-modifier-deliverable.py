"""Verify ZIP integrity and reconstruct all analyses from the delivered source patch."""
from pathlib import Path
import hashlib,json,subprocess,sys,tempfile,zipfile,tarfile,io
from html.parser import HTMLParser
repo=Path(__file__).resolve().parents[1];archive=Path(sys.argv[1])
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
class Tables(HTMLParser):
 def __init__(self):super().__init__();self.tables=0;self.width=None;self.row=None;self.active=False
 def handle_starttag(self,tag,attrs):
  if tag=='table':self.tables+=1;self.width=None;self.active=True
  if tag=='tr'and self.active:self.row=0
  if tag in ['td','th']and self.row is not None:self.row+=1
 def handle_endtag(self,tag):
  if tag=='tr'and self.row is not None:
   if self.width is None:self.width=self.row
   assert self.row==self.width,(self.tables,self.row,self.width);self.row=None
  if tag=='table':self.active=False
with tempfile.TemporaryDirectory(prefix='century-deliverable-qa-')as tmp:
 tmp=Path(tmp);data=tmp/'data';data.mkdir()
 with zipfile.ZipFile(archive)as z:
  assert z.testzip()is None
  for n in z.namelist():assert not Path(n).is_absolute()and'..'not in Path(n).parts
  z.extractall(data)
 checks=json.loads((data/'package-checksums.json').read_text())
 for c in checks:
  f=data/c['path'];assert f.stat().st_size==c['bytes'];assert sha(f)==c['sha256']
 pins=json.loads((data/'reproduction/source-pins.json').read_text());assert sha(data/'reproduction/source.patch')==pins['patchSHA256']
 restored=tmp/'source';restored.mkdir();b=subprocess.check_output(['git','archive',pins['baseCommit']],cwd=repo)
 with tarfile.open(fileobj=io.BytesIO(b))as t:t.extractall(restored,filter='data')
 subprocess.run(['git','apply','--binary',str(data/'reproduction/source.patch')],cwd=restored,check=True)
 proofs=[]
 for folder,n,outcomes in [('confirmation',10240,20480),('combined',1024,11264)]:
  d=data/folder;analysis=d/'analysis.json';proof=d/'independent-recomputation.json';prior=(sha(analysis),sha(proof));v=json.loads((d/'ledger-verification.json').read_text());assert v['status']=='passed'and v['fixtureClusters']==n and v['fullOutcomesVerified']==outcomes
  for script in ['analyze-modifier-stage.py','recompute-modifier-stage.py']:
   subprocess.run([sys.executable,str(restored/'scripts'/script),str(d)],check=True,stdout=subprocess.DEVNULL)
  assert (sha(analysis),sha(proof))==prior,'Reconstructed analysis differs from delivered evidence';proofs.append(folder)
 gate=json.loads((data/'confirmation/cold-confirmation-gate.json').read_text());assert gate['confirmed']
 for name,want in gate['evidenceSHA256'].items():assert sha(data/'confirmation'/name)==want
 h=data/'Century_Modifier_Evaluation_Report.html';html=h.read_text();parser=Tables();parser.feed(html);assert parser.tables==8,parser.tables
 assert 'NaN'not in html and'undefined'not in html and'<script'not in html
 assert (data/'effect-comparison.png').stat().st_size>10_000
 proof={'status':'passed','zipCRCVerified':True,'everyPackagedFileSHA256Verified':True,'sourcePatchReconstructed':True,'allAnalysesExactlyReproducedFromDeliveredPatch':proofs,'gateEvidenceHashesVerified':True,'reportTablesAndColumnsVerified':parser.tables,'archiveBytes':archive.stat().st_size,'archiveSHA256':sha(archive)}
 print(json.dumps(proof,indent=2))
 if len(sys.argv)>2:Path(sys.argv[2]).write_text(json.dumps(proof,indent=2)+'\n')
