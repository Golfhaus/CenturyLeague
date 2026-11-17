"""Paired weather factorial analysis, report and complete ledger preservation."""
import argparse,csv,gzip,hashlib,html,json,math,tarfile,zipfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('repo',type=Path);p.add_argument('out',type=Path);p.add_argument('sources',type=Path);p.add_argument('--reuse-archives',action='store_true');p.add_argument('--compact-only',action='store_true');p.add_argument('--evidence-dir',type=Path);args=p.parse_args()
repo=args.repo.resolve();out=args.out.resolve();sources=args.sources.resolve();out.mkdir(parents=True,exist_ok=True)
for name in ['save-status.json','delivery-status.json']:
 if(out/name).exists():
  previous_attempt=json.loads((out/name).read_text());state=previous_attempt.get('state',previous_attempt.get('status'))
  if state in ['unconfirmed','unconfirmed-after-timeout','unknown','awaiting_receipt_check']:raise SystemExit('Delivery is unconfirmed. Preserve this output and reconcile the original write before regenerating it.')
if(out/'save-results.json').exists()and(out/'save-results.json').stat().st_size:raise SystemExit('Delivery receipts exist. Preserve Library identity; use a new review revision or an identity-preserving replacement.')
if args.compact_only and args.reuse_archives:raise SystemExit('Choose compact-only or verified archive reuse, not both.')
study=repo/'experiments/v2/runs/philadelphia-norfolk-weather-factorial-001';m=json.loads((study/'manifest.json').read_text());s=json.loads((study/'summary.json').read_text())
assert s['status']=='completed' and s['matchedFixtures']==800 and s['engineResults']==12800 and s['sourceSHA256']==m['sourceSHA256']
assert len(s['records'])==len(m['fixtures'])==800 and len(m['arms'])==16 and sum(f['swap']for f in m['fixtures'])==400
assert m['runtime']['workerExecArgv']==['--no-maglev']
previous=json.loads((sources/'previous-analysis.json').read_text());oldm=json.loads((sources/'previous-recheck-manifest.json').read_text())
assert m['profile']==oldm['profiles'][0] and m['coefficients']['weather']==oldm['coefficients']['weather']
assert not {f['seed']for f in m['fixtures']}&{f['seed']for f in oldm['fixtures']}
for r,f in zip(s['records'],m['fixtures']):assert r['fixture']==f and {a['id']for a in r['arms']}=={a['id']for a in m['arms']}
BITS={'Heat':1,'Wind + gusts':2,'Rain':4}
def describe(mask):return ' + '.join(name for name,bit in BITS.items()if mask&bit)or'Neutral'
def mean_interval(values,scale=1):
 n=len(values);v=sum(values)/n;se=math.sqrt(sum((x-v)**2 for x in values)/(n-1)/n)
 return {'n':n,'mean':scale*v,'ci95Approx':[scale*(v-1.96*se),scale*(v+1.96*se)],'standardError':scale*se}
def wilson(k,n,z=2.241403):
 p=k/n;den=1+z*z/n;mid=(p+z*z/(2*n))/den;half=z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den
 return max(0,mid-half),min(1,mid+half)
def vectors(rows,context,weights):
 win=[];margin=[]
 for r in rows:
  a={a['id']:a for a in r['arms']}
  win.append(sum(w*a[f'{context}-{mask}']['focalWin']for mask,w in weights.items()))
  margin.append(sum(w*(a[f'{context}-{mask}']['focalScore']-a[f'{context}-{mask}']['opponentScore'])for mask,w in weights.items()))
 return win,margin
def result(win,margin):return {'winPoints':mean_interval(win,100),'scoreMargin':mean_interval(margin)}
def shapley_weights(bit):
 others=[b for b in BITS.values()if b!=bit];a,b=others
 return {0:-1/3,bit:1/3,a:-1/6,a|bit:1/6,b:-1/6,b|bit:1/6,7^bit:-1/3,7:1/3}
