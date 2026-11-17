"""Analyze the fixed heat/normal-trait screen from audited compact outcomes."""
import csv,gzip,json,math,statistics,sys
from pathlib import Path
p=Path(sys.argv[1]);m=json.loads((p/'manifest.json').read_text());groups={};ids=[a['id']for a in m['arms']]
with gzip.open(p/'paired-outcomes.csv.gz','rt',newline='')as f:
 for r in csv.DictReader(f):
  g=groups.setdefault(r['fixture'],{'profile':r['profile'],'trial':int(r['trial']),'swap':r['swapped']=='true','arms':{}})
  assert (g['profile'],g['trial'],g['swap'])==(r['profile'],int(r['trial']),r['swapped']=='true');assert r['arm']not in g['arms']
  a={k:float(r[k])for k in ['focalWin','focalScore','opponentScore','playingSeconds','focalShots','opponentShots','focalMeanFinalEnergy','opponentMeanFinalEnergy']};a['weather']=json.loads(r['weatherJSON']);g['arms'][r['arm']]=a
assert len(groups)==1024 and all(set(g['arms'])==set(ids)for g in groups.values());gs=list(groups.values())
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
z=statistics.NormalDist().inv_cdf(1-.05/6)
primary=[{'temperatureC':t,'contrast':physical_contrast(gs,f't{t}-normal-035','temperate',z)}for t in [28,32,35]]
physical=[]
for t in [28,32,35]:
 for variant in ['shared','normal-050','normal-035']:
  arm=f't{t}-{variant}';physical.append({'temperatureC':t,'variant':variant,'cell':cell(gs,arm),'versusTemperate':physical_contrast(gs,arm,'temperate')})
physical_secondary=[]
for t in [28,32,35]:
 for lo in [f't{t}-shared',f't{t}-normal-050']:
  hi=f't{t}-normal-035';physical_secondary.append({'contrast':hi+' minus '+lo,'values':physical_contrast(gs,hi,lo)})
for lo,hi in [(28,32),(32,35)]:
 physical_secondary.append({'contrast':f't{hi}-normal-035 minus t{lo}-normal-035','values':physical_contrast(gs,f't{hi}-normal-035',f't{lo}-normal-035')})
matchups=[]
for profile in m['profiles']:
 rows=[g for g in gs if g['profile']==profile['id']];assert len(rows)==256 and sum(g['swap']for g in rows)==128;assert sorted(g['trial']for g in rows)==list(range(256))
 contrasts=[]
 for t in [28,32,35]:
  hi=f't{t}-normal-035'
  for lo in ['temperate',f't{t}-shared',f't{t}-normal-050']:
   contrasts.append({'temperatureC':t,'overall':competitive(rows,hi,lo,12 if lo=='temperate'else 1),
    'sides':[{'swap':s,'values':competitive([g for g in rows if g['swap']==s],hi,lo)}for s in [False,True]]})
 matchups.append({'profile':profile['id'],'focal':profile['teams'][0]['name'],'opponent':profile['teams'][1]['name'],
  'cells':{arm:cell(rows,arm)for arm in ids},'contrasts':contrasts})
a={'status':'completed','fixtureClusters':1024,'outcomes':10240,'sourceSHA256':m['sourceSHA256'],'primary':primary,
 'controlCell':cell(gs,'temperate'),'physicalCurves':physical,'physicalSecondary':physical_secondary,'matchups':matchups,
 'limits':'Fixed copied clubs and fixed traits; screen of physical response, not winner-rate ceiling certification. Primary family intervals approximate; secondary energy intervals nominal.'}
(p/'analysis.json').write_text(json.dumps(a,indent=2)+'\n');print(json.dumps({'status':'completed','primary':primary,'outcomes':10240},indent=2))
