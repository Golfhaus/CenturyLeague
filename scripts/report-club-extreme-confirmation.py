"""Compact review report and verified data bundle for the fixed confirmation."""
import csv,hashlib,json,sys,zipfile
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.platypus import Paragraph,Table,TableStyle
from reportlab.lib.styles import ParagraphStyle

p=Path(sys.argv[1]).resolve();repo=Path(__file__).resolve().parents[1];out=repo.parent/'output';(out/'pdf').mkdir(parents=True,exist_ok=True)
read=lambda name:json.loads((p/name).read_text());sha=lambda b:hashlib.sha256(b).hexdigest()
m=read('manifest.json');a=read('analysis.json');i=read('inference.json');v=read('ledger-verification.json');r=read('independent-recomputation.json');ex=read('event-exposures-independent.json')
assert v['status']==r['status']==ex['status']=='passed' and v['fullOutcomesVerified']==13824
primary=i['primaryContrasts'];full=[x for x in primary if x['reference']=='000'];halftime=[x for x in primary if x['reference']=='110']
verdicts={'inside-outer15':'Inside +/-15 reference','confirmed-beyond-outer15':'Exceeds +/-15 reference','unresolved-at-outer15':'Unresolved at +/-15'}
summary={'status':'verified','studyId':m['studyId'],'pairedCases':4608,'outcomes':13824,'sourceSHA256':m['sourceSHA256'],'harnessSHA256':m['harnessSHA256'],'primaryContrasts':primary,'priorSamplesPooled':False,'liveEngineChanged':False,'seasonRehearsalPassed':False,'releaseApproved':False,'recommendation':'Review confirmed excess before release.' if any(x['outerReferenceReview']=='confirmed-beyond-outer15' for x in full) else 'Resolve reference-crossing cells before treating the proposed outer reference as established.' if any(x['outerReferenceReview']=='unresolved-at-outer15' for x in full) else 'Proceed to the isolated season rehearsal, then competition-scoped release review; release remains a separate decision.','limits':['The +/-10 and +/-15 percentage-point references are proposed review references, not newly adopted release margins.','Selected conditional club/scene confirmation only; no evolving season, injury or ban trajectory.','Uniform random opponents, history prefixes and orientation; actual draw counts may differ.','Earlier 18432-outcome compact files and full ledgers were unavailable after environment loss; only their previously verified summary was recovered. This confirmation is independently retained.']}
(p/'verified-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
pdfmetrics.registerFont(TTFont('OpenSans','/usr/share/fonts/truetype/open-sans/OpenSans-Regular.ttf'));pdfmetrics.registerFont(TTFont('OpenSans-Bold','/usr/share/fonts/truetype/open-sans/OpenSans-Bold.ttf'))
pdf=out/'pdf/Century_Club_Extreme_Confirmation_2026_11_18.pdf';c=canvas.Canvas(str(pdf),pagesize=(612,792));c.setTitle('Century v2 - Fresh club stress confirmation');blue=colors.HexColor('#173b52');teal=colors.HexColor('#12756f');gray=colors.HexColor('#52616b')
style=ParagraphStyle('body',fontName='OpenSans',fontSize=9,leading=13,textColor=blue)
small=ParagraphStyle('small',parent=style,fontSize=8,leading=11)
def para(text,x,y,w,sty=style):
    q=Paragraph(text,sty);_,h=q.wrap(w,700);q.drawOn(c,x,y-h);return y-h-9
def title(page,label):
    c.setFillColor(blue);c.rect(0,722,612,70,fill=1,stroke=0);c.setFillColor(colors.white);c.setFont('OpenSans-Bold',18);c.drawString(42,755,'Century v2 | Club stress confirmation');c.setFont('OpenSans',9);c.drawString(42,736,label);c.setFillColor(gray);c.setFont('OpenSans',8);c.drawString(42,24,'18 November 2026 | Laboratory candidate only | Current tournament engine unchanged');c.drawRightString(570,24,str(page))
def table(data,widths,y):
    t=Table([[Paragraph(str(v),small)for v in row]for row in data],colWidths=widths);t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e6eef2')),('VALIGN',(0,0),(-1,-1),'TOP'),('BOTTOMPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),7),('LINEBELOW',(0,0),(-1,0),.7,blue),('LINEBELOW',(0,1),(-1,-1),.25,colors.HexColor('#cbd6dc'))]));_,h=t.wrap(528,700);t.drawOn(c,42,y-h);return y-h-12
