"""Render the completed immutable holistic studies; no simulation or source edits."""
import csv,hashlib,json,statistics,sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
pdfmetrics.registerFont(TTFont('CenturySans','/usr/share/fonts/truetype/open-sans/OpenSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('CenturySans-Bold','/usr/share/fonts/truetype/open-sans/OpenSans-Bold.ttf'))
pdfmetrics.registerFontFamily('CenturySans',normal='CenturySans',bold='CenturySans-Bold',italic='CenturySans',boldItalic='CenturySans-Bold')
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,PageBreak,Image
from reportlab.lib.utils import ImageReader
repo=Path(__file__).resolve().parents[1]; out=Path(sys.argv[1]).resolve();out.parent.mkdir(parents=True,exist_ok=True)
base=repo/'experiments/holistic/runs'; S={k:{n:json.loads((base/k/(n+'.json')).read_text())for n in ['manifest','analysis','ledger-verification','independent-recomputation','event-exposures-verification','event-exposures-independent']}for k in ['screen','confirmation']}
for study in S.values():
 for n in ['ledger-verification','independent-recomputation','event-exposures-verification','event-exposures-independent']:assert study[n]['status']=='passed'
inf=json.loads((base/'confirmation/inference.json').read_text());assert inf['status']=='completed'
screen=S['screen']['analysis']; conf=S['confirmation']['analysis']; rows=list(csv.DictReader((base/'confirmation/outcomes.csv').open()));exposures=list(csv.DictReader((base/'confirmation/event-exposures.csv').open()))
labels={'ordinary':'Ordinary','hot-favored':'Hot favored','hot-adverse':'Hot adverse','cold-favored':'Cold favored','cold-adverse':'Cold adverse'}
scenes=['ordinary','hot-favored','hot-adverse','cold-favored','cold-adverse']; intervals=inf['primaryContrasts']; selected=json.loads((repo/'docs/holistic-selected-confirmation-plan-2026-11-18.json').read_text())['selectedScenes']
def f(x):return f'{x:+.2f}'
def rate(w,n):return f'{w}/{n} ({100*w/n:.1f}%)'
def con(scene,ref='000',data=conf):return next(c for c in data['contrasts']if c['scene']==scene and c['population']=='matched'and c['reference']==ref)
def ci(scene,ref):return next(c for c in intervals if c['scene']==scene and c['reference']==ref)['familyWise95IntervalPP']
def mdtable(head,data):return '| '+' | '.join(head)+' |\n| '+' | '.join(['---']*len(head))+' |\n'+'\n'.join('| '+' | '.join(map(str,r))+' |'for r in data)+'\n'
summary=[]
for scene in selected:
 for ref in ['000','110']:
  c=con(scene,ref);lo,hi=ci(scene,ref);summary.append([labels[scene],'Full vs control'if ref=='000'else'Added halftime',rate(c['wins'],c['n']),rate(c['referenceWins'],c['n']),f(c['winChangePP']),f'[{f(lo)}, {f(hi)}]'])
flags=[{'scene':x['scene'],'reference':x['reference'],'pointPP':x['winChangePP'],'intervalPP':x['familyWise95IntervalPP'],'intervalWithinOuter15':x['familyWise95IntervalPP'][0]>=-15 and x['familyWise95IntervalPP'][1]<=15}for x in intervals]
review={'status':'completed','scientificOutcomes':5376,'screenOutcomes':3840,'confirmationOutcomes':1536,'fullScientificReplays':sum(x['ledger-verification']['replays']for x in S.values()),'confirmationContrasts':flags,'adoptionApproved':False,'holisticReleaseGate':'open: total-stack bounds exceed provisional15-point reference; real-club/history and rehearsal gates remain','officialWrites':False,'sourceOrCoefficientChanges':False,'limits':'Synthetic profile-mixture confirmation at two selected matched corners; no established policy optimality, general safety or production acceptance. No earlier study pooled. Copied club snapshot available for later validation, unused here.'}
(base/'confirmation/review-summary.json').write_text(json.dumps(review,indent=2)+'\n')
styles=getSampleStyleSheet();navy=colors.HexColor('#17334b');teal=colors.HexColor('#087f8c');grey=colors.HexColor('#526474')
styles.add(ParagraphStyle(name='BodyCentury',fontName='CenturySans',fontSize=10,leading=14,spaceAfter=9,textColor=navy))
styles.add(ParagraphStyle(name='SmallCentury',fontName='CenturySans',fontSize=8.4,leading=11.5,spaceAfter=7,textColor=grey))
styles.add(ParagraphStyle(name='TableCentury',fontName='CenturySans',fontSize=8.1,leading=10.2,textColor=navy))
styles['Title'].fontName='CenturySans-Bold';styles['Title'].fontSize=25;styles['Title'].leading=29;styles['Title'].textColor=navy
styles['Heading2'].fontName='CenturySans-Bold';styles['Heading2'].textColor=teal;styles['Heading2'].fontSize=14;styles['Heading2'].spaceBefore=9
flow=[]
def p(t,small=False):flow.append(Paragraph(t,styles['SmallCentury'if small else'BodyCentury']))
def h(t):flow.append(Paragraph(t,styles['Heading2']))
def table(head,data,widths):
 conv=lambda x:Paragraph(str(x),styles['TableCentury']);t=Table([[conv(x)for x in head]]+[[conv(x)for x in r]for r in data],colWidths=widths,repeatRows=1,hAlign='LEFT')
 t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e2eef3')),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#f5f8fa')]),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6),('LINEBELOW',(0,0),(-1,0),.7,teal)]));flow.append(t);flow.append(Spacer(1,10))
