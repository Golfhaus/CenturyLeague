"""Independently analyze and archive the complete fixed copied-club validation."""
import argparse,csv,gzip,hashlib,html,json,math,shutil,tarfile,zipfile
from pathlib import Path

parser=argparse.ArgumentParser()
parser.add_argument('study',type=Path)
parser.add_argument('destination',type=Path)
parser.add_argument('sources',type=Path)
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
study=args.study.resolve();out=args.destination.resolve();sources=args.sources.resolve()
out.mkdir(parents=True,exist_ok=True)
m=json.loads((study/'manifest.json').read_text())
s=json.loads((study/'summary.json').read_text())
assert s['status']=='completed' and s['engineResults']==10240
assert s['matchedFixtures']==len(m['fixtures'])==len(s['records'])==2048
assert s['sourceSHA256']==m['sourceSHA256']
assert m['runtime']['workerExecArgv']==['--no-maglev']
assert s['coefficients']['scales']==[.2,1]
assert s['coefficients']['sharedPsychology']['maximumOddsBonus']==.006
arms=[a['id']for a in m['arms']]
assert arms==['control','confidence-5','home-hot-5','shared-full-5','shared-adverse-5']
fixture_ids=set();result_hashes=set()
for r,f in zip(s['records'],m['fixtures']):
 assert r['fixture']==f and f['id'] not in fixture_ids
 fixture_ids.add(f['id'])
 assert {a['id']for a in r['arms']}==set(arms)
 assert (study/(f['id']+'.json.gz')).exists()
 for a in r['arms']:
  assert len(a['resultSHA256'])==64
  result_hashes.add(a['resultSHA256'])
  assert max(a['focalScore'],a['opponentScore'])==100
  assert (a['focalScore']>a['opponentScore'])==bool(a['focalWin'])
  assert all(0<=c['appliedOddsBonus']<=.006 for c in a['psychologyContributions'])

def contrast(records,arm):
 pairs=[]
 for r in records:
  d={a['id']:a for a in r['arms']};pairs.append((d[arm],d['control']))
 n=len(pairs);diffs=[a['focalWin']-b['focalWin']for a,b in pairs]
 delta=sum(diffs)/n
 def wilson(k):
  z=2.241403;p=k/n;den=1+z*z/n;mid=(p+z*z/(2*n))/den
  half=z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den
  return max(0,mid-half),min(1,mid+half)
 plus,minus=wilson(diffs.count(1)),wilson(diffs.count(-1))
 ci=[100*max(-1,plus[0]-minus[1]),100*min(1,plus[1]-minus[0])]
 se=math.sqrt(sum((d-delta)**2 for d in diffs)/(n-1)/n)
 return {'arm':arm,'matchedFixtures':n,'wins':sum(a['focalWin']for a,b in pairs),
  'controlWins':sum(b['focalWin']for a,b in pairs),'liftPoints':100*delta,
  'conservative95Points':ci,'approximate95Points':[100*(delta-1.96*se),100*(delta+1.96*se)],
  'improved':diffs.count(1),'worsened':diffs.count(-1),
  'meanScoreMarginChange':sum((a['focalScore']-a['opponentScore'])-(b['focalScore']-b['opponentScore'])for a,b in pairs)/n,
  'focalSeriousFouls':sum(a['seriousFouls']for a,b in pairs),
  'focalFoulOpportunities':sum(a['foulOpportunities']for a,b in pairs),
  'opponentSeriousFouls':sum(a['opponentSeriousFouls']for a,b in pairs),
  'opponentFoulOpportunities':sum(a['opponentFoulOpportunities']for a,b in pairs)}

overall=[contrast(s['records'],a)for a in arms]
for fresh,saved in zip(overall,s['arms']):
 assert fresh['wins']==saved['wins']
 assert math.isclose(fresh['liftPoints'],100*saved['pairedWinRateDifference'],abs_tol=1e-10)
 assert all(math.isclose(a,100*b,abs_tol=1e-10)for a,b in zip(fresh['conservative95Points'],saved['pairedDifference95ConservativeWilson']))
