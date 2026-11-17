"""Compact cold-weather/tolerance review with full reproducibility inputs."""
import base64,hashlib,html,json,subprocess,sys,zipfile,statistics
from pathlib import Path
repo,p=map(Path,sys.argv[1:3]);a=json.loads((p/'analysis.json').read_text());m=json.loads((p/'manifest.json').read_text())
for name in ['ledger-verification.json','independent-recomputation.json']:assert json.loads((p/name).read_text())['status']=='passed'
esc=html.escape
def n(v):return f'{v:+.3f}'
def ci(v):return n(v[0])+' to '+n(v[1])
def table(headers,rows):return '<div class="scroll"><table><thead><tr>'+''.join('<th>'+esc(v)+'</th>'for v in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+esc(str(v))+'</td>'for v in row)+'</tr>'for row in rows)+'</tbody></table></div>'
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
fig,ax=plt.subplots(figsize=(9,5.6),layout='constrained')
labels=['Adverse 0.35 − mean tolerance (primary)','Favored 0.35 − mean tolerance','Adverse 0.50 − mean tolerance','Favored 0.50 − mean tolerance','Adverse 0.35 − adverse 0.50','Favored 0.35 − favored 0.50']
for i,v in enumerate(a['pooledTraitContrasts']):
 x=v['winChangePoints'];ax.errorbar(x,i,xerr=[[x-v['winInterval'][0]],[v['winInterval'][1]-x]],fmt='o',capsize=4,color='#117b72'if i==0 else '#6a7884')
ax.axvline(0,color='#89959e',linewidth=1);ax.set_yticks(range(6),labels,fontsize=9);ax.invert_yaxis();ax.set_xlabel('Focal win-probability change (percentage points)');ax.set_title('Opposed cold-tolerance extremes at −5°C',loc='left',weight='bold');ax.grid(axis='x',alpha=.2);ax.spines[['top','right']].set_visible(False)
fig.text(.02,-.035,'2,048 matched fixture clusters across four fixed pairings. Conservative 95% intervals per contrast.\n35/50 km/h wind/gusts, 5 mm/h rain; fixed copied rosters and original tactics. Secondary contrasts exploratory.',fontsize=9,color='#435462')
fig.savefig(p/'Cold_Tolerance_Contrasts.png',dpi=180,bbox_inches='tight');fig.savefig(p/'Cold_Tolerance_Contrasts.svg',bbox_inches='tight');plt.close(fig)
fig,ax=plt.subplots(figsize=(8.5,4.8),layout='constrained')
for pairs,label,color in [([('dry-5','dry18',-5),('dry0','dry18',0)],'Dry: cold minus dry 18°C','#6a7884'),([('wet-5','wet18',-5),('wet4','wet18',4)],'Wet/windy: cold minus wet/windy 18°C','#117b72')]:
 vals=[next(v['values']['activeEnergyPoints']for v in a['physicalContrasts']if v['contrast']==hi+' minus '+lo)for hi,lo,t in pairs];ys=[v['mean']for v in vals]
 ax.errorbar([t for hi,lo,t in pairs],ys,yerr=[[v['mean']-v['interval'][0]for v in vals],[v['interval'][1]-v['mean']for v in vals]],fmt='o-',capsize=4,label=label,color=color)
