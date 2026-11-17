"""Paired heat-only analysis from audited CSV; no model tuning."""
import csv,gzip,json,math,statistics,sys
from pathlib import Path
from collections import defaultdict
p=Path(sys.argv[1]);prior=Path(sys.argv[2]);m=json.loads((p/'manifest.json').read_text());groups={}
with gzip.open(p/'paired-outcomes.csv.gz','rt',newline='')as f:
 for r in csv.DictReader(f):
  g=groups.setdefault(r['fixture'],{'profile':r['profile'],'pairId':r['pairId'],'swap':r['swapped']=='true','trial':int(r['trial']),'arms':{}})
  assert (g['profile'],g['pairId'],g['swap'],g['trial'])==(r['profile'],r['pairId'],r['swapped']=='true',int(r['trial']))
  assert r['arm']not in g['arms'];a={k:float(r[k])for k in ['focalWin','focalScore','opponentScore','playingSeconds','focalShots','opponentShots','focalMeanFinalEnergy','opponentMeanFinalEnergy']}
  a['weather']=json.loads(r['weatherJSON']);g['arms'][r['arm']]=a
assert len(groups)==3200 and all(set(g['arms'])=={'temperate','hot'}for g in groups.values())
Z=statistics.NormalDist().inv_cdf(1-.05/8);ZW=statistics.NormalDist().inv_cdf(1-.05/16)
def mean_interval(v,z=1.96):
 n=len(v);avg=statistics.mean(v);se=statistics.stdev(v)/math.sqrt(n)
 return {'n':n,'mean':avg,'standardError':se,'interval':[avg-z*se,avg+z*se],'z':z}
def wilson(k,n,z):
 q=k/n;d=1+z*z/n;mid=(q+z*z/2/n)/d;h=z*math.sqrt(q*(1-q)/n+z*z/4/n/n)/d
 return [max(0,mid-h),min(1,mid+h)]
def contrast(gs,z=Z,zw=ZW):
 margins=[];wins=[];minutes=[];scores=[]
 for g in gs:
  c,h=g['arms']['temperate'],g['arms']['hot'];margins.append(h['focalScore']-h['opponentScore']-c['focalScore']+c['opponentScore']);wins.append(h['focalWin']-c['focalWin'])
  minutes.append((h['playingSeconds']-c['playingSeconds'])/60);scores.append(h['focalScore']+h['opponentScore']-c['focalScore']-c['opponentScore'])
 n=len(gs);plus=wins.count(1);minus=wins.count(-1);a,b=wilson(plus,n,zw),wilson(minus,n,zw)
 return {'scoreMargin':mean_interval(margins,z),'winChangePoints':100*statistics.mean(wins),'winConservativeFamily95':[100*(a[0]-b[1]),100*(a[1]-b[0])],
  'changedToFocal':plus,'changedAgainstFocal':minus,'unchangedWinner':n-plus-minus,'durationMinutes':mean_interval(minutes),'totalScore':mean_interval(scores)}
def cell(gs,arm):
 rows=[g['arms'][arm]for g in gs];n=len(rows);out={'n':n,'focalWinRatePct':100*sum(r['focalWin']for r in rows)/n,
 'focalMeanScore':statistics.mean(r['focalScore']for r in rows),'opponentMeanScore':statistics.mean(r['opponentScore']for r in rows),
 'meanMinutes':statistics.mean(r['playingSeconds']for r in rows)/60,'clubs':{}}
 for role in ['focal','opponent']:
  energy=active=extra=checks=shift=shots=0
  for g,r in zip(gs,rows):
   side=int(g['swap'])if role=='focal'else 1-int(g['swap']);w=r['weather'];energy+=w['energySeconds'][side];active+=w['activePlayerSeconds'][side];extra+=w['extraRequestedFatigue'][side]
   t=w['probabilities']['kick'][side];checks+=t['opportunities'];shift+=t['adjustedProbabilitySum']-t['baselineProbabilitySum'];shots+=r[role+'Shots']
  out['clubs'][role]={'meanFinalEnergy':statistics.mean(r[role+'MeanFinalEnergy']for r in rows),'timeWeightedActiveEnergy':energy/active,
   'activePlayerSeconds':active,'extraRequestedFatigue':extra,'extraFatiguePer1000PlayerSeconds':1000*extra/active,
   'kickChecks':checks,'directWeatherKickShiftPoints':100*shift/checks,'shotsPerMinute':60*shots/sum(r['playingSeconds']for r in rows)}
 return out
blocks=[]
for profile in m['profiles']:
 gs=[g for g in groups.values()if g['profile']==profile['id']];assert len(gs)==800 and sum(g['swap']for g in gs)==400
 assert sorted(g['trial']for g in gs)==list(range(800))
 blocks.append({'profile':profile['id'],'pairId':profile['pairId'],'focal':profile['teams'][0]['name'],'opponent':profile['teams'][1]['name'],
 'contrast':contrast(gs),'cells':{a:cell(gs,a)for a in ['temperate','hot']},
 'sideChecks':[{'swap':side,'interpretation':'exploratory nominal intervals','contrast':contrast([g for g in gs if g['swap']==side],1.96,statistics.NormalDist().inv_cdf(1-.05/4))}for side in [False,True]]})
# The old factorial focal club was Philadelphia, reciprocal of new Norfolk focal.
old=json.loads((prior/'summary.json').read_text());oldvalues=[];oldwins=[]
for g in old['records']:
 a={r['id']:r for r in g['arms']};c,h=a['original-0'],a['original-1'];oldvalues.append(h['focalScore']-h['opponentScore']-c['focalScore']+c['opponentScore']);oldwins.append(h['focalWin']-c['focalWin'])
norfolk=next(b for b in blocks if b['pairId']=='pair-3');new=norfolk['contrast']['scoreMargin'];priorheat=mean_interval(oldvalues)
newphil={'mean':-new['mean'],'standardError':new['standardError'],'interval':[-new['interval'][1],-new['interval'][0]]}
difference=newphil['mean']-priorheat['mean'];se=math.hypot(newphil['standardError'],priorheat['standardError'])
analysis={'status':'completed','fixtureClusters':3200,'outcomes':6400,'sourceSHA256':m['sourceSHA256'],'primaryFamilyZ':Z,'winFamilyWilsonZ':ZW,'matchups':blocks,
 'priorPureHeatComparison':{'interpretation':'Separate fresh samples, original tactics, heat only at 80% humidity; this is not the prior Shapley allocation.',
 'priorStudy':old['studyId'],'priorPhiladelphiaPureHeat':priorheat,'newPhiladelphiaPureHeat':newphil,'priorWinChangePoints':100*statistics.mean(oldwins),
 'newWinChangePoints':-norfolk['contrast']['winChangePoints'],'newMinusPriorMargin':{'mean':difference,'nominal95':[difference-1.96*se,difference+1.96*se]}}}
(p/'analysis.json').write_text(json.dumps(analysis,indent=2)+'\n');print(json.dumps(analysis,indent=2))
