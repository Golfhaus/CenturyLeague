"""Check that the other coach's activation never changes a halftime decision."""
import csv,hashlib,json,sys
from pathlib import Path
p=Path(sys.argv[1]);rows=list(csv.DictReader((p/'outcomes.csv').open()));groups={}
for r in rows:groups.setdefault(r['fixture'],{})[r['arm']]=r
assert len(groups)==384 and len(rows)==1536
for g in groups.values():
 assert len({r['firstHalfSHA256']for r in g.values()})==1
 for side,only in [('focal','focal-only'),('opponent','opponent-only')]:
  assert g['both'][side+'Choice']==g[only][side+'Choice'];assert float(g['both'][side+'RootDistance'])==float(g[only][side+'RootDistance'])
 assert g['none']['focalChoice']==g['none']['opponentChoice']=='hold'
 assert g['focal-only']['opponentChoice']==g['opponent-only']['focalChoice']=='hold'
 for r in g.values():
  if r['noOpBoth']=='true':assert r['gameplaySHA256']==g['none']['gameplaySHA256']
result={'status':'passed','pairedClusters':384,'crossCoachDecisionChecks':768,'pairedFirstHalfChecks':1152,'noOpRowsChecked':sum(r['noOpBoth']=='true'for r in rows),'outcomesCSVSHA256':hashlib.sha256((p/'outcomes.csv').read_bytes()).hexdigest()}
(p/'crossarm-verification.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