ax.scatter([18],[0],color='#6a7884',s=30);ax.axhline(0,color='#89959e',linewidth=.8);ax.set_xticks([-5,0,4,18]);ax.set_xlabel('Temperature (°C)');ax.set_ylabel('Active energy change (points on 0–100 scale)');ax.set_title('Cold burden relative to the same dry/wet reference',loc='left',weight='bold');ax.grid(axis='y',alpha=.2);ax.spines[['top','right']].set_visible(False);ax.legend(fontsize=8,loc='best')
fig.text(.02,-.04,'Mean-tolerance arms; equal club weight within fixtures. Nominal paired 95% intervals.\nLines connect tested cold conditions only; the 18°C identity references are separate.',fontsize=9,color='#435462')
fig.savefig(p/'Cold_Physical_Response.png',dpi=180,bbox_inches='tight');fig.savefig(p/'Cold_Physical_Response.svg',bbox_inches='tight');plt.close(fig)
s='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Century cold weather and tolerance validation</title><style>body{font:17px/1.6 system-ui;background:#edf3f3;color:#18333e;margin:0}main{max-width:1200px;margin:24px auto;background:white;padding:30px;border-radius:14px}h1,h2{color:#155264;line-height:1.25}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:9px;text-align:left;border-bottom:1px solid #d4e1e5}th{background:#155264;color:white}tr:nth-child(even){background:#f2f7f8}.note{padding:16px;background:#edf7f3;border-left:4px solid #16735e}@media(max-width:650px){main{margin:0;padding:16px}table{font-size:12px}}</style><main><h1>Cold weather and tolerance validation</h1>'''
s+='<p>Completed November 14, 2026: <strong>2,048 fresh matched fixture clusters and 24,576 outcomes</strong>. Four fixed copied pairings, 512 seeds each, balanced simulation sides. Twelve arms cover dry and wet/windy temperate references, 0/4/−5 C cold, normal traits and opposed tolerance extremes under provisional 0.35 and original 0.50. Humidity 90%; wet arms 35/50 km/h wind/gusts, 5 mm/h rain. No psychology, coefficient changes or official-record writes.</p>'
s+='<div class="note">'+''.join('<p>'+esc(v)+'</p>'for v in (p/'assessment.txt').read_text().strip().split('\n\n'))+'</div>'
for filename,alt in [('Cold_Tolerance_Contrasts.png','Cold-tolerance winner contrasts with uncertainty'),('Cold_Physical_Response.png','Cold energy response relative to dry and wet references')]:s+='<img style="max-width:100%;height:auto" alt="'+alt+'" src="data:image/png;base64,'+base64.b64encode((p/filename).read_bytes()).decode()+'">'
s+='<h2>Primary and same-weather tolerance contrasts</h2><p>The primary contrast is adverse 0.35 minus mean tolerance at −5 C wet/windy. Its intervention always disadvantages the focal club. Other pooled directional tolerance contrasts are secondary; intervals are nominal per contrast. Reciprocal views and two arms of a fixture are not independent samples. Shared-weather winner changes and normal-trait winner effects are reported per matchup below.</p>'
s+=table(['Contrast','Win change, pp','Conservative 95%','Changed to focal / against','Margin change (nominal 95%)'],[[v['contrast'],n(v['winChangePoints']),ci(v['winInterval']),str(v['changedToFocal'])+' / '+str(v['changedAgainstFocal']),n(v['scoreMargin']['mean'])+' ('+ci(v['scoreMargin']['interval'])+')']for v in a['pooledTraitContrasts']])
s+='<h2>Primary by matchup and simulation side</h2><p>Four matchup-specific primary winner intervals receive Bonferroni family protection. Side checks are exploratory nominal intervals.</p>'
rows=[]
for b in a['matchups']:
 v=next(c for c in b['contrasts']if c['overall']['contrast']==a['primary']['contrast']);r=v['overall'];rows.append([b['focal']+' / '+b['opponent'],n(r['winChangePoints']),ci(r['winInterval'])]+[n(t['values']['winChangePoints'])+' ('+ci(t['values']['winInterval'])+')'for t in v['sides']])
s+=table(['Focal / opponent','Primary change, pp','Four-matchup family 95%','Side 0 change (nominal 95%)','Side 1 change (nominal 95%)'],rows)
s+='<h2>All shared-weather and normal-trait winner comparisons</h2><p>These per-matchup secondary intervals are nominal and not simultaneous. All other profile/side contrasts remain in analysis.json and the full compact outcome data.</p>'
rows=[]
for b in a['matchups']:
 for c in b['contrasts']:
  v=c['overall']
  if v['contrast'].startswith(('dry','wet4 minus','wet-5 minus','wet-5-normal')):rows.append([b['focal'],v['contrast'],n(v['winChangePoints']),ci(v['winInterval'])])
s+=table(['Focal club','Contrast','Win change, pp','Nominal 95%'],rows)
s+='<h2>Physical response across every arm</h2><p>Energy is shown on a 0–100 scale and gives both clubs equal weight within each fixture. Mean duration and scoring reflect the 100-point ending condition. Wind/rain penalty averages can vary with sampled actions and players even though the held-state formula is temperature-independent.</p>'
s+=table(['Arm','Mean active energy','Mean minutes','Combined score','Focal kick checks','Focal direct kick shift, pp'],[[key,f"{100*v['equalClubWeightedActiveEnergy']:.3f}",f"{v['meanMinutes']:.3f}",f"{v['meanCombinedScore']:.3f}",v['clubs']['focal']['kickChecks'],n(v['clubs']['focal']['directWeatherKickShiftPoints'])]for key,v in a['physicalCells'].items()])
s+=table(['Paired physical contrast','Active-energy change (nominal 95%)','Duration change, min','Combined-score change'],[[v['contrast'],n(v['values']['activeEnergyPoints']['mean'])+' ('+ci(v['values']['activeEnergyPoints']['interval'])+')',n(v['values']['durationMinutes']['mean']),n(v['values']['combinedScore']['mean'])]for v in a['physicalContrasts']])
v=a['physicalColdWetInteractionEnergyPoints'];s+='<p>The wet-minus-dry cold increment at −5 C is '+n(v['mean'])+' active-energy points (nominal 95% '+ci(v['interval'])+'). It compares each cold arm with its same dry/wet 18 C reference. It is an interaction in this model, not empirical cold physiology.</p>'
s+='<h2>Earlier cold screen: different conditions</h2><p>The initial screen used 4 C wet/windy and original 0.50 moderation, with 512 fixtures across eight focal profiles. The new severe arm is −5 C: model cold load rises from 0.56 to 1.4. These earlier values are context only, not pooled observations or a direct test of coefficient improvement.</p>'
s+=table(['Earlier 4 C contrast','Screen estimate, pp','Nominal conservative 95%'],[[v['case']+' minus '+v['reference'],n(v['liftPoints']),ci(v['conservative95Points'])]for v in a['historicalColdScreen']])
s+='<h2>Normal cold traits and held-state coefficients</h2>'
traits=json.loads((p/'fixed-normal-traits.json').read_text());rows=[]
for profile in m['profiles']:
 for team in profile['teams']:
  xs=[traits[x['id']]['cold']for x in team['players']];rows.append([team['name'],len(xs),f'{statistics.mean(xs):.4f}',f'{statistics.stdev(xs):.4f}',f'{min(xs):.4f} to {max(xs):.4f}'])
