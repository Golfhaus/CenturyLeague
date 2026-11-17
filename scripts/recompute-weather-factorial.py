"""Independent fixture-cluster verification from CSV, using permutation Shapley weights."""
import csv,gzip,json,math,itertools,collections,sys
from pathlib import Path
p=Path(sys.argv[1]);groups={};count=0
with gzip.open(p/'paired-outcomes.csv.gz','rt',newline='')as f:
 for r in csv.DictReader(f):
  g=groups.setdefault(r['fixture'],{'swap':r['swapped'].lower()=='true','cells':{}});assert g['swap']==(r['swapped'].lower()=='true')
  key=(r['context'],int(r['mask']));assert key not in g['cells'];a={k:float(r[k])for k in ['focalWin','focalScore','opponentScore','playingSeconds','focalShots','opponentShots','focalMeanFinalEnergy','opponentMeanFinalEnergy']}
  a['weather']=json.loads(r['weatherJSON']);g['cells'][key]=a;count+=1
assert len(groups)==800 and count==12800 and sum(g['swap']for g in groups.values())==400
assert all(set(g['cells'])=={(c,i)for c in ['original','matched']for i in range(8)}for g in groups.values())
allgroups=list(groups.values());a=json.loads((p/'independent-analysis.json').read_text());names={'Heat':1,'Wind + gusts':2,'Rain':4}
def weights_shapley(context,bit):
 counter=collections.Counter()
 for order in itertools.permutations([1,2,4]):
  mask=0
  for b in order:
   if b==bit:counter[(context,mask|b)]+=1;counter[(context,mask)]-=1
   mask|=b
 return {k:v/6 for k,v in counter.items()}
def calc(rows,weights,metric):
 values=[]
 for g in rows:
  value=0
  for key,w in weights.items():
   r=g['cells'][key];value+=w*(r['focalWin']if metric=='winPoints'else r['focalScore']-r['opponentScore'])
  values.append(value)
 n=len(values);avg=sum(values)/n;se=math.sqrt(sum((v-avg)**2 for v in values)/(n*(n-1)));scale=100 if metric=='winPoints'else 1
 return values,{'n':n,'mean':scale*avg,'standardError':scale*se,'ci95Approx':[scale*(avg-1.96*se),scale*(avg+1.96*se)]}
def check(rows,saved,weights):
 for metric in ['winPoints','scoreMargin']:
  _,got=calc(rows,weights,metric);want=saved[metric];assert got['n']==want['n']
  for k in ['mean','standardError']:assert math.isclose(got[k],want[k],abs_tol=1e-10)
  assert all(math.isclose(x,y,abs_tol=1e-10)for x,y in zip(got['ci95Approx'],want['ci95Approx']))
def wilson(k,n,z=2.241403):
 q=k/n;d=1+z*z/n;m=(q+z*z/(2*n))/d;h=z*math.sqrt(q*(1-q)/n+z*z/(4*n*n))/d;return max(0,m-h),min(1,m+h)
def check_block(rows,saved):
 check(rows,saved['primaryWorkloadWeatherInteraction'],{('matched',7):1,('matched',0):-1,('original',7):-1,('original',0):1})
 for context in ['original','matched']:
  weights={(context,7):1,(context,0):-1};check(rows,saved['fullWeatherEffects'][context],weights)
  ds,_=calc(rows,weights,'winPoints');plus,minus=wilson(ds.count(1),len(rows)),wilson(ds.count(-1),len(rows));ci=[100*(plus[0]-minus[1]),100*(plus[1]-minus[0])]
  assert saved['fullWeatherEffects'][context]['improved']==ds.count(1)and saved['fullWeatherEffects'][context]['worsened']==ds.count(-1)
  assert all(math.isclose(x,y,abs_tol=1e-10)for x,y in zip(ci,saved['fullWeatherEffects'][context]['winConservative95']))
  for name,bit in names.items():
   weights=weights_shapley(context,bit);check(rows,saved['shapley'][context][name],weights)
   for metric in ['winPoints','scoreMargin']:
    bycomponent=[calc(rows,weights_shapley(context,b),metric)[0]for b in names.values()];total=calc(rows,{(context,7):1,(context,0):-1},metric)[0]
    assert all(math.isclose(sum(v[i]for v in bycomponent),total[i],abs_tol=1e-10)for i in range(len(rows)))
   coeff=collections.Counter()
   for mask in range(8):
    if not mask&bit:coeff[(context,mask|bit)]+=.25;coeff[(context,mask)]-=.25
   check(rows,saved['factorialMainEffects'][context][name],coeff)
  for n1,b1 in names.items():
   for n2,b2 in names.items():
    if b1>=b2:continue
    coeff=collections.Counter();other=7^(b1|b2)
    for mask in [0,other]:
     for state,sign in [(mask,1),(mask|b1,-1),(mask|b2,-1),(mask|b1|b2,1)]:coeff[(context,state)]+=.5*sign
    check(rows,saved['factorialInteractions'][context][n1+' × '+n2],coeff)
  check(rows,saved['factorialInteractions'][context]['Heat × Wind × Rain'],{(context,0):-1,(context,1):1,(context,2):1,(context,4):1,(context,3):-1,(context,5):-1,(context,6):-1,(context,7):1})
 for name,bit in names.items():
  coeff=collections.Counter(weights_shapley('matched',bit));coeff.subtract(weights_shapley('original',bit));check(rows,saved['shapleyContextChanges'][name],coeff)
check_block(allgroups,a['overall'])
for side in a['sideChecks']:check_block([g for g in allgroups if g['swap']==side['swap']],side)
for cell in a['cells']:
 key=(cell['context'],cell['mask']);rows=[g['cells'][key]for g in allgroups];seconds=sum(r['playingSeconds']for r in rows);wins=sum(r['focalWin']for r in rows);assert wins==cell['wins']
 expected={'winRatePct':100*wins/800,'meanScoreMargin':sum(r['focalScore']-r['opponentScore']for r in rows)/800,'meanPlayingMinutes':seconds/800/60,
  'focalShotsPerMinute':60*sum(r['focalShots']for r in rows)/seconds,'opponentShotsPerMinute':60*sum(r['opponentShots']for r in rows)/seconds,
  'focalFinalEnergy':sum(r['focalMeanFinalEnergy']for r in rows)/800,'opponentFinalEnergy':sum(r['opponentMeanFinalEnergy']for r in rows)/800}
 for k,v in expected.items():assert math.isclose(v,cell[k],abs_tol=1e-10)
 for role in ['focal','opponent']:
  energy=active=extra=checks=shift=0
  for g,r in zip(allgroups,rows):
   side=int(g['swap'])if role=='focal'else 1-int(g['swap']);w=r['weather'];energy+=w['energySeconds'][side];active+=w['activePlayerSeconds'][side];extra+=w['extraRequestedFatigue'][side]
   c=w['probabilities']['kick'][side];checks+=c['opportunities'];shift+=c['adjustedProbabilitySum']-c['baselineProbabilitySum']
  expected={'activeEnergy':energy/active,'extraRequestedFatiguePer1000PlayerSeconds':1000*extra/active,'localKickProbabilityShiftPoints':100*shift/checks}
  for k,v in expected.items():assert math.isclose(v,cell['metrics'][role][k],abs_tol=1e-10)
print(json.dumps({'status':'passed','fixtureClusters':800,'outcomeRows':12800,'pairedContrastsVerified':True,'permutationShapleyVerified':True,'cellMetricsVerified':True,'primary':a['overall']['primaryWorkloadWeatherInteraction']},indent=2))
