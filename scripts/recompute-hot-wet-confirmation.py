"""Recompute saved hot/wet confirmation using Python standard library only."""
import csv,gzip,json,math,sys
from pathlib import Path
root=Path(sys.argv[1])if len(sys.argv)>1 else Path(__file__).resolve().parents[1]
with gzip.open(root/'paired-outcomes.csv.gz','rt',newline='')as f:rows=list(csv.DictReader(f))
cases={}
for row in rows:
 group=cases.setdefault(row['fixture'],{})
 assert row['id']not in group
 group[row['id']]=int(row['focalWin'])
assert len(cases)==3200 and len(rows)==19200
arms=set(next(iter(cases.values())))
assert len(arms)==6 and all(set(g)==arms for g in cases.values())
def compute(case,reference):
 ds=[g[case]-g[reference]for g in cases.values()];n=len(ds);d=sum(ds)/n
 def wilson(k):
  z=2.241403;p=k/n;den=1+z*z/n;mid=(p+z*z/(2*n))/den
  half=z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den
  return max(0,mid-half),min(1,mid+half)
 plus,minus=wilson(ds.count(1)),wilson(ds.count(-1))
 return {'case':case,'reference':reference,'n':n,'wins':sum(g[case]for g in cases.values()),
  'referenceWins':sum(g[reference]for g in cases.values()),'liftPoints':100*d,
  'improved':ds.count(1),'worsened':ds.count(-1),
  'conservative95Points':[100*max(-1,plus[0]-minus[1]),100*min(1,plus[1]-minus[0])]}
saved=json.loads((root/'independent-analysis.json').read_text())
result=[]
for b in saved['contrasts']+saved['allVersusControl']:
 a=compute(b['case'],b['reference'])
 for k in ['n','wins','referenceWins','improved','worsened']:assert a[k]==b[k]
 assert math.isclose(a['liftPoints'],b['liftPoints'],abs_tol=1e-12)
 assert all(math.isclose(x,y,abs_tol=1e-12)for x,y in zip(a['conservative95Points'],b['conservative95Points']))
 result.append(a)
print(json.dumps({'status':'passed','matchedFixtures':3200,'outcomeRows':19200,'effects':result},indent=2))
