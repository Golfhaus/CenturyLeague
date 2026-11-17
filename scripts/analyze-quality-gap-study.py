"""Fixed-stage paired analysis. No resimulation, tuning, or cross-study pooling."""
import csv,gzip,json,math,statistics,sys
from pathlib import Path
p=Path(sys.argv[1]);m=json.loads((p/'manifest.json').read_text());groups={};ids=[a['id']for a in m['arms']]
with gzip.open(p/'paired-outcomes.csv.gz','rt',newline='')as f:
 for r in csv.DictReader(f):
  g=groups.setdefault(r['fixture'],{'profile':r['profile'],'trial':int(r['trial']),'swap':r['swapped']=='true','arms':{}})
  assert (g['profile'],g['trial'],g['swap'])==(r['profile'],int(r['trial']),r['swapped']=='true');assert r['arm']not in g['arms']
  a={k:float(r[k])for k in ['focalWin','focalScore','opponentScore','playingSeconds','focalShots','opponentShots','focalMeanFinalEnergy','opponentMeanFinalEnergy']};a['weather']=json.loads(r['weatherJSON']);a['lab']=json.loads(r['labJSON']);g['arms'][r['arm']]=a
expected=36 if m['studyId'].startswith('quality-preflight-')else 5632 if m['stage']=='controls'else 2304
assert len(groups)==expected and all(set(g['arms'])==set(ids)for g in groups.values());gs=list(groups.values())
def interval(v,z=1.96):
 n=len(v);mean=statistics.mean(v);se=statistics.stdev(v)/math.sqrt(n)
 return {'n':n,'mean':mean,'standardError':se,'interval':[mean-z*se,mean+z*se],'z':z}
def energy(g,arm):
 w=g['arms'][arm]['weather'];return sum(w['energySeconds'][i]/w['activePlayerSeconds'][i]for i in [0,1])/2
def physical_contrast(rows,hi,lo,z=1.96):
 return {'activeEnergyPoints':interval([100*(energy(g,hi)-energy(g,lo))for g in rows],z),
  'durationMinutes':interval([(g['arms'][hi]['playingSeconds']-g['arms'][lo]['playingSeconds'])/60 for g in rows]),
  'combinedScore':interval([sum(g['arms'][hi][k]-g['arms'][lo][k]for k in ['focalScore','opponentScore'])for g in rows])}
def wilson(k,n,z):
 q=k/n;d=1+z*z/n;mid=(q+z*z/2/n)/d;h=z*math.sqrt(q*(1-q)/n+z*z/4/n/n)/d;return max(0,mid-h),min(1,mid+h)
def competitive(rows,hi,lo,family=1):
 z=statistics.NormalDist().inv_cdf(1-.05/(2*family));zw=statistics.NormalDist().inv_cdf(1-.05/(4*family));ds=[];wins=[]
 for g in rows:
  a,b=g['arms'][hi],g['arms'][lo];ds.append(a['focalScore']-a['opponentScore']-b['focalScore']+b['opponentScore']);wins.append(a['focalWin']-b['focalWin'])
 n=len(rows);plus=wins.count(1);minus=wins.count(-1);a,b=wilson(plus,n,zw),wilson(minus,n,zw)
 return {'contrast':hi+' minus '+lo,'n':n,'scoreMargin':interval(ds,z),'winChangePoints':100*statistics.mean(wins),
  'winInterval':[100*(a[0]-b[1]),100*(a[1]-b[0])],'changedToFocal':plus,'changedAgainstFocal':minus,'familySize':family}
def cell(rows,arm):
 out={'n':len(rows),'focalWinRatePct':100*statistics.mean(g['arms'][arm]['focalWin']for g in rows),
  'equalClubWeightedActiveEnergy':statistics.mean(energy(g,arm)for g in rows),'meanMinutes':statistics.mean(g['arms'][arm]['playingSeconds']for g in rows)/60,
  'meanCombinedScore':statistics.mean(sum(g['arms'][arm][k]for k in ['focalScore','opponentScore'])for g in rows),'clubs':{}}
 for role in ['focal','opponent']:
  active=en=extra=checks=shift=shots=0
  for g in rows:
   r=g['arms'][arm];side=int(g['swap'])if role=='focal'else 1-int(g['swap']);w=r['weather'];active+=w['activePlayerSeconds'][side];en+=w['energySeconds'][side];extra+=w['extraRequestedFatigue'][side]
   c=w['probabilities']['kick'][side];checks+=c['opportunities'];shift+=c['adjustedProbabilitySum']-c['baselineProbabilitySum'];shots+=r[role+'Shots']
  out['clubs'][role]={'activeEnergy':en/active,'activePlayerSeconds':active,'requestedExtraFatigue':extra,'extraFatiguePer1000PlayerSeconds':1000*extra/active,
   'meanFinalEnergy':statistics.mean(g['arms'][arm][role+'MeanFinalEnergy']for g in rows),'kickChecks':checks,'directWeatherKickShiftPoints':100*shift/checks,
   'shotsPerMinute':60*shots/sum(g['arms'][arm]['playingSeconds']for g in rows)}
 return out
