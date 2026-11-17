"""Independent confirmation analysis, compact data and complete split ledgers."""
import argparse,csv,gzip,hashlib,html,json,math,tarfile,zipfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('study',type=Path);p.add_argument('out',type=Path);p.add_argument('sources',type=Path);p.add_argument('--reuse-archives',action='store_true')
args=p.parse_args();study=args.study.resolve();out=args.out.resolve();sources=args.sources.resolve();repo=Path(__file__).resolve().parents[1]
out.mkdir(parents=True,exist_ok=True)
m=json.loads((study/'manifest.json').read_text());s=json.loads((study/'summary.json').read_text())
assert s['status']=='completed' and s['matchedFixtures']==3200 and s['engineResults']==19200
assert len(s['records'])==len(m['fixtures'])==3200 and len(m['arms'])==6
assert s['sourceSHA256']==m['sourceSHA256'] and m['runtime']['workerExecArgv']==['--no-maglev']
old=json.loads((sources/'screen_checkpoint/manifest.json').read_text())
screen=json.loads((sources/'screen_checkpoint/independent-analysis.json').read_text())
assert not {f['seed']for f in m['fixtures']}&{f['seed']for f in old['fixtures']}
assert m['coefficients']==old['coefficients'] and m['weatherStudy']['candidate']==old['weatherStudy']['candidate']
assert m['profiles']==old['profiles']
for arm in m['arms']:assert arm==next(a for a in old['arms']if a['id']==arm['id'])
arms=[a['id']for a in m['arms']];cases={}
for r,f in zip(s['records'],m['fixtures']):
 assert r['fixture']==f and f['id']not in cases
 cases[f['id']]={a['id']:a for a in r['arms']};assert set(cases[f['id']])==set(arms)
 assert (study/(f['id']+'.json.gz')).exists()

def contrast(records,case,reference):
 rows=[{a['id']:a for a in r['arms']}for r in records];n=len(rows)
 ds=[r[case]['focalWin']-r[reference]['focalWin']for r in rows];delta=sum(ds)/n
 def wilson(k):
  z=2.241403;p=k/n;den=1+z*z/n;mid=(p+z*z/(2*n))/den;half=z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den
  return max(0,mid-half),min(1,mid+half)
 plus,minus=wilson(ds.count(1)),wilson(ds.count(-1))
 se=math.sqrt(sum((d-delta)**2 for d in ds)/(n-1)/n)
 return {'case':case,'reference':reference,'n':n,'wins':sum(r[case]['focalWin']for r in rows),
  'referenceWins':sum(r[reference]['focalWin']for r in rows),'liftPoints':100*delta,
  'conservative95Points':[100*max(-1,plus[0]-minus[1]),100*min(1,plus[1]-minus[0])],
  'supplementaryPairedNormal95Points':[100*(delta-1.96*se),100*(delta+1.96*se)],
  'improved':ds.count(1),'worsened':ds.count(-1),
  'meanScoreMarginChange':sum((r[case]['focalScore']-r[case]['opponentScore'])-(r[reference]['focalScore']-r[reference]['opponentScore'])for r in rows)/n}

comparisons=[('hot-wet-traits-adverse','hot-wet-shared'),('hot-wet-traits-favored','hot-wet-shared'),
 ('hot-psych-favored','control'),('hot-psych-adverse','control'),
 ('hot-psych-favored','hot-wet-traits-favored'),('hot-psych-adverse','hot-wet-traits-adverse'),('hot-wet-shared','control')]
contrasts=[contrast(s['records'],a,b)for a,b in comparisons]
assert math.isclose(contrasts[0]['liftPoints']/100,s['primaryContrast']['winRateDifference'],abs_tol=1e-12)
assert contrasts[0]['improved']==s['primaryContrast']['improved'] and contrasts[0]['worsened']==s['primaryContrast']['worsened']
overall=[contrast(s['records'],a,'control')for a in arms]
for a,b in zip(overall,s['arms']):
 assert a['case']==b['id']
 assert a['wins']==b['wins'] and math.isclose(a['liftPoints']/100,b['pairedWinRateDifference'],abs_tol=1e-12)
 assert all(math.isclose(x,100*y,abs_tol=1e-10)for x,y in zip(a['conservative95Points'],b['pairedDifference95ConservativeWilson']))
profiles=[]
for p in m['profiles']:
 records=[r for r in s['records']if r['fixture']['profile']==p['id']]
 assert len(records)==400 and sum(r['fixture']['swap']for r in records)==200
 profiles.append({'id':p['id'],'focalClub':p['teams'][0]['name'],'opponent':p['teams'][1]['name'],
  'controlWins':sum(cases[r['fixture']['id']]['control']['focalWin']for r in records),
  'contrasts':[contrast(records,a,b)for a,b in comparisons]})
