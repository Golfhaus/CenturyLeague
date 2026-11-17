"""Independent paired analysis and portable preservation for two fixed cohorts."""
import argparse,csv,gzip,hashlib,html,json,math,tarfile,zipfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('repo',type=Path);p.add_argument('out',type=Path);p.add_argument('sources',type=Path);p.add_argument('--reuse-archives',action='store_true');args=p.parse_args()
repo=args.repo.resolve();out=args.out.resolve();sources=args.sources.resolve();out.mkdir(parents=True,exist_ok=True)
ids={'main':'thermal-reduction-screen-001','targeted':'philadelphia-norfolk-weather-recheck-001'};studies={}
for cohort,id in ids.items():
 d=repo/'experiments/v2/runs'/id;m=json.loads((d/'manifest.json').read_text());s=json.loads((d/'summary.json').read_text())
 n,k=(1600,10)if cohort=='main'else(800,2)
 assert s['status']=='completed' and s['matchedFixtures']==n and s['engineResults']==n*k
 assert len(s['records'])==len(m['fixtures'])==n and len(m['arms'])==k and m['sourceSHA256']==s['sourceSHA256']
 assert m['runtime']['workerExecArgv']==['--no-maglev']
 for r,f in zip(s['records'],m['fixtures']):assert r['fixture']==f and len(r['arms'])==k
 studies[cohort]={'dir':d,'m':m,'s':s}
assert studies['main']['m']['sourceSHA256']==studies['targeted']['m']['sourceSHA256']
allseeds=[f['seed']for c in studies.values()for f in c['m']['fixtures']];assert len(set(allseeds))==2400
previous=json.loads((sources/'previous-confirmation-manifest.json').read_text());prior=json.loads((sources/'previous-confirmation-analysis.json').read_text())
assert not set(allseeds)&{f['seed']for f in previous['fixtures']}
assert studies['main']['m']['profiles']==previous['profiles']
def contrast(records,case,reference):
 rows=[{a['id']:a for a in r['arms']}for r in records];n=len(rows);ds=[r[case]['focalWin']-r[reference]['focalWin']for r in rows];v=sum(ds)/n
 def wilson(k):
  z=2.241403;t=k/n;den=1+z*z/n;mid=(t+z*z/(2*n))/den;half=z*math.sqrt(t*(1-t)/n+z*z/(4*n*n))/den
  return max(0,mid-half),min(1,mid+half)
 plus,minus=wilson(ds.count(1)),wilson(ds.count(-1));se=math.sqrt(sum((d-v)**2 for d in ds)/(n-1)/n)
 margins=[r[case]['focalScore']-r[case]['opponentScore']-r[reference]['focalScore']+r[reference]['opponentScore']for r in rows]
 margin=sum(margins)/n;ms=math.sqrt(sum((x-margin)**2 for x in margins)/(n-1)/n)
 return {'case':case,'reference':reference,'n':n,'wins':sum(r[case]['focalWin']for r in rows),'referenceWins':sum(r[reference]['focalWin']for r in rows),
 'liftPoints':100*v,'improved':ds.count(1),'worsened':ds.count(-1),'conservative95Points':[100*(plus[0]-minus[1]),100*(plus[1]-minus[0])],
 'supplementaryPairedNormal95Points':[100*(v-1.96*se),100*(v+1.96*se)],
 'meanScoreMarginChange':margin,'scoreMarginChange95Approx':[margin-1.96*ms,margin+1.96*ms]}
comparisons=[('reduced-hot-wet-traits-adverse','hot-wet-traits-adverse'),('reduced-hot-wet-traits-favored','hot-wet-traits-favored'),
 ('reduced-hot-psych-favored','hot-psych-favored'),('reduced-hot-psych-adverse','hot-psych-adverse'),
 ('hot-wet-traits-adverse','hot-wet-shared'),('reduced-hot-wet-traits-adverse','hot-wet-shared'),
 ('hot-wet-traits-favored','hot-wet-shared'),('reduced-hot-wet-traits-favored','hot-wet-shared'),
 ('hot-psych-favored','control'),('reduced-hot-psych-favored','control'),('hot-psych-adverse','control'),('reduced-hot-psych-adverse','control'),
 ('reduced-hot-psych-favored','reduced-hot-wet-traits-favored'),('reduced-hot-psych-adverse','reduced-hot-wet-traits-adverse'),
 ('hot-wet-shared','control'),('hot-psych-favored','hot-wet-traits-favored'),('hot-psych-adverse','hot-wet-traits-adverse')]
