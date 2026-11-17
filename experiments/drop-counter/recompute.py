"""Independent paired factorial recomputation from the compact outcome CSV."""
import csv,hashlib,json,math,statistics,sys
from pathlib import Path
p=Path(sys.argv[1]);a=json.loads((p/'analysis.json').read_text());m=json.loads((p/'manifest.json').read_text());rows=list(csv.DictReader((p/'outcomes.csv').open()));groups={}
for r in rows:
 g=groups.setdefault(r['fixture'],{});assert r['arm'] not in g;g[r['arm']]=r
assert len(rows)==1024 and len(groups)==256 and all(set(g)==set(m['arms'])for g in groups.values())
def near(x,y):assert math.isclose(x,y,abs_tol=1e-10,rel_tol=1e-12),(x,y)
def contrast(gs,v):
 ds=[int(g[v['arm']]['focalWin'])-int(g['hold']['focalWin'])for g in gs];assert len(gs)==v['n']
 assert ds.count(1)==v['changedToFocal'] and ds.count(-1)==v['changedAgainstFocal'];near(100*statistics.mean(ds),v['winChangePP'])
 assert sum(int(g[v['arm']]['focalWin'])for g in gs)==v['wins'];assert sum(int(g['hold']['focalWin'])for g in gs)==v['controlWins']
 near(statistics.mean(int(g[v['arm']]['margin'])-int(g['hold']['margin'])for g in gs),v['meanMarginChange'])
gs=list(groups.values());contrast(gs,a['primary']);half=100*math.sqrt(2*math.log(2/.05)/256);near(half,a['primary']['intervalHalfWidthPP'])
for x,y in zip(a['primary']['conservative95IntervalPP'],[max(-100,a['primary']['winChangePP']-half),min(100,a['primary']['winChangePP']+half)]):near(x,y)
for v in a['secondary']:contrast(gs,v)
for v in a['byTemplate']:contrast([g for g in gs if int(g['hold']['template'])==v['template']],v)
for v in a['bySide']:contrast([g for g in gs if int(g['hold']['trailingSide'])==v['side']],v)
near(100*statistics.mean(int(g['drop-counter']['focalWin'])-int(g['pressure-only']['focalWin'])-int(g['transition-only']['focalWin'])+int(g['hold']['focalWin'])for g in gs),a['interactionRiskDifferencePP'])
for cell in a['cells']:
 rr=[g[cell['arm']]for g in gs];assert sum(int(r['focalWin'])for r in rr)==cell['wins'];near(100*statistics.mean(int(r['focalWin'])for r in rr),cell['winRatePct']);near(statistics.mean(int(r['margin'])for r in rr),cell['meanMargin']);near(statistics.mean(float(r['playingSecondsAfter'])for r in rr)/60,cell['meanPlayingMinutes'])
 seconds=sum(float(r['playingSecondsAfter'])for r in rr)
 for k,x in cell['ratesPer60'].items():near(3600*sum(int(r[k])for r in rr)/seconds,x)
assert hashlib.sha256((p/'outcomes.csv').read_bytes()).hexdigest()==a['outcomesCSVSHA256']
result={'status':'passed','outcomes':1024,'pairedClusters':256,'primaryComparisons':1,'secondaryContrasts':2,'subgroupContrasts':6,'interactionContrasts':1,'armCells':4,'outcomesCSVSHA256':a['outcomesCSVSHA256'],'method':'Independent Python CSV regrouping, paired discordance, conservative primary interval, margins, durations, rates and interaction.'}
(p/'independent-recomputation.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
