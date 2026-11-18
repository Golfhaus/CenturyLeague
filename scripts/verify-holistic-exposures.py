"""Independent checks of supplemental event-derived denominators and grouping."""
import csv,hashlib,json,math,sys
from pathlib import Path
p=Path(sys.argv[1]);rows=list(csv.DictReader((p/'event-exposures.csv').open()));proof=json.loads((p/'event-exposures-verification.json').read_text());original={(r['fixture'],r['arm']):r for r in csv.DictReader((p/'outcomes.csv').open())};groups={}
assert len(rows)==len(original)==proof['outcomesVerified']
for r in rows:
 key=(r['fixture'],r['arm']);assert key in original;old=original[key];enabled=int(r['psychologyTelemetryPresent']);assert enabled==int(r['arm'][0]);g=groups.setdefault((r['scene'],float(r['gap']),r['arm']),{'n':0,**{k:0 for k in r if k.startswith(('focal','opponent'))and k!='focalSide'}});g['n']+=1
 for side in ['focal','opponent']:
  contacts=int(r[side+'Contacts']);incidents=int(r[side+'FoulIncidents']);serious=int(r[side+'SeriousFouls']);expected=float(r[side+'ExpectedSeriousSum']);assert 0<=serious<=incidents<=contacts;assert .09*incidents-1e-8<=expected<=.0972*incidents+1e-8
  if not enabled:assert math.isclose(expected,.09*incidents,abs_tol=1e-9)
  for field,main in [('Contacts','Contacts'),('FoulIncidents','SeverityIncidents'),('SeriousFouls','SeriousFouls')]:assert int(old[side+main])==(int(r[side+field])if enabled else 0)
 for k in g:
  if k!='n':g[k]+=float(r[k])
for c in proof['groups']:
 g=groups[(c['scene'],c['gap'],c['arm'])]
 for k,v in g.items():assert math.isclose(v,c[k],abs_tol=1e-8,rel_tol=1e-11),(k,v,c[k])
assert hashlib.sha256((p/'event-exposures.csv').read_bytes()).hexdigest()==proof['csvSHA256'];result={'status':'passed','outcomes':len(rows),'groups':len(groups),'csvSHA256':proof['csvSHA256'],'telemetryOffZerosTreatedAsUnavailable':True};(p/'event-exposures-independent.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
