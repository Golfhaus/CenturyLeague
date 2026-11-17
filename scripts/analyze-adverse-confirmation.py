"""Fixed-stage paired analysis. No resimulation, tuning, or cross-study pooling."""
import csv,gzip,json,math,statistics,sys
from pathlib import Path
p=Path(sys.argv[1]);m=json.loads((p/'manifest.json').read_text());groups={};ids=[a['id']for a in m['arms']]
with gzip.open(p/'paired-outcomes.csv.gz','rt',newline='')as f:
 for r in csv.DictReader(f):
  g=groups.setdefault(r['fixture'],{'profile':r['profile'],'trial':int(r['trial']),'swap':r['swapped']=='true','arms':{}})
  assert (g['profile'],g['trial'],g['swap'])==(r['profile'],int(r['trial']),r['swapped']=='true');assert r['arm']not in g['arms']
  a={k:float(r[k])for k in ['focalWin','focalScore','opponentScore','playingSeconds','focalShots','opponentShots','focalMeanFinalEnergy','opponentMeanFinalEnergy']};a['weather']=json.loads(r['weatherJSON']);a['lab']=json.loads(r['labJSON']);g['arms'][r['arm']]=a
expected=12 if m['studyId'].startswith('adverse-preflight-')else 4096
assert len(groups)==expected and all(set(g['arms'])==set(ids)for g in groups.values());gs=list(groups.values())
def interval(v,z=1.96):
 n=len(v);mean=statistics.mean(v);se=statistics.stdev(v)/math.sqrt(n)
 return {'n':n,'mean':mean,'standardError':se,'interval':[mean-z*se,mean+z*se],'z':z}
def energy(g,arm):
 w=g['arms'][arm]['weather'];return sum(w['energySeconds'][i]/w['activePlayerSeconds'][i]for i in [0,1])/2
def physical_contrast(rows,hi,lo,z=1.96):
 return {'activeEnergyPoints':interval([100*(energy(g,hi)-energy(g,lo))for g in rows],z),
  'durationMinutes':interval([(g['arms'][hi]['playingSeconds']-g['arms'][lo]['playingSeconds'])/60 for g in rows]),
  'combinedScore':interval([sum(g['arms'][hi][k]-g['arms'][lo][k]for k in ['focalScore','opponentScore'])for g in rows])}
def wilson(k,n,z):
 q=k/n;d=1+z*z/n;mid=(q+z*z/2/n)/d;h=z*math.sqrt(q*(1-q)/n+z*z/4/n/n)/d;return max(0,mid-h),min(1,mid+h)
def competitive(rows,hi,lo,family=1):
 z=statistics.NormalDist().inv_cdf(1-.05/(2*family));zw=statistics.NormalDist().inv_cdf(1-.05/(4*family));ds=[];wins=[]
 for g in rows:
  a,b=g['arms'][hi],g['arms'][lo];ds.append(a['focalScore']-a['opponentScore']-b['focalScore']+b['opponentScore']);wins.append(a['focalWin']-b['focalWin'])
 n=len(rows);plus=wins.count(1);minus=wins.count(-1);a,b=wilson(plus,n,zw),wilson(minus,n,zw)
 return {'contrast':hi+' minus '+lo,'n':n,'scoreMargin':interval(ds,z),'winChangePoints':100*statistics.mean(wins),
  'winInterval':[100*(a[0]-b[1]),100*(a[1]-b[0])],'changedToFocal':plus,'changedAgainstFocal':minus,'familySize':family}
def cell(rows,arm):
 out={'n':len(rows),'focalWinRatePct':100*statistics.mean(g['arms'][arm]['focalWin']for g in rows),
  'equalClubWeightedActiveEnergy':statistics.mean(energy(g,arm)for g in rows),'meanMinutes':statistics.mean(g['arms'][arm]['playingSeconds']for g in rows)/60,
  'meanCombinedScore':statistics.mean(sum(g['arms'][arm][k]for k in ['focalScore','opponentScore'])for g in rows),'clubs':{}}
 for role in ['focal','opponent']:
  active=en=extra=checks=shift=shots=0
  for g in rows:
   r=g['arms'][arm];side=int(g['swap'])if role=='focal'else 1-int(g['swap']);w=r['weather'];active+=w['activePlayerSeconds'][side];en+=w['energySeconds'][side];extra+=w['extraRequestedFatigue'][side]
   c=w['probabilities']['kick'][side];checks+=c['opportunities'];shift+=c['adjustedProbabilitySum']-c['baselineProbabilitySum'];shots+=r[role+'Shots']
  out['clubs'][role]={'activeEnergy':en/active,'activePlayerSeconds':active,'requestedExtraFatigue':extra,'extraFatiguePer1000PlayerSeconds':1000*extra/active,
   'meanFinalEnergy':statistics.mean(g['arms'][arm][role+'MeanFinalEnergy']for g in rows),'kickChecks':checks,'directWeatherKickShiftPoints':100*shift/checks,
   'shotsPerMinute':60*shots/sum(g['arms'][arm]['playingSeconds']for g in rows)}
 return out
