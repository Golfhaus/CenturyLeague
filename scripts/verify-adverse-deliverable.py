"""Reproduce packaged evidence without resimulating or pooling selected outcomes."""
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
with tempfile.TemporaryDirectory(prefix='century-adverse-deliverable-qa-')as t:
 t=Path(t);data=t/'data';data.mkdir()
 with zipfile.ZipFile(archive)as z:
  assert z.testzip()is None
  for n in z.namelist():assert not Path(n).is_absolute()and'..'not in Path(n).parts
  z.extractall(data)
 for c in json.loads((data/'package-checksums.json').read_text()):
  p=data/c['path'];assert p.stat().st_size==c['bytes']and sha(p)==c['sha256']
 pins=json.loads((data/'reproduction/source-pins.json').read_text());assert sha(data/'reproduction/source.patch')==pins['patchSHA256'];source=t/'source';source.mkdir()
 with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(['git','archive',pins['baseCommit']],cwd=repo)))as tar:tar.extractall(source,filter='data')
 subprocess.run(['git','apply','--binary',str(data/'reproduction/source.patch')],cwd=source,check=True)
 rebuilt=t/'profiles.json';subprocess.run(['node','--no-maglev',str(source/'scripts/build-quality-gap-profiles.mjs'),str(rebuilt)],check=True,stdout=subprocess.DEVNULL);assert sha(rebuilt)==sha(data/'reproduction/profiles.json')
 code="import fs from'node:fs';import{sourceFingerprint,verifyBaseline}from'./experiments/v2/tools.mjs';import{verifyAdverseScreen,adverseHarnessFingerprint}from'./scripts/adverse-confirmation-spec.mjs';verifyBaseline();verifyAdverseScreen(process.argv[1],sourceFingerprint(),fs.readFileSync(process.argv[2]));console.log(JSON.stringify({sourceSHA256:sourceFingerprint(),harnessSHA256:adverseHarnessFingerprint()}));"
 identity=json.loads(subprocess.check_output(['node','--no-maglev','--input-type=module','-e',code,str(data/'reproduction/prior-screen'),str(data/'reproduction/profiles.json')],cwd=source,text=True));completed=[];primary=[];refs=[];summary=[]
 for cohort,expectedOutcomes in [('matched',12288),('stronger',8192)]:
  p=data/cohort
  if not(p/'analysis.json').exists():continue
  m=json.loads((p/'manifest.json').read_text());a=json.loads((p/'analysis.json').read_text());v=json.loads((p/'ledger-verification.json').read_text());i=json.loads((p/'independent-recomputation.json').read_text())
  assert m['studyId']=='adverse-'+cohort+'-confirmation-001'and m['trialsPerProfile']==512 and len(m['profiles'])==8
  assert a['fixtureClusters']==4096 and a['outcomes']==v['fullOutcomesVerified']==i['outcomes']==expectedOutcomes and v['status']==i['status']=='passed'
  for x in [m,a,v,i]:assert all(x[k]==value for k,value in identity.items())
  assert sha(data/'ADVERSE_MODIFIER_CONFIRMATION_PLAN_2026_11_16.md')==m['analysisPlan']['protocolSHA256']and sha(data/'reproduction/profiles.json')==m['profileFileSHA256']
  assert a['freshControl']['familySize']==2
  for x in a['primaryContrasts']:
   assert x['familySize']==3;primary.append((cohort,x['contrast']));arm=x['contrast'].split(' minus ')[0];summary.append({'quality':cohort,**x,'modifiedWinRatePct':a['cells'][arm]['focalWinRatePct']})
  refs.extend({'quality':cohort,**x}for x in a['referenceAssessments'])
  before=[sha(p/f)for f in ['analysis.json','independent-recomputation.json']]
  for script in ['analyze-adverse-confirmation.py','recompute-adverse-confirmation.py']:subprocess.run([sys.executable,str(source/'scripts'/script),str(p)],check=True,stdout=subprocess.DEVNULL)
  assert before==[sha(p/f)for f in ['analysis.json','independent-recomputation.json']];completed.append(cohort)
 full=completed==['matched','stronger'];assert full or'--allow-pending'in sys.argv,'Both independent confirmations must finish for final delivery'
 parser=Tables();html=(data/'Century_Adverse_Modifier_Confirmation_Report.html').read_text();parser.feed(html);assert parser.tables==(10 if full else 1)and all(x not in html for x in ['NaN','undefined','<script'])
 if full:
  if(data/'resume-completion.json').exists():
   resumed=json.loads((data/'resume-completion.json').read_text());assert resumed['status']=='completed'and resumed['resumedFixturesVerified']==2004 and resumed['finalPairedSeeds']==4096 and resumed['finalOutcomes']==8192
   assert all(resumed[k]==v for k,v in identity.items())and resumed['sampleExpanded']is False and resumed['duplicatesPooled']is False
   assert json.loads((data/'resume-deadline-fault-verification.json').read_text())['status']=='passed'
  if(data/'environment-recovery.json').exists():
   recovery=json.loads((data/'environment-recovery.json').read_text());assert recovery['state']=='completed-matched-evidence-exactly-reconstructed'
   for name,want in recovery['expectedMatchedSHA256'].items():assert sha(data/'matched'/name)==want
   assert json.loads((data/'recovery-qualification.json').read_text())['status']=='passed'
   original=json.loads((data/'recovery-record-comparison.json').read_text());assert original['status']=='passed'and original['originalSavedRecordsExactlyMatched']==1117
  assert set(primary)=={('matched','psych-adverse minus control'),('matched','hot-combined-adverse minus control'),('stronger','psych-adverse minus control')}
  delivered=json.loads((data/'confirmation-summary.json').read_text());assert delivered['freshResults']==summary and delivered['references']==refs and delivered['primaryFamilySize']==3 and delivered['baselineFamilySize']==2
  assert(data/'adverse-confirmation-comparison.png').stat().st_size>10000
 proof={'status':'passed','zipCRCVerified':True,'allFileHashesVerified':True,'profilesExactlyReconstructed':True,'priorSelectionAndScreenHashesVerified':True,'sourceAndHarnessIdentitiesVerified':True,'analysesAndIndependentProofsExactlyReproduced':True,'comparisonFamiliesAndReportTablesVerified':True,'confirmationSummaryVerified':full,'completedCohorts':completed,'archiveBytes':archive.stat().st_size,'archiveSHA256':sha(archive)};print(json.dumps(proof,indent=2))
 if len(sys.argv)>2:Path(sys.argv[2]).write_text(json.dumps(proof,indent=2)+'\n')
