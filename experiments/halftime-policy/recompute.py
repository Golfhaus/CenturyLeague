"""Independent primary, decision-coverage and subgroup calculations from CSV."""
import csv,hashlib,json,math,statistics,sys
from pathlib import Path
p=Path(sys.argv[1]);a=json.loads((p/'analysis.json').read_text());m=json.loads((p/'manifest.json').read_text());rows=list(csv.DictReader((p/'outcomes.csv').open()));groups={}
for r in rows:
 g=groups.setdefault(r['fixture'],{});assert r['arm'] not in g;g[r['arm']]=r
assert len(rows)==1536 and len(groups)==384 and all(set(g)==set(m['arms'])for g in groups.values())
def near(x,y):assert math.isclose(x,y,abs_tol=1e-10,rel_tol=1e-12),(x,y)
def contrast(gs,v):
 ds=[int(g[v['arm']]['focalWin'])-int(g['none']['focalWin'])for g in gs];assert len(gs)==v['n'];assert ds.count(1)==v['changedToFocal']and ds.count(-1)==v['changedAgainstFocal'];near(100*statistics.mean(ds),v['winChangePP']);assert sum(int(g[v['arm']]['focalWin'])for g in gs)==v['wins'];assert sum(int(g['none']['focalWin'])for g in gs)==v['controlWins'];near(statistics.mean(int(g[v['arm']]['margin'])-int(g['none']['margin'])for g in gs),v['meanMarginChange'])
gs=list(groups.values());contrast(gs,a['primary']);half=100*math.sqrt(2*math.log(2/.05)/384);near(half,a['primary']['intervalHalfWidthPP'])
for x,y in zip(a['primary']['conservative95IntervalPP'],[max(-100,a['primary']['winChangePP']-half),min(100,a['primary']['winChangePP']+half)]):near(x,y)
for c in a['cells']:
 rr=[g[c['arm']]for g in gs];assert sum(int(r['focalWin'])for r in rr)==c['wins'];near(100*statistics.mean(int(r['focalWin'])for r in rr),c['winRatePct']);near(statistics.mean(int(r['margin'])for r in rr),c['meanMargin']);assert sum(r['focalChoice']!='hold'for r in rr)==c['focalChanges'];assert sum(r['opponentChoice']!='hold'for r in rr)==c['opponentChanges']
 for field,counts in [('focalChoice',c['focalChoices']),('opponentChoice',c['opponentChoices'])]:assert {k:sum(r[field]==k for r in rr)for k in counts}==counts
for c in a['coverage']:
 sub=[g for g in gs if g['none']['tactics']==c['tactics']and g['none']['quality']==c['quality']];contrast(sub,c);assert sum(g['focal-only']['focalChoice']!='hold'for g in sub)==c['focalChanges']
for c in a['byDeficit']:
 def band(r):
  d=int(r['halfDeficit']);return'leading-or-tied'if d<=0 else'trailing-1-4'if d<=4 else'trailing-5-20'if d<=20 else'trailing-21-plus'
 rr=[g['focal-only']for g in gs if band(g['focal-only'])==c['band']];assert len(rr)==c['n'];assert sum(r['focalChoice']!='hold'for r in rr)==c['changes']
for c in a['secondary']:contrast(gs,c)
for c in a['sideSplits']:contrast([g for g in gs if int(g['none']['focalSide'])==c['side']],c)
near(100*statistics.mean(int(g['both']['focalWin'])-int(g['focal-only']['focalWin'])-int(g['opponent-only']['focalWin'])+int(g['none']['focalWin'])for g in gs),a['interactionRiskDifferencePP'])
assert hashlib.sha256((p/'outcomes.csv').read_bytes()).hexdigest()==a['outcomesCSVSHA256']
result={'status':'passed','pairedClusters':384,'outcomes':1536,'primaryComparisons':1,'secondaryContrasts':2,'coverageCells':6,'deficitBands':4,'sideSplits':2,'armCells':4,'outcomesCSVSHA256':a['outcomesCSVSHA256'],'method':'Independent Python CSV regrouping, discordant counts, means, Hoeffding bound, choices, coverage, deficits and interaction.'};(p/'independent-recomputation.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