main=studies['main'];target=studies['targeted'];cs=[contrast(main['s']['records'],a,b)for a,b in comparisons];tc=contrast(target['s']['records'],'hot-wet-shared','control')
assert sum(r['fixture']['swap']for r in target['s']['records'])==400
metrics={}
for cohort,obj in studies.items():
 metrics[cohort]=[]
 for arm in obj['m']['arms']:
  rows=[next(a for a in r['arms']if a['id']==arm['id'])for r in obj['s']['records']];n=len(rows);seconds=sum(r['playingSeconds']for r in rows)
  metrics[cohort].append({'arm':arm['id'],'meanPlayingMinutes':seconds/n/60,
   'totalPointsPerPlayingMinute':60*sum(r['focalScore']+r['opponentScore']for r in rows)/seconds,
   'focalShotsPerPlayingMinute':60*sum(r['focalShots']for r in rows)/seconds,
   'opponentShotsPerPlayingMinute':60*sum(r['opponentShots']for r in rows)/seconds,
   'meanFocalFinalEnergy':sum(r['focalMeanFinalEnergy']for r in rows)/n,
   'meanOpponentFinalEnergy':sum(r['opponentMeanFinalEnergy']for r in rows)/n})
reciprocal={**tc,'view':'Norfolk from same physical fixtures','wins':tc['n']-tc['wins'],'referenceWins':tc['n']-tc['referenceWins'],
 'liftPoints':-tc['liftPoints'],'improved':tc['worsened'],'worsened':tc['improved'],
 'conservative95Points':[-tc['conservative95Points'][1],-tc['conservative95Points'][0]],'meanScoreMarginChange':-tc['meanScoreMarginChange']}
reciprocal.pop('supplementaryPairedNormal95Points',None)
reciprocal['scoreMarginChange95Approx']=[-tc['scoreMarginChange95Approx'][1],-tc['scoreMarginChange95Approx'][0]]
profiles=[]
for pr in main['m']['profiles']:
 rows=[r for r in main['s']['records']if r['fixture']['profile']==pr['id']];assert len(rows)==200 and sum(r['fixture']['swap']for r in rows)==100
 profiles.append({'id':pr['id'],'club':pr['teams'][0]['name'],'opponent':pr['teams'][1]['name'],'contrasts':[contrast(rows,a,b)for a,b in comparisons]})
allversus=[contrast(main['s']['records'],a['id'],'control')for a in main['m']['arms']]
sidechecks={c:[{'swap':swap,'contrasts':[contrast([r for r in obj['s']['records']if r['fixture']['swap']==swap],a,b)for a,b in (comparisons if c=='main'else[('hot-wet-shared','control')])]}for swap in [False,True]]for c,obj in studies.items()}
analysis={'schema':'century-thermal-reduction-analysis-v1','classification':'lab-only-not-adopted','uniqueMatchedFixtures':2400,'outcomes':17600,
 'sourceSHA256':main['m']['sourceSHA256'],'mainPrimary':cs[0],'mainContrasts':cs,'allVersusControl':allversus,'profiles':profiles,'sideChecks':sidechecks,'metrics':metrics,
 'targetedPrimaryPhiladelphia':tc,'reciprocalNorfolk':reciprocal,
 'priorConfirmationSeparateNotPooled':prior['contrasts'],'priorPhiladelphiaWeather':next(p for p in prior['profiles']if p['id']=='pair-3-focal-1')['contrasts'][6],
 'physicalReducedPointFlags':[c for c in [cs[5],cs[7]]if abs(c['liftPoints'])>8],
 'combinedReducedPreferredFlags':[c for c in [cs[9],cs[11]]if abs(c['liftPoints'])>10],
 'combinedReducedReviewFlags':[c for c in [cs[9],cs[11]]if abs(c['liftPoints'])>15],
 'exploratoryReducedProfileCombinedFlags':[{'club':p['club'],**c}for p in profiles for c in [p['contrasts'][9],p['contrasts'][11]]if abs(c['liftPoints'])>15],
 'limitations':['Candidate screen, not a ceiling certificate or empirical physiology calibration.','All-squad trait extremes, fixed hot/wet environment, eight selected profiles, healthy reset availability. No cold validation.','Per-contrast nominal conservative intervals; profile and secondary comparisons not simultaneous.','Recheck reciprocal views are complements, not extra samples; this identity is not proof of engine order invariance.','No official result, history, v1.0, coefficient adoption or external publication writes.']}
