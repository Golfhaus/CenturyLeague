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
mode=sys.argv[1]
if mode=='inputs':
 d=json.loads((root/'profiles.json').read_text());r=Path(sys.argv[2]);h=Path(sys.argv[3]);assert sha(r.read_bytes())==d['rosterSnapshotSHA256'];assert sha(h.read_bytes())==d['acceptedHistorySHA256'];original={x['team_id']:x['match_team']for x in json.loads(r.read_text())['rows']};assert len(original)==18
 for t in d['teams']:assert t==original[t['id']]
 assert len(d['profiles'])==306;assert set(tuple(p['teamIds'])for p in d['profiles'])=={(a,b)for a in original for b in original if a!=b}
 records=json.loads(h.read_text())['rows'];assert records==d['acceptedHistory'];assert len(records)==32;prefix=[];states={k:0 for k in original}
 for index,state in enumerate(d['histories']):
  through=state['throughDate'];eligible=[r for r in records if through and r['match_date']<=through];computed={k:0 for k in original}
  for row in eligible:
   assert row['accepted_event_id']and row['classification']=='competitive'
   for side,k in enumerate([row['team0'],row['team1']]):computed[k]=(max(0,computed[k])+1)if side==row['winner']else(min(0,computed[k])-1)
  assert computed==state['streaks'];assert [r['fixture_id']for r in eligible]==state['fixtureIds'];assert not through or state['evaluationDate']==(datetime.date.fromisoformat(through)+datetime.timedelta(days=1)).isoformat()
 proof={'status':'passed','clubsUnchanged':18,'orderedPairs':306,'acceptedNonvoidedResults':32,'chronologicalPrefixesVerified':6,'futureResultLeakage':False,'profilesSHA256':sha((root/'profiles.json').read_bytes()),'officialWrites':False};write(root/'runs/input-independent.json',proof);print(json.dumps(proof))
elif mode=='contracts':
 n=2048;z=cp(0,n);assert z[0]==0 and math.isclose(z[1],1-TAIL**(1/n),abs_tol=1e-10);p=cp(n,n);assert math.isclose(p[0],TAIL**(1/n),abs_tol=1e-10)and p[1]==1
 mid=cp(n//2,n);assert math.isclose(mid[0],1-mid[1],abs_tol=1e-10)
 for k in [1,10,205,512,1024,2047]:
  a,b=cp(k,n),cp(n-k,n);assert abs(a[0]-(1-b[1]))<1e-9 and abs(a[1]-(1-b[0]))<1e-9
 proof={'status':'passed','classification':'excluded artificial interval contracts; no scientific outcomes','n':n,'sixContrasts':6,'oneSidedTails':24,'tailAlpha':TAIL,'closedFormBoundaryAndComplementChecks':True,'logBinomialCDFBisection':True};write(root/'runs/math-contracts.json',proof);print(json.dumps(proof))
else:
 assert mode=='study';p=Path(sys.argv[2]);m=json.loads((p/'manifest.json').read_text());a=json.loads((p/'analysis.json').read_text());rows=list(csv.DictReader((p/'outcomes.csv').open()));d=json.loads((root/'profiles.json').read_text());plan=Path('docs/copied-club-holistic-precision-plan-2026-11-18.json');assert sha(plan.read_bytes())==m['planSHA256'];groups={}
 for r in rows:
  g=groups.setdefault(r['fixture'],{});assert r['arm']not in g;g[r['arm']]=r
 assert len(groups)==6144 and len(rows)==18432 and all(set(g)=={'000','110','111'}for g in groups.values())
 for f in m['fixtures']:
  domain='club-holistic-precision-fresh-v1:'+f['scene']+':'+str(f['trial']);draws={k:draw(domain+':'+key,n)for k,key,n in [('pair','pair',306),('history','history',6),('orientation','orientation',2)]};assert draws==f['draws'];profile=d['profiles'][draws['pair']['index']];assert profile['id']==f['profile'];assert draws['history']['index']==f['historyIndex'];assert draws['orientation']['index']==f['focalSide'];assert sha((domain+':gameplay').encode())==f['seed'];assert f['replay']==(f['trial']<8)
  for row in groups[f['id']].values():
   assert row['profile']==f['profile']and int(row['focalSide'])==f['focalSide']and int(row['historyIndex'])==f['historyIndex'];assert row['focalTeamId']==profile['teamIds'][0]and row['opponentTeamId']==profile['teamIds'][1];hist=d['histories'][f['historyIndex']];assert int(row['historyStreakFocal'])==hist['streaks'][row['focalTeamId']]and int(row['historyStreakOpponent'])==hist['streaks'][row['opponentTeamId']]
 def verify(c,sub):
  ds=[int(g['111']['focalWin'])-int(g[c['reference']]['focalWin'])for g in sub];assert len(sub)==c['n'];assert sum(int(g['111']['focalWin'])for g in sub)==c['wins'];assert sum(int(g[c['reference']]['focalWin'])for g in sub)==c['referenceWins'];assert ds.count(1)==c['toward']and ds.count(-1)==c['against'];assert math.isclose(100*statistics.mean(ds),c['winChangePP'],abs_tol=1e-10);assert math.isclose(statistics.mean(float(g['111']['margin'])-float(g[c['reference']]['margin'])for g in sub),c['meanMarginChange'],abs_tol=1e-10)
 inferred=[];gs=list(groups.values())
 for c in a['primary']:
  sub=[g for g in gs if g['000']['scene']==c['scene']];assert len(sub)==2048;verify(c,sub);up=cp(c['toward'],2048);down=cp(c['against'],2048);inferred.append({**c,'towardProbabilityBounds':up,'againstProbabilityBounds':down,'familyWise95IntervalPP':[100*(up[0]-down[1]),100*(up[1]-down[0])]})
 for c in a['secondary']:
  sub=[g for g in gs if g['000']['scene']==c['scene']and g['000'][c['key']]==str(c['value'])];verify(c,sub)
 assert sha((p/'outcomes.csv').read_bytes())==a['outcomesCSVSHA256'];inference={'status':'completed','method':'Independent uniform ordered-club/history/orientation mixture;24 one-sided Clopper-Pearson tails, signed subtraction, simultaneous95% family for six differences. Exact coverage unconditional over all design draws. Inverse endpoints checked by independent log-space binomial-CDF bisection.','familyAlpha':.05,'oneSidedTailAlpha':TAIL,'primaryContrasts':inferred,'sourceOrCoefficientChanges':False,'earlierStudiesPooled':False};write(p/'inference.json',inference)
 proof={'status':'passed','pairedClusters':6144,'outcomes':18432,'primaryContrasts':6,'secondaryGroups':len(a['secondary']),'allDesignDrawsVerified':True,'chronologicalHistoryLabelsVerified':True,'inverseCDFVerification':True,'outcomesCSVSHA256':a['outcomesCSVSHA256']};write(p/'independent-recomputation.json',proof);print(json.dumps(inference));print(json.dumps(proof))