def page():flow.append(PageBreak())
flow.append(Paragraph('Century engine v2<br/>Holistic modifier review',styles['Title']));p('18 November 2026 | Fixed candidate | Research branch only',True)
p('The complete modifier stack has now been tested together on fresh inputs. The screen and its independent selected-corner confirmation are complete; all retained outcomes passed the planned audits. These results inform the next validation gate, rather than activating v2.')
h('Fresh confirmation: what changed?')
table(['Scene / comparison','Full-stack wins','Reference wins','Change (pp)','Simultaneous 95% range (pp)'],[[r[0]+'<br/>'+r[1],*r[2:]]for r in summary],[121,92,92,62,157])
p('Each scene has 256 paired cases with matched roster quality. Full vs control switches psychology, weather/tolerance and both coaches on. Added halftime compares the same full stack with both coaches holding. A designated team need not benefit when both coaches adapt.',True)
p('<b>Assessment:</b> The screen\'s large selected shifts did not persist. Fresh total-stack estimates were -2.73 and -4.30 points; both simultaneous ranges extend beyond the provisional 15-point outer reference. The sample therefore leaves the envelope gate open. Added halftime effects were small negative point estimates with uncertain direction; a positive win benefit is not established.')
fig,ax=plt.subplots(figsize=(7.2,2.15));fig.patch.set_facecolor('white')
for i,x in enumerate(intervals):
 lo,hi=x['familyWise95IntervalPP'];v=x['winChangePP'];ax.errorbar(v,i,xerr=[[v-lo],[hi-v]],fmt='o',color='#087f8c'if x['reference']=='000'else'#5a607e',capsize=3)
ax.axvline(0,color='#667788',lw=.8);ax.axvline(-15,color='#b3b9bf',ls=':',lw=.8);ax.axvline(15,color='#b3b9bf',ls=':',lw=.8);ax.set_yticks(range(4),[labels[x['scene']]+(' / full'if x['reference']=='000'else' / halftime')for x in intervals],fontsize=9);ax.invert_yaxis();ax.set_xlabel('Change in focal-team win probability (percentage points)',fontsize=9);ax.tick_params(axis='x',labelsize=8);ax.spines[['top','right','left']].set_visible(False);fig.tight_layout();plot=out.parent/'holistic_confirmation_intervals.png';fig.savefig(plot,dpi=180);plt.close(fig);flow.append(Image(str(plot),width=520,height=155))
p('Ranges jointly cover all four predeclared differences under the designed synthetic mixture. Dotted lines show the provisional +/-15-point outer review reference for total stack effects; it is not an adopted pass margin or a winner clamp. Screen outcomes are not pooled into these estimates.',True)
page();h('Screen: quality still matters')
p('All 480 paired screen cases and all eight arms were retained. Every cell below has 32 cases. Opponent-wide rating offsets create a weaker opponent (-0.35), a matched opponent (0), or a stronger opponent (+0.35); backgrounds and original orientation are balanced.')
sd=[]
for scene in scenes:
 for gap in [-.35,0,.35]:
  a=next(x for x in screen['cells']if x['scene']==scene and x['gap']==gap and x['arm']=='000');b=next(x for x in screen['cells']if x['scene']==scene and x['gap']==gap and x['arm']=='111');sd.append([labels[scene],{-0.35:'Weaker',0:'Matched',0.35:'Stronger'}[gap],rate(a['wins'],a['n']),rate(b['wins'],b['n']),f(b['winRatePct']-a['winRatePct'])])
