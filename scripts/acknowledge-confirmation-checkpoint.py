"""Record a verified remote checkpoint receipt atomically; never retry a write."""
import hashlib,json,os,re,sys,uuid
from pathlib import Path
request=Path(sys.argv[1]);p=Path(sys.argv[2]).resolve();a=json.loads(request.read_text());i=a['blockIndex'];assert isinstance(i,int)and 1<=i<=9
name=f'block-{i:03}';meta=json.loads((p/'checkpoints'/(name+'.json')).read_text());audit=json.loads((p/'checkpoints'/(name+'.audit.json')).read_text());assert audit['status']=='passed'and audit['fullOutcomesVerified']==meta['outcomes'];assert hashlib.sha256((p/'checkpoints'/(name+'.json.gz')).read_bytes()).hexdigest()==meta['checkpointSHA256'];assert a['status']=='verified'and a['retainedReadbackVerified']is True
for k in ['studyId','blockIndex','manifestSHA256','checkpointSHA256','outcomeRowsSHA256']:assert a[k]==meta[k]
assert re.fullmatch('[0-9a-f]{40}',a['remoteCommit']);assert re.fullmatch('[0-9a-f]{40}',a['remoteBlob']);assert re.fullmatch('[0-9a-f]{40}',a['remoteTree']);target=p/'checkpoints'/(name+'.published.json');assert not target.exists(),'Preserve earlier acknowledgement';tmp=target.with_name(target.name+'.'+uuid.uuid4().hex+'.tmp')
try:
 with tmp.open('x')as f:json.dump(a,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
 os.link(tmp,target)
finally:
 if tmp.exists():tmp.unlink()
print(json.dumps({'status':'verified','blockIndex':i,'remoteCommit':a['remoteCommit']}))
