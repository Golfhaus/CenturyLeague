"""Fixed three-case winner confirmation; previous screening sample stays separate."""
import csv,gzip,json,math,statistics,sys
from pathlib import Path
p=Path(sys.argv[1]);m=json.loads((p/'manifest.json').read_text());prior=json.loads((p/'prior-comparison/analysis.json').read_text());groups={}
with gzip.open(p/'paired-outcomes.csv.gz','rt',newline='')as f:
 for r in csv.DictReader(f):
  g=groups.setdefault(r['fixture'],{'caseId':r['caseId'],'profile':r['profile'],'trial':int(r['trial']),'swap':r['swapped']=='true','arms':{}})
  assert (g['caseId'],g['profile'],g['trial'],g['swap'])==(r['caseId'],r['profile'],int(r['trial']),r['swapped']=='true');assert r['arm']not in g['arms']
  a={k:float(r[k])for k in ['focalWin','focalScore','opponentScore','playingSeconds','focalShots','opponentShots','focalMeanFinalEnergy','opponentMeanFinalEnergy']};a['weather']=json.loads(r['weatherJSON']);g['arms'][r['arm']]=a
assert len(groups)==12288 and all(set(g['arms'])=={'reference','candidate'}for g in groups.values())
def interval(v,z=1.96):
 mean=statistics.mean(v);se=statistics.stdev(v)/math.sqrt(len(v));return {'n':len(v),'mean':mean,'standardError':se,'interval':[mean-z*se,mean+z*se],'z':z}
def wilson(k,n,z):
 q=k/n;d=1+z*z/n;mid=(q+z*z/2/n)/d;half=z*math.sqrt(q*(1-q)/n+z*z/4/n/n)/d;return max(0,mid-half),min(1,mid+half)
def energy(g,key):
 w=g['arms'][key]['weather'];return sum(w['energySeconds'][s]/w['activePlayerSeconds'][s]for s in [0,1])/2
def contrast(rows,family):
 wins=[];margins=[]
 for g in rows:
  h,c=g['arms']['candidate'],g['arms']['reference'];wins.append(h['focalWin']-c['focalWin']);margins.append(h['focalScore']-h['opponentScore']-c['focalScore']+c['opponentScore'])
 n=len(rows);plus=wins.count(1);minus=wins.count(-1);z=statistics.NormalDist().inv_cdf(1-.05/(4*family));a,b=wilson(plus,n,z),wilson(minus,n,z)
 return {'n':n,'familySize':family,'winChangePoints':100*statistics.mean(wins),'winStandardErrorPoints':100*statistics.stdev(wins)/math.sqrt(n),
  'winInterval':[100*(a[0]-b[1]),100*(a[1]-b[0])],'changedToFocal':plus,'changedAgainstFocal':minus,'unchangedWinner':n-plus-minus,
  'scoreMargin':interval(margins,statistics.NormalDist().inv_cdf(1-.05/(2*family))),
  'activeEnergyPoints':interval([100*(energy(g,'candidate')-energy(g,'reference'))for g in rows]),
  'durationMinutes':interval([(g['arms']['candidate']['playingSeconds']-g['arms']['reference']['playingSeconds'])/60 for g in rows]),
  'combinedScore':interval([sum(g['arms']['candidate'][k]-g['arms']['reference'][k]for k in ['focalScore','opponentScore'])for g in rows])}
def cell(rows,arm):
 n=len(rows);wins=sum(g['arms'][arm]['focalWin']for g in rows);out={'n':n,'wins':wins,'winRatePct':100*wins/n,'winWilson95':[100*x for x in wilson(wins,n,statistics.NormalDist().inv_cdf(.975))],
  'meanMinutes':statistics.mean(g['arms'][arm]['playingSeconds']for g in rows)/60,'equalClubWeightedActiveEnergy':statistics.mean(energy(g,arm)for g in rows),'clubs':{}}
 for role in ['focal','opponent']:
  en=active=extra=checks=shift=shots=0
  for g in rows:
   r=g['arms'][arm];s=int(g['swap'])if role=='focal'else 1-int(g['swap']);w=r['weather'];en+=w['energySeconds'][s];active+=w['activePlayerSeconds'][s];extra+=w['extraRequestedFatigue'][s];c=w['probabilities']['kick'][s];checks+=c['opportunities'];shift+=c['adjustedProbabilitySum']-c['baselineProbabilitySum'];shots+=r[role+'Shots']
  out['clubs'][role]={'activeEnergy':en/active,'activePlayerSeconds':active,'extraRequestedFatigue':extra,'extraFatiguePer1000PlayerSeconds':1000*extra/active,
   'meanFinalEnergy':statistics.mean(g['arms'][arm][role+'MeanFinalEnergy']for g in rows),'kickChecks':checks,'directWeatherKickShiftPoints':100*shift/checks,'shotsPerMinute':60*shots/sum(g['arms'][arm]['playingSeconds']for g in rows)}
 return out
blocks=[]
for case in m['cases']:
 rows=[g for g in groups.values()if g['caseId']==case['id']];assert len(rows)==4096 and sum(g['swap']for g in rows)==2048;assert sorted(g['trial']for g in rows)==list(range(4096));assert all(g['profile']==case['profile']for g in rows)
 profile=next(x for x in m['profiles']if x['id']==case['profile']);old=next(x for x in prior['matchups']if x['profile']==case['profile']);old=next(x['overall']for x in old['contrasts']if x['overall']['contrast']==case['candidate']+' minus '+case['reference']);assert old['winChangePoints']==case['screenWinPoints']
 current=contrast(rows,3);oldse=100*math.sqrt((old['changedToFocal']+old['changedAgainstFocal']-(old['winChangePoints']/100)**2*old['n'])/(old['n']*(old['n']-1)))
 difference=current['winChangePoints']-old['winChangePoints'];se=math.hypot(current['winStandardErrorPoints'],oldse)
 blocks.append({'caseId':case['id'],'profile':case['profile'],'focal':profile['teams'][0]['name'],'opponent':profile['teams'][1]['name'],'reference':case['reference'],'candidate':case['candidate'],
  'fresh':current,'cells':{arm:cell(rows,arm)for arm in ['reference','candidate']},'sides':[{'swap':s,'values':contrast([g for g in rows if g['swap']==s],1)}for s in [False,True]],
  'screen':old,'freshMinusScreen':{'winChangePoints':difference,'nominal95':[difference-1.96*se,difference+1.96*se],'interpretation':'Exploratory independent-sample difference after screening selection; no samples pooled.'}})
dover=next(b for b in blocks if b['caseId']=='dover-35-total')
analysis={'status':'completed','fixtureClusters':12288,'outcomes':24576,'sourceSHA256':m['sourceSHA256'],'cases':blocks,
 'doverWeatherFamilyIntervalWithinProvisionalEightPointReview':dover['fresh']['winInterval'][0]>-8 and dover['fresh']['winInterval'][1]<8,
 'limits':'Three selected contexts and one fixed trait population. No global ceiling, standalone trait budget, equivalence certification or automatic coefficient adoption.'}
(p/'analysis.json').write_text(json.dumps(analysis,indent=2)+'\n');print(json.dumps(analysis,indent=2))
