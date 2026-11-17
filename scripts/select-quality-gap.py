"""Prespecified pilot eligibility and ranking. Never changes coefficients or expands a grid."""
from pathlib import Path
import hashlib,json,statistics,sys,math

def choose(cells,profile_controls):
 by={v['gap']:v for v in cells};z=by[0];balanced=z['interval'][0]>=.4 and z['interval'][1]<=.6 and all(0<v['wins']<v['n']for v in profile_controls if v['gap']==0);candidates=[]
 for gap in [.05,.1,.2,.35,.5]:
  weak,strong=by[gap],by[-gap];eligible=balanced and weak['interval'][0]>=.2 and weak['interval'][1]<=.45 and strong['interval'][0]>=.55 and strong['interval'][1]<=.8
  eligible=eligible and all(.2<=x['winRate']<=.45 for x in weak['tactics'])and all(.55<=x['winRate']<=.8 for x in strong['tactics'])and all(0<v['wins']<v['n']for v in profile_controls if v['gap']in [gap,-gap])
  assert weak['n']==strong['n'];score=abs(20*weak['wins']-7*weak['n'])+abs(20*strong['wins']-13*strong['n']);candidates.append({'magnitude':gap,'eligible':bool(eligible),'integerDistanceScore':score,'weakerControl':weak['winRate'],'strongerControl':strong['winRate']})
 eligible=sorted((v for v in candidates if v['eligible']),key=lambda x:(x['integerDistanceScore'],x['magnitude']));return balanced,candidates,eligible[0]['magnitude']if eligible else None

def self_test():
 def make():
  cells=[];profiles=[]
  for g in [-.5,-.35,-.2,-.1,-.05,0,.05,.1,.2,.35,.5]:
   wins=256 if g==0 else 180 if g>0 else 332;rate=wins/512;bounds=[rate-.05,rate+.05];cells.append({'gap':g,'n':512,'wins':wins,'winRate':rate,'interval':bounds,'tactics':[{'winRate':rate},{'winRate':rate}]});profiles.append({'gap':g,'wins':wins//8,'n':64})
  return cells,profiles
 c,p=make();balanced,rows,g=choose(c,p);assert balanced and g==.05,'Tie must select smallest gap'
 c,p=make()
 for v in c:
  if abs(v['gap'])!=.2 and v['gap']!=0:v['interval']=[0,1]
 assert choose(c,p)[2]==.2
 c,p=make();c[5]['interval']=[.55,.75];assert choose(c,p)[2]is None
 c,p=make()
 for v in p:
  if v['gap']!=0:v['wins']=0
 assert choose(c,p)[2]is None
 c,p=make();p[5]['wins']=64;assert choose(c,p)[2]is None
 print(json.dumps({'status':'passed','selectionTieAndEligibilityTests':5}))

if __name__=='__main__':
 if sys.argv[1]=='--self-test':self_test();raise SystemExit
 p=Path(sys.argv[1]);read=lambda n:json.loads((p/n).read_text());sha=lambda n:hashlib.sha256((p/n).read_bytes()).hexdigest();m=read('manifest.json');a=read('analysis.json');v=read('ledger-verification.json');i=read('independent-recomputation.json');assert m['studyId']=='quality-control-ladder-001'and m['stage']=='controls';assert len(m['profiles'])==88 and m['trialsPerProfile']==64;assert v['status']==i['status']=='passed';assert v['fullOutcomesVerified']==i['outcomes']==5632
 for proof in [a,v,i]:assert proof['sourceSHA256']==m['sourceSHA256']and proof['harnessSHA256']==m['harnessSHA256']
 for proof in [v,i]:assert proof['compactOutcomesSHA256']==sha('paired-outcomes.csv.gz')and proof['manifestSHA256']==sha('manifest.json')
 assert i['analysisSHA256']==sha('analysis.json');assert len(a['gapCells'])==11 and all(x['n']==512 and x['familySize']==11 for x in a['gapCells']);assert len(a['profileControls'])==88 and all(x['n']==64 for x in a['profileControls'])
 balanced,candidates,gap=choose(a['gapCells'],a['profileControls']);selected=[p0['id']for p0 in m['profiles']if gap is not None and p0['gap']in [0,gap,-gap]];assert len(selected)==(24 if gap else 0)
 result={'schema':'century-quality-gap-selection-v1','studyId':m['studyId'],'confirmed':gap is not None,'sourceSHA256':m['sourceSHA256'],'harnessSHA256':m['harnessSHA256'],'balancedGuardPassed':balanced,'selectedMagnitude':gap,'selectedProfileIDs':selected,'candidates':candidates,'classification':'pilot-fixture-eligibility-only; fresh modifier outcomes required','evidenceSHA256':{n:sha(n)for n in ['manifest.json','analysis.json','ledger-verification.json','independent-recomputation.json','paired-outcomes.csv.gz']}}
 (p/'selection.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
