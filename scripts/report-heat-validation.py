"""Build the compact heat-validation report and reproducibility bundle."""
import gzip,hashlib,html,json,subprocess,sys,zipfile
from pathlib import Path
repo,p=map(Path,sys.argv[1:3]);a=json.loads((p/'analysis.json').read_text());m=json.loads((p/'manifest.json').read_text())
assert json.loads((p/'ledger-verification.json').read_text())['status']=='passed'
assert json.loads((p/'independent-recomputation.json').read_text())['status']=='passed'
esc=html.escape
def num(x):return f'{x:+.2f}'
def ci(x):return f'{num(x[0])} to {num(x[1])}'
def table(headers,rows):return '<div class="scroll"><table><thead><tr>'+''.join('<th>'+esc(x)+'</th>'for x in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+esc(str(x))+'</td>'for x in r)+'</tr>'for r in rows)+'</tbody></table></div>'
assessment=(p/'assessment.txt').read_text().strip()
report='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Century heat validation across copied clubs</title><style>body{font:17px/1.6 system-ui;background:#edf3f3;color:#18333e;margin:0}main{max-width:1150px;margin:24px auto;background:white;padding:30px;border-radius:14px}h1,h2{color:#155264;line-height:1.25}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:10px;text-align:left;border-bottom:1px solid #d4e1e5}th{background:#155264;color:white}tr:nth-child(even){background:#f2f7f8}.note{padding:16px;background:#edf7f3;border-left:4px solid #16735e}@media(max-width:650px){main{margin:0;padding:16px}table{font-size:12px}}</style><main><h1>Heat validation across eight copied clubs</h1>'''
report+='<p>Completed November 14, 2026. Four fixed matchups, 800 fresh matched seeds per matchup: <strong>3,200 fixture clusters and 6,400 outcomes</strong>. Each seed compares 18 C with 35 C at 80% humidity, without wind or rain. Ratings, original coaching tactics and coefficients are unchanged; psychology and temperature-tolerance traits are disabled.</p>'
report+='<div class="note">'+''.join('<p>'+esc(s)+'</p>'for s in assessment.split('\n\n'))+'</div>'
report+='<h2>Heat changes relative to each matchup’s own control</h2><p>Positive changes favor the first named club; the opponent’s win-rate change has the opposite sign. Margin and win intervals protect their respective four-matchup families, using the prespecified approximate paired-normal and conservative Wilson methods. They do not establish league-wide ceilings.</p>'
rows=[]
for b in a['matchups']:
 c=b['contrast'];rows.append([b['focal']+' / '+b['opponent'],f"{b['cells']['temperate']['focalWinRatePct']:.2f}%",f"{b['cells']['hot']['focalWinRatePct']:.2f}%",num(c['winChangePoints'])+' pp ('+ci(c['winConservativeFamily95'])+')',num(c['scoreMargin']['mean'])+' ('+ci(c['scoreMargin']['interval'])+')'])
report+=table(['Matchup: first club is focal','Temperate focal wins','Hot focal wins','Win-rate change, family 95%','Score-margin change, family 95%'],rows)
report+='<h2>Changed winners and simulation sides</h2><p>A matched seed is one statistical cluster. The two weather arms are not independent observations. Side checks below are exploratory nominal intervals.</p>'
rows=[]
for b in a['matchups']:
 c=b['contrast'];sides=b['sideChecks'];rows.append([b['focal'],c['changedToFocal'],c['changedAgainstFocal'],c['unchangedWinner'],num(sides[0]['contrast']['scoreMargin']['mean'])+' ('+ci(sides[0]['contrast']['scoreMargin']['interval'])+')',num(sides[1]['contrast']['scoreMargin']['mean'])+' ('+ci(sides[1]['contrast']['scoreMargin']['interval'])+')'])
report+=table(['Focal club','Changed to focal','Changed against focal','Unchanged winner','Focal on side 0: margin','Focal on side 1: margin'],rows)
report+='<h2>Physical response and pace</h2><p>Time-weighted active energy aggregates energy-seconds over active-player-seconds. Requested extra fatigue is the model’s additional workload budget before the energy floor, not measured physiology. Descriptive energy averages reflect changed match lengths, players and action sequences.</p>'
rows=[]
for b in a['matchups']:
 for role,name in [('focal',b['focal']),('opponent',b['opponent'])]:
  c,h=[b['cells'][x]['clubs'][role]for x in ['temperate','hot']]
  rows.append([name,f"{c['timeWeightedActiveEnergy']:.4f} → {h['timeWeightedActiveEnergy']:.4f}",f"{c['meanFinalEnergy']:.4f} → {h['meanFinalEnergy']:.4f}",f"{h['extraFatiguePer1000PlayerSeconds']:.4f}",f"{h['kickChecks']:,}",f"{h['directWeatherKickShiftPoints']:+.4f} pp"])
report+=table(['Club','Active energy: temperate → hot','Final energy: temperate → hot','Hot extra fatigue / 1,000 player-seconds','Hot kick checks','Direct weather kick shift'],rows)
rows=[]
for b in a['matchups']:
 c=b['contrast'];rows.append([b['focal']+' / '+b['opponent'],f"{b['cells']['temperate']['meanMinutes']:.2f}",f"{b['cells']['hot']['meanMinutes']:.2f}",num(c['durationMinutes']['mean'])+' ('+ci(c['durationMinutes']['interval'])+')',num(c['totalScore']['mean'])+' ('+ci(c['totalScore']['interval'])+')'])
