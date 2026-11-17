"""Compact review and pinned-source bundle for the temperature screen."""
import base64,hashlib,html,json,subprocess,sys,zipfile
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
fig,ax=plt.subplots(figsize=(8.5,4.8),layout='constrained')
for variant,label,color in [('shared','Mean tolerance','#6a7884'),('normal-050','Normal traits, original 0.50','#b66a28'),('normal-035','Normal traits, provisional 0.35','#117b72')]:
 points=[v for v in a['physicalCurves']if v['variant']==variant]
 ax.plot([v['temperatureC']for v in points],[v['versusTemperate']['activeEnergyPoints']['mean']for v in points],marker='o',label=label,color=color,linewidth=2)
x=[v['temperatureC']for v in a['primary']];y=[v['contrast']['activeEnergyPoints']['mean']for v in a['primary']]
err=[[v['contrast']['activeEnergyPoints']['mean']-v['contrast']['activeEnergyPoints']['interval'][0]for v in a['primary']],
 [v['contrast']['activeEnergyPoints']['interval'][1]-v['contrast']['activeEnergyPoints']['mean']for v in a['primary']]]
ax.errorbar(x,y,yerr=err,fmt='none',capsize=5,color='#117b72',linewidth=1.5)
ax.scatter([18],[0],color='#6a7884',s=35)
ax.axhline(0,color='#7e8a93',linewidth=.8);ax.set_xticks([18,28,32,35]);ax.set_xlabel('Temperature (°C)');ax.set_ylabel('Active energy change from 18°C (points on 0–100 scale)')
ax.set_title('Heat response across eight copied clubs',loc='left',weight='bold');ax.grid(axis='y',alpha=.2);ax.spines[['top','right']].set_visible(False);ax.legend(fontsize=9,loc='lower left')
fig.text(.02,-.045,'1,024 matched fixtures; bars: approximate family 95% intervals for provisional 0.35.\nFixed clubs/traits, 80% humidity, no wind or rain. Lines connect tested warm conditions.',fontsize=9,color='#435462')
fig.savefig(p/'Temperature_Response.png',dpi=180,bbox_inches='tight');fig.savefig(p/'Temperature_Response.svg',bbox_inches='tight');plt.close(fig)
s='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Century temperature response and normal tolerance</title><style>body{font:17px/1.6 system-ui;background:#edf3f3;color:#18333e;margin:0}main{max-width:1200px;margin:24px auto;background:white;padding:30px;border-radius:14px}h1,h2{color:#155264;line-height:1.25}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:9px;text-align:left;border-bottom:1px solid #d4e1e5}th{background:#155264;color:white}tr:nth-child(even){background:#f2f7f8}.note{padding:16px;background:#edf7f3;border-left:4px solid #16735e}@media(max-width:650px){main{margin:0;padding:16px}table{font-size:12px}}</style><main><h1>Temperature response and normal tolerance</h1>'''
s+='<p>Completed November 14, 2026: <strong>1,024 fresh fixture clusters / 10,240 outcomes</strong>, four fixed pairings and eight copied clubs. At 28/32/35 C compare mean tolerance, fixed normal traits at original 0.50 moderation and the same traits at provisional 0.35. One shared 18 C control; 80% humidity throughout, no wind/rain, original tactics, fixed healthy availability and disabled psychology.</p>'
s+='<div class="note">'+''.join('<p>'+esc(v)+'</p>'for v in (p/'assessment.txt').read_text().strip().split('\n\n'))+'</div>'
s+='<img alt="Heat response curves with primary uncertainty intervals" style="max-width:100%;height:auto" src="data:image/png;base64,'+base64.b64encode((p/'Temperature_Response.png').read_bytes()).decode()+'">'
s+='<h2>Primary: physical temperature response with normal 0.35 traits</h2><p>Energy is shown on a 0–100 scale. Each fixture gives both clubs equal weight, then all four equally sized matchup samples are averaged. Changes are paired against the same seed at 18 C. Approximate family 95% intervals protect these three primary contrasts. They describe sample uncertainty conditional on fixed clubs and traits, not all Century players.</p>'
s+=table(['Temperature','Mean active energy','Change from 18 C','Primary family 95%'],[[str(v['temperatureC'])+' C',f"{100*next(x for x in a['physicalCurves']if x['temperatureC']==v['temperatureC']and x['variant']=='normal-035')['cell']['equalClubWeightedActiveEnergy']:.3f}",n(v['contrast']['activeEnergyPoints']['mean']),ci(v['contrast']['activeEnergyPoints']['interval'])]for v in a['primary']])
s+='<p>Temperate control active energy: '+f"{100*a['controlCell']['equalClubWeightedActiveEnergy']:.3f}"+'. These are time-weighted active-player energy summaries, not final squad energy or measured physiology.</p>'
s+='<h2>All temperature and tolerance curves</h2>'
s+=table(['Temperature','Tolerance variant','Active energy (0–100)','Mean minutes','Combined score'],[[str(v['temperatureC'])+' C',v['variant'],f"{100*v['cell']['equalClubWeightedActiveEnergy']:.3f}",f"{v['cell']['meanMinutes']:.2f}",f"{v['cell']['meanCombinedScore']:.2f}"]for v in a['physicalCurves']])
s+='<h2>Paired tolerance-setting and adjacent-temperature contrasts</h2><p>These secondary physical intervals are nominal per contrast. Narrowing trait moderation does not guarantee a smaller observed match-level energy or winner difference: altered actions and match lengths feed back into energy use.</p>'
s+=table(['Contrast','Active energy change','Nominal 95%','Duration change, minutes'],[[v['contrast'],n(v['values']['activeEnergyPoints']['mean']),ci(v['values']['activeEnergyPoints']['interval']),n(v['values']['durationMinutes']['mean'])]for v in a['physicalSecondary']])
s+='<h2>Normal 0.35 versus temperate: competitive response</h2><p>Changes favor the first club when positive. Score-margin and win intervals protect their respective 12-contrast matchup × temperature families. With 256 seeds per matchup, these broad intervals cannot certify a ceiling or reliably detect a tiny normal-trait effect. All arms and exploratory side contrasts are retained in analysis.json.</p>'
rows=[]
for b in a['matchups']:
 for c in b['contrasts']:
  r=c['overall']
  if r['familySize']==12:rows.append([b['focal']+' / '+b['opponent'],str(c['temperatureC'])+' C',n(r['winChangePoints'])+' ('+ci(r['winInterval'])+')',n(r['scoreMargin']['mean'])+' ('+ci(r['scoreMargin']['interval'])+')'])