def analyze(rows):
 corners={};shapley={};main={};interactions={};raw={}
 for context in ['original','matched']:
  cw,cm=vectors(rows,context,{7:1,0:-1});corner=result(cw,cm);n=len(rows)
  plus,minus=wilson(cw.count(1),n),wilson(cw.count(-1),n)
  corner['winConservative95']=[100*(plus[0]-minus[1]),100*(plus[1]-minus[0])];corner['improved']=cw.count(1);corner['worsened']=cw.count(-1)
  corners[context]=corner;raw[context]={'corner':(cw,cm),'shapley':{}}
  shapley[context]={};main[context]={};interactions[context]={}
  for name,bit in BITS.items():
   weights=shapley_weights(bit);w,v=vectors(rows,context,weights);raw[context]['shapley'][name]=(w,v)
   shapley[context][name]={'weights':weights,**result(w,v)}
   mainweights={mask:(.25 if mask&bit else-.25)for mask in range(8)}
   w,v=vectors(rows,context,mainweights);main[context][name]={'weights':mainweights,**result(w,v)}
  for name1,b1 in BITS.items():
   for name2,b2 in BITS.items():
    if b1>=b2:continue
    other=7^(b1|b2);weights={}
    for third in [0,other]:weights.update({third:.5,third|b1:-.5,third|b2:-.5,third|b1|b2:.5})
    w,v=vectors(rows,context,weights);interactions[context][name1+' × '+name2]={'weights':weights,**result(w,v)}
  weights={mask:(-1 if (3-mask.bit_count())%2 else 1)for mask in range(8)}
  w,v=vectors(rows,context,weights);interactions[context]['Heat × Wind × Rain']={'weights':weights,**result(w,v)}
  for j in range(len(rows)):
   assert math.isclose(sum(raw[context]['shapley'][name][0][j]for name in BITS),cw[j],abs_tol=1e-12)
   assert math.isclose(sum(raw[context]['shapley'][name][1][j]for name in BITS),cm[j],abs_tol=1e-10)
 dw=[a-b for a,b in zip(raw['matched']['corner'][0],raw['original']['corner'][0])];dm=[a-b for a,b in zip(raw['matched']['corner'][1],raw['original']['corner'][1])]
 changes={}
 for name in BITS:
  w=[a-b for a,b in zip(raw['matched']['shapley'][name][0],raw['original']['shapley'][name][0])]
  v=[a-b for a,b in zip(raw['matched']['shapley'][name][1],raw['original']['shapley'][name][1])];changes[name]=result(w,v)
 assert math.isclose(sum(x['winPoints']['mean']for x in changes.values()),100*sum(dw)/len(dw),abs_tol=1e-10)
 assert math.isclose(sum(x['scoreMargin']['mean']for x in changes.values()),sum(dm)/len(dm),abs_tol=1e-10)
 return {'n':len(rows),'primaryWorkloadWeatherInteraction':result(dw,dm),'fullWeatherEffects':corners,'shapley':shapley,'shapleyContextChanges':changes,'factorialMainEffects':main,'factorialInteractions':interactions}
overall=analyze(s['records']);sides=[{'swap':swap,**analyze([r for r in s['records']if r['fixture']['swap']==swap])}for swap in [False,True]]
cells=[]
for arm in m['arms']:
 rows=[next(a for a in r['arms']if a['id']==arm['id'])for r in s['records']];n=len(rows);secs=sum(a['playingSeconds']for a in rows);wins=sum(a['focalWin']for a in rows)
 metrics={}
 for focal in [True,False]:
  active=energy=extra=checks=shift=0
  for r,a in zip(s['records'],rows):
   side=int(r['fixture']['swap'])if focal else 1-int(r['fixture']['swap']);w=a['weather'];active+=w['activePlayerSeconds'][side];energy+=w['energySeconds'][side];extra+=w['extraRequestedFatigue'][side]
   c=w['probabilities']['kick'][side];checks+=c['opportunities'];shift+=c['adjustedProbabilitySum']-c['baselineProbabilitySum']
  metrics['focal'if focal else'opponent']={'activeEnergy':energy/active,'extraRequestedFatiguePer1000PlayerSeconds':1000*extra/active,'localKickProbabilityShiftPoints':100*shift/checks}
 cells.append({**arm,'weatherLabel':describe(arm['mask']),'n':n,'wins':wins,'winRatePct':100*wins/n,'winRate95WilsonPct':[100*x for x in wilson(wins,n,1.96)],
  'meanScoreMargin':sum(a['focalScore']-a['opponentScore']for a in rows)/n,'meanPlayingMinutes':secs/n/60,
  'focalShotsPerMinute':60*sum(a['focalShots']for a in rows)/secs,'opponentShotsPerMinute':60*sum(a['opponentShots']for a in rows)/secs,
  'focalFinalEnergy':sum(a['focalMeanFinalEnergy']for a in rows)/n,'opponentFinalEnergy':sum(a['opponentMeanFinalEnergy']for a in rows)/n,'metrics':metrics})
