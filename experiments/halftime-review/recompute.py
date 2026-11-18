"""Independent CSV analysis checks; no simulator imports."""
import csv,hashlib,json,math,statistics,sys
from pathlib import Path
p=Path(sys.argv[1]);a=json.loads((p/'analysis.json').read_text());m=json.loads((p/'manifest.json').read_text());rows=list(csv.DictReader((p/'outcomes.csv').open()));groups={}
for r in rows:
 g=groups.setdefault(r['fixture'],{});assert r['arm']not in g;g[r['arm']]=r
assert len(rows)==768 and len(groups)==384 and all(set(g)=={'hold','policy'}for g in groups.values())
def near(x,y):assert math.isclose(x,y,abs_tol=1e-10,rel_tol=1e-12),(x,y)
def verify(gs,v):
 rr=[g['policy']for g in gs];ds=[int(g['policy']['focalWin'])-int(g['hold']['focalWin'])for g in gs];assert len(gs)==v['n'];assert sum(int(g['hold']['focalWin'])for g in gs)==v['holdWins'];assert sum(int(r['focalWin'])for r in rr)==v['policyWins'];assert ds.count(1)==v['changedToFocal']and ds.count(-1)==v['changedAgainstFocal'];near(100*statistics.mean(ds),v['winChangePP']);near(statistics.mean(float(g['policy']['margin'])-float(g['hold']['margin'])for g in gs),v['meanMarginChange']);assert sum(r['choice']!='hold'for r in rr)==v['changes'];assert {k:sum(r['choice']==k for r in rr)for k in set(r['choice']for r in rr)}==v['choices']
 for col,key in [('medianPreEnergy','meanPreEnergy'),('medianEnergy','meanPostEnergy')]:near(statistics.mean(float(r[col])for r in rr),v[key])
 assert sum(float(r['medianPreEnergy'])<.5 for r in rr)==v['preEnergyBelowHalf'];assert sum(float(r['medianEnergy'])<.5 for r in rr)==v['postEnergyBelowHalf']
gs=list(groups.values());verify(gs,a['primary']);half=100*math.sqrt(2*math.log(2/.05)/384)
for x,y in zip(a['primary']['conservative95IntervalPP'],[max(-100,a['primary']['winChangePP']-half),min(100,a['primary']['winChangePP']+half)]):near(x,y)
for c in a['contexts']:verify([g for g in gs if g['policy']['context']==c['context']],c)
for c in a['byRecipe']:verify([g for g in gs if g['policy']['choice']==c['recipe']],c)
for c in a['sideSplits']:verify([g for g in gs if int(g['policy']['focalSide'])==c['side']],c)
conflicts=[r for r in rows if r['arm']=='policy'and ((r['choice'].startswith('aerial-')and float(r['personnelFit'])<0)or(r['choice'].startswith('lower-aerial-')and float(r['personnelFit'])>0))];assert len(conflicts)==len(a['fitEvidenceConflicts']);assert hashlib.sha256((p/'outcomes.csv').read_bytes()).hexdigest()==a['outcomesCSVSHA256']
proof={'status':'passed','pairedCases':384,'outcomes':768,'contexts':len(a['contexts']),'recipeSplits':len(a['byRecipe']),'sideSplits':2,'primaryIntervals':1,'fitConflicts':len(conflicts),'outcomesCSVSHA256':a['outcomesCSVSHA256']};(p/'independent-recomputation.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps(proof))