profiles=[]
for p in m['profiles']:
 records=[r for r in s['records']if r['fixture']['profile']==p['id']]
 assert len(records)==256 and sum(r['fixture']['swap']for r in records)==128
 profiles.append({'id':p['id'],'pairId':p['pairId'],'focalClub':p['teams'][0]['name'],
  'opponent':p['teams'][1]['name'],'historicalFocalWins':p['historicalFocalWins'],
  'effects':[contrast(records,a)for a in arms]})
by_side=[{'swap':side,'effects':[contrast([r for r in s['records']if r['fixture']['swap']==side],a)for a in arms]}for side in [False,True]]
review_levels={'confidence-5':3,'home-hot-5':3,'shared-full-5':4,'shared-adverse-5':4}
flags=[{'profile':p['id'],'arm':a['arm'],'liftPoints':a['liftPoints'],
        'conservative95Points':a['conservative95Points'],'reviewLevel':review_levels[a['arm']]}
       for p in profiles for a in p['effects']if a['arm']in review_levels and abs(a['liftPoints'])>review_levels[a['arm']]]
old=json.loads((root/'docs/verification/shared-psychology-reduction-2026-11-12.json').read_text())
analysis={'schema':'century-real-club-validation-analysis-v1','classification':'lab-only-not-adopted',
 'studyId':m['studyId'],'simulationSourceCommit':'3d2691e','sourceSHA256':m['sourceSHA256'],
 'matchedFixtures':2048,'outcomes':10240,'overall':overall,'profiles':profiles,'simulationSideChecks':by_side,
 'previousSyntheticConfirmation':old['independentContrasts'],'profilePointEstimateFlags':flags,
 'intervalNote':'Conservative intervals are per contrast, not simultaneous across all profiles and arms.',
 'samplingNote':'Eight selected copied founding clubs in four historical close pairings; no inference to all league clubs or current availability.',
 'analysisMetadataClarification':'The written prespecified plan uses conservative intervals as primary; the generic manifest inherited a legacy approximate-interval label. Clarification was recorded before inspecting new winner outcomes.'}
(out/'independent-analysis.json').write_text(json.dumps(analysis,indent=2)+'\n')
(out/'manifest.json').write_bytes((study/'manifest.json').read_bytes())
(out/'summary.json').write_text(json.dumps({k:v for k,v in s.items()if k!='records'},indent=2)+'\n')
flat=[]
for r in s['records']:
 for a in r['arms']:
  flat.append({'fixture':r['fixture']['id'],'profile':r['fixture']['profile'],'trial':r['fixture']['trial'],
   'swapped':r['fixture']['swap'],**{k:v for k,v in a.items()if k!='psychologyContributions'}})
with gzip.open(out/'paired-outcomes.csv.gz','wt',newline='')as f:
 w=csv.DictWriter(f,fieldnames=list(flat[0]));w.writeheader();w.writerows(flat)

archives=[]
for p in m['profiles']:
 target=out/f"Century_Real_Club_Psychology_{p['id']}.tar"
 fixtures=[f for f in m['fixtures']if f['profile']==p['id']]
 with tarfile.open(target,'w')as tar:
  tar.add(study/'manifest.json',arcname='manifest.json')
  for f in fixtures:
   filename=f['id']+'.json.gz';tar.add(study/filename,arcname='ledgers/'+filename)
 with tarfile.open(target)as tar:
  members=tar.getmembers();assert len(members)==257
  for item in members[1:]:
   assert hashlib.sha256(tar.extractfile(item).read()).digest()==hashlib.sha256((study/Path(item.name).name).read_bytes()).digest()
 archives.append({'file':target.name,'profile':p['id'],'focalClub':p['teams'][0]['name'],'fixtures':256,
  'outcomes':1280,'sizeBytes':target.stat().st_size,'sha256':hashlib.file_digest(target.open('rb'),'sha256').hexdigest()})
 print(json.dumps({'archivedProfile':p['id'],'sizeBytes':target.stat().st_size}),flush=True)
(out/'full-ledger-archives.json').write_text(json.dumps(archives,indent=2)+'\n')

labels={'control':'Control','confidence-5':'Five-win confidence','home-hot-5':'Peak crowd support',
        'shared-full-5':'Favorable combined psychology','shared-adverse-5':'Adverse combined psychology'}
escape=html.escape
def value(a):
 lo,hi=a['conservative95Points'];return f"{a['liftPoints']:+.2f} ({lo:+.2f} to {hi:+.2f})"
