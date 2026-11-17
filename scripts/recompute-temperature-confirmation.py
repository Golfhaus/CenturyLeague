"""Independent direct-sum verification of the fixed confirmation comparisons."""
import csv,gzip,json,math,statistics,sys
from pathlib import Path
p=Path(sys.argv[1]);a=json.loads((p/'analysis.json').read_text());groups={};count=0
with gzip.open(p/'paired-outcomes.csv.gz','rt',newline='')as f:
 for r in csv.DictReader(f):
  g=groups.setdefault(r['fixture'],{'caseId':r['caseId'],'swap':r['swapped']=='true','arms':{}});assert r['arm']not in g['arms'];r['weather']=json.loads(r.pop('weatherJSON'));g['arms'][r['arm']]=r;count+=1
assert len(groups)==12288 and count==24576 and all(set(g['arms'])=={'candidate','reference'}for g in groups.values())
def close(x,y):assert math.isclose(x,y,rel_tol=1e-9,abs_tol=1e-9),(x,y)
def verify_interval(values,saved,z):
 n=len(values);total=math.fsum(values);mean=total/n;se=math.sqrt(max(0,math.fsum(v*v for v in values)-total*total/n)/(n*(n-1)))
 assert n==saved['n'];close(mean,saved['mean']);close(se,saved['standardError']);close(z,saved['z'])
 for x,y in zip([mean-z*se,mean+z*se],saved['interval']):close(x,y)
def wilson(k,n,z):
 d=n+z*z;mid=(k+z*z/2)/d;h=z*math.sqrt(k*(n-k)/n+z*z/4)/d;return max(0,mid-h),min(1,mid+h)
def energy(r):
 w=r['weather'];return .5*(w['energySeconds'][0]/w['activePlayerSeconds'][0]+w['energySeconds'][1]/w['activePlayerSeconds'][1])
def verify(rows,saved):
 values=[];wins=[];plus=minus=0
 for g in rows:
  h,c=g['arms']['candidate'],g['arms']['reference'];values.append(float(h['focalScore'])-float(c['focalScore'])-float(h['opponentScore'])+float(c['opponentScore']));d=int(float(h['focalWin']))-int(float(c['focalWin']));plus+=d==1;minus+=d==-1;wins.append(d)
 n=len(rows);k=saved['familySize'];verify_interval(values,saved['scoreMargin'],statistics.NormalDist().inv_cdf(1-.05/(2*k)));close(100*(plus-minus)/n,saved['winChangePoints']);assert plus==saved['changedToFocal']and minus==saved['changedAgainstFocal'];assert n-plus-minus==saved['unchangedWinner']
 se=100*math.sqrt((plus+minus-(plus-minus)**2/n)/(n*(n-1)));close(se,saved['winStandardErrorPoints']);z=statistics.NormalDist().inv_cdf(1-.05/(4*k));x,y=wilson(plus,n,z),wilson(minus,n,z)
 for v,w in zip([100*(x[0]-y[1]),100*(x[1]-y[0])],saved['winInterval']):close(v,w)
 verify_interval([100*(energy(g['arms']['candidate'])-energy(g['arms']['reference']))for g in rows],saved['activeEnergyPoints'],1.96)
 verify_interval([(float(g['arms']['candidate']['playingSeconds'])-float(g['arms']['reference']['playingSeconds']))/60 for g in rows],saved['durationMinutes'],1.96)
 verify_interval([sum(float(g['arms']['candidate'][k])-float(g['arms']['reference'][k])for k in ['focalScore','opponentScore'])for g in rows],saved['combinedScore'],1.96)
for b in a['cases']:
 rows=[g for g in groups.values()if g['caseId']==b['caseId']];assert len(rows)==4096;verify(rows,b['fresh'])
 for side in b['sides']:verify([g for g in rows if g['swap']==side['swap']],side['values'])
 for key,saved in b['cells'].items():
  wins=sum(float(g['arms'][key]['focalWin'])for g in rows);close(100*wins/4096,saved['winRatePct']);close(sum(energy(g['arms'][key])for g in rows)/4096,saved['equalClubWeightedActiveEnergy'])
  for role in ['focal','opponent']:
   en=active=fatigue=checks=shift=0
   for g in rows:
    w=g['arms'][key]['weather'];s=int(g['swap'])if role=='focal'else 1-int(g['swap']);en+=w['energySeconds'][s];active+=w['activePlayerSeconds'][s];fatigue+=w['extraRequestedFatigue'][s];c=w['probabilities']['kick'][s];checks+=c['opportunities'];shift+=c['adjustedProbabilitySum']-c['baselineProbabilitySum']
   cell=saved['clubs'][role];close(en/active,cell['activeEnergy']);close(1000*fatigue/active,cell['extraFatiguePer1000PlayerSeconds']);assert checks==cell['kickChecks'];close(shift*100/checks,cell['directWeatherKickShiftPoints']);assert shift==0
 old=b['screen'];oldse=100*math.sqrt((old['changedToFocal']+old['changedAgainstFocal']-(old['changedToFocal']-old['changedAgainstFocal'])**2/old['n'])/(old['n']*(old['n']-1)))
 diff=b['fresh']['winChangePoints']-old['winChangePoints'];se=math.hypot(b['fresh']['winStandardErrorPoints'],oldse);close(diff,b['freshMinusScreen']['winChangePoints'])
 for x,y in zip([diff-1.96*se,diff+1.96*se],b['freshMinusScreen']['nominal95']):close(x,y)
d=next(b for b in a['cases']if b['caseId']=='dover-35-total')['fresh']['winInterval'];assert a['doverWeatherFamilyIntervalWithinProvisionalEightPointReview']==(d[0]>-8 and d[1]<8)
proof={'status':'passed','fixtureClusters':12288,'outcomes':24576,'primaryWinnerFamilyContrasts':3,'scoreMarginAndSideContrastsVerified':True,'physicalMetricsAndDenominatorsVerified':True,'screenComparisonVerifiedWithoutPooling':True}
(p/'independent-recomputation.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps(proof))
