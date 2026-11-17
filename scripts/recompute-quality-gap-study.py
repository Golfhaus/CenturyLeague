"""Separate direct-sum verification of all declared compact analyses and denominators."""
import csv,gzip,json,math,statistics,sys,hashlib
from pathlib import Path
p=Path(sys.argv[1]);a=json.loads((p/'analysis.json').read_text());m=json.loads((p/'manifest.json').read_text());groups={};count=0
with gzip.open(p/'paired-outcomes.csv.gz','rt',newline='')as f:
 for r in csv.DictReader(f):
  g=groups.setdefault(r['fixture'],{'profile':r['profile'],'swap':r['swapped']=='true','arms':{}});assert r['arm']not in g['arms'];r['weather']=json.loads(r.pop('weatherJSON'));r['lab']=json.loads(r.pop('labJSON'));g['arms'][r['arm']]=r;count+=1
expected=36 if m['studyId'].startswith('quality-preflight-')else 5632 if m['stage']=='controls'else 2304
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
if m['stage']=='controls':
 for v in a['gapCells']:
  rows=[g for g in allrows if metadata[g['profile']]['gap']==v['gap']];verify_binomial(rows,v);verify_cell(rows,'control',v['cell']);verify_telemetry(rows,{'control':v['disciplineAndPsychology']})
  for t in v['tactics']:verify_binomial([g for g in rows if metadata[g['profile']]['tactics']==t['tactics']],t)
  for side in v['sides']:verify_binomial([g for g in rows if g['swap']==side['swap']],side)
 for v in a['profileControls']:
  rows=[g for g in allrows if g['profile']==v['profile']];assert len(rows)==m['trialsPerProfile'];verify_binomial(rows,v);verify_cell(rows,'control',v['cell'])
else:
 for b in a['strata']:
  rows=[g for g in allrows if metadata[g['profile']]['quality']==b['quality']];assert len(rows)==b['n'];verify_binomial(rows,b['freshControl']);assert b['freshControl']['familySize']==3;lo,hi=b['freshControl']['interval'];assert b['freshControlClassification']==('within-pilot-target'if lo>=b['freshControlTarget'][0]and hi<=b['freshControlTarget'][1]else'pilot-target-not-confirmed')
  for key,family in [('ordinaryFamily',6),('psychologyFamily',6),('extremeFamily',12),('contrasts',1)]:
   for v in b[key]:assert v['familySize']==family;competitive(rows,v);checked+=1
  for v in b['physicalContrasts']:
   hi,lo=v['contrast'].split(' minus ');physical(rows,hi,lo,v['values'])
  for arm,c in b['cells'].items():verify_cell(rows,arm,c)
  verify_telemetry(rows,b['disciplineAndPsychology'])
  for t in b['tactics']:
   sub=[g for g in rows if metadata[g['profile']]['tactics']==t['tactics']];assert len(sub)==t['n'];verify_binomial(sub,t['control'])
   for arm,c in t['cells'].items():verify_cell(sub,arm,c)
   for v in t['contrasts']:competitive(sub,v);checked+=1
  for side in b['sides']:
   sub=[g for g in rows if g['swap']==side['swap']];assert len(sub)==side['n']
   for v in side['contrasts']:competitive(sub,v);checked+=1
  for regime in b['ordinaryRegimes']:
   sub=[g for g in rows if(int(g['arms']['control']['trial'])//2)%3==regime['regime']];assert len(sub)==regime['n']
   for v in regime['contrasts']:competitive(sub,v);checked+=1
 for b in a['matchups']:
  rows=[g for g in allrows if g['profile']==b['profile']];assert len(rows)==m['trialsPerProfile'];verify_binomial(rows,b['control'])
  for arm,c in b['cells'].items():verify_cell(rows,arm,c)
  for v in b['contrasts']:
   competitive(rows,v['overall']);checked+=1
   for side in v['sides']:competitive([g for g in rows if g['swap']==side['swap']],side['values']);checked+=1
 flags=[]
 for b in a['strata']:
  for v in b['contrasts']:
   limit=5 if v['contrast'].startswith('ordinary-')else 4 if v['contrast'].startswith('psych-')else 10
   if abs(v['winChangePoints'])>limit:flags.append({'quality':b['quality'],'contrast':v['contrast'],'pointChange':v['winChangePoints'],'interval':v['winInterval'],'reviewReference':limit,'classification':'descriptive-screen-flag-not-confirmed-threshold-failure'})
 assert flags==a['descriptiveFlags']
proof={'status':'passed','analysisSHA256':hashlib.sha256((p/'analysis.json').read_bytes()).hexdigest(),'compactOutcomesSHA256':hashlib.sha256((p/'paired-outcomes.csv.gz').read_bytes()).hexdigest(),'manifestSHA256':hashlib.sha256((p/'manifest.json').read_bytes()).hexdigest(),'studyId':m['studyId'],'stage':m['stage'],'sourceSHA256':m['sourceSHA256'],'harnessSHA256':m['harnessSHA256'],'fixtureClusters':expected,'outcomes':count,'allDeclaredContrastsAndControlsVerified':True,'competitiveCheckInvocations':checked,'allPhysicalMetricsAndDenominatorsVerified':True,'allDisciplineAndPsychologyVerified':True}
(p/'independent-recomputation.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps(proof))