side_checks=[{'swap':swap,'contrasts':[contrast([r for r in s['records']if r['fixture']['swap']==swap],a,b)
 for a,b in comparisons]}for swap in [False,True]]
metrics=[]
for arm in arms:
 rows=[cases[f['id']][arm]for f in m['fixtures']];weather=[r['weather']for r in rows if r['weather']is not None]
 seconds=sum(r['playingSeconds']for r in rows);active=sum(sum(w['activePlayerSeconds'])for w in weather)
 kick=[c for w in weather for c in w['probabilities'].get('kick',[])];checks=sum(c['opportunities']for c in kick)
 metrics.append({'arm':arm,'meanPlayingMinutes':seconds/3200/60,
  'totalPointsPerPlayingMinute':sum(r['focalScore']+r['opponentScore']for r in rows)/seconds*60,
  'shotsPerPlayingMinute':sum(r['focalShots']+r['opponentShots']for r in rows)/seconds*60,
  'meanFocalFinalEnergy':sum(r['focalMeanFinalEnergy']for r in rows)/3200,
  'meanOpponentFinalEnergy':sum(r['opponentMeanFinalEnergy']for r in rows)/3200,
  'meanActiveEnergy':sum(sum(w['energySeconds'])for w in weather)/active if active else None,
  'energyFloorPercent':100*sum(sum(w['energyFloorSeconds'])for w in weather)/active if active else None,
  'extraRequestedFatiguePer1000PlayerSeconds':1000*sum(sum(w['extraRequestedFatigue'])for w in weather)/active if active else None,
  'kickChecks':checks,'meanLocalKickProbabilityChangePoints':100*sum(c['adjustedProbabilitySum']-c['baselineProbabilitySum']for c in kick)/checks if checks else None})
comparison=[{'case':c['case'],'reference':c['reference'],'screen':next(x for x in screen['contrasts']if x['case']==c['case']and x['reference']==c['reference']),'confirmation':c}for c in contrasts]
primary_screen=comparison[0]['screen']
planning_note={'genericManifestLegacyField':m['analysisPlan']['priorDiscordancePlanningEstimate'],
 'correctPrimaryScreenDiscordance':(primary_screen['improved']+primary_screen['worsened'])/primary_screen['n'],
 'primaryScreenDiscordantCount':primary_screen['improved']+primary_screen['worsened'],'primaryScreenFixtures':primary_screen['n'],
 'explanation':'The generic manifest retains the earlier psychology planning field 0.324. The hot/wet primary screen had 249 discordances in 512 fixtures (0.486328125). This field is nonoperative: 3200 confirmation fixtures were fixed before execution and all confidence intervals use actual confirmation counts. The original locked manifest is preserved unchanged.'}
analysis={'schema':'century-hot-wet-confirmation-analysis-v1','classification':'lab-only-not-adopted',
 'studyId':m['studyId'],'sourceSHA256':m['sourceSHA256'],'matchedFixtures':3200,'outcomes':19200,
 'primaryContrast':contrasts[0],'contrasts':contrasts,'allVersusControl':overall,'profiles':profiles,'sideChecks':side_checks,'metrics':metrics,
 'screenComparisonSeparateNotPooled':comparison,'unchangedCoefficientsAndProfiles':True,'noScreenSeedsReused':True,
 'planningMetadataClarification':planning_note,
 'intervalCaution':'Conservative paired intervals per contrast; no simultaneous protection across all comparisons. Single prespecified primary; profile and other secondary analyses exploratory.',
 'metricCaution':'Control has no active-energy weather telemetry in this study. Final energy is available in all arms. Extra requested fatigue is pre-floor model load; local probability shifts describe same-check differences.',
 'scope':'Eight selected copied profiles, extreme all-squad traits, fixed healthy availability and weather. No population-wide ceiling, adoption, halftime adaptation, accumulated seasons or official result writes.'}