analysis['posthocMatchupDiagnostics']={'tactics':{t['name']:t['coach']['tactics']for t in target['m']['profiles'][0]['teams']},
 'interpretation':'Descriptive post-hoc diagnostics only. Attack production and energy changes can motivate a weather-by-roster/strategy hypothesis; they do not isolate temperature, rain, wind, tactics or player ratings causally. A component/strategy ablation is required before attributing the repeatable shared-weather effect.'}
analysis['recommendation']={'status':'retain-035-as-provisional-lab-candidate-no-adoption',
 'basis':'All four pooled point estimates moved toward neutral. The primary paired win-rate interval still includes zero, so improved win probability is unconfirmed. Review-level headroom is also unresolved.',
 'nextStep':'Isolate heat, wind and rain and their interactions in Philadelphia–Norfolk, with controlled strategy comparisons, before further global coefficient tuning. Keep psychology fixed. A larger fresh confirmation is still required before adopting 0.35.'}
(out/'independent-analysis.json').write_text(json.dumps(analysis,indent=2)+'\n')
flat=[]
for cohort,obj in studies.items():
 (out/(cohort+'-manifest.json')).write_bytes((obj['dir']/'manifest.json').read_bytes());(out/(cohort+'-summary.json')).write_text(json.dumps({k:v for k,v in obj['s'].items()if k!='records'},indent=2)+'\n')
 for r in obj['s']['records']:
  for a in r['arms']:
   flat.append({'cohort':cohort,'fixture':r['fixture']['id'],'profile':r['fixture']['profile'],'trial':r['fixture']['trial'],'swapped':r['fixture']['swap'],**{k:v for k,v in a.items()if k not in ['weather','psychologyContributions']},'weatherJSON':json.dumps(a['weather'],separators=(',',':'))})
with gzip.open(out/'paired-outcomes.csv.gz','wt',newline='')as f:w=csv.DictWriter(f,fieldnames=list(flat[0]));w.writeheader();w.writerows(flat)
if args.reuse_archives:
 archives=json.loads((out/'full-ledger-archives.json').read_text())
 for item in archives:
  q=out/item['file'];assert q.stat().st_size==item['sizeBytes'] and hashlib.file_digest(q.open('rb'),'sha256').hexdigest()==item['sha256']
else:
 archives=[]
 for cohort,obj in studies.items():
  for pr in obj['m']['profiles']:
   fixtures=[f for f in obj['m']['fixtures']if f['profile']==pr['id']];chunks=[];chunk=[];size=(obj['dir']/'manifest.json').stat().st_size+1048576
   for f in fixtures:
    q=obj['dir']/(f['id']+'.json.gz');amount=q.stat().st_size+2048
    if chunk and size+amount>300*1048576:chunks.append(chunk);chunk=[];size=1048576+(obj['dir']/'manifest.json').stat().st_size
    chunk.append(f);size+=amount
   if chunk:chunks.append(chunk)
   for part,chunk in enumerate(chunks,1):
    dest=out/f"Century_Thermal_Reduction_{cohort}_{pr['id']}_part_{part}.tar"
    with tarfile.open(dest,'w')as t:
     t.add(obj['dir']/'manifest.json',arcname='manifest.json')
     for f in chunk:t.add(obj['dir']/(f['id']+'.json.gz'),arcname='ledgers/'+f['id']+'.json.gz')
    with tarfile.open(dest)as t:
     assert len(t.getmembers())==len(chunk)+1
     for member in t.getmembers()[1:]:
      b=t.extractfile(member).read();assert hashlib.sha256(b).digest()==hashlib.sha256((obj['dir']/Path(member.name).name).read_bytes()).digest();gzip.decompress(b)
    assert dest.stat().st_size<512*1048576
    archives.append({'file':dest.name,'cohort':cohort,'profile':pr['id'],'fixtures':len(chunk),'outcomes':len(chunk)*len(obj['m']['arms']),
     'gzipCRCValidated':True,'sizeBytes':dest.stat().st_size,'sha256':hashlib.file_digest(dest.open('rb'),'sha256').hexdigest()})
    print(json.dumps({'archived':dest.name,'fixtures':len(chunk)}),flush=True)
 (out/'full-ledger-archives.json').write_text(json.dumps(archives,indent=2)+'\n')
