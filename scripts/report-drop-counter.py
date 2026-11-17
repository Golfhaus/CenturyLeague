"""Render the audited targeted package experiment; retain its recovery limits."""
import argparse,json
from pathlib import Path
from html import escape
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,PageBreak
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
p=argparse.ArgumentParser(description=__doc__);p.add_argument('study',type=Path);p.add_argument('output',type=Path);a=p.parse_args()
v=json.loads((a.study/'analysis.json').read_text());proof=json.loads((a.study/'ledger-verification.json').read_text());ind=json.loads((a.study/'independent-recomputation.json').read_text());assert v['outcomes']==proof['fullOutcomesVerified']==1024 and ind['status']=='passed'
for name,file in [('C','DejaVuSans.ttf'),('CB','DejaVuSans-Bold.ttf')]:pdfmetrics.registerFont(TTFont(name,'/usr/share/fonts/truetype/dejavu/'+file))
pdfmetrics.registerFontFamily('C',normal='C',bold='CB',italic='C',boldItalic='CB')
navy=colors.HexColor('#163449');teal=colors.HexColor('#087D80')
b=ParagraphStyle('b',fontName='C',fontSize=9.2,leading=12.7,spaceAfter=8,textColor=navy);h=ParagraphStyle('h',parent=b,fontName='CB',fontSize=21,leading=25,spaceAfter=14)
h2=ParagraphStyle('h2',parent=b,fontName='CB',fontSize=12.1,leading=16,spaceBefore=5,spaceAfter=8);c=ParagraphStyle('c',parent=b,fontSize=8.2,leading=11.2,spaceAfter=0);small=ParagraphStyle('small',parent=b,fontSize=7.3,leading=10)
story=[]
def para(s,style=b):story.append(Paragraph(s,style))
def table(rows,widths):
 t=Table([[Paragraph(escape(str(x)),c) for x in row]for row in rows],colWidths=widths,repeatRows=1);t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#DDEDEE')),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.HexColor('#F4F8F9'),colors.white]),('VALIGN',(0,0),(-1,-1),'TOP'),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5),('LINEBELOW',(0,0),(-1,0),.8,teal)]));story.extend([t,Spacer(1,8)])
labels={'hold':'Hold','pressure-only':'Pressure -0.5','transition-only':'Transition +0.5','drop-counter':'Combined drop-and-counter'}
q=v['primary'];lo,hi=q['conservative95IntervalPP']
if lo>0:decision='The combined package showed a positive effect in this fixed conditional sample. This is not a validation of revised coaching thresholds or natural-match adoption.'
elif hi<0:decision='The combined package reduced win probability in this fixed conditional sample. These results support retaining Hold here rather than forcing this package.'
else:decision='The primary interval includes zero. This study does not establish a reliable benefit from forcing the combined package; keep the current coaching thresholds.'
para('Halftime adaptation<br/>Drop-and-counter package test',h)
para('<b>17 November 2026 | Completed, audited and independently recomputed</b>')
para('The fixed experiment completed <b>256 paired cases / 1,024 second-half outcomes</b>. It uses only maximal-pressure 50-48 halftime states: four frozen synthetic roster histories, both orientations and 32 fresh seeds per state. Every case shares its state and future seed across the four arms; the opponent holds.')
para('<b>'+decision+'</b>')
table([['Arm','Pressure delta','Transition delta','Wins / 256','Win rate']]+[[labels[x['arm']],'-0.5'if x['arm']in ['pressure-only','drop-counter']else'0','+0.5'if x['arm']in ['transition-only','drop-counter']else'0',x['wins'],f"{x['winRatePct']:.2f}%"]for x in v['cells']],[173,87,87,91,86])
para('Primary comparison: combined package versus Hold',h2)
para(f"The paired win-probability change was <b>{q['winChangePP']:+.2f} percentage points</b>. Its prespecified conservative 95% interval is <b>{lo:+.2f} to {hi:+.2f} points</b>. The package changed the winner toward the trailing team in {q['changedToFocal']} cases and against it in {q['changedAgainstFocal']}; mean final-margin change was {q['meanMarginChange']:+.2f} score points.")
para(f"The interval uses the frozen distribution-free Hoeffding bound for one primary comparison, with half-width {q['intervalHalfWidthPP']:.2f} percentage points at n=256. It remains too wide to establish a small effect precisely. The components, interaction, margins and splits below are descriptive rather than additional confirmed findings.")
para(f"The factorial interaction in win-probability differences was {v['interactionRiskDifferencePP']:+.2f} percentage points: combined minus pressure-only minus transition-only plus Hold. This quantity need not be zero, and its point estimate is not a demonstrated interaction effect.")
para('The individual components had higher observed win rates than the combined package in this fresh sample. Pressure-only also reversed the negative point estimate seen in the earlier 16-case screen. The old and fresh samples remain separate; neither reversal nor the descriptive ranking proves a general coaching rule.')
table([['Descriptive split','Cases','Hold wins','Package wins','Paired change']]+[[f"Roster template {x['template']}",x['n'],x['controlWins'],x['wins'],f"{x['winChangePP']:+.2f} pp"]for x in v['byTemplate']]+[[f"Trailing side {x['side']}",x['n'],x['controlWins'],x['wins'],f"{x['winChangePP']:+.2f} pp"]for x in v['bySide']],[153,69,91,100,111])
story.append(PageBreak())
para('Verification, recovery and evaluation decision',h)
table([['Evidence','Result'],['Frozen source recovery','Public base plus the archived source patch reproduced the prior native v2 fingerprint and protected v1.0 checks'],
 ['Rebuilt adapter qualification','All 1,248 historical single-slider records matched every saved compact score, clock and action-count measurement; four full default-off comparisons matched the recovered native engine'],
 ['Excluded preflight','Two opposite orientations / eight outcomes; exact replays and full independent ledger audits; excluded from this experiment'],
 ['Fresh scientific ledgers',f"{proof['fullOutcomesVerified']} score/statistics, clock, energy and eligibility audits; exact prescribed deltas and frozen prefixes checked"],
 ['Exact future replay',f"{proof['replayEvidenceOutcomes']} matched replays: first two trials of every oriented state/arm"],
 ['Independent statistics','Python regrouped the compact CSV and verified the primary interval, discordant pairs, components, interaction, subgroup splits, margins, durations and event rates'],
 ['Operational faults','Interruption before/after atomic publication, duplicate-write protection and corrupt-gzip rejection passed']],[158,366])
