import {useEffect,useRef,useState} from 'react';
import {supabase} from './lib/supabase';
import {request,download} from './lib/match-api';
import type {Review} from './lib/match-api';
import type {ReplayReport,CompetitiveMatchInput} from '@century-league/simulation-core';
import MatchReview from './MatchReview';

type Team={id:string;name:string};
type Planned={id:string;seasonId:string;roundId:string;matchDate:string;teamIds:[string,string];names:string[]};
type Fixture={id:string;seasonId:string;roundId:string;matchDate:string;teams:Team[];proposalId:string|null;acceptedId:string|null;
  scores:number[]|null;status:string;eligibilityChanged:boolean;blocked:boolean;eligibleCounts:number[];
  availability:{playerId:string;name:string;eligible:boolean;injuryIds:string[];suspensionIds:string[]}[]};
type Detail={id:string;name:string;status:string;revision:number;fixtures:Fixture[];
  records:{teamId:string;name:string;played:number;wins:number;losses:number;pointsFor:number;pointsAgainst:number}[];
  injuries:{id:string;name:string;recoveredOn:string}[];suspensions:{id:string;name:string;remaining:number}[];
  incidents:{id:string;name:string;reason:string;eventIds:number[]}[];reviews:{id:string;resultId:string}[];
  audit:{id:string;at:string;operation:{type:string;reason?:string}}[]};
