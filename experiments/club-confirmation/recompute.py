"""Independent input/history, interval contracts, and completed CSV verification."""
import csv,datetime,functools,hashlib,json,math,statistics,sys
from pathlib import Path
from scipy.stats import beta
root=Path(__file__).resolve().parent
def sha(x):return hashlib.sha256(x).hexdigest()
@functools.lru_cache(None)
def logchoose(n):return [math.lgamma(n+1)-math.lgamma(j+1)-math.lgamma(n-j+1)for j in range(n+1)]
def cdf(k,n,p):
 if p<=0:return 1.
 if p>=1:return float(k>=n)
 vals=[v+j*math.log(p)+(n-j)*math.log1p(-p)for j,v in enumerate(logchoose(n)[:k+1])];top=max(vals);return math.exp(top)*math.fsum(math.exp(v-top)for v in vals)
def bisect(k,n,target):
 lo,hi=0.,1.
 for _ in range(65):
  mid=(lo+hi)/2
  if cdf(k,n,mid)>target:lo=mid
  else:hi=mid
 return(lo+hi)/2
TAIL=.05/24
def cp(k,n):
 lo=0. if k==0 else float(beta.ppf(TAIL,k,n-k+1));hi=1. if k==n else float(beta.ppf(1-TAIL,k+1,n-k))
 if k:assert abs(lo-bisect(k-1,n,1-TAIL))<1e-8
 if k<n:assert abs(hi-bisect(k,n,TAIL))<1e-8
 return[lo,hi]
def write(p,x):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,indent=2)+'\n')
def draw(domain,n):
 limit=2**256-2**256%n
 for attempt in range(100):
  h=sha((domain+':'+str(attempt)).encode());v=int(h,16)
  if v<limit:return {'index':v%n,'sha256':h,'attempt':attempt}
 raise AssertionError('Unexpected draw rejection count')

# New study modes appended below.
mode=sys.argv[1]
if mode=='contracts':
 n=1536
 for k in [0,1,5,100,384,768,1535,1536]:
  x=cp(k,n);y=cp(n-k,n);assert abs(x[0]-(1-y[1]))<1e-9 and abs(x[1]-(1-y[0]))<1e-9
 z=cp(0,n);assert math.isclose(z[1],1-TAIL**(1/n),abs_tol=1e-10)
 proof={'status':'passed','classification':'excluded artificial interval contracts','n':1536,'oneSidedTails':24,'familyAlpha':.05,'inverseCDFAndClosedFormVerified':True};write(root/'runs/math-contracts.json',proof);print(json.dumps(proof))