assert sum(a['fixtures']for a in archives)==2400 and sum(a['outcomes']for a in archives)==17600
def effect(c):return f"{c['liftPoints']:+.2f} ({c['conservative95Points'][0]:+.2f} to {c['conservative95Points'][1]:+.2f})"
def margin(c):return f"{c['meanScoreMarginChange']:+.2f} ({c['scoreMarginChange95Approx'][0]:+.2f} to {c['scoreMarginChange95Approx'][1]:+.2f})"
def table(headers,rows):return '<div class="scroll"><table><tr>'+''.join('<th>'+html.escape(str(x))+'</th>'for x in headers)+'</tr>'+''.join('<tr>'+''.join('<td>'+html.escape(str(x))+'</td>'for x in row)+'</tr>'for row in rows)+'</table></div>'
primary=cs[0];supported=primary['conservative95Points'][0]>0
text=('The paired primary comparison supports a smaller adverse thermal penalty with moderation 0.35.'if supported else 'The paired primary comparison supports a larger adverse win-rate penalty with moderation 0.35 in this screen; the reduced coefficient should not be described as a win-probability improvement.'if primary['conservative95Points'][1]<0 else 'The paired primary comparison does not resolve whether moderation 0.35 reduces the adverse win-rate penalty at the conservative 95% level. Its point estimate remains useful screening evidence, not proof of equivalence.')
targettext=('The fresh recheck supports a directional shared-weather disadvantage for Philadelphia.'if tc['conservative95Points'][1]<0 else'The fresh recheck supports a shared-weather advantage for Philadelphia.'if tc['conservative95Points'][0]>0 else'The fresh recheck does not establish a directional shared-weather effect for Philadelphia. This does not prove zero effect or prove the earlier result was noise.')
parts=['<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Century thermal reduction and matchup recheck</title><style>body{font:17px/1.6 system-ui;background:#eef3f4;color:#17333d;margin:0}main{max-width:1200px;margin:24px auto;background:white;padding:30px;border-radius:14px}h1,h2{color:#134a55;line-height:1.25}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:9px;text-align:left;border-bottom:1px solid #d7e3e6}th{background:#134a55;color:white}tr:nth-child(even){background:#f3f7f8}@media(max-width:650px){main{padding:16px;margin:0}table{font-size:12px}}</style><main>',
 '<h1>Thermal reduction and Philadelphia–Norfolk recheck</h1><p>Completed 1,600 fresh candidate-screen fixtures across eight unchanged copied profiles, plus 800 separate shared-weather recheck fixtures: 17,600 outcomes. Moderation 0.35 was compared directly with 0.50. All other weather and psychological settings stayed fixed. No earlier seeds were reused or pooled. Nothing was adopted into v1.0.</p>',
 '<h2>Primary finding</h2><p>'+text+'</p>',table(['Direct candidate change','Win-rate change, points (conservative 95%)','Score-margin change (approximate 95%)'],[[c['case']+' minus '+c['reference'],effect(c),margin(c)]for c in cs[:4]]),
 '<h2>Decision</h2><p>Retain 0.35 as a provisional laboratory candidate. All four pooled point estimates moved toward neutral, but the primary win-rate improvement is unconfirmed. The secondary paired score-margin changes are consistent with blunting the thermal imbalance; these approximate secondary intervals are not simultaneous and do not replace the primary result. No default or official coefficient was changed.</p><p>Next, isolate heat, wind and rain and their interactions in Philadelphia–Norfolk, with controlled strategy comparisons. Its shared-weather disadvantage reproduced independently and cannot be solved solely by lowering thermal-trait moderation. Keep psychology fixed; complete a larger fresh confirmation before any adoption.</p>',
 '<h2>Physical and combined magnitudes</h2><p>Thermal rows use the identical shared-weather reference; combined rows use calm control. Intervals are per contrast, not simultaneous.</p>',table(['Comparison','Original 0.50','Reduced 0.35'],[['Adverse thermal minus shared weather',effect(cs[4]),effect(cs[5])],['Favored thermal minus shared weather',effect(cs[6]),effect(cs[7])],['Combined favored minus calm',effect(cs[8]),effect(cs[9])],['Combined adverse minus calm',effect(cs[10]),effect(cs[11])]]),
 '<p>Review levels remain approximately eight points for an extreme physical mismatch, preferably ten combined, and review above fifteen. These are design criteria, not outcome clamps. A 30% reduction in the coefficient does not imply 30% fewer changed winners. This screen may leave modest differences and review-level crossings unresolved.</p>',
 '<h2>Energy and match pace</h2><p>Final energy is measured across all copied squad players. It reflects rotations, duration and changed trajectories; the 30% coefficient reduction need not produce a 30% change in this observed metric.</p>',table(['Arm','Playing minutes','Points / minute','Focal final energy','Opponent final energy'],[[x['arm'],f"{x['meanPlayingMinutes']:.2f}",f"{x['totalPointsPerPlayingMinute']:.3f}",f"{x['meanFocalFinalEnergy']:.4f}",f"{x['meanOpponentFinalEnergy']:.4f}"]for x in metrics['main']]),
 '<h2>Independent Philadelphia–Norfolk recheck</h2><p>'+targettext+'</p>',table(['View of the same 800 physical fixtures','Shared hot/wet minus calm, points (95% interval)'],[['Philadelphia',effect(tc)],['Norfolk (exact complementary view)',effect(reciprocal)],['Previous Philadelphia result; separate 400-fixture profile',effect(analysis['priorPhiladelphiaWeather'])]]),
 '<p>Each fixture was run in calm and shared hot/wet weather, without thermal extremes or psychology. Philadelphia occupied each simulation side 400 times. Norfolk is viewed from the same outcomes; it does not contribute another 800 independent samples. Complementarity follows from this construction and does not certify absence of every engine asymmetry.</p>',
 '<p>The following diagnostics describe the completed recheck. Differences in attack production and energy may reflect interactions between weather, players and fixed strategies. They do not establish a causal mechanism; component and strategy ablations would be needed for that.</p>',table(['Weather','Philadelphia shots / minute','Norfolk shots / minute','Philadelphia final energy','Norfolk final energy'],[[x['arm'],f"{x['focalShotsPerPlayingMinute']:.3f}",f"{x['opponentShotsPerPlayingMinute']:.3f}",f"{x['meanFocalFinalEnergy']:.4f}",f"{x['meanOpponentFinalEnergy']:.4f}"]for x in metrics['targeted']]),
 table(['Philadelphia simulation side','Shared-weather effect (95% interval)'],[['Second'if x['swap']else'First',effect(x['contrasts'][0])]for x in sidechecks['targeted']]),
 '<h2>Fresh club-level candidate screen</h2><p>200 independent fixtures per row. These exploratory estimates are imprecise and not simultaneous. They are distinct from the 800-fixture recheck.</p>',table(['Club','Opponent','Reduced adverse thermal','Reduced favored thermal','Reduced combined favored','Reduced combined adverse'],[[p['club'],p['opponent'],effect(p['contrasts'][5]),effect(p['contrasts'][7]),effect(p['contrasts'][9]),effect(p['contrasts'][11])]for p in profiles]),
 '<p>Reduced combined point estimates still passed the fifteen-point review level in two exploratory profiles. Their wide intervals are not simultaneous; these are review flags, not established ceilings.</p>',table(['Club','Exploratory combined contrast','Effect (95% interval)'],[[x['club'],x['case'],effect(x)]for x in analysis['exploratoryReducedProfileCombinedFlags']]),
 '<h2>Main screen simulation-side checks</h2>',table(['Focal simulation side','Primary reduced-minus-original adverse effect (95% interval)'],[['Second'if x['swap']else'First',effect(x['contrasts'][0])]for x in sidechecks['main']]),
 '<h2>Reliability, reproduction and limits</h2><p>The prior 48 selected full-result hashes replayed exactly. Strict TypeScript, candidate energy-differential tests, mean-trait/calm parity, role/side mapping, full save/resume and corrupt telemetry rejection passed before execution. All outcomes passed score, statistics, clock, integrity, input immutability and psychological-cap checks. First fixtures were fully replayed, first controls checked against frozen v1.0, and all 64 protected files remained unchanged. Independent compact outcomes support reproducible recomputation. Every archived ledger passed byte and gzip CRC checks.</p>',
 '<p>These are laboratory hypotheses on selected healthy rosters and extreme all-squad traits, in one fixed severe hot/wet environment. Cold response, normal trait distributions, halftime adaptation and accumulated seasons remain outside this study. The reduced candidate remains explicit and default-off. No official histories or competition data were changed.</p>',
 '<p>The compact bundle preserves the fixed plan, both manifests, separate previous-confirmation estimates, compact outcomes, independent analysis, verification evidence, source patch, copied input profiles and standalone recomputation. The full-ledger index lists all separately preserved event archives and their SHA-256 checksums.</p></main></html>']