fmt=lambda x:f'{x:+.2f}'
label=lambda x:('Hampden / hot' if x['targetCellId']=='hampden-hot' else 'Dover / hot' if x['targetCellId']=='dover-hot' else 'Dover / cold')
title(1,'Fresh, fixed sample: 1,536 paired cases per flagged cell; 13,824 engine outcomes')
y=para(summary['recommendation'],42,702,528)
y=table([['Full stack vs control','Win change (pp)','Family-wise 95% interval','Reference review']]+[[label(x),fmt(x['winChangePP']),f"{fmt(x['familyWise95IntervalPP'][0])} to {fmt(x['familyWise95IntervalPP'][1])}",verdicts[x['outerReferenceReview']]]for x in full],[136,86,148,158],y)
y=para('The intervals account jointly for all six predeclared contrasts. All three full-stack intervals lie within +/-15 points but cross the tighter +/-10 reference. These remain review aids; neither is newly adopted here as a release gate.',42,y,528)
charttop=y-18;left,right=215,557;span=30
for x in primary:span=max(span,abs(x['familyWise95IntervalPP'][0])+3,abs(x['familyWise95IntervalPP'][1])+3)
scale=lambda v:left+(v+span)/(2*span)*(right-left)
bottom=charttop-6*29
c.setFillColor(colors.HexColor('#edf5f3'));c.rect(scale(-15),bottom,scale(15)-scale(-15),charttop-bottom+12,fill=1,stroke=0)
c.setStrokeColor(colors.HexColor('#aebdc4'))
for tick in [-15,0,15]:
    c.line(scale(tick),bottom,scale(tick),charttop+12);c.setFont('OpenSans',8);c.setFillColor(gray);c.drawCentredString(scale(tick),bottom-14,str(tick))
for n,x in enumerate(primary):
    yy=charttop-n*29;c.setFillColor(blue);c.setFont('OpenSans',8);c.drawString(42,yy-2,label(x)+(' | full vs control'if x['reference']=='000'else' | coaching increment'));lo,hi=x['familyWise95IntervalPP'];c.setStrokeColor(teal);c.setLineWidth(2);c.line(scale(lo),yy,scale(hi),yy);c.line(scale(lo),yy-3,scale(lo),yy+3);c.line(scale(hi),yy-3,scale(hi),yy+3);c.setFillColor(teal);c.circle(scale(x['winChangePP']),yy,3,fill=1,stroke=0)
