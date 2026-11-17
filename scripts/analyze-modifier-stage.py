"""Fixed-stage paired analysis. No resimulation, tuning, or cross-study pooling."""
import csv,gzip,json,math,statistics,sys
from pathlib import Path
p=Path(sys.argv[1]);m=json.loads((p/'manifest.json').read_text());groups={};ids=[a['id']for a in m['arms']]
with gzip.open(p/'paired-outcomes.csv.gz','rt',newline='')as f:
 for r in csv.DictReader(f):
  g=groups.setdefault(r['fixture'],{'profile':r['profile'],'trial':int(r['trial']),'swap':r['swapped']=='true','arms':{}})
  assert (g['profile'],g['trial'],g['swap'])==(r['profile'],int(r['trial']),r['swapped']=='true');assert r['arm']not in g['arms']
  a={k:float(r[k])for k in ['focalWin','focalScore','opponentScore','playingSeconds','focalShots','opponentShots','focalMeanFinalEnergy','opponentMeanFinalEnergy']};a['weather']=json.loads(r['weatherJSON']);a['lab']=json.loads(r['labJSON']);g['arms'][r['arm']]=a
expected=10240 if m['stage']=='cold-confirmation'else 1024
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
if m['stage']=='cold-confirmation':
 primary_pairs=[('wet-5-adverse-035','wet-5')];secondary_pairs=[];family=1
else:
 primary_pairs=[(f'{env}-combined-{direction}','control')for env in ['hot','cold']for direction in ['favored','adverse']];family=4
 secondary_pairs=[('psych-'+d,'control')for d in ['favored','adverse']]
 secondary_pairs += [(f'{e}-physical-{d}','control')for e in ['hot','cold']for d in ['favored','adverse']]
 secondary_pairs += [(f'{e}-combined-{d}',f'{e}-physical-{d}')for e in ['hot','cold']for d in ['favored','adverse']]
pairs=primary_pairs+secondary_pairs
primary=[competitive(gs,*pair,family)for pair in primary_pairs]
matchups=[]
for profile in m['profiles']:
 rows=[g for g in gs if g['profile']==profile['id']];n=m['trialsPerProfile'];assert len(rows)==n and sum(g['swap']for g in rows)==n//2;assert sorted(g['trial']for g in rows)==list(range(n))
 comparisons=[]
 for hi,lo in pairs:
  comparisons.append({'overall':competitive(rows,hi,lo,4 if m['stage']=='cold-confirmation'else 1),'sides':[{'swap':side,'values':competitive([g for g in rows if g['swap']==side],hi,lo)}for side in [False,True]]})
 matchups.append({'profile':profile['id'],'focal':profile['teams'][0]['name'],'opponent':profile['teams'][1]['name'],'cells':{arm:cell(rows,arm)for arm in ids},'contrasts':comparisons})
interactions=[]
if m['stage']=='combined':
 for env in ['hot','cold']:
  for direction in ['favored','adverse']:
   weights={f'{env}-combined-{direction}':1,f'{env}-physical-{direction}':-1,'psych-'+direction:-1,'control':1}
   values={}
   for label,fn in [('winChangePoints',lambda r:100*r['focalWin']),('scoreMargin',lambda r:r['focalScore']-r['opponentScore'])]:
    values[label]=interval([sum(w*fn(g['arms'][arm])for arm,w in weights.items())for g in gs])
   interactions.append({'environment':env,'direction':direction,'weights':weights,'values':values})
a={'status':'completed','studyId':m['studyId'],'stage':m['stage'],'fixtureClusters':expected,'outcomes':expected*len(ids),'sourceSHA256':m['sourceSHA256'],
 'primaryContrasts':primary,'secondaryContrasts':[competitive(gs,*pair)for pair in secondary_pairs],
 'primarySides':[{'swap':side,'contrasts':[competitive([g for g in gs if g['swap']==side],*pair)for pair in primary_pairs]}for side in [False,True]],
 'physicalContrasts':[{'contrast':hi+' minus '+lo,'values':physical_contrast(gs,hi,lo)}for hi,lo in pairs],
 'interactions':interactions,'cells':{arm:cell(gs,arm)for arm in ids},'disciplineAndPsychology':{arm:telemetry(gs,arm)for arm in ids},'matchups':matchups,
 'limits':'Fresh fixed samples; selected eight copied clubs/four pairings. Primary combined family four; profile cold family four; other comparisons nominal exploratory. Interactions use paired normal intervals. Physical corners combine weather and opposed tolerance; no shared-mean weather arms in combined stage. No global ceiling, season validation, halftime adaptation or adoption.'}
if m['stage']=='cold-confirmation':a['previousColdScreenSeparate']=json.loads((p/'prior-comparison/cold-screen-analysis.json').read_text())['primary']
(p/'analysis.json').write_text(json.dumps(a,indent=2)+'\n');print(json.dumps({'status':'completed','studyId':m['studyId'],'primary':primary,'interactions':interactions},indent=2))