report=out/'Century_Thermal_Reduction_and_Matchup_Recheck.html';report.write_text('\n'.join(parts))
files={q.name:q for q in [report,out/'independent-analysis.json',out/'paired-outcomes.csv.gz',out/'full-ledger-archives.json']}
for c in studies:
 for suffix in ['manifest.json','summary.json']:files[c+'-'+suffix]=out/(c+'-'+suffix)
files.update({'fixed-study-plan.md':repo/'docs/THERMAL_REDUCTION_AND_MATCHUP_RECHECK_PLAN_2026_11_13.md','results-summary.md':repo/'docs/THERMAL_REDUCTION_AND_MATCHUP_RECHECK_RESULTS_2026_11_13.md',
 'previous-confirmation-analysis.json':sources/'previous-confirmation-analysis.json','previous-confirmation-manifest.json':sources/'previous-confirmation-manifest.json','reproduction/source.patch':sources/'source.patch',
 'reproduction/copied-profiles.json':sources/'copied-profiles.json','reproduction/recompute.py':repo/'scripts/recompute-thermal-reduction.py',
 'reproduction/report-and-archive.py':Path(__file__),'verification/preflight.json':Path('/tmp/century-thermal-reduction-preflight.json'),
 'verification/legacy-replay.json':Path('/tmp/century-thermal-reduction-legacy-replay.json'),
 'verification/strict-typescript.json':Path('/tmp/century-thermal-reduction-typescript.json'),
 'verification/clean-source-reconstruction.json':Path('/tmp/century-thermal-reduction-portable-source.json'),
 'verification/independent-csv-recomputation.json':Path('/tmp/century-thermal-reduction-recomputed.json')})
