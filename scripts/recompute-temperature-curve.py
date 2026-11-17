"""Independent direct-sum verification of the complete declared curve analysis."""
import csv,gzip,json,math,statistics,sys
from pathlib import Path
p=Path(sys.argv[1]);a=json.loads((p/'analysis.json').read_text());groups={};count=0
with gzip.open(p/'paired-outcomes.csv.gz','rt',newline='')as f:
 for r in csv.DictReader(f):
  g=groups.setdefault(r['fixture'],{'profile':r['profile'],'swap':r['swapped']=='true','arms':{}});assert r['arm']not in g['arms'];r['weather']=json.loads(r.pop('weatherJSON'));g['arms'][r['arm']]=r;count+=1
assert count==10240 and len(groups)==1024;allrows=list(groups.values())
def close(x,y):assert math.isclose(x,y,rel_tol=1e-9,abs_tol=1e-9),(x,y)
def verify_interval(values,saved,z):
 n=len(values);total=math.fsum(values);mean=total/n;se=math.sqrt(max(0,math.fsum(v*v for v in values)-total*total/n)/(n*(n-1)))
 assert saved['n']==n;close(mean,saved['mean']);close(se,saved['standardError']);close(z,saved['z'])
 for x,y in zip([mean-z*se,mean+z*se],saved['interval']):close(x,y)
def energy(g,key):
 w=g['arms'][key]['weather'];return .5*(w['energySeconds'][0]/w['activePlayerSeconds'][0]+w['energySeconds'][1]/w['activePlayerSeconds'][1])
def physical(rows,hi,lo,saved,z=1.96):
 verify_interval([100*(energy(g,hi)-energy(g,lo))for g in rows],saved['activeEnergyPoints'],z)
 verify_interval([(float(g['arms'][hi]['playingSeconds'])-float(g['arms'][lo]['playingSeconds']))/60 for g in rows],saved['durationMinutes'],1.96)
 verify_interval([sum(float(g['arms'][hi][k])-float(g['arms'][lo][k])for k in ['focalScore','opponentScore'])for g in rows],saved['combinedScore'],1.96)
for b in a['primary']:physical(allrows,f"t{b['temperatureC']}-normal-035",'temperate',b['contrast'],statistics.NormalDist().inv_cdf(1-.05/6))
for b in a['physicalCurves']:
 hi=f"t{b['temperatureC']}-{b['variant']}";physical(allrows,hi,'temperate',b['versusTemperate']);close(math.fsum(energy(g,hi)for g in allrows)/1024,b['cell']['equalClubWeightedActiveEnergy'])
for b in a['physicalSecondary']:
 hi,lo=b['contrast'].split(' minus ');physical(allrows,hi,lo,b['values'])
def wilson(k,n,z):
 d=n+z*z;mid=(k+z*z/2)/d;h=z*math.sqrt(k*(n-k)/n+z*z/4)/d;return max(0,mid-h),min(1,mid+h)
def competitive(rows,saved):
 hi,lo=saved['contrast'].split(' minus ');family=saved['familySize'];z=statistics.NormalDist().inv_cdf(1-.05/(2*family));zw=statistics.NormalDist().inv_cdf(1-.05/(4*family));values=[];plus=minus=0
 for g in rows:
  h,c=g['arms'][hi],g['arms'][lo];values.append(float(h['focalScore'])-float(c['focalScore'])-float(h['opponentScore'])+float(c['opponentScore']));d=int(float(h['focalWin']))-int(float(c['focalWin']));plus+=d==1;minus+=d==-1
 n=len(rows);verify_interval(values,saved['scoreMargin'],z);assert plus==saved['changedToFocal']and minus==saved['changedAgainstFocal'];close(100*(plus-minus)/n,saved['winChangePoints']);x,y=wilson(plus,n,zw),wilson(minus,n,zw)
 for want,got in zip([100*(x[0]-y[1]),100*(x[1]-y[0])],saved['winInterval']):close(want,got)
checked=0
for b in a['matchups']:
 rows=[g for g in allrows if g['profile']==b['profile']];assert len(rows)==256
 for c in b['contrasts']:
  competitive(rows,c['overall']);checked+=1
  for side in c['sides']:competitive([g for g in rows if g['swap']==side['swap']],side['values']);checked+=1
 for key,cell in b['cells'].items():
  close(sum(float(g['arms'][key]['focalWin'])for g in rows)*100/256,cell['focalWinRatePct']);close(sum(energy(g,key)for g in rows)/256,cell['equalClubWeightedActiveEnergy'])
  for role in ['focal','opponent']:
   en=active=fatigue=checks=shift=0
   for g in rows:
    w=g['arms'][key]['weather'];side=int(g['swap'])if role=='focal'else 1-int(g['swap']);en+=w['energySeconds'][side];active+=w['activePlayerSeconds'][side];fatigue+=w['extraRequestedFatigue'][side];c=w['probabilities']['kick'][side];checks+=c['opportunities'];shift+=c['adjustedProbabilitySum']-c['baselineProbabilitySum']
   got=cell['clubs'][role];close(en/active,got['activeEnergy']);close(1000*fatigue/active,got['extraFatiguePer1000PlayerSeconds']);close(100*shift/checks,got['directWeatherKickShiftPoints']);assert checks==got['kickChecks'];assert shift==0
   if key=='temperate':assert fatigue==0
proof={'status':'passed','fixtureClusters':1024,'outcomes':10240,'primaryPhysicalFamilyContrasts':3,'competitiveContrastsIncludingSidesVerified':checked,'allDeclaredPhysicalContrastsVerified':True,'clubCellsAndPhysicalDenominatorsVerified':True}
(p/'independent-recomputation.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps(proof))
