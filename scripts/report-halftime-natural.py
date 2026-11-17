"""Render restored-policy integration and fresh natural-history validation results."""
import argparse,json
from pathlib import Path
from html import escape
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,PageBreak
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
p=argparse.ArgumentParser(description=__doc__);p.add_argument('study',type=Path);p.add_argument('output',type=Path);a=p.parse_args()
v=json.loads((a.study/'analysis.json').read_text());proof=json.loads((a.study/'ledger-verification.json').read_text());ind=json.loads((a.study/'independent-recomputation.json').read_text());assert v['outcomes']==proof['fullOutcomesVerified']==1536 and ind['status']=='passed'
for name,file in [('C','DejaVuSans.ttf'),('CB','DejaVuSans-Bold.ttf')]:pdfmetrics.registerFont(TTFont(name,'/usr/share/fonts/truetype/dejavu/'+file))
pdfmetrics.registerFontFamily('C',normal='C',bold='CB',italic='C',boldItalic='CB');navy=colors.HexColor('#163449');teal=colors.HexColor('#087D80')
b=ParagraphStyle('b',fontName='C',fontSize=9.1,leading=12.6,spaceAfter=8,textColor=navy);h=ParagraphStyle('h',parent=b,fontName='CB',fontSize=20,leading=24,spaceAfter=13);h2=ParagraphStyle('h2',parent=b,fontName='CB',fontSize=12,leading=16,spaceBefore=5,spaceAfter=8);c=ParagraphStyle('c',parent=b,fontSize=8.2,leading=11.1,spaceAfter=0);small=ParagraphStyle('small',parent=b,fontSize=7.3,leading=10)
story=[]
def para(s,style=b):story.append(Paragraph(s,style))
def table(rows,widths):
 t=Table([[Paragraph(escape(str(x)),c)for x in row]for row in rows],colWidths=widths,repeatRows=1);t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#DDEDEE')),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.HexColor('#F4F8F9'),colors.white]),('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5),('LINEBELOW',(0,0),(-1,0),.8,teal)]));story.extend([t,Spacer(1,8)])