analysis={'schema':'century-weather-factorial-analysis-v1','classification':'lab-only-not-adopted','studyId':m['studyId'],'sourceSHA256':m['sourceSHA256'],
 'uniqueMatchedFixtures':800,'outcomes':12800,'overall':overall,'sideChecks':sides,'cells':cells,'previousRecheckSeparateNotPooled':previous['targetedPrimaryPhiladelphia'],
 'scope':'Single matchup. Matched intervention changes only Philadelphia tempo, running emphasis and pressure jointly. No individual tactic identification, tolerance extremes, psychology or empirical physical calibration.',
 'intervalCaution':'800 fixture clusters, not 12800 independent samples. Primary and secondary approximate paired intervals are nominal per contrast; direct corner win effects additionally use conservative paired Wilson intervals. No simultaneous protection.',
 'allocationCaution':'Shapley is a specified interaction allocation. Signed allocations add to full change; their intervals must not be added. This is not unique physical attribution.'}
analysis['assessment']={'finding':'Heat is the clearest adverse diagnostic component under original tactics at nominal per-contrast levels; wind and rain allocations remain unresolved. The primary workload-weather interaction is unconfirmed.',
 'recommendation':'Keep weather coefficients and original official coaches unchanged, with 0.35 still provisional. Prioritize broader real-club heat validation before further global reduction. Do not attribute all raw matched-context gains to weather mitigation.',
 'crossStudyCaution':'Current original full-weather win effect is -3.125 points versus prior -8.375; their conservative intervals overlap. The corresponding score-margin effects are similar (-2.74875 versus -2.58625). Studies remain separate.'}
(out/'independent-analysis.json').write_text(json.dumps(analysis,indent=2)+'\n');(out/'manifest.json').write_bytes((study/'manifest.json').read_bytes())
(out/'summary.json').write_text(json.dumps({k:v for k,v in s.items()if k!='records'},indent=2)+'\n')
flat=[]
for r in s['records']:
 for a in r['arms']:flat.append({'fixture':r['fixture']['id'],'trial':r['fixture']['trial'],'swapped':r['fixture']['swap'],**{k:v for k,v in a.items()if k!='weather'},'weatherJSON':json.dumps(a['weather'],separators=(',',':'))})
with gzip.open(out/'paired-outcomes.csv.gz','wt',newline='')as f:w=csv.DictWriter(f,fieldnames=list(flat[0]));w.writeheader();w.writerows(flat)
if args.compact_only:
 archives=json.loads((out/'full-ledger-archives.json').read_text())if(out/'full-ledger-archives.json').exists()else[]
 archive_state='referenced'if archives else'deferred'
 (out/'full-ledger-archives.json').write_text(json.dumps(archives,indent=2)+'\n')
elif args.reuse_archives:
 archive_state='verified'
 archives=json.loads((out/'full-ledger-archives.json').read_text())
 for a in archives:
  q=out/a['file'];assert q.stat().st_size==a['sizeBytes']and hashlib.file_digest(q.open('rb'),'sha256').hexdigest()==a['sha256']
else:
 archive_state='verified'
 chunks=[];chunk=[];size=1048576+(study/'manifest.json').stat().st_size
 for f in m['fixtures']:
  amount=(study/(f['id']+'.json.gz')).stat().st_size+2048
  if chunk and size+amount>300*1048576:chunks.append(chunk);chunk=[];size=1048576+(study/'manifest.json').stat().st_size
  chunk.append(f);size+=amount
 if chunk:chunks.append(chunk)
 archives=[]
 for i,chunk in enumerate(chunks,1):
  q=out/f'Century_Weather_Factorial_Full_Ledgers_part_{i:02d}.tar'
  with tarfile.open(q,'w')as t:
   t.add(study/'manifest.json',arcname='manifest.json')
   for f in chunk:t.add(study/(f['id']+'.json.gz'),arcname='ledgers/'+f['id']+'.json.gz')
  with tarfile.open(q)as t:
   assert len(t.getmembers())==len(chunk)+1
   for member in t.getmembers()[1:]:
    b=t.extractfile(member).read();assert hashlib.sha256(b).digest()==hashlib.sha256((study/Path(member.name).name).read_bytes()).digest();gzip.decompress(b)
  assert q.stat().st_size<512*1048576
  archives.append({'file':q.name,'fixtures':len(chunk),'outcomes':len(chunk)*16,'gzipCRCValidated':True,'sizeBytes':q.stat().st_size,'sha256':hashlib.file_digest(q.open('rb'),'sha256').hexdigest()})
  print(json.dumps({'archived':q.name,'fixtures':len(chunk)}),flush=True)
 (out/'full-ledger-archives.json').write_text(json.dumps(archives,indent=2)+'\n')
