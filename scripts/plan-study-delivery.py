"""Create a core-first plan for NEW deliveries; never rewrite an uncertain attempt."""
import argparse,json
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('original',type=Path);p.add_argument('output',type=Path);p.add_argument('--attempt-status',type=Path);p.add_argument('--max-core-mib',type=float,default=20);a=p.parse_args()
if a.attempt_status and a.attempt_status.exists():
 s=json.loads(a.attempt_status.read_text());state=s.get('state',s.get('status'))
 if state in ['unconfirmed','unconfirmed-after-timeout','unknown','awaiting_receipt_check']:raise SystemExit('Original delivery is unconfirmed. Reconcile it; do not reorder or retry this attempt.')
items=json.loads(a.original.read_text())['uploads'];core=[];bulk=[]
for item in items:
 q=Path(item['local_path']);assert q.is_absolute()and q.is_file()
 if q.name.lower().endswith(('.tar','.tar.gz','.tar.zst','.tgz')):bulk.append(item)
 else:core.append(item)
if sum(Path(x['local_path']).stat().st_size for x in core)>a.max_core_mib*1048576:raise SystemExit('Core exceeds size budget; prepare a smaller review bundle before any write.')
if a.output.exists():raise SystemExit('Output already exists; preserve the earlier plan.')
a.output.mkdir(parents=True)
for name,items in [('review-files.json',core),('bulk-archives.json',bulk)]:
 (a.output/name).write_text(json.dumps({'uploads':items},indent=2)+'\n')
(a.output/'README.txt').write_text('For a NEW delivery only: save the small review files first and inspect every receipt. Bulk event archives are a separate optional handoff; do not let them block the review. Use current Library transfer guidance. Never use this plan to retry or shrink an unconfirmed operation.\n')
print(json.dumps({'coreFiles':len(core),'coreBytes':sum(Path(x['local_path']).stat().st_size for x in core),'bulkFiles':len(bulk),'bulkBytes':sum(Path(x['local_path']).stat().st_size for x in bulk)}))