analysis['physicalPointEstimateReviewFlags']=[c for c in contrasts[:2]if abs(c['liftPoints'])>8]
analysis['combinedPreferredLevelFlags']=[c for c in contrasts[2:4]if abs(c['liftPoints'])>10]
analysis['combinedReviewLevelFlags']=[c for c in contrasts[2:4]if abs(c['liftPoints'])>15]
analysis['exploratoryProfileCombinedReviewFlags']=[{'profile':p['id'],'focalClub':p['focalClub'],**c}for p in profiles for c in p['contrasts'][2:4]if abs(c['liftPoints'])>15]
(out/'independent-analysis.json').write_text(json.dumps(analysis,indent=2)+'\n')
(out/'manifest.json').write_bytes((study/'manifest.json').read_bytes())
(out/'summary.json').write_text(json.dumps({k:v for k,v in s.items()if k!='records'},indent=2)+'\n')
flat=[]
for r in s['records']:
 for a in r['arms']:
  flat.append({'fixture':r['fixture']['id'],'profile':r['fixture']['profile'],'trial':r['fixture']['trial'],'swapped':r['fixture']['swap'],
   **{k:v for k,v in a.items()if k not in ['weather','psychologyContributions']},'weatherJSON':json.dumps(a['weather'],separators=(',',':'))})
with gzip.open(out/'paired-outcomes.csv.gz','wt',newline='')as f:
 writer=csv.DictWriter(f,fieldnames=list(flat[0]));writer.writeheader();writer.writerows(flat)
if args.reuse_archives:
 archives=json.loads((out/'full-ledger-archives.json').read_text())
 assert len(archives)==16 and sum(a['fixtures']for a in archives)==3200
 for item in archives:
  target=out/item['file']
  assert target.stat().st_size==item['sizeBytes'] and item['gzipCRCValidated']
  assert hashlib.file_digest(target.open('rb'),'sha256').hexdigest()==item['sha256']
else:
 archives=[]
 for p in m['profiles']:
  fixtures=[f for f in m['fixtures']if f['profile']==p['id']]
  for part in range(2):
   selected=fixtures[part*200:(part+1)*200];target=out/f"Century_Hot_Wet_Confirmation_{p['id']}_part_{part+1}.tar"
   with tarfile.open(target,'w')as tar:
    tar.add(study/'manifest.json',arcname='manifest.json')
    for f in selected:tar.add(study/(f['id']+'.json.gz'),arcname='ledgers/'+f['id']+'.json.gz')
   with tarfile.open(target)as tar:
    members=tar.getmembers();assert len(members)==201
    for member in members[1:]:
     payload=tar.extractfile(member).read()
     assert hashlib.sha256(payload).digest()==hashlib.sha256((study/Path(member.name).name).read_bytes()).digest()
     gzip.decompress(payload)  # Verify every saved ledger's compressed stream and CRC.
   assert target.stat().st_size<512*1024*1024
   archives.append({'file':target.name,'profile':p['id'],'part':part+1,'focalClub':p['teams'][0]['name'],'fixtures':200,'outcomes':1200,
    'gzipCRCValidated':True,'sizeBytes':target.stat().st_size,'sha256':hashlib.file_digest(target.open('rb'),'sha256').hexdigest()})
   print(json.dumps({'archivedProfile':p['id'],'part':part+1,'sizeBytes':target.stat().st_size}),flush=True)
 (out/'full-ledger-archives.json').write_text(json.dumps(archives,indent=2)+'\n')