s+=table(['Matchup: first club focal','Temperature','Win change, pp (family 95%)','Margin change (family 95%)'],rows)
s+='<h2>Normal traits versus mean tolerance and original moderation</h2><p>These secondary competitive intervals are nominal per contrast; reciprocal views are complements of the same outcomes. They are not extra samples.</p>'
rows=[]
for b in a['matchups']:
 for c in b['contrasts']:
  r=c['overall']
  if r['familySize']==1:rows.append([b['focal'],r['contrast'],n(r['winChangePoints'])+' ('+ci(r['winInterval'])+')',n(r['scoreMargin']['mean'])])
s+=table(['Focal club','Contrast','Win change, pp (nominal 95%)','Margin change'],rows)
s+='<h2>Held-state mechanism and fixed trait distribution</h2><p>Without trait moderation, heat load is ((temperature − 24)/12) × 0.94 in this range; fatigue is 1 + 0.12 × load and recovery 1 − 0.04 × load. These are declared model hypotheses, not empirical calibration. Trait moderation multiplies only this extra burden.</p>'
s+=table(['Temperature','Mean-tolerance fatigue multiplier','Mean-tolerance recovery multiplier'],[[str(t)+' C',f'{1+.12*(t-24)/12*.94:.6f}',f'{1-.04*(t-24)/12*.94:.6f}']for t in [28,32,35]])
traits=json.loads((p/'fixed-normal-traits.json').read_text());import statistics
rows=[]
for profile in m['profiles']:
 for team in profile['teams']:
  values=[traits[x['id']]['heat']for x in team['players']];rows.append([team['name'],len(values),f'{statistics.mean(values):.4f}',f'{statistics.stdev(values):.4f}',f'{min(values):.4f} to {max(values):.4f}'])