def telemetry(rows,arm):
 out={}
 for role in ['focal','opponent']:
  contacts=fouls=serious=prob=baseline=cap=0;contributions={k:[]for k in ['confidenceOddsBonus','homeOddsBonus','crowdEnthusiasm','rawOddsBonus','appliedOddsBonus']}
  for g in rows:
   side=int(g['swap'])if role=='focal'else 1-int(g['swap']);lab=g['arms'][arm]['lab'];c=lab['severity'][side]
   contacts+=lab['contacts'][side];fouls+=c['opportunities'];serious+=c['successes'];prob+=c['adjustedProbabilitySum'];baseline+=c['baselineProbabilitySum'];psy=lab['psychology']['contributions'][side];cap+=psy['saturated']
   for k in contributions:contributions[k].append(psy[k])
  out[role]={'contacts':contacts,'fouls':fouls,'seriousFouls':serious,'foulsPer100Contacts':100*fouls/contacts if contacts else None,'seriousPctOfFouls':100*serious/fouls if fouls else None,'severityAdjustedProbabilitySum':prob,'severityBaselineProbabilitySum':baseline,'saturatedFixtures':cap,'capSaturationPct':100*cap/len(rows),'meanPsychology':{k:statistics.mean(v)for k,v in contributions.items()}}
 return out
profiles={p['id']:p for p in m['profiles']};is_test=m['studyId'].startswith('quality-preflight-')
def binomial(rows,family=1):
 n=len(rows);wins=sum(int(g['arms']['control']['focalWin'])for g in rows);z=statistics.NormalDist().inv_cdf(1-.05/(2*family));return{'n':n,'wins':wins,'winRate':wins/n,'interval':list(wilson(wins,n,z)),'familySize':family}
if m['stage']=='controls':
 gapCells=[]
 gaps=sorted({p['gap']for p in m['profiles']})
 for gap in gaps:
  rows=[g for g in gs if profiles[g['profile']]['gap']==gap];v={'gap':gap,**binomial(rows,len(gaps)),'cell':cell(rows,'control'),'disciplineAndPsychology':telemetry(rows,'control'),'tactics':[],'sides':[]}
  for t in ['neutral','pressure']:
   sub=[g for g in rows if profiles[g['profile']]['tactics']==t];v['tactics'].append({'tactics':t,**binomial(sub)})
  for side in [False,True]:v['sides'].append({'swap':side,**binomial([g for g in rows if g['swap']==side])})
  gapCells.append(v)
 profileControls=[]
 for p0 in m['profiles']:
  rows=[g for g in gs if g['profile']==p0['id']];assert len(rows)==m['trialsPerProfile'];assert sum(g['swap']for g in rows)==len(rows)//2;profileControls.append({'profile':p0['id'],'gap':p0['gap'],'tactics':p0['tactics'],'replicate':p0['replicate'],**binomial(rows),'cell':cell(rows,'control')})
 a={'status':'completed','stage':m['stage'],'studyId':m['studyId'],'sourceSHA256':m['sourceSHA256'],'harnessSHA256':m['harnessSHA256'],'fixtureClusters':expected,'outcomes':expected,'gapCells':gapCells,'profileControls':profileControls,'limits':'Control-only fixture eligibility screen; no modifier estimate or winner clamp. One protected family of11 pooled rates in research; tactic/side/profile intervals nominal. All candidate offsets retained; no target-dependent extension.'}