def effect(c):return f"{c['liftPoints']:+.2f} ({c['conservative95Points'][0]:+.2f} to {c['conservative95Points'][1]:+.2f})"
def table(headers,rows):return '<div class="scroll"><table><tr>'+''.join('<th>'+html.escape(str(x))+'</th>'for x in headers)+'</tr>'+''.join('<tr>'+''.join('<td>'+html.escape(str(x))+'</td>'for x in row)+'</tr>'for row in rows)+'</table></div>'
primary=contrasts[0];lo,hi=primary['conservative95Points'];fav=contrasts[1]
assessment=('The fresh primary estimate supports an adverse tolerance disadvantage.'if hi<0 else 'The primary direction remains unresolved at the conservative 95% level.')
assessment+=(' Its entire interval exceeds the eight-point physical review level in magnitude.'if hi < -8 else ' Its interval includes effects on both sides of the eight-point physical review level.'if lo < -8 < hi else ' Its interval is within the eight-point adverse physical review level.')
recommend='Test a modest thermal-only reduction before adoption, while keeping psychology unchanged. Both physical estimates sit close to the approximate eight-point review level and their intervals extend beyond it; the adverse combined estimate exceeds the preferred ten-point level. This is a design-headroom recommendation, not proof that the true thermal effect exceeds eight points. Also recheck the Philadelphia–Norfolk pairing on fresh matched seeds: its exploratory club-level results are uneven, and a thermal trim alone may not resolve shared-weather differences.'
parts=['<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
 '<title>Century hot/wet thermal confirmation</title><style>body{font:17px/1.6 system-ui,sans-serif;margin:0;background:#eef3f4;color:#17333d}main{max-width:1180px;margin:28px auto;background:white;border-radius:14px;padding:34px}h1,h2{line-height:1.2;color:#134a55}h2{margin-top:2em}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;border-bottom:1px solid #d7e3e6;padding:10px}th{background:#134a55;color:white}tr:nth-child(even){background:#f3f7f8}code{overflow-wrap:anywhere}@media(max-width:650px){main{margin:0;padding:18px}table{font-size:12px}}</style><main>',
 '<h1>Hot/wet temperature-tolerance confirmation</h1><p>Completed 3,200 fresh matched fixtures and 19,200 outcomes across six unchanged conditions. Each of eight copied founding profiles contributed 400 fresh seeds, balanced across simulation sides. Screening results were excluded from the new estimate. Weather and psychology coefficients, rosters, ratings and coaches were unchanged.</p>',
 '<h2>Assessment</h2><p>'+html.escape(assessment)+'</p><p>'+html.escape(recommend)+'</p>',
 '<h2>Comparison with the previous screen</h2><p>Win-rate changes are percentage points. Parentheses give conservative paired 95% intervals. These are separate studies, not a pooled estimate. Different point estimates with overlapping intervals need not indicate an engine defect.</p>',
 table(['Case minus reference','Screen: 512 fixtures','Fresh confirmation: 3,200'],[[c['case']+' minus '+c['reference'],effect(c['screen']),effect(c['confirmation'])]for c in comparison]),
 '<h2>Primary comparison</h2><p>The prespecified primary was adverse thermal traits minus mean tolerance in identical hot/wet weather. It changed '+str(primary['improved'])+' paired losses into wins and '+str(primary['worsened'])+' wins into losses. The paired mean score-margin change was '+f"{primary['meanScoreMarginChange']:+.3f}"+' points. All-squad extremes deliberately set heat tolerance to 0 versus 1; cold tolerance remains neutral.</p>',
 '<h2>Absolute wins</h2>',table(['Arm','Wins / 3,200','Win rate','Change versus calm (95% interval)'],[[c['case'],c['wins'],f"{100*c['wins']/3200:.2f}%",effect(c)if c['case']!='control'else'Reference']for c in overall]),
 '<h2>Club-level checks</h2><p>Each row has 400 fixtures. Club-level intervals are exploratory and wider than the overall estimate.</p>',
 table(['Focal club','Opponent','Calm wins / 400','Adverse traits minus shared weather','Favored traits minus shared weather','Combined favored minus calm','Combined adverse minus calm'],[[p['focalClub'],p['opponent'],p['controlWins'],effect(p['contrasts'][0]),effect(p['contrasts'][1]),effect(p['contrasts'][2]),effect(p['contrasts'][3])]for p in profiles]),
 '<p>Three exploratory club-level combined point estimates pass the fifteen-point review level: Norfolk favored +15.50, Hagerstown adverse −15.25, and Philadelphia adverse −19.75. Their intervals remain wide and are not simultaneous. Philadelphia also showed −11.75 points for shared hot/wet weather alone (95% interval −21.17 to −2.04), so its combined result cannot be attributed entirely to thermal tolerance or psychology. These are targeted-recheck flags, not established club-specific ceilings or proof of a coding defect.</p>',
 '<h2>Simulation-side checks</h2>',table(['Focal simulation side','Adverse traits minus shared weather','Favored traits minus shared weather'],[['Second'if x['swap']else'First',effect(x['contrasts'][0]),effect(x['contrasts'][1])]for x in side_checks]),
 '<h2>Match behavior</h2><p>Century ends at 100 points, so playing time and scoring pace help describe shared physical effects. Control active-energy counters were not collected in this confirmation; final energy is available for every arm. No unavailable counters are borrowed from another seed or study.</p>',
 table(['Arm','Playing minutes','Points / minute','Final focal energy','Final opponent energy','Active energy'],[[x['arm'],f"{x['meanPlayingMinutes']:.2f}",f"{x['totalPointsPerPlayingMinute']:.3f}",f"{x['meanFocalFinalEnergy']:.4f}",f"{x['meanOpponentFinalEnergy']:.4f}",f"{x['meanActiveEnergy']:.4f}"if x['meanActiveEnergy']is not None else'Not collected']for x in metrics]),
 '<h2>Interpretation and limits</h2><p>The approximately eight-point extreme physical level, preferred ten-point combined level and fifteen-point combined review level are design review criteria, not outcome clamps or empirically measured physiological limits. Per-contrast intervals do not simultaneously cover every secondary contrast or profile. This is one fixed severe environment and selected club cohort, not a universal perfect-storm bound. Normal trait distributions, additional weather conditions, halftime adaptation and accumulating season histories require separate validation.</p>',
 '<p>Heat traits moderate additional energy costs and recovery burdens, without a temperate rating bonus. Rain and wind affect execution and movement. Alternate-quarter ends remain a lab assumption. All coefficients remain lab hypotheses; nothing was adopted into the official competition.</p>',
 '<h2>Reliability and reproduction</h2><p>Before the confirmation, 48 selected screened outcomes reproduced their full result hashes exactly; frozen v1.0 checks, all-six-arm save/resume, trait-role mapping and corrupt telemetry rejection passed. All main outcomes passed clock, score, statistics, integrity, input immutability and shared psychological cap checks. The first fixture for every profile/arm was fully replayed, with controls checked against frozen v1.0. All 64 v1.0 files remained unchanged.</p>',
 '<p>The compact bundle includes the fixed plan, both study estimates, manifests, compact confirmation outcomes, independent analysis, source patch, copied profiles and standalone recomputation. Sixteen split full-ledger archives preserve every input and event, indexed with SHA-256 checksums. No source was published remotely.</p></main></html>']