labels={'none':'Neither adapts','focal-only':'Focal coach only','opponent-only':'Opponent coach only','both':'Both coaches'}
q=v['primary'];lo,hi=q['conservative95IntervalPP'];focal=next(x for x in v['cells']if x['arm']=='focal-only')
if focal['focalChanges']==0:status='The automatic policy is restored and executes correctly, but it made no focal tactical changes in this validation matrix. The sporting-effect comparison is therefore uninformative about adaptation benefits; review coverage before release validation.'
elif lo<=0<=hi:status='The automatic policy is restored and works end to end. The primary interval includes zero, so a reliable win-rate benefit is not established. This clears functional checks, not holistic release acceptance.'
elif lo>0:status='The automatic policy works end to end and the isolated focal-policy contrast is positive in this fixed validation sample. Holistic testing and the later release decision remain required.'
else:status='The automatic policy works end to end, but the isolated focal-policy result is negative in this fixed validation sample. Investigate before release acceptance; do not lower thresholds to chase a result.'
para('Automatic halftime coaching<br/>Restoration and natural-history validation',h)
para('<b>17 November 2026 | Completed, audited and independently recomputed</b>')
para('The frozen candidate completed <b>384 paired cases / 1,536 full matches</b> on 24 synthetic profiles: four roster templates, matched and stronger/weaker opponents, neutral/maximal tactical backgrounds, and balanced focal orientation. First halves played naturally; the same match seed was shared across four coaching arms. Other modifiers were disabled for isolation.')
para('<b>'+status+'</b>')
table([['Coaching arm','Focal wins / 384','Win rate','Focal changes','Opponent changes']]+[[labels[x['arm']],x['wins'],f"{x['winRatePct']:.2f}%",x['focalChanges'],x['opponentChanges']]for x in v['cells']],[151,104,82,91,96])
para('Primary comparison: focal coach only versus neither',h2)
para(f"The pre-match focal win-probability change was <b>{q['winChangePP']:+.2f} percentage points</b>, with a conservative 95% interval of <b>{lo:+.2f} to {hi:+.2f} points</b>. Winners changed toward the focal team in {q['changedToFocal']} cases and against it in {q['changedAgainstFocal']}; mean final-margin change was {q['meanMarginChange']:+.2f} score points.")
if q['changedAgainstFocal']>0 and q['changedToFocal']==0:para('Every changed winner in the primary contrast went against the adapting focal team. This small-sample pattern does not prove harm, but it warrants decision-quality review before the policy is called settled. Do not infer that reducing adoption thresholds would help.')
para(f"The bound has half-width {q['intervalHalfWidthPP']:.2f} points and does not rely on identical outcome probabilities across the fixed profiles. It was fixed before scientific execution; the earlier binomial interval proposal and prospective amendment are retained. Other arm comparisons, adoption splits and margins are descriptive.")
para('When the focal policy changed its tactics',h2)
bandLabels={'leading-or-tied':'Leading or tied','trailing-1-4':'Trailing 1-4','trailing-5-20':'Trailing 5-20','trailing-21-plus':'Trailing 21+'}
table([['Halftime position','Cases','Changes','Change rate']]+[[bandLabels[x['band']],x['n'],x['changes'],f"{100*x['changes']/x['n']:.1f}%"if x['n']else'Not observed']for x in v['byDeficit']],[204,92,109,119])
para(f"The focal policy changed in {focal['focalChanges']}/384 cases ({100*focal['focalChanges']/384:.1f}%). Hold is a valid decision; these are observed rates on the fixed synthetic matrix, not estimates of league-wide coaching behavior. Policy thresholds, costs and recipes were restored unchanged and were not tuned to these outcomes.")
story.append(PageBreak())
para('Context, safeguards and release gates',h)
para('Each root/quality combination contains 64 paired cases; full context splits are retained in the data bundle. The maximal background also changes running emphasis, physicality and aggression, so differences cannot isolate pressure alone. This full-match effect includes Hold and cannot be pooled with earlier conditional second-half estimates. Neither component rankings nor subgroup winners select a new policy.')
table([['Validation evidence','Result'],['Historical decision restoration','96 policy choices/distances and 96 diagnostic choices matched saved records; new source/version identity, not byte restoration of the missing original'],['Native integration','Six default-off, six enabled-Hold sporting equivalence, six exact enabled replays and six first-half checks passed'],['Targeted behavior','Fatigue conservation, close-game hurdle, press energy/leading vetoes, no-evidence Hold, threshold boundaries and observation immutability checked'],['Excluded preflight','Eight full-match outcomes and eight exact replays; neutral/maximal roots and both orientations; excluded from validation'],['Scientific ledgers',f"{proof['fullOutcomesVerified']} full score/statistic, clock, energy and eligibility audits; {proof['ownObservationReconstructionChecks']} own-state observation reconstructions"],['Pairing and replays',f"{proof['pairedFirstHalfChecks']} paired first-half equality checks, {proof['replayEvidenceOutcomes']} matched full-match replays and {proof['noOpGameplayComparisons']} no-op gameplay comparisons"],['Independent recomputation','Python CSV regrouping verified primary/secondary contrasts, the interval, choices, coverage, deficit bands, margins and interaction']],[155,369])
para('Policy boundary',h2)
para('Decisions occur after the native halftime interval and personnel review. Observations contain public score/shot/disposal data, original tactics and the coach\'s own active players, pre-interval workload and personnel-review events. Both decisions are formed before either tactical change is applied. Opponent ratings/energy and future events are excluded. At most two sliders change, root distance is at most two, and values remain in 1-5. Native substitutions and recovery remain in force.')
para('Next gate and rollout',h2)
para('The candidate remains experimental. Next, review decisions on genuine opposing-tactic and personnel-fit mismatches, plus persistent-fatigue coverage. This matrix used mirrored skill patterns and the same tactical background for both teams, so it is not a deliberate tactical-mismatch test. Then evaluate the v2 modifiers together and run an isolated season rehearsal. The current tournament retains its existing engine; December-season v2 remains conditional on the remaining validation and release decision. Further factors stay deferred to a possible v3.')
para('The compact bundle contains the fixed plan, all paired outcomes, analysis and verification evidence, and exact synthetic profile inputs. Full ledgers remain in the study directory. Repository code is maintained on the separate lab branch.',small)
para('Policy source SHA256: '+v['sourceSHA256'],small);para('Harness SHA256: '+v['harnessSHA256'],small)
def decorate(canvas,doc):
 canvas.saveState();canvas.setStrokeColor(teal);canvas.setLineWidth(1.2);canvas.line(44,755,568,755);canvas.setFont('CB',8);canvas.setFillColor(teal);canvas.drawString(44,766,'CENTURY / ENGINE LABORATORY');canvas.setFont('C',7);canvas.setFillColor(navy);canvas.drawString(44,29,'AUTOMATIC POLICY VALIDATION | EXPERIMENTAL - NOT ADOPTED');canvas.drawRightString(568,29,str(doc.page));canvas.restoreState()
a.output.parent.mkdir(parents=True,exist_ok=True);SimpleDocTemplate(str(a.output),pagesize=(612,792),leftMargin=44,rightMargin=44,topMargin=55,bottomMargin=48,title='Century automatic halftime policy: natural-history validation',author='Century Stuff').build(story,onFirstPage=decorate,onLaterPages=decorate);print(a.output)