else:
 ordinary=[('ordinary-'+d,'control')for d in ['favored','adverse']];psych=[('psych-'+d,'control')for d in ['favored','adverse']];extreme=[(f'{e}-combined-{d}','control')for e in ['hot','cold']for d in ['favored','adverse']];pairs=ordinary+psych+extreme;strata=[]
 for quality in ['matched','weaker','stronger']:
  rows=[g for g in gs if profiles[g['profile']]['quality']==quality];assert rows;control=binomial(rows,3);bounds={'matched':[.4,.6],'weaker':[.2,.45],'stronger':[.55,.8]}[quality];within=control['interval'][0]>=bounds[0]and control['interval'][1]<=bounds[1]
  b={'quality':quality,'gap':profiles[rows[0]['profile']]['gap'],'n':len(rows),'freshControl':control,'freshControlTarget':bounds,'freshControlClassification':'within-pilot-target'if within else'pilot-target-not-confirmed','cells':{arm:cell(rows,arm)for arm in ids},'disciplineAndPsychology':{arm:telemetry(rows,arm)for arm in ids},'ordinaryFamily':[competitive(rows,*v,6)for v in ordinary],'psychologyFamily':[competitive(rows,*v,6)for v in psych],'extremeFamily':[competitive(rows,*v,12)for v in extreme],'contrasts':[competitive(rows,*v)for v in pairs],'physicalContrasts':[{'contrast':hi+' minus '+lo,'values':physical_contrast(rows,hi,lo)}for hi,lo in pairs],'tactics':[],'sides':[],'ordinaryRegimes':[]}
  for t in ['neutral','pressure']:
   sub=[g for g in rows if profiles[g['profile']]['tactics']==t];b['tactics'].append({'tactics':t,'n':len(sub),'control':binomial(sub),'cells':{arm:cell(sub,arm)for arm in ids},'contrasts':[competitive(sub,*v)for v in pairs]})
  for side in [False,True]:
   sub=[g for g in rows if g['swap']==side];b['sides'].append({'swap':side,'n':len(sub),'contrasts':[competitive(sub,*v)for v in pairs]})
  for regime in range(3):
   sub=[g for g in rows if(g['trial']//2)%3==regime];assert sub;b['ordinaryRegimes'].append({'regime':regime,'n':len(sub),'contrasts':[competitive(sub,*v)for v in ordinary]})
  strata.append(b)
 matchups=[]
 for p0 in m['profiles']:
  rows=[g for g in gs if g['profile']==p0['id']];n=m['trialsPerProfile'];assert len(rows)==n and sum(g['swap']for g in rows)==n//2;assert sorted(g['trial']for g in rows)==list(range(n));assert [sum((g['trial']//2)%3==r for g in rows)for r in range(3)]==[n//3]*3
  matchups.append({'profile':p0['id'],'quality':p0['quality'],'gap':p0['gap'],'tactics':p0['tactics'],'replicate':p0['replicate'],'control':binomial(rows),'cells':{arm:cell(rows,arm)for arm in ids},'contrasts':[{'overall':competitive(rows,*v),'sides':[{'swap':side,'values':competitive([g for g in rows if g['swap']==side],*v)}for side in [False,True]]}for v in pairs]})
 flags=[]
 for b in strata:
  for v in b['contrasts']:
   limit=5 if v['contrast'].startswith('ordinary-')else 4 if v['contrast'].startswith('psych-')else 10
   if abs(v['winChangePoints'])>limit:flags.append({'quality':b['quality'],'contrast':v['contrast'],'pointChange':v['winChangePoints'],'interval':v['winInterval'],'reviewReference':limit,'classification':'descriptive-screen-flag-not-confirmed-threshold-failure'})
 a={'status':'completed','stage':m['stage'],'studyId':m['studyId'],'sourceSHA256':m['sourceSHA256'],'harnessSHA256':m['harnessSHA256'],'fixtureClusters':expected,'outcomes':expected*len(ids),'selection':m['selection'],'strata':strata,'matchups':matchups,'descriptiveFlags':flags,'limits':'Fresh selected-input follow-up; pilot outcomes excluded. Three synthetic quality strata never pooled. Separate ordinary family6, psychology family6 and extreme family12; fresh control family3. All template/tactic/regime/side/profile contrasts exploratory nominal. No reselection if controls drift; no ceiling certification, official players, halftime, season carryover, tuning or adoption.'}
(p/'analysis.json').write_text(json.dumps(a,indent=2)+'\n');print(json.dumps({'status':'completed','stage':m['stage'],'clusters':expected,'gapCells':[{k:v[k]for k in ['gap','n','wins','winRate','interval']}for v in a.get('gapCells',[])],'qualities':[{'quality':s['quality'],'control':s['freshControl'],'ordinary':s['ordinaryFamily'],'psychology':s['psychologyFamily'],'extremes':s['extremeFamily']}for s in a.get('strata',[])]},indent=2))
