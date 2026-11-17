"""Reconstruct completed quality stages from their delivered compact evidence."""
from pathlib import Path
from html.parser import HTMLParser
import hashlib,io,json,subprocess,sys,tarfile,tempfile,zipfile
repo=Path(__file__).resolve().parents[1];archive=Path(sys.argv[1]);sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
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
with tempfile.TemporaryDirectory(prefix='century-quality-delivery-qa-')as name:
 tmp=Path(name);data=tmp/'data';data.mkdir()
 with zipfile.ZipFile(archive)as z:
  assert z.testzip()is None
  for n in z.namelist():assert not Path(n).is_absolute()and'..'not in Path(n).parts
  z.extractall(data)
 for c in json.loads((data/'package-checksums.json').read_text()):
  f=data/c['path'];assert f.stat().st_size==c['bytes']and sha(f)==c['sha256']
 pins=json.loads((data/'reproduction/source-pins.json').read_text());assert sha(data/'reproduction/source.patch')==pins['patchSHA256'];source=tmp/'source';source.mkdir()
 with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git','archive',pins['baseCommit']],cwd=repo)))as t:t.extractall(source,filter='data')
 subprocess.run(['git','apply','--binary',str(data/'reproduction/source.patch')],cwd=source,check=True)
 rebuilt=tmp/'profiles.json';subprocess.run(['node','--no-maglev',str(source/'scripts/build-quality-gap-profiles.mjs'),str(rebuilt)],check=True,stdout=subprocess.DEVNULL)
 assert sha(rebuilt)==sha(data/'reproduction/profiles.json'),'Generated profile bytes differ'
 completed=[]
 for folder,n,outcomes,families in [('controls',5632,5632,None),('modifiers',2304,20736,{'ordinaryFamily':6,'psychologyFamily':6,'extremeFamily':12})]:
  p=data/folder
  if not(p/'analysis.json').exists():continue
  m=json.loads((p/'manifest.json').read_text());a=json.loads((p/'analysis.json').read_text());v=json.loads((p/'ledger-verification.json').read_text());i=json.loads((p/'independent-recomputation.json').read_text())
  assert sha(data/'QUALITY_GAP_LADDER_AND_VALIDATION_PLAN_2026_11_15.md')==m['analysisPlan']['protocolSHA256']
  assert a['fixtureClusters']==n and a['outcomes']==outcomes and v['status']==i['status']=='passed'and v['fullOutcomesVerified']==i['outcomes']==outcomes
  for e in [a,v,i]:assert e['sourceSHA256']==m['sourceSHA256']and e['harnessSHA256']==m['harnessSHA256']
  if families:
   assert len(a['strata'])==3 and len(a['matchups'])==24
   for s in a['strata']:
    assert s['freshControl']['familySize']==3 and s['n']==768
    for key,family in families.items():assert all(x['familySize']==family for x in s[key])and len(s[key])==(4 if family==12 else 2)
   reported=json.loads((data/'reference-assessments.json').read_text())['contrasts'];expected=[]
   for key,ref in [('ordinaryFamily',5),('psychologyFamily',4),('extremeFamily',10)]:
    for s in a['strata']:
     for v in s[key]:
      low,high=v['winInterval'];category='within-reference'if low>=-ref and high<=ref else'reference-exceeded'if low>ref or high<-ref else'unresolved-at-reference'
      expected.append({'quality':s['quality'],'contrast':v['contrast'],'familySize':v['familySize'],'changePoints':v['winChangePoints'],'protectedInterval':v['winInterval'],'referencePoints':ref,'referenceAssessment':category})
   assert reported==expected
  else:assert len(a['gapCells'])==11 and len(a['profileControls'])==88 and all(x['familySize']==11 and x['n']==512 for x in a['gapCells'])
  before=[sha(p/f)for f in ['analysis.json','independent-recomputation.json']]
  for script in ['analyze-quality-gap-study.py','recompute-quality-gap-study.py']:subprocess.run([sys.executable,str(source/'scripts'/script),str(p)],check=True,stdout=subprocess.DEVNULL)
  assert before==[sha(p/f)for f in ['analysis.json','independent-recomputation.json']]
  completed.append(folder)
 assert 'controls'in completed
 control=data/'controls';before=[sha(control/f)for f in ['selection.json','selection-verification.json']]
 for script in ['select-quality-gap.py','verify-quality-gap-selection.py']:subprocess.run([sys.executable,str(source/'scripts'/script),str(control)],check=True,stdout=subprocess.DEVNULL)
 assert before==[sha(control/f)for f in ['selection.json','selection-verification.json']]
 g=json.loads((control/'selection.json').read_text());pending=g['confirmed']and'modifiers'not in completed
 assert not pending or'--allow-pending'in sys.argv,'Final delivery must include the authorized completed follow-up if eligible'
 parser=Tables();html=(data/'Century_Quality_Gap_Validation_Report.html').read_text();parser.feed(html);assert parser.tables==(12 if'modifiers'in completed else 2)
 assert all(t not in html for t in ['NaN','undefined','<script'])and(data/'quality-control-curve.png').stat().st_size>10000
 if'modifiers'in completed:assert(data/'modifier-effect-intervals.png').stat().st_size>10000
 proof={'status':'passed','zipCRCVerified':True,'everyPackagedFileHashVerified':True,'profilesExactlyReconstructed':True,'analysisAndIndependentProofsExactlyReproduced':True,'selectionAndIndependentProofExactlyReproduced':True,'familiesAndReportTablesVerified':True,'completedStages':completed,'selectedMagnitude':g['selectedMagnitude'],'archiveBytes':archive.stat().st_size,'archiveSHA256':sha(archive)}
 print(json.dumps(proof,indent=2))
 if len(sys.argv)>2:Path(sys.argv[2]).write_text(json.dumps(proof,indent=2)+'\n')
