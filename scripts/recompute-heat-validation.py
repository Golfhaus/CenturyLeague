"""Independent checks using direct sums and ordered CSV contrasts."""
import csv,gzip,json,math,statistics,sys
from pathlib import Path
p=Path(sys.argv[1]);a=json.loads((p/'analysis.json').read_text());groups={};rowcount=0
with gzip.open(p/'paired-outcomes.csv.gz','rt',newline='')as f:
 for r in csv.DictReader(f):
  key=r['fixture'];g=groups.setdefault(key,{});assert r['arm']not in g;g[r['arm']]=r;rowcount+=1
assert rowcount==6400 and len(groups)==3200
def close(x,y):assert math.isclose(x,y,rel_tol=1e-10,abs_tol=1e-9),(x,y)
def wilson(k,n,z):
 denominator=n+z*z;mid=(k+z*z/2)/denominator;half=z*math.sqrt(k*(n-k)/n+z*z/4)/denominator
 return max(0,mid-half),min(1,mid+half)
for block in a['matchups']:
 gs=[g for g in groups.values()if g['temperate']['profile']==block['profile']];assert len(gs)==800
 for side,rows,saved,z,zw in [(None,gs,block['contrast'],statistics.NormalDist().inv_cdf(.99375),statistics.NormalDist().inv_cdf(.996875))]+[
  (s,[g for g in gs if (g['temperate']['swapped']=='true')==s],b['contrast'],1.96,statistics.NormalDist().inv_cdf(.9875))for s,b in zip([False,True],block['sideChecks'])]:
  ds=[];plus=minus=0
  for g in rows:
   c,h=g['temperate'],g['hot'];ds.append((float(h['focalScore'])-float(c['focalScore']))-(float(h['opponentScore'])-float(c['opponentScore'])))
   delta=int(float(h['focalWin']))-int(float(c['focalWin']));plus+=delta==1;minus+=delta==-1
  n=len(ds);mean=sum(ds)/n;se=math.sqrt((sum(x*x for x in ds)-sum(ds)**2/n)/(n*(n-1)));close(mean,saved['scoreMargin']['mean']);close(se,saved['scoreMargin']['standardError'])
  for x,y in zip([mean-z*se,mean+z*se],saved['scoreMargin']['interval']):close(x,y)
  lo,hi=wilson(plus,n,zw),wilson(minus,n,zw)
  close(100*(plus-minus)/n,saved['winChangePoints']);assert plus==saved['changedToFocal']and minus==saved['changedAgainstFocal']
  for x,y in zip([100*(lo[0]-hi[1]),100*(lo[1]-hi[0])],saved['winConservativeFamily95']):close(x,y)
 for arm in ['temperate','hot']:
  rows=[g[arm]for g in gs];saved=block['cells'][arm];n=len(rows);close(100*sum(float(r['focalWin'])for r in rows)/n,saved['focalWinRatePct'])
  close(sum(float(r['playingSeconds'])for r in rows)/n/60,saved['meanMinutes'])
  for role in ['focal','opponent']:
   active=energy=fatigue=checks=shift=0
   for r in rows:
    side=int(r['swapped']=='true')if role=='focal'else int(r['swapped']!='true');w=json.loads(r['weatherJSON']);active+=w['activePlayerSeconds'][side];energy+=w['energySeconds'][side];fatigue+=w['extraRequestedFatigue'][side]
    k=w['probabilities']['kick'][side];checks+=k['opportunities'];shift+=k['adjustedProbabilitySum']-k['baselineProbabilitySum']
   cell=saved['clubs'][role];close(energy/active,cell['timeWeightedActiveEnergy']);close(fatigue*1000/active,cell['extraFatiguePer1000PlayerSeconds']);close(shift*100/checks,cell['directWeatherKickShiftPoints']);assert checks==cell['kickChecks']
   close(sum(float(r[role+'MeanFinalEnergy'])for r in rows)/n,cell['meanFinalEnergy'])
   if arm=='temperate':assert fatigue==0
proof={'status':'passed','fixtureClusters':len(groups),'outcomes':rowcount,'matchups':4,'bothSideContrastsVerified':True,'familyIntervalsAndDiscordanceCountsVerified':True,'physicalMetricsVerified':True}
(p/'independent-recomputation.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps(proof))