s+=table(['Club','Players','Mean cold trait','Sample SD','Cold trait range'],rows)
s+='<p>Cold fatigue/recovery coefficients stay at 0.06/0.02; mean-tolerance −5 C dry multipliers are 1.06/0.98, and −5 C wet/windy 1.084/0.972. Thermal moderation acts only on this additional burden. Heat load is inactive. These fixed coefficients are laboratory hypotheses.</p>'
s+='<h2>Recovery, verification and limits</h2><p>The temporary workspace was reset before this step. The saved source patch restored the exact previous laboratory fingerprint, with all 64 frozen v1.0 files intact; four regenerated historical outcomes matched their retained full-result hashes. Prior unsaved full event ledgers were unavailable after the reset, while compact results and reproduction material remained saved. Completed heat studies were not repeated.</p><p>Cold qualification passed 96 constructions, 16 dry/wet neutral-trait parity checks, 6,720 held-state checks, historical replay, 96-outcome save/resume, corrupted-telemetry rejection, and cold threshold/amplification checks. Main execution included 96 full enabled replays, eight dry/v1.0 controls and every result’s input/score/statistics/clock/retained checksum checks. The post-run audit verified every full ledger CRC and hash. Independent Python recomputation checked the primary and declared secondary/side contrasts, physical interaction, cells and denominators.</p><p>The bundle contains every compact outcome, exact normal traits, fixed plan, seed manifest, source patch, verification and ledger checksum index. New full ledgers remain separate; bulk delivery is deferred. No official player records, coaches, rules, defaults, results or deployment changed.</p><p>Limits: four fixed copied pairings, one normal trait population, prescribed weather and healthy availability. No empirical physiology, league-wide ceiling, cold/heat safety boundary, full psychological stack, halftime adaptation or accumulated-season validation. The 0.35 option remains provisional. Screening flags need separately fixed fresh confirmation before tuning or adoption.</p></main></html>'
(p/'Century_Cold_Weather_and_Tolerance_Validation.html').write_text(s)
repro=p/'reproduction';base='1f867ad5de47a6e8c40b70cbcb379e8751c72e8a';(repro/'base-commit.txt').write_text(base+'\n');(repro/'source.patch').write_bytes(subprocess.check_output(['git','diff','--binary',base,'HEAD'],cwd=repo));(repro/'pinned-commit.txt').write_bytes(subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo))
for name in ['audit-cold-validation.mjs','analyze-cold-validation.py','recompute-cold-validation.py','report-cold-validation.py']:(repro/name).write_bytes((repo/'scripts'/name).read_bytes())
(repro/'README.txt').write_text('\n'.join(['Restore Golfhaus/CenturyLeague at base-commit.txt and apply source.patch with git apply --binary. Use Node '+m['runtime']['node']+' and the saved simulation command under scripts/supervise-engine-study.py. Source fingerprint must equal manifest.json. No official credentials needed. Full event ledgers are not in this compact bundle; checksums are retained.',
 'Recompute from this extracted directory without simulations:', 'python3 reproduction/analyze-cold-validation.py .','python3 reproduction/recompute-cold-validation.py .','The earlier 4 C screen remains separate and is not a same-condition confirmation. No official adoption or deployment.','']))
files=sorted(x for x in p.rglob('*')if x.is_file()and x.suffix!='.zip'and x.name not in ['CHECKSUMS.sha256','save-status.json','save-receipt.json']and not x.name.endswith('.log'))
(p/'CHECKSUMS.sha256').write_text(''.join(hashlib.sha256(x.read_bytes()).hexdigest()+'  '+x.relative_to(p).as_posix()+'\n'for x in files));z=p/'Century_Cold_Weather_and_Tolerance_Validation_2026_11_14.zip'
with zipfile.ZipFile(z,'w',zipfile.ZIP_DEFLATED,compresslevel=9)as f:
 for x in files+[p/'CHECKSUMS.sha256']:f.write(x,x.relative_to(p).as_posix())
with zipfile.ZipFile(z)as f:
 assert f.testzip()is None
 for line in f.read('CHECKSUMS.sha256').decode().splitlines():
  sha,name=line.split('  ',1);assert hashlib.sha256(f.read(name)).hexdigest()==sha
print(json.dumps({'status':'verified','package':str(z.resolve()),'bytes':z.stat().st_size,'contentFiles':len(files)}))