if archives:assert sum(x['fixtures']for x in archives)==800 and sum(x['outcomes']for x in archives)==12800
else:assert args.compact_only
(out/'archive-status.json').write_text(json.dumps({'state':archive_state,'eventLedgersRemainLocal':True,'fixtureLedgers':800,'bulkDeliveryRequested':not args.compact_only},indent=2)+'\n')
archive_note='Bulk event archive preparation and delivery are deferred; original event ledgers remain in the study directory.'if archive_state=='deferred'else'A prior archive index is referenced; bulk event bytes were not re-read for this compact handoff.'if archive_state=='referenced'else'Full ledger archives were byte-checked and every gzip stream/CRC verified.'
def effect(x):return f"{x['mean']:+.2f} ({x['ci95Approx'][0]:+.2f} to {x['ci95Approx'][1]:+.2f})"
def direct_win(x):return f"{x['winPoints']['mean']:+.2f} ({x['winConservative95'][0]:+.2f} to {x['winConservative95'][1]:+.2f})"
def table(headers,rows):return '<div class="scroll"><table><tr>'+''.join('<th>'+html.escape(str(x))+'</th>'for x in headers)+'</tr>'+''.join('<tr>'+''.join('<td>'+html.escape(str(x))+'</td>'for x in row)+'</tr>'for row in rows)+'</table></div>'
primary=overall['primaryWorkloadWeatherInteraction']['scoreMargin'];lo,hi=primary['ci95Approx']
assessment=('Matching the three workload settings weakened Philadelphia’s full-weather score-margin penalty in this model, with a supported positive primary interaction.'if lo>0 else'Matching the three workload settings strengthened Philadelphia’s full-weather score-margin penalty in this model, with a supported negative primary interaction.'if hi<0 else'The primary interval does not resolve whether matching the three workload settings changes Philadelphia’s full-weather score-margin penalty. This does not establish absence of a tactical interaction.')
parts=['<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Century weather components and workload</title><style>body{font:17px/1.6 system-ui;background:#eef3f4;color:#17333d;margin:0}main{max-width:1250px;margin:24px auto;background:white;padding:30px;border-radius:14px}h1,h2{color:#134a55;line-height:1.25}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:9px;text-align:left;border-bottom:1px solid #d7e3e6}th{background:#134a55;color:white}tr:nth-child(even){background:#f3f7f8}@media(max-width:650px){main{padding:16px;margin:0}table{font-size:12px}}</style><main>',
 '<h1>Weather components and workload: Philadelphia–Norfolk</h1><p>Completed 800 fresh matched fixture clusters and 12,800 outcomes. Each seed ran all heat × wind × rain combinations under original and matched workload settings. Heat was 18/35 C; wind/gusts 0/0 or 35/50 km/h; rain 0/5 mm/hour. Humidity stayed 80% and physical end policy stayed explicit. No coefficients, ratings, official coaches or v1.0 data were changed.</p>',
 '<h2>Primary workload–weather interaction</h2><p>'+assessment+'</p><p>The matched context changes only Philadelphia tempo 5→4, running emphasis 5→4 and pressure 3→2, matching Norfolk. It does not neutralize all other tactics or isolate one setting. Psychology and temperature-tolerance traits were disabled; the optional 0.35 candidate remains provisional and inactive here.</p>',
 '<h2>Assessment and next step</h2><p>Heat is the clearest adverse diagnostic component under original tactics: allocated mean margin −1.86 (nominal 95% interval −3.04 to −0.68). The wind and rain allocations remain uncertain. These secondary intervals are not simultaneous; the result identifies a conditional model response, not an empirical physiological calibration.</p><p>Keep the coefficients and official coaches unchanged. The 0.35 candidate remains provisional. Broader heat validation across the copied real clubs is the next useful step before further global reduction. No coding defect was established by this study.</p>',
 table(['Difference in weather effects: matched minus original','Estimate (nominal approximate 95% interval)'],[['Primary: mean score margin',effect(primary)],['Secondary: win probability, points',effect(overall['primaryWorkloadWeatherInteraction']['winPoints'])]]),
 '<p>The matched-context win rates were 53.125% versus 47.00% in neutral weather, and 51.375% versus 43.875% in full weather. Thus most of the observed raw gain was already present in neutral conditions. The weather-specific interaction is only +1.375 win-rate points (−5.352 to +8.102); do not describe the full raw gain as proven weather protection.</p>',
 '<h2>Full weather versus neutral</h2>',table(['Tactical context','Win-rate change, points (conservative 95%)','Mean score-margin change (approximate 95%)'],[[c,direct_win(overall['fullWeatherEffects'][c]),effect(overall['fullWeatherEffects'][c]['scoreMargin'])]for c in ['original','matched']]),
 '<p>The earlier independent 800-fixture recheck estimated Philadelphia’s shared-weather disadvantage at −8.375 win-rate points (−15.146 to −1.500). The fresh original-tactics estimate is −3.125 (−9.861 to +3.650), and the intervals overlap. Mean score-margin effects are similar: −2.58625 previously and −2.74875 here. These separate studies were not pooled, and the earlier −8.375 should not be treated as a known constant.</p>',
 '<h2>Allocated component contributions to score margin</h2><p>These signed Shapley allocations average six possible orders of introducing the components. They sum exactly to full weather minus neutral, including allocated interactions. Differences between contexts sum to the primary interaction. This is a declared allocation, not a unique physical attribution. Interval endpoints do not add and are not simultaneous.</p>',
 table(['Component','Original tactics','Matched workload','Matched minus original'],[[name,effect(overall['shapley']['original'][name]['scoreMargin']),effect(overall['shapley']['matched'][name]['scoreMargin']),effect(overall['shapleyContextChanges'][name]['scoreMargin'])]for name in BITS]),
 '<h2>Allocated contributions to win probability</h2>',table(['Component','Original tactics, points','Matched workload, points','Difference, points'],[[name,effect(overall['shapley']['original'][name]['winPoints']),effect(overall['shapley']['matched'][name]['winPoints']),effect(overall['shapleyContextChanges'][name]['winPoints'])]for name in BITS]),
 '<h2>Non-additive weather interactions</h2><p>Pair interactions average over both states of the third component. The triple interaction is the alternating eight-cell contrast. These score-margin intervals are exploratory and per contrast.</p>',table(['Weather interaction','Original tactics','Matched workload'],[[name,effect(overall['factorialInteractions']['original'][name]['scoreMargin']),effect(overall['factorialInteractions']['matched'][name]['scoreMargin'])]for name in overall['factorialInteractions']['original']]),
 '<h2>All observed conditions</h2><p>Each row contains 800 outcomes on the same matched seeds. Raw cell results below are descriptive; 12,800 outcomes are not 12,800 independent fixture samples.</p>',table(['Context','Weather','Philadelphia wins','Win rate','Mean margin','Playing minutes'],[[x['context'],x['weatherLabel'],str(x['wins'])+'/800',f"{x['winRatePct']:.2f}%",f"{x['meanScoreMargin']:+.2f}",f"{x['meanPlayingMinutes']:.2f}"]for x in cells]),
 '<h2>Energy and execution at the corners</h2><p>Active energy is weighted by active-player seconds. Local kick shifts compare adjusted and baseline probabilities at the same observed checks. They are diagnostic counters, not overall skill changes or uniquely identified mediators.</p>',table(['Context / weather','Philadelphia active energy','Norfolk active energy','Philadelphia kick shift, points','Norfolk kick shift, points','Philadelphia shots/min','Norfolk shots/min'],[[x['context']+' / '+x['weatherLabel'],f"{x['metrics']['focal']['activeEnergy']:.4f}",f"{x['metrics']['opponent']['activeEnergy']:.4f}",f"{x['metrics']['focal']['localKickProbabilityShiftPoints']:+.3f}",f"{x['metrics']['opponent']['localKickProbabilityShiftPoints']:+.3f}",f"{x['focalShotsPerMinute']:.3f}",f"{x['opponentShotsPerMinute']:.3f}"]for x in cells if x['mask']in [0,7]]),
 '<h2>Simulation-side checks</h2>',table(['Philadelphia simulation side','Primary score-margin interaction','Secondary win-rate interaction, points'],[['Second'if x['swap']else'First',effect(x['primaryWorkloadWeatherInteraction']['scoreMargin']),effect(x['primaryWorkloadWeatherInteraction']['winPoints'])]for x in sides]),
 '<h2>Reliability and limits</h2><p>Before execution, all input constructions, exact replay of four old outcomes, calm parity against frozen v1.0 in both contexts and both sides, immutable rosters, full save/resume of 32 outcomes and corrupt telemetry rejection passed. All 12,800 outcomes passed score, statistics, clock, immutable-input and retained-result checks. Thirty-two first-fixture outcomes were fully replayed and four neutral controls checked against v1.0. All 64 protected source files and the final lab lock passed. '+archive_note+'</p>',
 '<p>Intervals use fixture-level paired contrasts, not arm-level pseudo-replication. The primary interval is a large-sample approximation. Secondary and side intervals are nominal per contrast without simultaneous protection. A supported model intervention effect is conditional on these rosters, fixed availability and severe component levels; it is not empirical physiology, a global balance ceiling, cold validation or proof about every tactical setting.</p><p>The compact bundle preserves the pinned plan, manifests, compact outcomes, independent calculations, source patch, copied profiles and full-ledger checksum index. All official competition data remain unchanged.</p></main></html>']
