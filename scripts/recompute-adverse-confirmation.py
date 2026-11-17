"""Separate direct-sum verification of all declared compact analyses and denominators."""
import csv,gzip,json,math,statistics,sys,hashlib
from pathlib import Path
p=Path(sys.argv[1]);a=json.loads((p/'analysis.json').read_text());m=json.loads((p/'manifest.json').read_text());groups={};count=0
with gzip.open(p/'paired-outcomes.csv.gz','rt',newline='')as f:
 for r in csv.DictReader(f):
  g=groups.setdefault(r['fixture'],{'profile':r['profile'],'swap':r['swapped']=='true','arms':{}});assert r['arm']not in g['arms'];r['weather']=json.loads(r.pop('weatherJSON'));r['lab']=json.loads(r.pop('labJSON'));g['arms'][r['arm']]=r;count+=1
expected=12 if m['studyId'].startswith('adverse-preflight-')else 4096
assert count==expected*len(m['arms'])and len(groups)==expected;assert all(set(g['arms'])==set(x['id']for x in m['arms'])for g in groups.values());allrows=list(groups.values())
def close(x,y):assert math.isclose(x,y,rel_tol=1e-9,abs_tol=1e-9),(x,y)
def verify_interval(values,saved,z):
 n=len(values);total=math.fsum(values);mean=total/n;se=math.sqrt(max(0,math.fsum(v*v for v in values)-total*total/n)/(n*(n-1)))
 assert saved['n']==n;close(mean,saved['mean']);close(se,saved['standardError']);close(z,saved['z'])
 for x,y in zip([mean-z*se,mean+z*se],saved['interval']):close(x,y)
def energy(g,key):
 w=g['arms'][key]['weather'];return .5*(w['energySeconds'][0]/w['activePlayerSeconds'][0]+w['energySeconds'][1]/w['activePlayerSeconds'][1])
def physical(rows,hi,lo,saved,z=1.96):
 verify_interval([100*(energy(g,hi)-energy(g,lo))for g in rows],saved['activeEnergyPoints'],z)
 verify_interval([(float(g['arms'][hi]['playingSeconds'])-float(g['arms'][lo]['playingSeconds']))/60 for g in rows],saved['durationMinutes'],1.96)
 verify_interval([sum(float(g['arms'][hi][k])-float(g['arms'][lo][k])for k in ['focalScore','opponentScore'])for g in rows],saved['combinedScore'],1.96)
def wilson(k,n,z):
 d=n+z*z;mid=(k+z*z/2)/d;h=z*math.sqrt(k*(n-k)/n+z*z/4)/d;return max(0,mid-h),min(1,mid+h)
def competitive(rows,saved):
 hi,lo=saved['contrast'].split(' minus ');family=saved['familySize'];z=statistics.NormalDist().inv_cdf(1-.05/(2*family));zw=statistics.NormalDist().inv_cdf(1-.05/(4*family));values=[];plus=minus=0
 for g in rows:
  h,c=g['arms'][hi],g['arms'][lo];values.append(float(h['focalScore'])-float(c['focalScore'])-float(h['opponentScore'])+float(c['opponentScore']));d=int(float(h['focalWin']))-int(float(c['focalWin']));plus+=d==1;minus+=d==-1
 n=len(rows);verify_interval(values,saved['scoreMargin'],z);assert plus==saved['changedToFocal']and minus==saved['changedAgainstFocal'];close(100*(plus-minus)/n,saved['winChangePoints']);x,y=wilson(plus,n,zw),wilson(minus,n,zw)
 for want,got in zip([100*(x[0]-y[1]),100*(x[1]-y[0])],saved['winInterval']):close(want,got)
def verify_cell(rows,key,saved):
 n=len(rows);assert saved['n']==n;close(sum(float(g['arms'][key]['focalWin'])for g in rows)*100/n,saved['focalWinRatePct']);close(sum(energy(g,key)for g in rows)/n,saved['equalClubWeightedActiveEnergy'])
 close(sum(float(g['arms'][key]['playingSeconds'])for g in rows)/n/60,saved['meanMinutes'])
 close(sum(float(g['arms'][key]['focalScore'])+float(g['arms'][key]['opponentScore'])for g in rows)/n,saved['meanCombinedScore'])
 for role in ['focal','opponent']:
  en=active=fatigue=checks=shift=0
  for g in rows:
   w=g['arms'][key]['weather'];side=int(g['swap'])if role=='focal'else 1-int(g['swap']);en+=w['energySeconds'][side];active+=w['activePlayerSeconds'][side];fatigue+=w['extraRequestedFatigue'][side];c=w['probabilities']['kick'][side];checks+=c['opportunities'];shift+=c['adjustedProbabilitySum']-c['baselineProbabilitySum']
  got=saved['clubs'][role];close(active,got['activePlayerSeconds']);close(fatigue,got['requestedExtraFatigue']);close(60*sum(float(g['arms'][key][role+'Shots'])for g in rows)/sum(float(g['arms'][key]['playingSeconds'])for g in rows),got['shotsPerMinute']);close(en/active,got['activeEnergy']);close(1000*fatigue/active,got['extraFatiguePer1000PlayerSeconds']);close(100*shift/checks,got['directWeatherKickShiftPoints']);assert checks==got['kickChecks']
  close(sum(float(g['arms'][key][role+'MeanFinalEnergy'])for g in rows)/n,got['meanFinalEnergy'])
  if key=='control':assert shift==0
