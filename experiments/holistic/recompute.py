"""Independent CSV factorial checks and prospective mixture-confirmation bounds."""
import csv,hashlib,json,math,statistics,sys
from pathlib import Path
from scipy.stats import beta
p=Path(sys.argv[1]);m=json.loads((p/'manifest.json').read_text());a=json.loads((p/'analysis.json').read_text());rows=list(csv.DictReader((p/'outcomes.csv').open()));groups={}
for r in rows:
 g=groups.setdefault(r['fixture'],{});assert r['arm']not in g;g[r['arm']]=r
assert len(groups)==len(m['fixtures'])and len(rows)==len(groups)*len(m['arms'])and all(set(g)==set(m['arms'])for g in groups.values())
def near(x,y):assert math.isclose(x,y,rel_tol=1e-11,abs_tol=1e-10),(x,y)
def contrast(gs,c):
 ds=[int(g[c['arm']]['focalWin'])-int(g[c['reference']]['focalWin'])for g in gs];assert len(gs)==c['n'];assert sum(int(g[c['arm']]['focalWin'])for g in gs)==c['wins'];assert sum(int(g[c['reference']]['focalWin'])for g in gs)==c['referenceWins'];assert ds.count(1)==c['changedToFocal']and ds.count(-1)==c['changedAgainstFocal'];near(100*statistics.mean(ds),c['winChangePP']);near(statistics.mean(float(g[c['arm']]['margin'])-float(g[c['reference']]['margin'])for g in gs),c['meanMarginChange'])
gs=list(groups.values())
for c in a['contrasts']:contrast([g for g in gs if g['000']['scene']==c['scene']and(c['population']=='all-qualities'or float(g['000']['gap'])==0)],c)
for c in a['matchedRoots']:contrast([g for g in gs if g['000']['scene']==c['scene']and float(g['000']['gap'])==0 and g['000']['tactics']==c['tactics']],c)
for c in a['cells']:
 rr=[r for r in rows if r['scene']==c['scene']and float(r['gap'])==c['gap']and r['arm']==c['arm']];assert len(rr)==c['n'];assert sum(int(r['focalWin'])for r in rr)==c['wins'];near(100*statistics.mean(int(r['focalWin'])for r in rr),c['winRatePct']);assert sum(r['focalChoice']!='hold'for r in rr)==c['focalChanges'];assert sum(r['opponentChoice']!='hold'for r in rr)==c['opponentChanges'];near(statistics.mean(float(r['focalFinalEnergy'])for r in rr),c['meanFinalFocalEnergy']);near(statistics.mean(float(r['playingSeconds'])for r in rr),c['meanPlayingSeconds'])
 for col in ['focalContacts','focalSeverityIncidents','focalSeriousFouls']:assert sum(int(r[col])for r in rr)==c[col]
if m['mode']=='screen':
 assert len(groups)==480 and len(rows)==3840
 for c in a['factorial']:
  sub=[g for g in gs if g['000']['scene']==c['scene']and float(g['000']['gap'])==0];y=lambda g,p,w,h:int(g[f'{p}{w}{h}']['focalWin'])
  for key,idx in [('psychologyMainPP',0),('physicalMainPP',1),('halftimeMainPP',2)]:
   values=[]
   for g in sub:
    total=0
    for b in [0,1]:
     for d in [0,1]:
      x=[b,d];lo=x.copy();lo.insert(idx,0);hi=x.copy();hi.insert(idx,1);total+=y(g,*hi)-y(g,*lo)
    values.append(total/4)
   near(100*statistics.mean(values),c[key])
  for key,i,j,k in [('psychologyPhysicalInteractionPP',0,1,2),('psychologyHalftimeInteractionPP',0,2,1),('physicalHalftimeInteractionPP',1,2,0)]:
   values=[]
   for g in sub:
    v=0
    for b in [0,1]:
     for x in [0,1]:
      for z in [0,1]:
       bits=[0,0,0];bits[i]=x;bits[j]=z;bits[k]=b;v+=(-1)**(x+z)*y(g,*bits)/2
    values.append(v)
   near(100*statistics.mean(values),c[key])
  near(100*statistics.mean(sum((-1)**(3-sum(map(int,arm)))*int(g[arm]['focalWin'])for arm in m['arms'])for g in sub),c['threeWayInteractionPP'])