report=out/'Century_Weather_Components_and_Workload.html';report.write_text('\n'.join(parts))
files={q.name:q for q in [report,out/'independent-analysis.json',out/'manifest.json',out/'summary.json',out/'paired-outcomes.csv.gz',out/'full-ledger-archives.json',out/'archive-status.json']}
files.update({'fixed-study-plan.md':repo/'docs/WEATHER_FACTORIAL_PLAN_2026_11_13.md','results-summary.md':repo/'docs/WEATHER_FACTORIAL_RESULTS_2026_11_13.md','previous-analysis.json':sources/'previous-analysis.json','previous-recheck-manifest.json':sources/'previous-recheck-manifest.json',
 'reproduction/source.patch':sources/'source.patch','reproduction/copied-profiles.json':sources/'copied-profiles.json','reproduction/recompute.py':repo/'scripts/recompute-weather-factorial.py','reproduction/report-and-archive.py':Path(__file__),
})
evidence={};evidence_dir=args.evidence_dir or study/'verification'
for name,legacy in [('preflight.json','century-factorial-preflight.json'),('clean-source.json','century-factorial-portable-source.json'),('independent-csv-recomputation.json','century-factorial-recomputed.json')]:
 candidates=[evidence_dir/name]if args.evidence_dir else[evidence_dir/name,Path('/tmp')/legacy];source=next((q for q in candidates if q.is_file()),None)
 evidence[name]='included'if source else'unavailable'
 if source:files['verification/'+name]=source