target=out/'Century_Thermal_Reduction_and_Matchup_Recheck_Data.zip'
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=6)as z:
 for n,q in files.items():z.write(q,n)
 z.writestr('CHECKSUMS.sha256','\n'.join(hashlib.sha256(q.read_bytes()).hexdigest()+'  '+n for n,q in files.items())+'\n')
 z.writestr('reproduction/README.txt','Recompute: python3 reproduction/recompute.py EXTRACTED_BUNDLE_DIR. Apply source.patch to Golfhaus/CenturyLeague commit 1f867ad5de47a6e8c40b70cbcb379e8751c72e8a. Node v24.22.1 with --no-maglev. Run node experiments/v2/run-thermal-reduction.mjs --cohort main --profiles /absolute/path/to/copied-profiles.json --workers 8; then the same command with --cohort targeted. Defaults pin study IDs and 200 or 800 trials respectively. Restore each cohort manifest and its ledgers/*.json.gz under experiments/v2/runs/STUDY_ID to resume; omit compact summary. Every restored outcome fully replays. Previous confirmation is separate, never pooled. Source was not published remotely.\n')
with zipfile.ZipFile(target)as z:assert z.testzip()is None
uploads=[{'local_path':str(out/a['file']),'purpose':'create_library_file','library_artifact_type':'other'}for a in archives]+[{'local_path':str(report),'purpose':'create_library_file','library_artifact_type':'report'},{'local_path':str(target),'purpose':'create_library_file','library_artifact_type':'other'}]
(out/'uploads.json').write_text(json.dumps({'uploads':uploads})+'\n');print(json.dumps({'status':'completed','mainPrimary':cs[0],'targetedPrimary':tc,'archiveParts':len(archives)}),flush=True)
