"""Verify previously completed compact evidence; this is not a new full-event replay."""
from pathlib import Path
import hashlib,json
def completed_compact(directory,cohort,pins):
 p=Path(directory);names=['manifest.json','analysis.json','ledger-verification.json','independent-recomputation.json','paired-outcomes.csv.gz']
 if not any((p/n).exists()for n in ['analysis.json','ledger-verification.json','independent-recomputation.json']):return False
 assert all((p/n).is_file()for n in names),'Completed evidence is incomplete; stop and reconcile it'
 m,a,v,i=[json.loads((p/n).read_text())for n in names[:4]];outcomes=12288 if cohort=='matched'else 8192
 assert m['studyId']=='adverse-'+cohort+'-confirmation-001'and m['stage']==cohort and m['trialsPerProfile']==512 and len(m['profiles'])==8 and len(m['fixtures'])==4096
 assert a['status']=='completed'and v['status']==i['status']=='passed'and a['fixtureClusters']==i['fixtureClusters']==4096 and a['outcomes']==v['fullOutcomesVerified']==i['outcomes']==outcomes
 for x in [m,a,v,i]:assert x['sourceSHA256']==pins['sourceSHA256']and x['harnessSHA256']==pins['harnessSHA256'],'Completed evidence source identity differs; stop'
 sha=lambda n:hashlib.sha256((p/n).read_bytes()).hexdigest()
 assert sha('analysis.json')==i['analysisSHA256'],'Completed analysis differs; stop'
 for x in [v,i]:assert sha('manifest.json')==x['manifestSHA256']and sha('paired-outcomes.csv.gz')==x['compactOutcomesSHA256'],'Completed compact evidence differs; stop'
 return True
