"""Reconstruct analysis from delivered source, without resimulating or pooling."""
from pathlib import Path
import hashlib,io,json,subprocess,sys,tarfile,tempfile,zipfile
from html.parser import HTMLParser
repo=Path(__file__).resolve().parents[1];archive=Path(sys.argv[1]);sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
class Tables(HTMLParser):
 def __init__(self):super().__init__();self.tables=0;self.active=False;self.row=None;self.width=None
 def handle_starttag(self,t,attrs):
  if t=='table':self.tables+=1;self.active=True;self.width=None
  if t=='tr'and self.active:self.row=0
  if t in ['td','th']and self.row is not None:self.row+=1
 def handle_endtag(self,t):
  if t=='tr'and self.row is not None:
   if self.width is None:self.width=self.row
   assert self.row==self.width;self.row=None
  if t=='table':self.active=False
with tempfile.TemporaryDirectory(prefix='century-hot-qa-')as tmp:
 tmp=Path(tmp);data=tmp/'data';data.mkdir()
 with zipfile.ZipFile(archive)as z:
  assert z.testzip()is None
  for n in z.namelist():assert not Path(n).is_absolute()and'..'not in Path(n).parts
  z.extractall(data)
 checks=json.loads((data/'package-checksums.json').read_text())
 for c in checks:
  f=data/c['path'];assert f.stat().st_size==c['bytes'];assert sha(f)==c['sha256']
 pins=json.loads((data/'reproduction/source-pins.json').read_text());assert sha(data/'reproduction/source.patch')==pins['patchSHA256'];restored=tmp/'source';restored.mkdir()
 with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git','archive',pins['baseCommit']],cwd=repo)))as t:t.extractall(restored,filter='data')
 subprocess.run(['git','apply','--binary',str(data/'reproduction/source.patch')],cwd=restored,check=True)
 m=json.loads((data/'manifest.json').read_text());v=json.loads((data/'ledger-verification.json').read_text());i=json.loads((data/'independent-recomputation.json').read_text());a=json.loads((data/'analysis.json').read_text());assert v['status']==i['status']=='passed';assert v['fullOutcomesVerified']==i['outcomes']==20480;assert a['fixtureClusters']==10240
 for e in [a,v,i]:assert e['sourceSHA256']==m['sourceSHA256']and e['harnessSHA256']==m['harnessSHA256']
 before=[sha(data/name)for name in ['analysis.json','independent-recomputation.json']]
 for name in ['analyze-hot-favored-confirmation.py','recompute-hot-favored-confirmation.py']:subprocess.run([sys.executable,str(restored/'scripts'/name),str(data)],check=True,stdout=subprocess.DEVNULL)
 assert [sha(data/name)for name in ['analysis.json','independent-recomputation.json']]==before
 parser=Tables();text=(data/'Century_Hot_Favored_Confirmation_Report.html').read_text();parser.feed(text);assert parser.tables==6;assert 'NaN'not in text and'undefined'not in text and'<script'not in text;assert(data/'effect-comparison.png').stat().st_size>10000
 proof={'status':'passed','zipCRCVerified':True,'everyPackagedFileHashVerified':True,'analysisExactlyReproducedFromDeliveredPatch':True,'independentProofExactlyReproduced':True,'sixReportTablesAndColumnsVerified':True,'archiveBytes':archive.stat().st_size,'archiveSHA256':sha(archive)};print(json.dumps(proof,indent=2))
 if len(sys.argv)>2:Path(sys.argv[2]).write_text(json.dumps(proof,indent=2)+'\n')
