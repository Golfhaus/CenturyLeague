"""Mark a delivery complete only after every ordered file receipt is verified."""
import argparse,datetime,json,os,uuid
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('request',type=Path);p.add_argument('receipts',type=Path);p.add_argument('status',type=Path);a=p.parse_args()
requests=json.loads(a.request.read_text())['uploads'];receipts=json.loads(a.receipts.read_text())['results']
checks=[]
for i,r in enumerate(receipts):
 checks.append(i<len(requests)and r.get('local_path')==requests[i]['local_path']and r.get('status')=='succeeded'
  and r.get('local_metadata_applied')is True and bool(r.get('library_file_id'))and bool(r.get('file_id')))
complete=bool(requests)and len(receipts)==len(requests)and all(checks)
prior=json.loads(a.status.read_text())if a.status.exists()else{}
result={**prior,'stage':'delivery','state':'completed'if complete else'unconfirmed','updatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'receiptFiles':str(a.receipts),'expectedFiles':len(requests),'verifiedFiles':sum(checks),
 'savedFiles':[{'local_path':r['local_path'],'library_file_id':r['library_file_id'],'file_id':r['file_id']}for r,ok in zip(receipts,checks)if ok],
 'message':'Every ordered file receipt and local identity verified.'if complete else'Delivery incomplete or ambiguous. Reconcile actual saved items before another write.'}
a.status.parent.mkdir(parents=True,exist_ok=True);tmp=a.status.with_name(a.status.name+'.'+uuid.uuid4().hex+'.tmp');tmp.write_text(json.dumps(result,indent=2)+'\n');os.replace(tmp,a.status)
print(json.dumps(result));raise SystemExit(0 if complete else 1)