report+=table(['Matchup','Temperate minutes','Hot minutes','Duration change: nominal 95%','Combined score change: nominal 95%'],rows)
old=a['priorPureHeatComparison'];report+='<h2>Comparison with the previous Philadelphia study</h2><p>The old pure-heat effect on Philadelphia’s score margin was '+num(old['priorPhiladelphiaPureHeat']['mean'])+' points (nominal 95%: '+ci(old['priorPhiladelphiaPureHeat']['interval'])+'). The fresh sample estimates '+num(old['newPhiladelphiaPureHeat']['mean'])+' points (four-matchup family 95%: '+ci(old['newPhiladelphiaPureHeat']['interval'])+'). The new-minus-old difference is '+num(old['newMinusPriorMargin']['mean'])+' (nominal 95%: '+ci(old['newMinusPriorMargin']['nominal95'])+').</p><p>These compare heat alone under the original tactics. The earlier −1.86-point Shapley heat allocation averaged contributions across wind/rain combinations and is a different estimand. Earlier samples are comparison evidence only and are not pooled into this validation.</p>'
report+='<h2>Verification, retention and limits</h2><p>Before launch: all four matchup/side inputs validated; exact temperate/v1.0 parity; four prior results exactly replayed; save/resume and corrupt-telemetry rejection passed. During execution: 16 full enabled replays and eight frozen controls; every result checked for scores, statistics, clocks and retained checksums. After execution: all 3,200 gzip ledgers and 6,400 full result hashes, inputs and compact records audited; Python independently recomputed the paired contrasts, family intervals, discordances and physical summaries. The 64-file v1.0 lock is intact.</p><p>The monitored run retained checkpoints and separate computation/verification status. The compact bundle contains the fixed plan, profiles, seed manifest, outcomes, checksums, verification and source patch. Full event ledgers remain separate; bulk delivery is deferred.</p><p>These are conditional model responses for eight selected copied clubs, four opponents and one severe heat level. They do not establish empirical physiology, temperature-response calibration, cold behavior, all tactical interactions, normal/extreme thermal traits, combined psychology, halftime adaptation or the full perfect-storm ceiling. The optional 0.35 thermal-moderation candidate remains provisional and inactive here. No official results, coaches, player records, schedule, deployment or rulebook changed.</p></main></html>'
(p/'Century_Heat_Validation_Across_Clubs.html').write_text(report)
repro=p/'reproduction';repro.mkdir(exist_ok=True);base='1f867ad5de47a6e8c40b70cbcb379e8751c72e8a'
(repro/'base-commit.txt').write_text(base+'\n');(repro/'source.patch').write_bytes(subprocess.check_output(['git','diff','--binary',base,'HEAD'],cwd=repo))
(repro/'pinned-commit.txt').write_bytes(subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo))
(repro/'README.txt').write_text('\n'.join([
 'Reconstruct the private lab checkout from Golfhaus/CenturyLeague at base-commit.txt, then apply source.patch with git apply --binary.',
 'Use Node '+m['runtime']['node']+'. No dependencies or credentials are needed. The source fingerprint must equal manifest.json sourceSHA256.',
 'Profiles are read-only copied research inputs. To reproduce the fixed-seed simulation, use the exact command in simulation-status.json from the reconstructed repository under scripts/supervise-engine-study.py.',
 'Historical full event ledgers are not included. All original event-file checksums are retained. Do not overwrite an existing study with changed inputs.',
 '', 'To recompute the compact analysis WITHOUT simulations, from the extracted bundle directory run:',
 'python3 reproduction/analyze-heat-validation.py . prior-comparison',
 'python3 reproduction/recompute-heat-validation.py .',
 '', 'The source patch includes the analysis and full-ledger audit scripts. No official deployment or adoption.', ''
]))
for name in ['audit-heat-validation.mjs','analyze-heat-validation.py','recompute-heat-validation.py','report-heat-validation.py']:
 (repro/name).write_bytes((repo/'scripts'/name).read_bytes())
files=[x for x in p.rglob('*')if x.is_file()and not x.name.endswith('.zip')and x.name not in ['CHECKSUMS.sha256','save-receipt.json']and not x.name.endswith('.log')]
checks=''.join(hashlib.sha256(x.read_bytes()).hexdigest()+'  '+x.relative_to(p).as_posix()+'\n'for x in sorted(files))
(p/'CHECKSUMS.sha256').write_text(checks);z=p/'Century_Heat_Validation_Across_Clubs_2026_11_14.zip'
with zipfile.ZipFile(z,'w',zipfile.ZIP_DEFLATED,compresslevel=9)as bundle:
 for x in sorted(files)+[p/'CHECKSUMS.sha256']:bundle.write(x,x.relative_to(p).as_posix())
with zipfile.ZipFile(z)as bundle:
 assert bundle.testzip()is None
 for line in bundle.read('CHECKSUMS.sha256').decode().splitlines():
  sha,name=line.split('  ',1);assert hashlib.sha256(bundle.read(name)).hexdigest()==sha
print(json.dumps({'status':'verified','package':str(z.resolve()),'bytes':z.stat().st_size,'contentFiles':len(files)}))