y=para('Win-rate difference in percentage points; green region is the proposed outer reference.',42,bottom-31,528,small)
y=para('Coaching increment compares automatic halftime coaching with both coaches holding, while the same whole-game modifiers remain enabled. It is not an absolute team-strength measure, and a positive win benefit for both opposing coaches is not required.',42,y,528)
c.showPage();title(2,'Comparison, verification and remaining decisions');y=698
y=table([['Flagged cell','Earlier sample / effect','Fresh sample / effect']]+[[label(x),f"n={t['priorN']}; {100*(t['priorWins']-t['priorControlWins'])/t['priorN']:+.2f} pp",f"n=1,536; {x['winChangePP']:+.2f} pp"]for x,t in zip(full,m['targets'])],[150,189,189],y)
y=para('These earlier flags came from small selected subsets. The fresh sample is not pooled with them. Differences can reflect sampling variation and the realized opponent/history/orientation mix; this study does not establish a causal explanation for a change between samples.',42,y,528)
y=table([['Coaching increment','Win change (pp)','Family-wise 95% interval']]+[[label(x),fmt(x['winChangePP']),f"{fmt(x['familyWise95IntervalPP'][0])} to {fmt(x['familyWise95IntervalPP'][1])}"]for x in halftime],[180,125,223],y)
y=para('<b>Verified evidence.</b> All 13,824 retained outcome files received full ledger readback audits before their blocks were saved. All 72 planned exact replays matched. Source, inputs, fixed seeds, paired first halves, own-observation boundaries, no-op behavior and final checkpoint-to-CSV reconciliation passed. An independent Python calculation verified all draw domains and six simultaneous intervals. Event-derived foul/contact denominators were checked separately.',42,y,528)
y=para('<b>Scope.</b> Authentic copied club ratings and tactics, six frozen history prefixes, healthy availability resets, and the existing per-match energy reset were retained. Stress streaks deliberately override historical streaks. Thermal fit is an imposed stress condition, not a claim about actual club physiology. This is not an evolving future-season, injury or suspension test.',42,y,528)
y=para('<b>Next decision.</b> '+summary['recommendation']+' Keep the candidate on the authorized laboratory branch. Any coefficient change requires a separately frozen plan and new evaluation; this run does not authorize a merge or deployment.',42,y,528)
y=para('<b>Data availability.</b> This new study includes all nine verified compact checkpoints and its exact reproduction inputs. The prior 18,432-outcome study could be recovered only as its previously verified summary; its missing raw data is not represented as recovered.',42,y,528)
y=para('Runtime: qualified Node 24.22.3 / no-Maglev, versus 24.22.1 previously. Six retained historical full-result hashes reproduced exactly; that is an engineering compatibility check, not proof of equivalence for every possible match.',42,y,528,small)
y=para('Method: six paired differences; 24 one-sided Clopper-Pearson tails at 0.05/24, signed subtraction, independently checked by log-binomial-CDF bisection. Secondary splits are descriptive. Source: '+m['sourceSHA256'][:16]+'; fixed harness: '+m['harnessSHA256'][:16]+'.',42,y,528,small)
assert y>38,('Page overflow',y);c.save()
files={name:p/name for name in ['manifest.json','summary.json','outcomes.csv','analysis.json','inference.json','ledger-verification.json','independent-recomputation.json','verified-summary.json','event-exposures.csv','event-exposures-verification.json','event-exposures-independent.json','source-verification.json','mixture-counts.json']}
for i in range(1,10):
    for suffix in ['json.gz','json','audit.json','published.json']:files[f'checkpoints/block-{i:03}.{suffix}']=p/'checkpoints'/f'block-{i:03}.{suffix}'
evidence=repo/'docs/verification/club-extreme-confirmation-2026-11-18'
for f in evidence.rglob('*'):
    if f.is_file() and 'checkpoints'not in f.parts:files['verification/'+str(f.relative_to(evidence))]=f
files['report/'+pdf.name]=pdf
files['previous-study/verified-summary-recovery.json']=repo/'docs/verification/club-holistic-2026-11-18/verified-summary-recovery.json'
for name in ['CLUB_EXTREME_CONFIRMATION_RESULTS_2026_11_18.md','ENGINE_V2_ISOLATED_SEASON_REHEARSAL_NEXT.md']:files['review/'+name]=repo/'docs'/name
readme=p/'COMPACT_README.txt';readme.write_text('Fresh club stress confirmation only. Earlier outcomes are not pooled. Full bulky event ledgers are excluded; compact immutable rows and per-block full-ledger audit receipts are included. Exact inputs and expanded plan were frozen before outcomes. The old study is represented only by its recovered verified summary. No season rehearsal, official result update or engine release is represented as completed.\n');files['README.txt']=readme
hashes={name:sha(f.read_bytes())for name,f in files.items()};zpath=out/'Century_Club_Extreme_Confirmation_Data_2026_11_18.zip'
with zipfile.ZipFile(zpath,'w',zipfile.ZIP_DEFLATED,compresslevel=6)as z:
    for name,f in files.items():z.write(f,name)
    z.writestr('SHA256SUMS.json',json.dumps(hashes,indent=2)+'\n')
with zipfile.ZipFile(zpath)as z:
    assert z.testzip()is None
    for name,digest in hashes.items():assert sha(z.read(name))==digest
proof={'status':'passed','members':len(files)+1,'pdf':{'path':str(pdf),'bytes':pdf.stat().st_size,'sha256':sha(pdf.read_bytes())},'data':{'path':str(zpath),'bytes':zpath.stat().st_size,'sha256':sha(zpath.read_bytes())},'crcAndEveryMemberSHA256Verified':True}
(p/'report-bundle-verification.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps(proof))
