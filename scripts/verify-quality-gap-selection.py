"""Independent raw compact control tally, Wilson algebra and eligibility/rank verification."""
from pathlib import Path
import csv,gzip,hashlib,json,math,statistics,sys
p=Path(sys.argv[1]);m=json.loads((p/'manifest.json').read_text());g=json.loads((p/'selection.json').read_text());assert m['studyId']=='quality-control-ladder-001';metadata={x['id']:x for x in m['profiles']};profiles={k:[0,0]for k in metadata};totals={}
with gzip.open(p/'paired-outcomes.csv.gz','rt',newline='')as f:
 for r in csv.DictReader(f):
  assert r['arm']=='control';v=metadata[r['profile']];win=int(float(r['focalWin']));profiles[r['profile']][0]+=win;profiles[r['profile']][1]+=1
  for key in [(v['gap'],'all'),(v['gap'],v['tactics'])]:
   cell=totals.setdefault(key,[0,0]);cell[0]+=win;cell[1]+=1
assert len(profiles)==88 and all(n==64 for w,n in profiles.values());assert sum(n for w,n in profiles.values())==5632
z=statistics.NormalDist().inv_cdf(1-.05/22)
def interval(w,n):
 denominator=n+z*z;mid=(w+.5*z*z)/denominator;half=z*math.sqrt(w*(n-w)/n+.25*z*z)/denominator;return[max(0,mid-half),min(1,mid+half)]
low,high=interval(*totals[(0,'all')]);balanced=low>=.4 and high<=.6 and all(0<w<n for key,(w,n)in profiles.items()if metadata[key]['gap']==0);want=[]
for gap in [.05,.1,.2,.35,.5]:
 w,n=totals[(gap,'all')];s,n2=totals[(-gap,'all')];assert n==n2==512;wl,wh=interval(w,n);sl,sh=interval(s,n);eligible=balanced and .2<=wl and wh<=.45 and .55<=sl and sh<=.8
 for t in ['neutral','pressure']:
  ww,nn=totals[(gap,t)];ss,nn2=totals[(-gap,t)];assert nn==nn2==256;eligible=eligible and .2<=ww/nn<=.45 and .55<=ss/nn2<=.8
 eligible=eligible and all(0<wins<count for key,(wins,count)in profiles.items()if metadata[key]['gap']in [gap,-gap]);score=abs(20*w-7*n)+abs(20*s-13*n);want.append({'magnitude':gap,'eligible':bool(eligible),'integerDistanceScore':score,'weakerControl':w/n,'strongerControl':s/n})
assert want==g['candidates']and balanced==g['balancedGuardPassed'];eligible=sorted((x for x in want if x['eligible']),key=lambda x:(x['integerDistanceScore'],x['magnitude']));selected=eligible[0]['magnitude']if eligible else None;assert g['selectedMagnitude']==selected and g['confirmed']==(selected is not None);assert g['selectedProfileIDs']==[x['id']for x in m['profiles']if selected is not None and x['gap']in [0,selected,-selected]]
sha=lambda n:hashlib.sha256((p/n).read_bytes()).hexdigest()
for name,want_hash in g['evidenceSHA256'].items():assert sha(name)==want_hash
proof={'status':'passed','studyId':m['studyId'],'sourceSHA256':m['sourceSHA256'],'harnessSHA256':m['harnessSHA256'],'controlsVerifiedFromRawCompact':5632,'selectionSHA256':sha('selection.json'),'eligibleCandidatesAndRankingVerified':True,'confirmed':g['confirmed'],'selectedMagnitude':selected};(p/'selection-verification.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps(proof))
