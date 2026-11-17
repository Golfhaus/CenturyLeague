"""Separate direct-sum verification of all declared compact analyses and denominators."""
import csv,gzip,json,math,statistics,sys
from pathlib import Path
p=Path(sys.argv[1]);a=json.loads((p/'analysis.json').read_text());m=json.loads((p/'manifest.json').read_text());groups={};count=0
with gzip.open(p/'paired-outcomes.csv.gz','rt',newline='')as f:
 for r in csv.DictReader(f):
  g=groups.setdefault(r['fixture'],{'profile':r['profile'],'swap':r['swapped']=='true','arms':{}});assert r['arm']not in g['arms'];r['weather']=json.loads(r.pop('weatherJSON'));r['lab']=json.loads(r.pop('labJSON'));g['arms'][r['arm']]=r;count+=1
expected=10240 if m['stage']=='cold-confirmation'else 1024
assert count==expected*len(m['arms'])and len(groups)==expected;assert all(set(g['arms'])==set(a['cells'])for g in groups.values());allrows=list(groups.values())
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
  if key.startswith('dry'):assert shift==0
checked=0
for saved in a['primaryContrasts']+a['secondaryContrasts']:competitive(allrows,saved);checked+=1
for side in a['primarySides']:
 for saved in side['contrasts']:competitive([g for g in allrows if g['swap']==side['swap']],saved);checked+=1
for saved in a['physicalContrasts']:
 hi,lo=saved['contrast'].split(' minus ');physical(allrows,hi,lo,saved['values'])
for saved in a['interactions']:
 env,d=saved['environment'],saved['direction'];weights={f'{env}-combined-{d}':1,f'{env}-physical-{d}':-1,'psych-'+d:-1,'control':1};assert weights==saved['weights']
 verify_interval([sum(w*100*float(g['arms'][k]['focalWin'])for k,w in weights.items())for g in allrows],saved['values']['winChangePoints'],1.96)
 verify_interval([sum(w*(float(g['arms'][k]['focalScore'])-float(g['arms'][k]['opponentScore']))for k,w in weights.items())for g in allrows],saved['values']['scoreMargin'],1.96)
for key,saved in a['cells'].items():verify_cell(allrows,key,saved)
for b in a['matchups']:
 rows=[g for g in allrows if g['profile']==b['profile']];assert len(rows)==m['trialsPerProfile']and sum(g['swap']for g in rows)==len(rows)//2
 for v in b['contrasts']:
  competitive(rows,v['overall']);checked+=1
  for side in v['sides']:competitive([g for g in rows if g['swap']==side['swap']],side['values']);checked+=1
 for key,saved in b['cells'].items():verify_cell(rows,key,saved)
for key,roles in a['disciplineAndPsychology'].items():
 for role,saved in roles.items():
  total={k:0 for k in ['contacts','fouls','seriousFouls','severityAdjustedProbabilitySum','severityBaselineProbabilitySum','saturatedFixtures']};psych={k:0 for k in saved['meanPsychology']}
  for g in allrows:
   side=int(g['swap'])if role=='focal'else 1-int(g['swap']);lab=g['arms'][key]['lab'];severity=lab['severity'][side];psy=lab['psychology']['contributions'][side]
   for k,v in [('contacts',lab['contacts'][side]),('fouls',severity['opportunities']),('seriousFouls',severity['successes']),('severityAdjustedProbabilitySum',severity['adjustedProbabilitySum']),('severityBaselineProbabilitySum',severity['baselineProbabilitySum']),('saturatedFixtures',int(psy['saturated']))]:total[k]+=v
   for k in psych:psych[k]+=psy[k]
   assert psy['appliedOddsBonus']<=.006+1e-12
  for k,v in total.items():close(v,saved[k])
  close(100*total['fouls']/total['contacts'],saved['foulsPer100Contacts']);close(100*total['seriousFouls']/total['fouls'],saved['seriousPctOfFouls']);close(100*total['saturatedFixtures']/len(allrows),saved['capSaturationPct'])
  for k,v in psych.items():close(v/len(allrows),saved['meanPsychology'][k])
proof={'status':'passed','studyId':m['studyId'],'stage':m['stage'],'fixtureClusters':expected,'outcomes':count,'sourceSHA256':m['sourceSHA256'],'primaryAndAllDeclaredCompetitiveContrastsVerified':True,'competitiveCheckInvocations':checked,'allPhysicalContrastsAndInteractionsVerified':True,'allClubCellsAndDenominatorsVerified':True,'disciplineAndPsychologyVerified':True}
(p/'independent-recomputation.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps(proof))