table(['Scene','Opponent','Control wins','Full-stack wins','Change (pp)'],sd,[100,76,128,128,92])
p('These are small, descriptive cells, not 15 independent release decisions. High raw win rates against a weaker opponent are not evidence of excessive modifier power when the control already wins often. Stronger opponents can still win despite favorable inputs. Exact scores, energy, decisions and all eight arms are in the data package.',True)
h('Selected corners were chosen by a frozen rule')
p('From matched screen cases, choose the larger full-minus-control point estimate among hot/cold favored and the smaller among hot/cold adverse; break ties lexically. The selected scenes were '+', '.join(labels[x]for x in selected)+'. Confirmation uses new profile draws and gameplay seeds, without replacing losses, extending the sample or modifying coefficients.')
page();h('Interactions and coaching decisions')
p('The eight arms form a psychology x physical x halftime factorial. Main effects average a switch over the other settings; pair terms are averaged differences of differences. These diagnostics have 32 matched cases per scene and are descriptive, so large or sign-changing terms can reflect stochastic path changes and sampling noise.')
fd=[]
for x in screen['factorial']:fd.append([labels[x['scene']],*[f(x[k])for k in ['psychologyMainPP','physicalMainPP','halftimeMainPP','psychologyPhysicalInteractionPP','psychologyHalftimeInteractionPP','physicalHalftimeInteractionPP','threeWayInteractionPP']]])
table(['Scene','P','W','H','P x W','P x H','W x H','P x W x H'],fd,[100,56,56,56,64,64,64,64])
p('All values are percentage points. P = confidence/frustration/home support; W = weather plus heat/cold tolerance; H = both coaches automatic. The shared psychology odds bonus remained capped at 0.006 in the audited outcomes. This is an event-probability cap, not a match-win cap.',True)
h('Fresh confirmation: actual exposure and workload')
ed=[]
for scene in selected:
 for arm in ['000','110','111']:
  rr=[r for r in rows if r['scene']==scene and r['arm']==arm];ee=[r for r in exposures if r['scene']==scene and r['arm']==arm];n=len(rr);inc=sum(int(r['focalFoulIncidents'])for r in ee);ser=sum(int(r['focalSeriousFouls'])for r in ee);exp=sum(float(r['focalExpectedSeriousSum'])for r in ee);choices=sum(r['focalChoice']!='hold'for r in rr)+sum(r['opponentChoice']!='hold'for r in rr)
  ed.append([labels[scene],arm,f'{choices}/{2*n}',f'{statistics.mean(float(r["focalFinalEnergy"])for r in rr):.3f}',f'{ser}/{inc} ({100*ser/inc:.2f}%)',f'{100*exp/inc:.2f}%'])
table(['Scene','Arm','Coach changes','Mean final energy','Serious / foul incidents','Mean modeled severity'],ed,[100,36,88,86,132,82])
p('Energy is the mean over the focal roster at match end. Severity uses event-derived foul incidents in every arm; it is not serious fouls per match or per contact. The last column is the mean conditional severity probability across those incidents. These exposure summaries are descriptive. Use event-exposures.csv: optional psychology counters in the frozen outcomes.csv are zero when telemetry is off, which does not mean no actual fouls.',True)
h('What the result does and does not establish')
p('The fixed source ran coherently through simultaneous modifiers, retained Hold decisions and finite energy, and reproduced its planned replay subset. Uncertainty around the paired win effects remains material. No result establishes policy optimality, general non-inferiority, or acceptance of every real-club and season-history combination. Modest strategic adaptation is the intended behavior; a better opponent can remain better.')
page();h('Verification, provenance and release boundary')
vd=[]
for name in ['screen','confirmation']:
 v=S[name]['ledger-verification'];vd.append([name.title(),v['fixtureClusters'],v['fullOutcomesVerified'],v['replays'],v['pairedFirstHalfChecks'],v['ownObservationReconstructions']])
table(['Study','Paired cases','Full outcomes audited','Exact replays','Paired first halves','Own observations rebuilt'],vd,[88,70,100,80,92,94])
p('All retained raw-result and file hashes were checked. The audit reconstructs scores, clocks, player eligibility, substitutions, native fatigue/recovery, weather adjustments, public halftime observations, permitted tactical choices and modifier/exposure counters. The planned replay subset is checked exactly; this is not a claim to reconstruct every hidden RNG draw independently. A second Python pass reproduces the CSV contrasts, cells and factorial arithmetic. Event denominators are exported from raw events and independently regrouped.')
p('Qualification was excluded: 96 audited outcomes with 96 exact replays, 12 default-off checks, 12 Hold equivalences, 48 paired first halves and eight deliberate corruption rejections. Four-worker preflight retained 64 excluded outcomes and 16 replays. Before scientific execution a signed-zero assertion in the new checker was corrected; gameplay was unchanged. Synthetic math-contract checks used artificial data and were also excluded. Scientific automatic retries, seed replacements and sample extensions: zero.',True)
h('Statistical scope')
p('Confirmation drew with replacement from eight matched synthetic profiles (four templates x two tactical backgrounds), independently within each fixed orientation: 128 cases per side per scene. The target includes random profile draws and averages the two orientations equally. For each signed discordance probability, one-sided Clopper-Pearson bounds use alpha = 0.05/32; a union bound yields family-wise 95% coverage for four differences. Beta inverse-CDF endpoints were independently checked by binomial-CDF bisection. This inference does not condition on realized template counts, and is not a real-league population estimate.',True)
mix={}
for fxt in S['confirmation']['manifest']['fixtures']:
 key=fxt['scene']+' / '+fxt['profile'];mix[key]=mix.get(key,0)+1
