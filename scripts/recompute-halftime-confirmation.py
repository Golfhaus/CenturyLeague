"""Independent counts for the separate engineering confirmation."""
import csv,hashlib,json,sys
from pathlib import Path
p=Path(sys.argv[1]);proof=json.loads((p/'confirmation.json').read_text());m=json.loads((p/'manifest.json').read_text());rows=list(csv.DictReader((p/'outcomes.csv').open()));assert len(rows)==proof['fullOutcomesAudited']==192;groups={}
for r in rows:
 g=groups.setdefault(r['fixture'],{});assert r['arm']not in g;g[r['arm']]=r
assert len(groups)==proof['pairedCases']==64
for g in groups.values():
 assert set(g)=={'hold','original','corrected'};assert len(set(r['firstHalfSHA256']for r in g.values()))==1
 for r in g.values():
  if r['arm']!='hold'and r['choice']=='hold':assert r['gameplaySHA256']==g['hold']['gameplaySHA256']
for cell in proof['cells']:
 rr=[r for r in rows if r['arm']==cell['arm']];assert len(rr)==cell['n'];assert sum(int(r['focalWin'])for r in rr)==cell['wins'];assert sum(r['choice']!='hold'for r in rr)==cell['changes'];assert {k:sum(r['choice']==k for r in rr)for k in set(r['choice']for r in rr)}==cell['choices']
assert hashlib.sha256((p/'outcomes.csv').read_bytes()).hexdigest()==proof['outcomesCSVSHA256'];result={'status':'passed','pairedCases':64,'outcomes':192,'armCounts':3,'pairedFirstHalfGroups':64,'outcomesCSVSHA256':proof['outcomesCSVSHA256']};(p/'independent-recomputation.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
