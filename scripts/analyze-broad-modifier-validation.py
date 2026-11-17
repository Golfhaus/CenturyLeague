"""Fixed-stage paired analysis. No resimulation, tuning, or cross-study pooling."""
import csv,gzip,json,math,statistics,sys
from pathlib import Path
p=Path(sys.argv[1]);m=json.loads((p/'manifest.json').read_text());groups={};ids=[a['id']for a in m['arms']]
with gzip.open(p/'paired-outcomes.csv.gz','rt',newline='')as f:
 for r in csv.DictReader(f):
  g=groups.setdefault(r['fixture'],{'profile':r['profile'],'trial':int(r['trial']),'swap':r['swapped']=='true','arms':{}})
  assert (g['profile'],g['trial'],g['swap'])==(r['profile'],int(r['trial']),r['swapped']=='true');assert r['arm']not in g['arms']
  a={k:float(r[k])for k in ['focalWin','focalScore','opponentScore','playingSeconds','focalShots','opponentShots','focalMeanFinalEnergy','opponentMeanFinalEnergy']};a['weather']=json.loads(r['weatherJSON']);a['lab']=json.loads(r['labJSON']);g['arms'][r['arm']]=a
expected=16 if m['studyId'].startswith('broad-preflight-')else 2160
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
profiles={p['id']:p for p in m['profiles']};primary_pairs=[('ordinary-'+d,'control')for d in ['favored','adverse']]+[('psych-'+d,'control')for d in ['favored','adverse']];extreme_pairs=[(f'{e}-combined-{d}','control')for e in ['hot','cold']for d in ['favored','adverse']];pairs=primary_pairs+extreme_pairs
copied=[g for g in gs if profiles[g['profile']]['cohort']=='copied'];assert copied
strata=[]
for cohort,quality in [('copied','copied'),('synthetic','matched'),('synthetic','weaker'),('synthetic','stronger')]:
 rows=[g for g in gs if profiles[g['profile']]['cohort']==cohort and profiles[g['profile']]['quality']==quality];assert rows
 b={'cohort':cohort,'quality':quality,'n':len(rows),'cells':{arm:cell(rows,arm)for arm in ids},'disciplineAndPsychology':{arm:telemetry(rows,arm)for arm in ids},'contrasts':[competitive(rows,*pair)for pair in pairs],'physicalContrasts':[{'contrast':hi+' minus '+lo,'values':physical_contrast(rows,hi,lo)}for hi,lo in pairs],'sides':[],'tactics':[],'ordinaryRegimes':[]}
 for side in [False,True]:
  sub=[g for g in rows if g['swap']==side];b['sides'].append({'swap':side,'n':len(sub),'contrasts':[competitive(sub,*pair)for pair in pairs]})
 for tactic in sorted({profiles[g['profile']]['tactics']for g in rows}):
  sub=[g for g in rows if profiles[g['profile']]['tactics']==tactic];b['tactics'].append({'tactics':tactic,'n':len(sub),'cells':{arm:cell(sub,arm)for arm in ids},'contrasts':[competitive(sub,*pair)for pair in pairs]})
 for regime in range(3):
  sub=[g for g in rows if(g['trial']//2)%3==regime]
  if sub:b['ordinaryRegimes'].append({'regime':regime,'n':len(sub),'contrasts':[competitive(sub,'ordinary-'+d,'control')for d in ['favored','adverse']]})
 strata.append(b)
matchups=[]
for profile in m['profiles']:
 rows=[g for g in gs if g['profile']==profile['id']];n=m['trialsPerProfile'];assert len(rows)==n and sum(g['swap']for g in rows)==n//2;assert sorted(g['trial']for g in rows)==list(range(n))
 if not m['studyId'].startswith('broad-preflight-'):assert [sum((g['trial']//2)%3==r for g in rows)for r in range(3)]==[12,12,12]
 matchups.append({'profile':profile['id'],'cohort':profile['cohort'],'quality':profile['quality'],'tactics':profile['tactics'],'focal':profile['teams'][0]['name'],'opponent':profile['teams'][1]['name'],'cells':{arm:cell(rows,arm)for arm in ids},'contrasts':[{'overall':competitive(rows,*pair),'sides':[{'swap':side,'values':competitive([g for g in rows if g['swap']==side],*pair)}for side in [False,True]]}for pair in pairs]})
primary=[competitive(copied,*pair,4)for pair in primary_pairs];extremes=[competitive(copied,*pair,4)for pair in extreme_pairs]
flags=[]
for s in strata:
 for v in s['contrasts']:
  limit=5 if v['contrast'].startswith('ordinary-')else 4 if v['contrast'].startswith('psych-')else 10
  if abs(v['winChangePoints'])>limit:flags.append({'cohort':s['cohort'],'quality':s['quality'],'contrast':v['contrast'],'pointChange':v['winChangePoints'],'interval':v['winInterval'],'reviewReference':limit,'classification':'descriptive-exploratory-not-confirmed-ceiling-failure'})
a={'status':'completed','studyId':m['studyId'],'stage':m['stage'],'fixtureClusters':expected,'outcomes':expected*len(ids),'sourceSHA256':m['sourceSHA256'],'harnessSHA256':m['harnessSHA256'],'primaryCopiedContrasts':primary,'separateCopiedExtremeFamily':extremes,'strata':strata,'matchups':matchups,'descriptiveStratumFlags':flags,'limits':'Breadth screen; copied and generated populations never pooled. Copied ordinary/psych primary family4 and separate copied extreme family4; all cohort-quality/tactic/regime/side/profile intervals nominal exploratory. Fixed selected pairings, not league-average or global-ceiling estimates. Moderate laboratory regimes not empirical season distribution. No season carryover, injuries, halftime, component ablations, new interaction estimate, tuning or adoption.'}
(p/'analysis.json').write_text(json.dumps(a,indent=2)+'\n');print(json.dumps({'status':'completed','primaryCopied':primary,'separateExtremeFamily':extremes,'stratumFlags':flags},indent=2))