def telemetry(rows,arm):
 out={}
 for role in ['focal','opponent']:
  contacts=fouls=serious=prob=baseline=cap=0;contributions={k:[]for k in ['confidenceOddsBonus','homeOddsBonus','crowdEnthusiasm','rawOddsBonus','appliedOddsBonus']}
  for g in rows:
   side=int(g['swap'])if role=='focal'else 1-int(g['swap']);lab=g['arms'][arm]['lab'];c=lab['severity'][side]
   contacts+=lab['contacts'][side];fouls+=c['opportunities'];serious+=c['successes'];prob+=c['adjustedProbabilitySum'];baseline+=c['baselineProbabilitySum'];psy=lab['psychology']['contributions'][side];cap+=psy['saturated']
   for k in contributions:contributions[k].append(psy[k])
  out[role]={'contacts':contacts,'fouls':fouls,'seriousFouls':serious,'foulsPer100Contacts':100*fouls/contacts if contacts else None,'seriousPctOfFouls':100*serious/fouls if fouls else None,'severityAdjustedProbabilitySum':prob,'severityBaselineProbabilitySum':baseline,'saturatedFixtures':cap,'capSaturationPct':100*cap/len(rows),'meanPsychology':{k:statistics.mean(v)for k,v in contributions.items()}}
 return out

def binomial(rows,family):
 n=len(rows);wins=sum(int(g['arms']['control']['focalWin'])for g in rows);z=statistics.NormalDist().inv_cdf(1-.05/(2*family));return {'n':n,'wins':wins,'winRate':wins/n,'interval':list(wilson(wins,n,z)),'familySize':family}
def assess(v,ref):
 lo,hi=v['winInterval'];return 'within-reference'if lo>=-ref and hi<=ref else'reference-exceeded'if lo>ref or hi<-ref else'unresolved-at-reference'
pairs=[(arm,'control')for arm in ids if arm!='control'];primary=[competitive(gs,*pair,3)for pair in pairs];control=binomial(gs,2);bounds=[.4,.6]if m['stage']=='matched'else[.55,.8];lo,hi=control['interval'];matchups=[]
for profile in m['profiles']:
 rows=[g for g in gs if g['profile']==profile['id']];n=m['trialsPerProfile'];assert len(rows)==n and sum(g['swap']for g in rows)==n//2 and sorted(g['trial']for g in rows)==list(range(n))
 matchups.append({'profile':profile['id'],'replicate':profile['replicate'],'tactics':profile['tactics'],'gap':profile['gap'],'control':binomial(rows,1),'cells':{arm:cell(rows,arm)for arm in ids},'contrasts':[competitive(rows,*pair)for pair in pairs]})
a={'status':'completed','studyId':m['studyId'],'stage':m['stage'],'fixtureClusters':expected,'outcomes':expected*len(ids),'sourceSHA256':m['sourceSHA256'],'harnessSHA256':m['harnessSHA256'],'freshControl':control,'freshControlTarget':bounds,'freshControlClassification':'within-target'if lo>=bounds[0]and hi<=bounds[1]else'target-not-confirmed','primaryContrasts':primary,'referenceAssessments':[{'contrast':v['contrast'],'referencePoints':ref,'assessment':assess(v,ref)}for v in primary for ref in ([4]if v['contrast'].startswith('psych-')else[10,15])],'cells':{arm:cell(gs,arm)for arm in ids},'disciplineAndPsychology':{arm:telemetry(gs,arm)for arm in ids},'physicalContrasts':[{'contrast':hi+' minus '+lo,'values':physical_contrast(gs,hi,lo)}for hi,lo in pairs],'matchups':matchups,'tactics':[],'sides':[],'limits':'Fresh fixed selected synthetic contexts; one primary family3 across both cohorts; fresh baselines separate family2. Tactic/side/profile contrasts nominal exploratory. No pooled pilot data, coefficient changes, global ceiling, halftime, season effects or adoption.'}
metadata={v['id']:v for v in m['profiles']}
for tactic in ['neutral','pressure']:
 rows=[g for g in gs if metadata[g['profile']]['tactics']==tactic];a['tactics'].append({'tactics':tactic,'n':len(rows),'control':binomial(rows,1),'cells':{arm:cell(rows,arm)for arm in ids},'contrasts':[competitive(rows,*pair)for pair in pairs]})
for side in [False,True]:
 rows=[g for g in gs if g['swap']==side];a['sides'].append({'swap':side,'n':len(rows),'control':binomial(rows,1),'contrasts':[competitive(rows,*pair)for pair in pairs]})
(p/'analysis.json').write_text(json.dumps(a,indent=2)+'\n');print(json.dumps({'status':'completed','studyId':m['studyId'],'control':control,'primary':primary,'references':a['referenceAssessments']},indent=2))
