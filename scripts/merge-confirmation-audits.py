"""Merge nine independently audited blocks without rerunning scientific cases."""
import csv,gzip,hashlib,json,sys
from pathlib import Path

sha=lambda b:hashlib.sha256(b).hexdigest()
def unique(rows):
    out={}
    for r in rows:
        key=(r['fixture'],r['arm'])
        assert key not in out,'Duplicate outcome'
        out[key]=r
    return out
def align(rows,expected):
    out=unique(rows)
    assert set(out)==set(expected),'Missing/unexpected outcomes'
    assert len(expected)==len(set(expected)),'Duplicate expected outcome'
    return [out[k] for k in expected]
def main(p):
    m=json.loads((p/'manifest.json').read_text());s=json.loads((p/'summary.json').read_text())
    assert s['status']=='completed' and s['matchedFixtures']==4608 and s['engineResults']==13824
    assert s['sourceSHA256']==m['sourceSHA256'] and s['harnessSHA256']==m['harnessSHA256']
    manifest_sha=sha((p/'manifest.json').read_bytes());proofs=[];allrows=[];checkpointrows=[];keys=None
    q=json.loads((Path(__file__).resolve().parents[1]/'docs/verification/club-extreme-confirmation-2026-11-18/block-audit-qualification.json').read_text())
    for i in range(1,10):
        name=f'block-{i:03}';d=p/'checkpoints';meta=json.loads((d/(name+'.json')).read_text());ack=json.loads((d/(name+'.published.json')).read_text());proof=json.loads((d/(name+'.audit.json')).read_text());raw=(d/(name+'.json.gz')).read_bytes();cp=json.loads(gzip.decompress(raw));
        assert meta['manifestSHA256']==manifest_sha and sha(raw)==meta['checkpointSHA256']==proof['checkpointSHA256']
        assert proof['status']=='passed' and proof['fullOutcomesVerified']==1536 and proof['fixtureClusters']==512
        assert ack['status']=='verified' and ack['retainedReadbackVerified'] is True
        for k in ['studyId','blockIndex','manifestSHA256','checkpointSHA256','outcomeRowsSHA256']: assert ack[k]==meta[k]
        for k in ['sourceSHA256','harnessSHA256']: assert proof[k]==meta[k]==m[k]
        for k in ['driverSHA256','shardSHA256','pinnedAuditSHA256']: assert proof[k]==q[k]
        assert cp['fixtureIds']==[f['id']for f in m['fixtures'][(i-1)*512:i*512]]
        text=(d/f'audit-{i:03}'/'outcomes.csv').read_text();assert sha(text.encode())==proof['outcomesCSVSHA256']
        reader=csv.DictReader(text.splitlines());assert keys is None or keys==reader.fieldnames;keys=reader.fieldnames;allrows.extend(reader);checkpointrows.extend(cp['rows']);proofs.append(proof)
    expected=[(f['id'],arm)for f in m['fixtures']for arm in m['arms']];rows=align(allrows,expected)
    cpmap=unique(checkpointrows);smap=unique([r for record in s['records']for r in record['arms']]);assert set(cpmap)==set(smap)==set(expected)
    for row in rows:
        key=(row['fixture'],row['arm']);old=cpmap[key];assert old==smap[key]
        for k in ['resultSHA256','armFileSHA256','gameplaySHA256','firstHalfSHA256']: assert row[k]==old[k]
        for k in ['focalWin','margin','focalScore','opponentScore']: assert float(row[k])==old[k]
    text=','.join(keys)+'\n'+'\n'.join(','.join(r[k]for k in keys)for r in rows)+'\n'
    totals={k:sum(proof[k]for proof in proofs)for k in ['fullOutcomesVerified','fixtureClusters','pairedFirstHalfChecks','crossArmOwnObservationChecks','ownObservationReconstructions','replays','noOpGameplayComparisons','weatherEnergyAndTelemetryAudits','psychologyAndFoulTelemetryAudits']}
    assert totals['fullOutcomesVerified']==13824 and totals['fixtureClusters']==4608 and totals['replays']==72
    assert totals['pairedFirstHalfChecks']==4608 and totals['crossArmOwnObservationChecks']==9216
    proof={'status':'passed','sourceSHA256':m['sourceSHA256'],'harnessSHA256':m['harnessSHA256'],**totals,'outcomesCSVSHA256':sha(text.encode()),'durableBlocksVerified':9,'method':'Qualified full retained-byte auditor executed separately in each immutable block before publication; final CSV/summary/checkpoint exact reconciliation.','mergeDriverSHA256':sha(Path(__file__).read_bytes())}
    assert not(p/'outcomes.csv').exists() and not(p/'ledger-verification.json').exists(),'Preserve prior final audit'
    (p/'outcomes.csv').write_text(text);(p/'ledger-verification.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps(proof))
if __name__=='__main__':
    if sys.argv[1]=='contracts':
        a={'fixture':'a','arm':'000'};b={'fixture':'b','arm':'000'};assert align([b,a],[('a','000'),('b','000')])==[a,b]
        for bad,expected in [([a,a],[('a','000')]),([a],[('a','000'),('b','000')]),([a,b],[('a','000')]),([a],[('a','000'),('a','000')])]:
            try:align(bad,expected)
            except AssertionError:pass
            else:raise AssertionError('Fault was accepted')
        print(json.dumps({'status':'passed','duplicateMissingUnexpectedAndDuplicateExpectedRejected':True,'driverSHA256':sha(Path(__file__).read_bytes())}))
    else:main(Path(sys.argv[1]).resolve())