para('What the recovery does and does not establish',h2)
para('The earlier local checkout was unavailable. The saved data and original prefix bytes were recovered intact. The old native source was reconstructed from its exact public base and archived patch, while the missing halftime continuation adapter was rebuilt as a new, separately identified research adapter. Its native gameplay calculations are unchanged outside explicit restore/intervention wiring.')
para('Recovery qualification compared every saved compact measurement for 1,248 earlier outcomes and independently audited the newly generated qualification ledgers. The original full historical future ledgers and exact missing adapter source were unavailable. <b>This is not a claim of byte-identical historical event reproduction.</b> Qualification outcomes do not enter the fresh 256-case estimate.')
para('Implications and remaining limits',h2)
para(decision+' The test measures the exact modest package that narrowly missed the close-game adoption hurdle. It does not evaluate a revised whole coaching policy, prove an optimal strategy, or justify reducing thresholds across all contexts.')
para('These are conditional synthetic histories with recovered on-field players at halftime. They do not establish natural coaching frequencies, persistent-fatigue decisions, unequal-quality performance, pre-match modifier effects or full-stack/season behavior. The native fixed interchange-edge asymmetry remains; both orientations are balanced. No official gameplay, rosters, coaches or competition results were changed.')
para('The compact bundle retains the full fixed plan, every paired outcome, analysis, verification proofs and eight frozen prefixes. Full new event ledgers remain in the working study directory. Source code is prepared on a separate local research branch; publishing that branch was blocked pending explicit approval. It is not yet available as a remote reproduction checkout.',small)
para('Adapter SHA256: '+v['sourceSHA256'],small);para('Harness SHA256: '+v['harnessSHA256'],small)
def decorate(canvas,doc):
 canvas.saveState();canvas.setStrokeColor(teal);canvas.setLineWidth(1.2);canvas.line(44,755,568,755);canvas.setFont('CB',8);canvas.setFillColor(teal);canvas.drawString(44,766,'CENTURY / ENGINE LABORATORY');canvas.setFont('C',7);canvas.setFillColor(navy);canvas.drawString(44,29,'TARGETED CONDITIONAL EXPERIMENT | EXPERIMENTAL - NOT ADOPTED');canvas.drawRightString(568,29,str(doc.page));canvas.restoreState()
a.output.parent.mkdir(parents=True,exist_ok=True);SimpleDocTemplate(str(a.output),pagesize=(612,792),leftMargin=44,rightMargin=44,topMargin=55,bottomMargin=48,title='Century halftime adaptation: drop-and-counter package test',author='Century Stuff').build(story,onFirstPage=decorate,onLaterPages=decorate);print(a.output)