else:
 assert m['mode']=='confirmation'and len(groups)==512 and len(rows)==1536
 # The IID target includes the independently sampled profile; do not condition on its realized count.
 profiles=json.loads((Path('experiments/holistic/profiles.json')).read_text())['profiles'];pool=sorted(x['id']for x in profiles if x['gap']==0)
 for f in m['fixtures']:
  domain=f"holistic-confirmation-mixture-v1:{f['scene']}:{f['focalSide']}:{f['trial']}";draw=hashlib.sha256((domain+':profile').encode()).hexdigest();assert f['profile']==pool[int(draw[:8],16)%8];assert f['seed']==hashlib.sha256((domain+':gameplay').encode()).hexdigest();assert f['profileDrawSHA256']==draw
 def cdf(k,n,p):return math.fsum(math.comb(n,j)*p**j*(1-p)**(n-j)for j in range(k+1))
 def bisect(k,n,target):
  lo,hi=0.,1.
  for _ in range(80):
   mid=(lo+hi)/2
   if cdf(k,n,mid)>target:lo=mid
   else:hi=mid
  return(lo+hi)/2
 tail=.05/32
 def cp(k,n):
  lo=0. if k==0 else float(beta.ppf(tail,k,n-k+1));hi=1. if k==n else float(beta.ppf(1-tail,k+1,n-k))
  if k>0:assert abs(lo-bisect(k-1,n,1-tail))<1e-9
  if k<n:assert abs(hi-bisect(k,n,tail))<1e-9
  return lo,hi
 inferred=[]
 for scene in sorted(set(g['000']['scene']for g in gs)):
  for reference in ['000','110']:
   strata=[]
   for side in [0,1]:
    sub=[g for g in gs if g['000']['scene']==scene and int(g['000']['focalSide'])==side];assert len(sub)==128;ds=[int(g['111']['focalWin'])-int(g[reference]['focalWin'])for g in sub];toward=ds.count(1);against=ds.count(-1);up=cp(toward,128);down=cp(against,128);strata.append({'side':side,'n':128,'toward':toward,'against':against,'towardProbabilityBounds':up,'againstProbabilityBounds':down,'differenceBounds':[up[0]-down[1],up[1]-down[0]]})
   delta=100*statistics.mean(int(g['111']['focalWin'])-int(g[reference]['focalWin'])for g in gs if g['000']['scene']==scene);bounds=[50*sum(s['differenceBounds'][j]for s in strata)for j in [0,1]];inferred.append({'scene':scene,'arm':'111','reference':reference,'n':256,'winChangePP':delta,'familyWise95IntervalPP':bounds,'strata':strata})
 result={'status':'completed','method':'Prespecified independent uniform-profile mixture within each fixed orientation; Clopper-Pearson bounds plus a32-tail union bound, then signed difference and equal-orientation averaging. Exact coverage is unconditional over profile and gameplay draws. Beta PPF endpoints independently verified by binomial-CDF bisection.','familyAlpha':.05,'oneSidedTailAlpha':tail,'primaryContrasts':inferred,'profileDrawVerification':True,'inverseCDFVerification':True};(p/'inference.json').write_text(json.dumps(result,indent=2)+'\n')
assert hashlib.sha256((p/'outcomes.csv').read_bytes()).hexdigest()==a['outcomesCSVSHA256'];proof={'status':'passed','mode':m['mode'],'pairedClusters':len(groups),'outcomes':len(rows),'contrastGroups':len(a['contrasts']),'armCells':len(a['cells']),'factorialCells':len(a['factorial']),'outcomesCSVSHA256':a['outcomesCSVSHA256'],'confirmationInferenceVerified':m['mode']=='confirmation'};(p/'independent-recomputation.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps(proof))