else:
 assert mode=='study';p=Path(sys.argv[2]);m=json.loads((p/'manifest.json').read_text());a=json.loads((p/'analysis.json').read_text());d=json.loads((root/'profiles.json').read_text());assert sha((root/'expanded-plan.json').read_bytes())==m['planSHA256'];rows=list(csv.DictReader((p/'outcomes.csv').open()));groups={};targets={t['id']:t for t in m['targets']};profiles={t['id']:t for t in d['profiles']}
 for r in rows:
  g=groups.setdefault(r['fixture'],{});assert r['arm']not in g;g[r['arm']]=r
 assert len(groups)==4608 and len(rows)==13824 and all(set(g)=={'000','110','111'}for g in groups.values())
 for f in m['fixtures']:
  target=targets[f['targetCellId']];pool=sorted(t['id']for t in d['teams']if t['id']!=target['focalTeamId']);domain='club-extreme-confirmation-fresh-v1:'+target['id']+':'+str(f['trial']);draws={key:draw(domain+':'+key,n)for key,n in [('opponent',17),('history',6),('orientation',2)]};assert draws==f['draws'];profile=profiles[f['profile']];assert profile['teamIds']==[target['focalTeamId'],pool[draws['opponent']['index']]];assert f['historyIndex']==draws['history']['index']and f['focalSide']==draws['orientation']['index'];assert f['seed']==sha((domain+':gameplay').encode())and f['replay']==(f['trial']<8)
  for row in groups[f['id']].values():assert row['targetCellId']==target['id']and row['focalTeamId']==target['focalTeamId']and row['opponentTeamId']==profile['teamIds'][1]
 def verify(c,sub):
  ds=[int(g['111']['focalWin'])-int(g[c['reference']]['focalWin'])for g in sub];assert len(sub)==c['n'];assert sum(int(g['111']['focalWin'])for g in sub)==c['wins'];assert sum(int(g[c['reference']]['focalWin'])for g in sub)==c['referenceWins'];assert ds.count(1)==c['toward']and ds.count(-1)==c['against'];assert math.isclose(statistics.mean(ds)*100,c['winChangePP'],abs_tol=1e-10);assert math.isclose(statistics.mean(float(g['111']['margin'])-float(g[c['reference']]['margin'])for g in sub),c['meanMarginChange'],abs_tol=1e-10)
 inferred=[];gs=list(groups.values())
 for c in a['primary']:
  sub=[g for g in gs if g['000']['targetCellId']==c['targetCellId']];assert len(sub)==1536;verify(c,sub);up,down=cp(c['toward'],1536),cp(c['against'],1536);bounds=[100*(up[0]-down[1]),100*(up[1]-down[0])];verdict=('inside-outer15'if bounds[0]>=-15 and bounds[1]<=15 else'confirmed-beyond-outer15'if bounds[0]>15 or bounds[1]<-15 else'unresolved-at-outer15');inferred.append({**c,'towardProbabilityBounds':up,'againstProbabilityBounds':down,'familyWise95IntervalPP':bounds,'outerReferenceReview':verdict if c['reference']=='000'else'not-a-separate-adopted-halftime-margin'})
 for c in a['secondary']:verify(c,[g for g in gs if g['000']['targetCellId']==c['targetCellId']and g['000'][c['key']]==str(c['value'])])
 assert sha((p/'outcomes.csv').read_bytes())==a['outcomesCSVSHA256'];checkpointRows={}
 import gzip
 for idx in range(1,10):
  name='block-'+str(idx).zfill(3);raw=gzip.decompress((p/'checkpoints'/(name+'.json.gz')).read_bytes());b=json.loads(raw);meta=json.loads((p/'checkpoints'/(name+'.json')).read_text());ack=json.loads((p/'checkpoints'/(name+'.published.json')).read_text());assert sha(raw.decode().rsplit(',"rows":',1)[1][:-1].encode())==meta['outcomeRowsSHA256'];assert sha((p/'checkpoints'/(name+'.json.gz')).read_bytes())==meta['checkpointSHA256'];assert ack['status']=='verified'and all(ack[k]==meta[k]for k in ['studyId','blockIndex','manifestSHA256','checkpointSHA256','outcomeRowsSHA256'])
  for row in b['rows']:
   key=(row['fixture'],row['arm']);assert key not in checkpointRows;checkpointRows[key]=row
 assert len(checkpointRows)==13824
 for r in rows:
  old=checkpointRows[(r['fixture'],r['arm'])];assert int(r['focalWin'])==old['focalWin']and float(r['margin'])==old['margin']and r['resultSHA256']==old['resultSHA256']and r['armFileSHA256']==old['armFileSHA256']
 inference={'status':'completed','familyAlpha':.05,'oneSidedTailAlpha':TAIL,'method':'Six predeclared paired differences;24one-sided Clopper-Pearson tails and signed subtraction; inverse endpoints checked by independent log-binomial-CDF bisection. Conditional on fixed focal club/scene, unconditional over uniform opponents/history/orientation.','primaryContrasts':inferred,'priorSamplesPooled':False};write(p/'inference.json',inference);proof={'status':'passed','pairedClusters':4608,'outcomes':13824,'primaryContrasts':6,'secondaryGroups':len(a['secondary']),'allDesignDrawsVerified':True,'inverseCDFVerified':True,'durableBlocksVerified':9,'durableRowsMatchFinalCSV':True,'outcomesCSVSHA256':a['outcomesCSVSHA256']};write(p/'independent-recomputation.json',proof);print(json.dumps(inference));print(json.dumps(proof))