p('All realized profile draws, seeds, environments and source identities are in the frozen plans. Complete mixture counts are supplied in the data package. The screen covers only four synthetic templates and five fixed environments, not all plausible weather, traits, rosters or histories.',True)
h('Next gate')
p('Predeclare a larger, more precise envelope study, incorporating copied real-club profiles and accumulating histories, before treating the proposed modifier budget as satisfied. Then complete an isolated season rehearsal and a competition-scoped release review. A read-only snapshot of all 18 clubs (35 players each) has been captured and was not used here. No official records were changed. The current tournament keeps its current engine; v2 remains a December candidate and has not been merged, deployed or activated.')
p('Gameplay source SHA256: '+conf['sourceSHA256']+'<br/>Harness SHA256: '+conf['harnessSHA256'],True)
p('Methods: <link href="https://stat.ethz.ch/R-manual/R-devel/library/stats/html/binom.test.html" color="#087f8c">R binom.test / Clopper-Pearson</link>; <link href="https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.beta.html" color="#087f8c">SciPy beta inverse CDF</link>. Source and exact prospective plans: Golfhaus/CenturyLeague, lab/drop-counter-recovery-2026-11-17.',True)
def footer(canvas,doc):
 canvas.setStrokeColor(colors.HexColor('#d4e0e7'));canvas.line(44,40,568,40);canvas.setFont('CenturySans',8);canvas.setFillColor(grey);canvas.drawString(44,27,'CENTURY | Engine v2 laboratory | 18 November 2026');canvas.drawRightString(568,27,str(doc.page))
SimpleDocTemplate(str(out),pagesize=(612,792),rightMargin=44,leftMargin=44,topMargin=38,bottomMargin=53,title='Century holistic modifier review - 18 November 2026',author='Century engine laboratory').build(flow,onFirstPage=footer,onLaterPages=footer)
doc='# Holistic modifier results - 18 November 2026\n\nCompleted: 3,840 screen + 1,536 fresh confirmation outcomes, kept separate. No gameplay tuning, scientific retries, seed replacements, sample extension or official writes. Research publication is not activation.\n\n'+mdtable(['Scene','Comparison','Full wins','Reference wins','Change pp','Family-wise95% interval pp'],summary)+'\n## All screen quality cells (descriptive)\n\n'+mdtable(['Scene','Opponent','Control','Full','Change pp'],sd)+'\n## Factorial diagnostics (descriptive pp)\n\n'+mdtable(['Scene','P','W','H','PxW','PxH','WxH','PxWxH'],fd)+'\n## Verification and limits\n\n'+mdtable(['Study','Clusters','Audited outcomes','Replays','Paired first halves','Own observations'],vd)+'\nAll source/result hashes, ledgers, own observations, weather/energy and policy checks passed. The independently verified event-exposures.csv supplies all-arm disciplinary denominators; optional counters in original outcomes.csv are zero when telemetry is disabled, not evidence of zero incidents.\n\nConfirmation uses the predeclared independent uniform profile-mixture target with 128 fresh draws per fixed side and scene, jointly covering four signed differences using 32 one-sided Clopper-Pearson tails. No screen or historical outcomes pooled. All remaining cells/interaction/exposure summaries are descriptive. The outer15-point reference remains provisional; point estimates or nonsignificance are not release acceptance.\n\nFour synthetic templates and fixed scenes do not cover actual club/history variation. A read-only18-club snapshot is available for the next validation, unused in this sample. Copied-club/history checks, an isolated season rehearsal and explicit competition-scoped release remain. Current tournament stays on its existing engine.\n\nSource SHA256: `'+conf['sourceSHA256']+'`\n\nHarness SHA256: `'+conf['harnessSHA256']+'`\n'
doc+='\n## Release assessment\n\nThe large screen effects did not persist in fresh confirmation. Total-stack simultaneous95% ranges extend beyond the provisional15-point outer review reference, leaving the envelope gate open. Added halftime point estimates are small and negative with uncertain direction; a positive benefit is not established. Predeclare a larger, more precise envelope study incorporating copied real-club profiles and accumulating histories before treating the budget as satisfied. No coefficients or thresholds were changed in response to this sample.\n'
(repo/'docs/HOLISTIC_MODIFIER_RESULTS_2026_11_18.md').write_text(doc)
(base/'confirmation/profile-mixture-counts.json').write_text(json.dumps(mix,indent=2)+'\n')
print(json.dumps({'report':str(out),'bytes':out.stat().st_size,'review':review}))
