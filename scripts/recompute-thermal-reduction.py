"""Independent compact-file verification; Python standard library only."""
import csv,gzip,json,math,sys
from pathlib import Path
p=Path(sys.argv[1]);groups={'main':{},'targeted':{}}
with gzip.open(p/'paired-outcomes.csv.gz','rt',newline='')as f:
 count=0
 for row in csv.DictReader(f):
  g=groups[row['cohort']].setdefault(row['fixture'],{});assert row['id']not in g
  g[row['id']]={k:float(row[k])for k in ['focalWin','focalScore','opponentScore','playingSeconds','focalShots','opponentShots','focalMeanFinalEnergy','opponentMeanFinalEnergy']};count+=1
assert count==17600 and len(groups['main'])==1600 and len(groups['targeted'])==800
assert all(len(g)==10 for g in groups['main'].values())and all(len(g)==2 for g in groups['targeted'].values())
def effect(cohort,case,ref):
 gs=groups[cohort];ds=[g[case]['focalWin']-g[ref]['focalWin']for g in gs.values()];n=len(ds)
 margins=[g[case]['focalScore']-g[case]['opponentScore']-g[ref]['focalScore']+g[ref]['opponentScore']for g in gs.values()]
 mean=sum(margins)/n;se=math.sqrt(sum((m-mean)**2 for m in margins)/(n-1)/n)
 def wilson(k):
  z=2.241403;t=k/n;den=1+z*z/n;m=(t+z*z/(2*n))/den;h=z*math.sqrt(t*(1-t)/n+z*z/(4*n*n))/den;return max(0,m-h),min(1,m+h)
 plus,minus=wilson(ds.count(1)),wilson(ds.count(-1))
 return {'n':n,'wins':sum(g[case]['focalWin']for g in gs.values()),'referenceWins':sum(g[ref]['focalWin']for g in gs.values()),'improved':ds.count(1),'worsened':ds.count(-1),
 'liftPoints':100*sum(ds)/n,'conservative95Points':[100*(plus[0]-minus[1]),100*(plus[1]-minus[0])],
 'meanScoreMarginChange':mean,'scoreMarginChange95Approx':[mean-1.96*se,mean+1.96*se]}
a=json.loads((p/'independent-analysis.json').read_text())
for cohort,items in [('main',a['mainContrasts']+a['allVersusControl']),('targeted',[a['targetedPrimaryPhiladelphia']])]:
 for item in items:
  got=effect(cohort,item['case'],item['reference'])
  for k in ['n','wins','referenceWins','improved','worsened']:assert got[k]==item[k]
  assert math.isclose(got['liftPoints'],item['liftPoints'],abs_tol=1e-12)
  assert all(math.isclose(x,y,abs_tol=1e-12)for x,y in zip(got['conservative95Points'],item['conservative95Points']))
  assert math.isclose(got['meanScoreMarginChange'],item['meanScoreMarginChange'],abs_tol=1e-12)
  assert all(math.isclose(x,y,abs_tol=1e-12)for x,y in zip(got['scoreMarginChange95Approx'],item['scoreMarginChange95Approx']))
for cohort,metrics in a['metrics'].items():
 for item in metrics:
  rows=[g[item['arm']]for g in groups[cohort].values()];n=len(rows);seconds=sum(r['playingSeconds']for r in rows)
  expected={'meanPlayingMinutes':seconds/n/60,'totalPointsPerPlayingMinute':60*sum(r['focalScore']+r['opponentScore']for r in rows)/seconds,
   'focalShotsPerPlayingMinute':60*sum(r['focalShots']for r in rows)/seconds,'opponentShotsPerPlayingMinute':60*sum(r['opponentShots']for r in rows)/seconds,
   'meanFocalFinalEnergy':sum(r['focalMeanFinalEnergy']for r in rows)/n,'meanOpponentFinalEnergy':sum(r['opponentMeanFinalEnergy']for r in rows)/n}
  for k,v in expected.items():assert math.isclose(v,item[k],abs_tol=1e-12)
assert a['reciprocalNorfolk']['liftPoints']==-a['targetedPrimaryPhiladelphia']['liftPoints']
for k in ['wins','referenceWins']:assert a['reciprocalNorfolk'][k]==800-a['targetedPrimaryPhiladelphia'][k]
assert a['reciprocalNorfolk']['meanScoreMarginChange']==-a['targetedPrimaryPhiladelphia']['meanScoreMarginChange']
print(json.dumps({'status':'passed','uniqueFixtures':2400,'outcomeRows':17600,'pairedMarginsVerified':True,'energyAndPaceMetricsVerified':True,'mainPrimary':a['mainPrimary'],'targetedPrimary':a['targetedPrimaryPhiladelphia']},indent=2))