s+=table(['Club','Players','Mean heat trait','Sample SD','Heat trait range'],rows)
s+='<h2>Comparison, verification and limits</h2><p>The previous 6,400-outcome study estimated heat-only winner shifts from −3.875 to +2.75 points; all adjusted intervals crossed zero. Its sample is preserved separately in prior-comparison and is not pooled here. This new screen adds moderate temperatures and normal tolerance variation; it is not a high-precision replication of the severe-heat winner estimates.</p><p>Preflight: 80 input constructions, eight exact neutral-trait parity checks, 3,360 held-state multiplier checks, four exact historical replays, and save/resume of 80 outcomes with corrupt-telemetry rejection. Research: 80 enabled replays, eight frozen controls, and every score/statistic/clock/input/retained checksum checked. Full ledger audit verified every gzip CRC, result hash and compact metric. Independent Python recomputation checked all primary and declared secondary physical contrasts, 108 competitive contrasts including sides, and club cells/denominators. The 64-file v1.0 lock is intact.</p><p>The bundle contains all compact outcomes, exact traits, fixed plan, seed manifest, verification and reproducible source. Full ledgers remain separate; no bulk archive is required for review. No official records, default coefficients, coaches, ratings, rules or deployment changed.</p><p>Limits: eight selected clubs, four opponents, one fixed trait population, fixed humidity and availability; no empirical physiology, cold validation, all league matchups, thermal extremes, combined psychology or halftime adaptation. The 0.35 setting remains provisional. Sample winner fluctuations are not forced to be monotonic.</p></main></html>'
(p/'Century_Temperature_Response_and_Normal_Tolerance.html').write_text(s)
repro=p/'reproduction';base='1f867ad5de47a6e8c40b70cbcb379e8751c72e8a';(repro/'base-commit.txt').write_text(base+'\n')
(repro/'source.patch').write_bytes(subprocess.check_output(['git','diff','--binary',base,'HEAD'],cwd=repo));(repro/'pinned-commit.txt').write_bytes(subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo))
for name in ['audit-temperature-curve.mjs','analyze-temperature-curve.py','recompute-temperature-curve.py','report-temperature-curve.py']:(repro/name).write_bytes((repo/'scripts'/name).read_bytes())
(repro/'README.txt').write_text('\n'.join(['Reconstruct Golfhaus/CenturyLeague at base-commit.txt and git apply --binary source.patch. Use Node '+m['runtime']['node']+' and the exact saved simulation command under scripts/supervise-engine-study.py. No dependencies or credentials needed. Source fingerprint must match manifest.json. Copied profiles and fixed traits are read-only research inputs. Full historical ledgers are not included; their checksums are retained.',
 'To recompute without simulations from the extracted bundle directory:', 'python3 reproduction/analyze-temperature-curve.py .','python3 reproduction/recompute-temperature-curve.py .','No official deployment or adoption.','']))
files=sorted(x for x in p.rglob('*')if x.is_file()and x.suffix!='.zip'and x.name not in ['CHECKSUMS.sha256','save-status.json','save-receipt.json']and not x.name.endswith('.log'))
(p/'CHECKSUMS.sha256').write_text(''.join(hashlib.sha256(x.read_bytes()).hexdigest()+'  '+x.relative_to(p).as_posix()+'\n'for x in files));z=p/'Century_Temperature_Response_and_Normal_Tolerance_2026_11_14.zip'
with zipfile.ZipFile(z,'w',zipfile.ZIP_DEFLATED,compresslevel=9)as f:
 for x in files+[p/'CHECKSUMS.sha256']:f.write(x,x.relative_to(p).as_posix())
with zipfile.ZipFile(z)as f:
 assert f.testzip()is None
 for line in f.read('CHECKSUMS.sha256').decode().splitlines():
  sha,name=line.split('  ',1);assert hashlib.sha256(f.read(name)).hexdigest()==sha
print(json.dumps({'status':'verified','package':str(z.resolve()),'bytes':z.stat().st_size,'contentFiles':len(files)}))