export default function RehearsalCenter(){
  const [list,setList]=useState<{id:string;name:string}[]>([]),[selected,setSelected]=useState(''),[detail,setDetail]=useState<Detail|null>(null);
  const [review,setReview]=useState<Review|null>(null),[message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [seasons,setSeasons]=useState<{id:string;label:string;starts_on:string|null}[]>([]),[season,setSeason]=useState(''),[teams,setTeams]=useState<Team[]>([]);
  const [first,setFirst]=useState(''),[second,setSecond]=useState(''),[date,setDate]=useState(''),[round,setRound]=useState('Round 1');
  const [name,setName]=useState('Competitive readiness rehearsal'),[plan,setPlan]=useState<Planned[]>([]),[draft,setDraft]=useState(()=>crypto.randomUUID());
  const [reason,setReason]=useState(''),[kind,setKind]=useState<'technical'|'administrative'>('administrative'),[bans,setBans]=useState<Record<string,number>>({});
  const [replacementOptions,setReplacementOptions]=useState<Team[]>([]),[replacementFirst,setReplacementFirst]=useState(''),[replacementSecond,setReplacementSecond]=useState('');
  const requests=useRef(new Map<string,string>());
  const reviewed=detail?.fixtures.find(f=>f.id===review?.fixtureId);
  function key(value:unknown){const k=JSON.stringify(value);if(!requests.current.has(k))requests.current.set(k,crypto.randomUUID());return requests.current.get(k)!;}
  async function loadList(){setList(await request({action:'rehearsal-list'}));}
  async function reload(){if(selected)setDetail(await request({action:'rehearsal-detail',rehearsalId:selected}));}
  useEffect(()=>{let ignore=false;
    Promise.all([request<{id:string;name:string}[]>({action:'rehearsal-list'}),supabase!.from('seasons').select('id,label,starts_on').neq('status','complete').order('starts_on',{ascending:false})])
      .then(([items,s])=>{if(ignore)return;if(s.error)throw s.error;setList(items);setSeasons(s.data??[]);setSeason(s.data?.[0]?.id??'');setDate(s.data?.[0]?.starts_on??'');}).catch(e=>{if(!ignore)setError(e.message);});
    return()=>{ignore=true;};
  },[]);
  useEffect(()=>{let ignore=false;setDetail(null);setReview(null);if(!selected)return;
    request<Detail>({action:'rehearsal-detail',rehearsalId:selected}).then(d=>{if(!ignore)setDetail(d);}).catch(e=>{if(!ignore)setError(e.message);});return()=>{ignore=true;};
  },[selected]);
  useEffect(()=>{let ignore=false;setTeams([]);setFirst('');setSecond('');if(!season)return;
    supabase!.from('team_season_rosters').select('team_id,match_team').eq('season_id',season).then(({data,error:e})=>{
      if(ignore)return;if(e){setError(e.message);return;}setTeams((data??[]).map(r=>({id:r.team_id,name:(r.match_team as unknown as {name:string}).name})).sort((a,b)=>a.name.localeCompare(b.name)));
    });return()=>{ignore=true;};
  },[season]);
  useEffect(()=>{let ignore=false;setReplacementOptions([]);if(!reviewed)return;
    setReplacementFirst(reviewed.teams[0].id);setReplacementSecond(reviewed.teams[1].id);
    supabase!.from('team_season_rosters').select('team_id,match_team').eq('season_id',reviewed.seasonId).then(({data,error:e})=>{
      if(ignore)return;if(e){setError(e.message);return;}setReplacementOptions((data??[]).map(r=>({id:r.team_id,name:(r.match_team as unknown as {name:string}).name})).sort((a,b)=>a.name.localeCompare(b.name)));
    });return()=>{ignore=true;};
  },[reviewed?.id,reviewed?.seasonId]);
  async function run(work:()=>Promise<void>){setBusy(true);setError('');setMessage('');try{await work();}catch(e){setError(e instanceof Error?e.message:'Rehearsal operation failed');}finally{setBusy(false);}}
  async function operate(operation:Record<string,unknown>){await request({action:'rehearsal-command',rehearsalId:selected,commandId:key(operation),expectedRevision:detail!.revision,operation});await reload();setMessage('Commissioner decision recorded.');}
  async function reviewMatch(f:Fixture){setReview(await request({action:'rehearsal-proposal',rehearsalId:selected,proposalId:f.proposalId}));}
  const reasonReady=reason.trim().length>=10;
  return <section className="generate-stack rehearsal-center" aria-label="Competitive rehearsal" aria-busy={busy}>
    <p>Test persistent injury recovery, bans and corrections. These matches do not count toward official league records. The inaugural tournament remains unscheduled.</p>
    <p className="match-note">Recovery candidate: 80% take 1–3 calendar days, 18% take 4–10 days, and 2% take 11–28 days. Serious or repeated conduct goes to commissioner review; there are no automatic bans.</p>
    <div role="status" aria-live="polite">{busy?'Working on rehearsal…':message}</div>{error?<p role="alert" className="notice warning">{error}</p>:null}
    <div className="match-controls"><label>Saved rehearsal<select aria-label="Saved rehearsal" value={selected} disabled={busy} onChange={e=>setSelected(e.target.value)}><option value="">Choose rehearsal</option>{list.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label><button className="primary-button" disabled={busy} onClick={()=>run(async()=>{await Promise.all([reload(),loadList()]);})}>Refresh rehearsal</button></div>
    {detail?<>
      <h3>{detail.name} <span className="status-tag">rehearsal · {detail.status}</span></h3>
      <div className="match-table-wrap"><table><caption>Rehearsal fixtures</caption><thead><tr><th>Date / round</th><th>Match</th><th>Eligible</th><th>Score / status</th><th>Action</th></tr></thead><tbody>{detail.fixtures.map(f=><tr key={f.id}>
        <td>{f.matchDate}<br/>{f.roundId}</td><th>{f.teams.map(t=>t.name).join(' v ')}</th><td>{f.eligibleCounts.join(' / ')}</td><td>{f.scores?.join('–')??'—'} · {f.status}{f.eligibilityChanged?' · eligibility changed':''}{f.blocked?' · review required':''}</td>
        <td>{f.proposalId?<button className="primary-button" disabled={busy} onClick={()=>run(()=>reviewMatch(f))}>Review rehearsal match</button>:f.eligibilityChanged?<button className="primary-button" disabled={busy||!reasonReady||detail.status==='closed'} onClick={()=>run(async()=>{await request({action:'rehearsal-replace',rehearsalId:selected,fixtureId:f.id,newFixtureId:key({repin:f.id,reason}),expectedRevision:detail.revision,reason});await reload();setMessage('Changed fixture repinned through an audited replacement.');})}>Repin changed fixture</button>:<button className="primary-button" disabled={busy||detail.status==='closed'||f.status==='superseded'||f.blocked||f.eligibleCounts.some(n=>n<15)} onClick={()=>run(async()=>{const p=await request<{id:string}>({action:'rehearsal-simulate',rehearsalId:selected,fixtureId:f.id});await reload();setReview(await request({action:'rehearsal-proposal',rehearsalId:selected,proposalId:p.id}));setMessage('Rehearsal proposal saved; no records or absences count until acceptance.');})}>Simulate rehearsal match</button>}</td>
      </tr>)}</tbody></table></div>
      <div className="match-table-wrap"><table><caption>Active accepted rehearsal records</caption><thead><tr><th>Team</th><th>Played</th><th>Wins</th><th>Losses</th><th>For</th><th>Against</th></tr></thead><tbody>{detail.records.map(r=><tr key={r.teamId}><th>{r.name}</th>{[r.played,r.wins,r.losses,r.pointsFor,r.pointsAgainst].map((n,i)=><td key={i}>{n}</td>)}</tr>)}</tbody></table></div>
      <details><summary>Injuries and outstanding bans</summary>{!detail.injuries.length&&!detail.suspensions.length?<p>No recorded absences.</p>:<ul>{detail.injuries.map(i=><li key={i.id}>{i.name}: recovered on {i.recoveredOn}.</li>)}{detail.suspensions.map(s=><li key={s.id}>{s.name}: {s.remaining} eligible match(es) remaining.</li>)}</ul>}</details>
      <label>Commissioner reason<textarea value={reason} maxLength={1000} disabled={busy} onChange={e=>setReason(e.target.value)} placeholder="Describe the decision in at least 10 characters"/></label>
      {detail.incidents.map(c=><section className="preview-panel" key={c.id}><h4>{c.name} · incident review</h4><p>{c.reason.replaceAll('_',' ')}. Source events: {c.eventIds.join(', ')}.</p><label>Ban length for {c.name}<input type="number" min={1} max={20} value={bans[c.id]??1} disabled={busy} onChange={e=>setBans(v=>({...v,[c.id]:Number(e.target.value)}))}/></label><div className="generator-actions"><button className="primary-button" disabled={busy||!reasonReady||detail.status==='closed'} onClick={()=>run(()=>operate({type:'discipline',caseId:c.id,matches:bans[c.id]??1,reason}))}>Record suspension</button><button className="primary-button" disabled={busy||!reasonReady||detail.status==='closed'} onClick={()=>run(()=>operate({type:'discipline',caseId:c.id,matches:0,reason}))}>Dismiss incident</button></div></section>)}
      {detail.reviews.map(r=><p key={r.id}>Affected match {r.resultId}. <button className="primary-button" disabled={busy||!reasonReady||detail.status==='closed'} onClick={()=>run(()=>operate({type:'resolve-review',reviewId:r.id,reason}))}>Uphold reviewed match</button></p>)}
      <div className="generator-actions"><button className="primary-button" disabled={busy||!reasonReady} onClick={()=>run(()=>operate({type:detail.status==='closed'?'reopen':'close',reason}))}>{detail.status==='closed'?'Reopen rehearsal':'Close rehearsal'}</button>
      {[...new Set(detail.fixtures.map(f=>f.roundId))].map(r=><button key={r} className="primary-button" disabled={busy} onClick={()=>run(async()=>{download(`century-rehearsal-${selected}-${r.replaceAll(/[^a-zA-Z0-9-]/g,'_')}.json`,await request({action:'rehearsal-briefing',rehearsalId:selected,roundId:r}));setMessage('Rehearsal briefing exported from active accepted results.');})}>Export rehearsal {r}</button>)}</div>
      <details><summary>Commissioner audit ({detail.audit.length})</summary><ul>{detail.audit.map(a=><li key={a.id}>{a.at}: {a.operation.type}{a.operation.reason?` — ${a.operation.reason}`:''}</li>)}</ul></details>
    </>:null}
    {review&&reviewed?<>
      <MatchReview review={review} accepted={reviewed.status==='accepted'} mode="rehearsal" statusLabel={reviewed.status==='voided'||reviewed.status==='superseded'?`${reviewed.status} source · retained for audit`:undefined}/>
      <details><summary>Pinned availability in this proposal</summary><ul>{(review.result.input as CompetitiveMatchInput).availability.players.filter(p=>!p.eligible).map(p=><li key={p.playerId}>{review.result.input.teams.flatMap(t=>t.players).find(x=>x.id===p.playerId)?.name}: {p.injuryIds.length?'injury recovery':''}{p.suspensionIds.length?' suspension':''}</li>)}</ul></details>
      <div className="generator-actions">
        {reviewed.status==='proposed'?<button className="primary-button" disabled={busy||detail?.status==='closed'||reviewed.blocked||reviewed.eligibilityChanged} onClick={()=>run(async()=>{await request({action:'rehearsal-accept',rehearsalId:selected,proposalId:review.id,commandId:key({accept:review.id}),expectedRevision:detail!.revision});await reload();setMessage('Result and availability effects accepted together, once.');})}>Accept rehearsal result</button>:null}
        <button className="primary-button" disabled={busy} onClick={()=>run(async()=>{const r=await request<{replay:ReplayReport}>({action:'rehearsal-verify',rehearsalId:selected,proposalId:review.id});setMessage(r.replay.exact?'Rehearsal replay passed exactly.':`Rehearsal replay passed with ${r.replay.coordinateDifferences} bounded coordinate rounding differences; all match facts agree.`);})}>Verify rehearsal replay</button>
        <button className="primary-button" disabled={busy} onClick={()=>download(`century-rehearsal-${review.fixtureId}.json`,{classification:'competitive-rehearsal',status:reviewed.status,...review})}>Export rehearsal match</button>
      </div>
      {reviewed.status==='accepted'?<div className="match-controls"><label>Correction type<select value={kind} disabled={busy} onChange={e=>setKind(e.target.value as typeof kind)}><option value="administrative">Administrative error</option><option value="technical">Technical error</option></select></label><button className="primary-button" disabled={busy||!reasonReady||detail?.status==='closed'} onClick={()=>run(()=>operate({type:'correct',resultId:reviewed.acceptedId,kind,reason}))}>Void rehearsal result</button></div>:null}
      {['voided','proposed','pinned','scheduled'].includes(reviewed.status)?<div className="preview-panel"><h4>Prepare an audited replacement</h4><p>The original proposal and seed are retained. These selections use canonical season rosters.</p><div className="match-controls"><label>Replacement first team<select value={replacementFirst} disabled={busy} onChange={e=>setReplacementFirst(e.target.value)}>{replacementOptions.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Replacement second team<select value={replacementSecond} disabled={busy} onChange={e=>setReplacementSecond(e.target.value)}>{replacementOptions.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><button className="primary-button" disabled={busy||!reasonReady||detail?.status==='closed'||!replacementOptions.length||replacementFirst===replacementSecond} onClick={()=>run(async()=>{await request({action:'rehearsal-replace',rehearsalId:selected,fixtureId:reviewed.id,newFixtureId:key({replace:reviewed.id,reason,replacementFirst,replacementSecond}),teamIds:[replacementFirst,replacementSecond],expectedRevision:detail!.revision,reason});setReview(null);await reload();setMessage('Replacement fixture prepared; original history preserved.');})}>Prepare replacement fixture</button></div></div>:null}
    </>:null}
    <details><summary>Prepare a competitive rehearsal</summary>
      <div className="match-controls"><label>Rehearsal name<input value={name} maxLength={160} disabled={busy} onChange={e=>setName(e.target.value)}/></label><label>Rehearsal season<select value={season} disabled={busy} onChange={e=>{setSeason(e.target.value);setDate(seasons.find(s=>s.id===e.target.value)?.starts_on??'');}}>{seasons.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label></div>
      <div className="match-controls"><label>Rehearsal round<input value={round} maxLength={100} disabled={busy} onChange={e=>setRound(e.target.value)}/></label><label>Match date<input type="date" value={date} disabled={busy} onInput={e=>setDate(e.currentTarget.value)}/></label><label>Rehearsal first team<select value={first} disabled={busy} onChange={e=>setFirst(e.target.value)}><option value="">Choose team</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Rehearsal second team<select value={second} disabled={busy} onChange={e=>setSecond(e.target.value)}><option value="">Choose opponent</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label></div>
      <button className="primary-button" disabled={busy||!first||!second||first===second||!date||!round.trim()||plan.length>=32} onClick={()=>{if(plan.some(f=>f.roundId===round.trim()&&f.teamIds.some(id=>id===first||id===second))){setError('A team can appear only once in each rehearsal round.');return;}setPlan(p=>[...p,{id:crypto.randomUUID(),seasonId:season,roundId:round.trim(),matchDate:date,teamIds:[first,second],names:[teams.find(t=>t.id===first)!.name,teams.find(t=>t.id===second)!.name]}]);}}>Add rehearsal fixture</button>
      <ol>{plan.map(f=><li key={f.id}>{f.matchDate} · {f.roundId}: {f.names.join(' v ')} <button className="link-button" disabled={busy} onClick={()=>setPlan(p=>p.filter(x=>x.id!==f.id))}>Remove rehearsal fixture</button></li>)}</ol>
      <button className="primary-button" disabled={busy||!plan.length||!name.trim()} onClick={()=>run(async()=>{const r=await request<{id:string}>({action:'rehearsal-create',rehearsalId:draft,name,fixtures:plan});await loadList();setSelected(r.id);setPlan([]);setDraft(crypto.randomUUID());setMessage('Competitive rehearsal prepared from canonical rosters.');})}>Create competitive rehearsal</button>
    </details>
  </section>;
}