def table(headers,rows):
 return '<div class="scroll"><table><tr>'+''.join('<th>'+escape(str(x))+'</th>'for x in headers)+'</tr>'+''.join('<tr>'+''.join('<td>'+escape(str(x))+'</td>'for x in row)+'</tr>'for row in rows)+'</table></div>'
parts=['<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
 '<title>Century real-club psychology validation</title><style>body{margin:0;background:#eef3f4;color:#18363d;font:17px/1.6 system-ui,sans-serif}main{max-width:1120px;margin:28px auto;padding:32px;background:#fff;border-radius:12px}h1,h2{line-height:1.25;color:#164853}h2{margin-top:2em}.scroll{overflow:auto}table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:10px;border-bottom:1px solid #d9e3e6;text-align:left}th{background:#164853;color:white}tr:nth-child(even){background:#f3f7f8}code{overflow-wrap:anywhere}@media(max-width:650px){main{margin:0;padding:18px}table{font-size:12px}}</style><main>',
 '<h1>Validation on copied founding squads</h1>',
 '<p>The fixed study completed 2,048 fresh matched fixtures and 10,240 outcomes. It used eight copied founding clubs in four previously competitive pairings, both focal orientations and both simulation sides. Player ratings and original coach tactics were preserved exactly. The reduced psychological coefficients remained fixed.</p>',
 '<p>This is separate from the prior 6,400-seed synthetic confirmation and the later synthetic screen. No prior outcomes were pooled into the new results. The v1.0 engine, official competition and saved player histories were not modified.</p>',
 '<h2>Assessment</h2>',
 '<p>The new point estimates support keeping the reduced coefficients as a provisional working candidate. They do not justify another reduction in response to the earlier noisy screen, and they do not establish a universal match-level ceiling. The primary conservative intervals include zero, and the favorable combined interval still extends slightly beyond the four-point review level. No adoption is approved by these results.</p>',
 f"<p>The eight individual controls range from {100*min(p['effects'][0]['wins']for p in profiles)/256:.2f}% to {100*max(p['effects'][0]['wins']for p in profiles)/256:.2f}%. The previously observed zero-/all-win synthetic controls were avoided. These are genuinely competitive copied-club matchups within this selected sample.</p>",
 '<h2>Overall effects</h2><p>Changes are percentage points versus the same fixtures’ control; brackets show conservative paired 95% intervals.</p>',
 table(['Condition','Wins / 2,048','Win rate','Change (95% interval)','Mean margin change'],
 [[labels[a['arm']],f"{a['wins']} / 2,048",f"{100*a['wins']/2048:.2f}%",'—'if a['arm']=='control'else value(a),f"{a['meanScoreMarginChange']:+.2f}"]for a in overall]),
 '<h2>Compared with the prior large confirmation</h2><p>The previous study used synthetic mirror squads; the new study uses selected copied founding clubs. Differences between estimates can reflect populations and sampling. This is not a paired coefficient-change experiment.</p>',
 table(['Condition','Previous synthetic, n=6,400','New copied clubs, n=2,048'],
 [[labels[a['case']],f"{a['liftPoints']:+.2f} ({a['conservative95Points'][0]:+.2f} to {a['conservative95Points'][1]:+.2f})",value(next(x for x in overall if x['arm']==a['case']))]for a in old['independentContrasts']]),
 '<h2>Each club’s own control</h2><p>Both focal orientations make the pooled control naturally trend toward 50%. That alone does not establish competitive matchups. Review the individual controls below; no clubs were replaced after seeing new results.</p>',
 table(['Focal club','Opponent','Control wins / 256','Favorable lift (95% interval)','Adverse lift (95% interval)'],
 [[p['focalClub'],p['opponent'],f"{p['effects'][0]['wins']} / 256",value(next(a for a in p['effects']if a['arm']=='shared-full-5')),value(next(a for a in p['effects']if a['arm']=='shared-adverse-5'))]for p in profiles]),
 '<h2>Interpretation limits</h2>',
 f'<p>There are {len(flags)} profile point-estimate review flags against the existing provisional three-point individual/four-point combined review levels. These select follow-up questions; wide per-profile intervals do not establish an actual threshold breach. Intervals do not provide simultaneous coverage across every comparison. The execution-odds cap is not a universal ceiling on match-winning frequency.</p>',
 '<p>Frustration uses the unchanged foul-severity mechanism. Conditional foul fractions are preserved with denominators in the independent analysis; changing match trajectories means raw fractions are not clean isolated causal estimates.</p>',
 '<p>The source is an October 31 founding-roster copy. Laboratory availability is healthy and suspension-free, reset each match. Eight selected clubs are not a random league-wide sample. Accumulating season histories, weather, temperature tolerance and halftime adaptation remain later gates; no adoption follows automatically.</p>',
 '<h2>Reliability and preservation</h2>',
 '<p>Preflight checks verified copied roster immutability, source archive checksums, all 630 draft memberships, both side roles, adverse home/streak mapping, exact save/resume replay and corrupt-ledger rejection. During the study every outcome passed scoring/statistics, clock, cap and retained-result checksum checks. First fixtures were fully replayed and their controls checked against frozen v1.0.</p>',
 '<p>The written plan prespecified conservative intervals as primary. A legacy manifest text label describes approximate intervals; that metadata inconsistency was documented before new winner outcomes were inspected. Both interval calculations and all outcomes are preserved.</p>',
 '<p>The compact data bundle preserves manifests, outcomes, independent analysis, the written plan and the unpushed study-specific source patch. Eight full-ledger archives preserve all new match inputs and events.</p>',
 table(['Archive','Focal club','Size (MiB)'],[[a['file'],a['focalClub'],f"{a['sizeBytes']/1048576:.1f}"]for a in archives]),
 '</main></html>']