(out/'evidence-status.json').write_text(json.dumps(evidence,indent=2)+'\n');files['evidence-status.json']=out/'evidence-status.json'
target=out/'Century_Weather_Components_and_Workload_Data.zip'
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=6)as z:
 for n,q in files.items():z.write(q,n)
 z.writestr('CHECKSUMS.sha256','\n'.join(hashlib.sha256(q.read_bytes()).hexdigest()+'  '+n for n,q in files.items())+'\n')
 z.writestr('reproduction/README.txt','Recompute: python3 reproduction/recompute.py EXTRACTED_BUNDLE_DIR. Apply source.patch to Golfhaus/CenturyLeague commit 1f867ad5de47a6e8c40b70cbcb379e8751c72e8a. Node v24.22.1; --no-maglev is enforced. Run node experiments/v2/run-weather-factorial.mjs --profiles /absolute/path/to/copied-profiles.json --workers 8. Defaults pin 800 trials and study ID. Restore manifest and all ledgers/*.json.gz under experiments/v2/runs/philadelphia-norfolk-weather-factorial-001 to resume; omit compact summary. Every saved result fully replays. No earlier study pooled, no official adoption or external publication.\n')
with zipfile.ZipFile(target)as z:assert z.testzip()is None
uploads=[{'local_path':str(report),'purpose':'create_library_file','library_artifact_type':'report'},{'local_path':str(target),'purpose':'create_library_file','library_artifact_type':'other'}]+([]if args.compact_only else[{'local_path':str(out/a['file']),'purpose':'create_library_file','library_artifact_type':'other'}for a in archives])
(out/'uploads.json').write_text(json.dumps({'uploads':uploads})+'\n');print(json.dumps({'status':'completed','primary':primary,'fullWeatherEffects':overall['fullWeatherEffects'],'archives':len(archives)}),flush=True)
