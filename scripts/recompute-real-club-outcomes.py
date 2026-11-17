"""Recompute the portable data bundle's winner effects using Python stdlib only."""
import csv,gzip,json,math,sys
from pathlib import Path
root=Path(sys.argv[1])if len(sys.argv)>1 else Path(__file__).resolve().parents[1]
with gzip.open(root/'paired-outcomes.csv.gz','rt',newline='')as f:rows=list(csv.DictReader(f))
cases={}
for row in rows:
 group=cases.setdefault(row['fixture'],{})
 assert row['id']not in group
 group[row['id']]=int(row['focalWin'])
assert len(cases)==2048 and len(rows)==10240
arms=set(next(iter(cases.values())))
assert all(set(g)==arms for g in cases.values())
def compute(arm):
 ds=[g[arm]-g['control']for g in cases.values()];n=len(ds);d=sum(ds)/n
 def wilson(k):
  z=2.241403;p=k/n;den=1+z*z/n;mid=(p+z*z/(2*n))/den
  half=z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den
  return max(0,mid-half),min(1,mid+half)
 plus,minus=wilson(ds.count(1)),wilson(ds.count(-1))
 return {'arm':arm,'wins':sum(g[arm]for g in cases.values()),'liftPoints':100*d,
  'conservative95Points':[100*max(-1,plus[0]-minus[1]),100*min(1,plus[1]-minus[0])]}
result=[compute(a)for a in sorted(arms)]
saved={a['arm']:a for a in json.loads((root/'independent-analysis.json').read_text())['overall']}
for a in result:
 b=saved[a['arm']];assert a['wins']==b['wins']
 assert math.isclose(a['liftPoints'],b['liftPoints'],abs_tol=1e-12)
 assert all(math.isclose(x,y,abs_tol=1e-12)for x,y in zip(a['conservative95Points'],b['conservative95Points']))
print(json.dumps({'status':'passed','matchedFixtures':2048,'outcomeRows':10240,'effects':result},indent=2))