(out/'Century_Real_Club_Psychology_Validation.html').write_text('\n'.join(parts))
plan=root/'docs/REAL_CLUB_PSYCHOLOGY_VALIDATION_PLAN_2026_11_13.md'
files={n:out/n for n in ['Century_Real_Club_Psychology_Validation.html','manifest.json','summary.json','independent-analysis.json','paired-outcomes.csv.gz','full-ledger-archives.json']}
files['fixed-study-plan.md']=plan
files['reproduction/source.patch']=sources/'reproduction.patch'
files['reproduction/copied-profiles.json']=sources/'real-club-validation-profiles.json'
files['reproduction/analyze-and-archive.py']=Path(__file__)
files['reproduction/recompute.py']=root/'scripts/recompute-real-club-outcomes.py'
target=out/'Century_Real_Club_Psychology_Validation_Data.zip'
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=6)as z:
 for name,p in files.items():z.write(p,name)
 z.writestr('CHECKSUMS.sha256','\n'.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+n for n,p in files.items())+'\n')
 z.writestr('reproduction/README.txt','For standalone statistical recomputation: python3 reproduction/recompute.py PATH_TO_EXTRACTED_BUNDLE. It reads paired-outcomes.csv.gz and checks the saved effects and intervals.\nFor full replay: apply source.patch to Golfhaus/CenturyLeague commit 1f867ad5de47a6e8c40b70cbcb379e8751c72e8a. Use Node v24.22.1 and the pinned command in fixed-study-plan.md, replacing the private profile path with copied-profiles.json. The runner qualifies --no-maglev automatically. To resume from full ledgers, put manifest.json in experiments/v2/runs/real-club-psychology-validation-001 and merge the eight archives\' ledgers/*.json.gz into that same run directory. Omit the compact summary; the runner replays every saved result and rebuilds the complete summary. For report regeneration, copy analyze-and-archive.py into the repository scripts directory. Copied profiles are unchanged founding snapshots. The source patch was not published remotely.\n')
with zipfile.ZipFile(target)as z:assert z.testzip()is None
uploads=[{'local_path':str(out/a['file']),'purpose':'create_library_file','library_artifact_type':'other'}for a in archives]
uploads += [{'local_path':str(out/'Century_Real_Club_Psychology_Validation.html'),'purpose':'create_library_file','library_artifact_type':'report'},
            {'local_path':str(target),'purpose':'create_library_file','library_artifact_type':'other'}]
(out/'uploads.json').write_text(json.dumps({'uploads':uploads})+'\n')
print(json.dumps({'status':'completed','outcomes':10240,'overall':overall,'profileFlags':len(flags),'dataPackageBytes':target.stat().st_size}),flush=True)