parts[-1]=parts[-1].replace('</main>', '<p>Planning metadata clarification: the generic manifest retains an earlier psychology planning field of 0.324. The hot/wet primary screen had 249 discordant pairs in 512 fixtures (0.486328125). The fixed 3,200-fixture plan and reported intervals do not use that stale field; all result intervals use actual confirmation counts. The original locked manifest is preserved unchanged.</p></main>')
(out/'Century_Hot_Wet_Thermal_Confirmation.html').write_text('\n'.join(parts))
files={name:out/name for name in ['Century_Hot_Wet_Thermal_Confirmation.html','independent-analysis.json','manifest.json','summary.json','paired-outcomes.csv.gz','full-ledger-archives.json']}
files.update({'fixed-study-plan.md':repo/'docs/HOT_WET_THERMAL_CONFIRMATION_PLAN_2026_11_13.md',
 'previous-screen-analysis.json':sources/'screen_checkpoint/independent-analysis.json',
 'reproduction/source.patch':sources/'confirmation-reproduction.patch','reproduction/copied-profiles.json':sources/'screen_checkpoint/reproduction/copied-profiles.json',
 'reproduction/recompute.py':repo/'scripts/recompute-hot-wet-confirmation.py','reproduction/analyze-and-archive.py':Path(__file__),
 'verification/screen-replay.json':Path('/tmp/century-confirm-replay.json'),'verification/save-resume.json':Path('/tmp/century-confirm-smoke.json'),
 'verification/clean-source-reconstruction.json':Path('/tmp/century-confirm-portable-source.json'),
 'verification/independent-csv-recomputation.json':Path('/tmp/century-confirmation-recompute.json')})
target=out/'Century_Hot_Wet_Thermal_Confirmation_Data.zip'
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=6)as z:
 for name,p in files.items():z.write(p,name)
 z.writestr('CHECKSUMS.sha256','\n'.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+n for n,p in files.items())+'\n')
 z.writestr('reproduction/README.txt','Statistical recomputation: python3 reproduction/recompute.py EXTRACTED_BUNDLE_DIRECTORY. Full replay: apply source.patch to Golfhaus/CenturyLeague commit 1f867ad5de47a6e8c40b70cbcb379e8751c72e8a; use Node v24.22.1 with --no-maglev. Command: node experiments/v2/run-streaks.mjs --study-id hot-wet-thermal-confirmation-001 --trials 400 --workers 8 --date 2026-11-13 --arms psychology-weather-confirm --psychology-candidate reduced-020 --profiles /absolute/path/to/copied-profiles.json. To resume, put the manifest and all ledgers/*.json.gz from the sixteen archives in experiments/v2/runs/hot-wet-thermal-confirmation-001, omit compact summary, then rerun the command. All saved results replay. Original screen analysis is separate; never pool its seeds. Source was not published remotely.\n')
with zipfile.ZipFile(target)as z:assert z.testzip()is None
uploads=[{'local_path':str(out/a['file']),'purpose':'create_library_file','library_artifact_type':'other'}for a in archives]
uploads += [{'local_path':str(out/'Century_Hot_Wet_Thermal_Confirmation.html'),'purpose':'create_library_file','library_artifact_type':'report'},
 {'local_path':str(target),'purpose':'create_library_file','library_artifact_type':'other'}]
(out/'uploads.json').write_text(json.dumps({'uploads':uploads})+'\n')
print(json.dumps({'status':'completed','primary':contrasts[0],'contrasts':contrasts,'dataPackageBytes':target.stat().st_size}),flush=True)