def verify_telemetry(allrows,saved_telemetry):
 for key,roles in saved_telemetry.items():
  for role,saved in roles.items():
   total={k:0 for k in ['contacts','fouls','seriousFouls','severityAdjustedProbabilitySum','severityBaselineProbabilitySum','saturatedFixtures']};psych={k:0 for k in saved['meanPsychology']}
   for g in allrows:
    side=int(g['swap'])if role=='focal'else 1-int(g['swap']);lab=g['arms'][key]['lab'];severity=lab['severity'][side];psy=lab['psychology']['contributions'][side]
    for k,v in [('contacts',lab['contacts'][side]),('fouls',severity['opportunities']),('seriousFouls',severity['successes']),('severityAdjustedProbabilitySum',severity['adjustedProbabilitySum']),('severityBaselineProbabilitySum',severity['baselineProbabilitySum']),('saturatedFixtures',int(psy['saturated']))]:total[k]+=v
    for k in psych:psych[k]+=psy[k]
    assert psy['appliedOddsBonus']<=.006+1e-12
   for k,v in total.items():close(v,saved[k])
   
   if total['contacts']:close(100*total['fouls']/total['contacts'],saved['foulsPer100Contacts'])
   else:assert saved['foulsPer100Contacts']is None
   if total['fouls']:close(100*total['seriousFouls']/total['fouls'],saved['seriousPctOfFouls'])
   else:assert saved['seriousPctOfFouls']is None
   close(100*total['saturatedFixtures']/len(allrows),saved['capSaturationPct'])
   for k,v in psych.items():close(v/len(allrows),saved['meanPsychology'][k])
metadata={p['id']:p for p in m['profiles']};checked=0
def verify_binomial(rows,v):
 n=len(rows);wins=sum(int(float(g['arms']['control']['focalWin']))for g in rows);assert v['n']==n and v['wins']==wins;close(v['winRate'],wins/n);z=statistics.NormalDist().inv_cdf(1-.05/(2*v['familySize']));want=wilson(wins,n,z)
 for x,y in zip(want,v['interval']):close(x,y)

assert a['fixtureClusters']==expected and a['outcomes']==count and a['sourceSHA256']==m['sourceSHA256']and a['harnessSHA256']==m['harnessSHA256']
assert a['freshControl']['familySize']==2;verify_binomial(allrows,a['freshControl']);bounds=[.4,.6]if m['stage']=='matched'else[.55,.8];assert bounds==a['freshControlTarget'];lo,hi=a['freshControl']['interval'];assert a['freshControlClassification']==('within-target'if lo>=bounds[0]and hi<=bounds[1]else'target-not-confirmed')
assert {v['contrast']for v in a['primaryContrasts']}=={arm['id']+' minus control'for arm in m['arms']if arm['id']!='control'}
for v in a['primaryContrasts']:assert v['familySize']==3;competitive(allrows,v);checked+=1
refs=[]
for v in a['primaryContrasts']:
 for ref in ([4]if v['contrast'].startswith('psych-')else[10,15]):
  lo,hi=v['winInterval'];decision='within-reference'if lo>=-ref and hi<=ref else'reference-exceeded'if hi<-ref or lo>ref else'unresolved-at-reference';refs.append({'contrast':v['contrast'],'referencePoints':ref,'assessment':decision})
assert refs==a['referenceAssessments']
for arm,c in a['cells'].items():verify_cell(allrows,arm,c)
verify_telemetry(allrows,a['disciplineAndPsychology'])
for v in a['physicalContrasts']:
 hi,lo=v['contrast'].split(' minus ');physical(allrows,hi,lo,v['values'])
for v in a['matchups']:
 rows=[g for g in allrows if g['profile']==v['profile']];n=m['trialsPerProfile'];assert len(rows)==n and sum(g['swap']for g in rows)==n//2 and sorted(int(g['arms']['control']['trial'])for g in rows)==list(range(n));verify_binomial(rows,v['control'])
 for arm,c in v['cells'].items():verify_cell(rows,arm,c)
 for c in v['contrasts']:assert c['familySize']==1;competitive(rows,c);checked+=1
for kind in ['tactics','sides']:
 for v in a[kind]:
  rows=[g for g in allrows if(metadata[g['profile']]['tactics']==v['tactics']if kind=='tactics'else g['swap']==v['swap'])];assert len(rows)==v['n'];verify_binomial(rows,v['control'])
  for arm,c in v.get('cells',{}).items():verify_cell(rows,arm,c)
  for c in v['contrasts']:assert c['familySize']==1;competitive(rows,c);checked+=1
sha=lambda n:hashlib.sha256((p/n).read_bytes()).hexdigest();v=json.loads((p/'ledger-verification.json').read_text());assert v['status']=='passed'and v['fullOutcomesVerified']==count and v['sourceSHA256']==m['sourceSHA256']and v['harnessSHA256']==m['harnessSHA256']and v['compactOutcomesSHA256']==sha('paired-outcomes.csv.gz')and v['manifestSHA256']==sha('manifest.json')
proof={'status':'passed','analysisSHA256':sha('analysis.json'),'compactOutcomesSHA256':sha('paired-outcomes.csv.gz'),'manifestSHA256':sha('manifest.json'),'studyId':m['studyId'],'stage':m['stage'],'sourceSHA256':m['sourceSHA256'],'harnessSHA256':m['harnessSHA256'],'fixtureClusters':expected,'outcomes':count,'allDeclaredContrastsAndControlsVerified':True,'competitiveCheckInvocations':checked,'allPhysicalMetricsAndDenominatorsVerified':True,'allDisciplineAndPsychologyVerified':True,'allReferenceDecisionsVerified':True};(p/'independent-recomputation.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps(proof))
