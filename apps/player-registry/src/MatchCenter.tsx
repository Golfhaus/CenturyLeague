import { useEffect, useState } from 'react';
import type { MatchResult, ReplayReport, matchBriefing } from '@century-league/simulation-core';
import { supabase } from './lib/supabase';

type Competition = { id:string; name:string; season_id:string; competition_category:string; classification:string; status:string; revision:number };
type Fixture = { id:string; round_id:string; teams:{id:string;name:string}[]; proposal_id:string|null; scores:number[]|null; accepted_at:string|null };
type RecordRow = { team_id:string; name:string; played:number; wins:number; losses:number; points_for:number; points_against:number };
type Detail = { competition:Competition; fixtures:Fixture[]; records:RecordRow[] };
type Review = { id:string; fixtureId:string; sha256:string; result:MatchResult; briefing:ReturnType<typeof matchBriefing> };
type PlannedFixture = { id:string; roundId:string; teamIds:[string,string] };
async function request<T>(body:Record<string,unknown>):Promise<T> {
  if(!supabase)throw Error('Database is not configured');
  const {data,error}=await supabase.functions.invoke('manage-matches',{body});
  if(error){let message=error.message;try{message=(await error.context.json()).error??message;}catch{/* Network failures have no JSON body. */}throw Error(message);}
  return data as T;
}
function download(name:string,data:unknown) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function MatchReview({review,accepted}:{review:Review;accepted:boolean}) {
  const {result:r,briefing:b}=review;
  const stats=['points','shots','centralAirScores','bonusesConverted','catches','tackles','recoveries','turnovers','fouls'];
  return <section className="preview-panel match-review" aria-label="Match review">
    <p className="eyebrow">{accepted?'Accepted exhibition':'Proposed exhibition · awaiting acceptance'}</p>
    <h3>{r.input.teams[0].name} {r.scores[0]}–{r.scores[1]} {r.input.teams[1].name}</h3>
    <p>{b.winner} won in {b.playingMinutes.toFixed(1)} playing minutes. {b.leadChanges} lead changes; largest lead {b.largestLead}.</p>
    <p>{b.winningPlay.player} delivered the winning central kick, credited with {b.winningPlay.awardedPoints} points (event {b.winningPlay.eventId}).</p>
    <div className="match-table-wrap"><table><caption>Quarter scores</caption><thead><tr><th>Quarter</th><th>Quarter points</th><th>Running score</th></tr></thead><tbody>{r.quarters.map(q=><tr key={q.quarter}><th>{q.quarter}</th><td>{q.points.join('–')}</td><td>{q.cumulative.join('–')}</td></tr>)}</tbody></table></div>
    <div className="match-table-wrap"><table><caption>Team statistics</caption><thead><tr><th>Statistic</th>{r.input.teams.map(t=><th key={t.id}>{t.name}</th>)}</tr></thead><tbody>{stats.map(stat=><tr key={stat}><th>{stat.replace(/([A-Z])/g,' $1')}</th>{r.teamStats.map((s,i)=><td key={i}>{s[stat]??0}</td>)}</tr>)}</tbody></table></div>
    {r.input.teams.map((t,side)=><details key={t.id}><summary>{t.name}: all 35 player statistics</summary><div className="match-table-wrap"><table><thead><tr><th>Player</th><th>Minutes</th><th>Points</th><th>Shots</th><th>Tackles</th><th>Recoveries</th></tr></thead><tbody>{r.players.filter(p=>p.side===side).map(p=><tr key={p.id}><th>{p.name}</th><td>{(p.secondsPlayed/60).toFixed(1)}</td>{['points','shots','tackles','recoveries'].map(s=><td key={s}>{p.stats[s]??0}</td>)}</tr>)}</tbody></table></div></details>)}
    <details><summary>Recorded incidents ({b.noteworthy.length})</summary><ul>{b.noteworthy.map(e=><li key={e.eventId}>Q{e.quarter}, {(e.playingSeconds/60).toFixed(1)} minutes: {e.type.replaceAll('_',' ')} — {e.player??'Team'} ({e.team??'match'}), event {e.eventId}.</li>)}</ul></details>
    <p className="match-note">Exhibition fatigue and injuries reset after the match. Accepted exhibition records remain separate from official competition.</p>
  </section>;
}
export default function MatchCenter({role}:{role:string|null}) {
  const [competitions,setCompetitions]=useState<Competition[]>([]),[selected,setSelected]=useState('');
  const [detail,setDetail]=useState<Detail|null>(null),[round,setRound]=useState(''),[review,setReview]=useState<Review|null>(null);
  const [seasons,setSeasons]=useState<{id:string;label:string;competition_category:string}[]>([]),[seasonId,setSeasonId]=useState('');
  const [teams,setTeams]=useState<{id:string;name:string}[]>([]),[first,setFirst]=useState(''),[second,setSecond]=useState('');
  const [name,setName]=useState('Exhibition rehearsal'),[roundName,setRoundName]=useState('Round 1');
  const [plan,setPlan]=useState<PlannedFixture[]>([]),[draftId,setDraftId]=useState(()=>crypto.randomUUID());
  const [busy,setBusy]=useState(''),[loading,setLoading]=useState(true),[message,setMessage]=useState(''),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
  const commissioner=role==='commissioner';
  useEffect(()=>{let ignore=false;
    Promise.all([request<Competition[]>({action:'list'}),supabase!.from('seasons').select('id,label,competition_category').neq('status','complete').order('starts_on',{ascending:false})])
      .then(([list,available])=>{if(ignore)return;if(available.error)throw available.error;setCompetitions(list);setSeasons(available.data??[]);setSeasonId(id=>id||available.data?.[0]?.id||'');})
      .catch(e=>{if(!ignore)setError(e.message);}).finally(()=>{if(!ignore)setLoading(false);});
    return()=>{ignore=true;};
  },[refresh]);
  useEffect(()=>{let ignore=false;setDetail(null);setReview(null);setRound('');if(!selected)return;
    request<Detail>({action:'detail',competitionId:selected}).then(d=>{if(!ignore){setDetail(d);setRound(d.fixtures[0]?.round_id??'');}}).catch(e=>{if(!ignore)setError(e.message);});
    return()=>{ignore=true;};
  },[selected,refresh]);
  useEffect(()=>{let ignore=false;setTeams([]);setFirst('');setSecond('');setPlan([]);setDraftId(crypto.randomUUID());if(!seasonId)return;
    supabase!.from('team_season_rosters').select('team_id,match_team').eq('season_id',seasonId).then(({data,error:e})=>{
      if(ignore)return;if(e){setError(e.message);return;}setTeams((data??[]).map(row=>({id:row.team_id,name:(row.match_team as unknown as {name:string}).name})).sort((a,b)=>a.name.localeCompare(b.name)));
    });return()=>{ignore=true;};
  },[seasonId]);
  async function run(label:string,work:()=>Promise<void>){setBusy(label);setError('');setMessage('');try{await work();}catch(e){setError(e instanceof Error?e.message:'Match operation failed');}finally{setBusy('');}}
  async function reload(){if(selected)setDetail(await request<Detail>({action:'detail',competitionId:selected}));setCompetitions(await request<Competition[]>({action:'list'}));}
  const rounds=[...new Set(detail?.fixtures.map(f=>f.round_id)??[])];
  const reviewedFixture=detail?.fixtures.find(f=>f.id===review?.fixtureId);
  function addFixture(){
    if(!first||!second||first===second||!roundName.trim()){setError('Choose two different teams and a round name.');return;}
    if(plan.some(f=>f.roundId===roundName.trim()&&f.teamIds.some(id=>id===first||id===second))){setError('A team can appear only once in each round.');return;}
    setPlan(p=>[...p,{id:crypto.randomUUID(),roundId:roundName.trim(),teamIds:[first,second]}]);setError('');
  }
  return <div className="generate-stack match-center" aria-busy={Boolean(busy)}>
    <p className="match-note">The inaugural tournament format will be decided once the engine is ready. This workspace supports explicit exhibition fixtures; no official tournament is scheduled.</p>
    <div role="status" aria-live="polite">{busy||message}</div>{error?<div role="alert" className="notice warning">{error}<button className="link-button" disabled={Boolean(busy)} onClick={()=>{setError('');setRefresh(n=>n+1);}}>Refresh match data</button></div>:null}
    <section className="generator-panel">
      <div className="match-controls"><label>Competition<select aria-label="Competition" value={selected} disabled={Boolean(busy)||loading} onChange={e=>{setSelected(e.target.value);setError('');setMessage('');}}><option value="">{loading?'Loading…':'Choose an exhibition'}</option>{competitions.map(c=><option key={c.id} value={c.id}>{c.name} · {c.competition_category} · {c.status}</option>)}</select></label><button className="primary-button" disabled={Boolean(busy)} onClick={()=>setRefresh(n=>n+1)}>Refresh</button></div>
      {!loading&&!competitions.length?<p>No exhibitions yet. A commissioner can prepare one below from the imported season rosters.</p>:null}
      {selected&&!detail?<p>Loading competition…</p>:null}
      {detail?<>
        <h3>{detail.competition.name} <span className="status-tag">{detail.competition.classification} · {detail.competition.status}</span></h3>
        {detail.competition.status==='draft'&&commissioner?<button className="primary-button" disabled={Boolean(busy)} onClick={()=>run('Activating exhibition…',async()=>{await request({action:'activate',competitionId:selected,expectedRevision:detail.competition.revision});await reload();setMessage('Exhibition activated. Fixtures and rosters are pinned.');})}>Activate exhibition</button>:null}
        <div className="match-controls"><label>Round<select aria-label="Round" value={round} disabled={Boolean(busy)} onChange={e=>{setRound(e.target.value);setReview(null);}}>{rounds.map(r=><option key={r}>{r}</option>)}</select></label><button className="primary-button" disabled={Boolean(busy)||!round} onClick={()=>run('Preparing matchday briefing…',async()=>{download(`century-${selected}-briefing.json`,await request({action:'briefing',competitionId:selected,roundId:round}));setMessage('Briefing exported from accepted matches only.');})}>Export round briefing</button></div>
        <div className="match-table-wrap"><table><caption>Fixtures · {round}</caption><thead><tr><th>Match</th><th>Score</th><th>Status</th><th>Action</th></tr></thead><tbody>{detail.fixtures.filter(f=>f.round_id===round).map(f=><tr key={f.id}><th>{f.teams.map(t=>t.name).join(' v ')}</th><td>{f.scores?.join('–')??'—'}</td><td>{f.accepted_at?'Accepted':f.proposal_id?'Proposed':'Scheduled'}</td><td>{f.proposal_id?<button className="primary-button" disabled={Boolean(busy)} onClick={()=>run('Loading match…',async()=>setReview(await request<Review>({action:'proposal',proposalId:f.proposal_id})))}>Review match</button>:<button className="primary-button" disabled={Boolean(busy)||!commissioner||detail.competition.status!=='active'} onClick={()=>run('Simulating match…',async()=>{const p=await request<{id:string}>({action:'simulate',fixtureId:f.id});await reload();setReview(await request<Review>({action:'proposal',proposalId:p.id}));setMessage('Proposal saved. Review it before acceptance.');})}>Simulate</button>}</td></tr>)}</tbody></table></div>
        <div className="match-table-wrap"><table><caption>Accepted exhibition records · unranked</caption><thead><tr><th>Team</th><th>Played</th><th>Wins</th><th>Losses</th><th>For</th><th>Against</th><th>Difference</th></tr></thead><tbody>{detail.records.map(r=><tr key={r.team_id}><th>{r.name}</th><td>{r.played}</td><td>{r.wins}</td><td>{r.losses}</td><td>{r.points_for}</td><td>{r.points_against}</td><td>{r.points_for-r.points_against}</td></tr>)}</tbody></table></div>
      </>:null}
    </section>
    {review?<><MatchReview review={review} accepted={Boolean(reviewedFixture?.accepted_at)}/><div className="generator-actions">
      {!reviewedFixture?.accepted_at&&commissioner?<button className="primary-button" disabled={Boolean(busy)||!detail} onClick={()=>run('Accepting result…',async()=>{await request({action:'accept',proposalId:review.id,expectedRevision:detail!.competition.revision});await reload();setMessage('Result accepted. Exhibition records updated once.');})}>Accept reviewed result</button>:null}
      <button className="primary-button" disabled={Boolean(busy)} onClick={()=>run('Replaying saved match…',async()=>{const {replay}=await request<{replay:ReplayReport}>({action:'verify',proposalId:review.id});setMessage(replay.exact?`Exact event and statistic replay passed (${replay.policy}).`:`Replay passed with ${replay.coordinateDifferences} bounded coordinate rounding differences (${replay.policy}). Scores, events, timing and statistics match exactly.`);})}>Verify replay</button>
      <button className="primary-button" disabled={Boolean(busy)} onClick={()=>download(`century-${review.fixtureId}.json`,{classification:'exhibition',status:reviewedFixture?.accepted_at?'accepted':'proposed',...review})}>Export match data</button>
    </div></>:null}
    {commissioner?<details className="generator-panel"><summary>Prepare an exhibition</summary><p>Choose a season and add the fixtures you want to test. Team rosters and original coaching preferences are loaded from that season.</p>
      <div className="match-controls"><label>Season<select aria-label="Season" value={seasonId} disabled={Boolean(busy)} onChange={e=>setSeasonId(e.target.value)}><option value="">Choose season</option>{seasons.map(s=><option key={s.id} value={s.id}>{s.label} · {s.competition_category}</option>)}</select></label><label>Exhibition name<input value={name} maxLength={160} disabled={Boolean(busy)} onChange={e=>setName(e.target.value)}/></label></div>
      {!teams.length?<p>No imported team rosters are available for this season.</p>:null}
      <div className="match-controls"><label>Round name<input value={roundName} maxLength={100} disabled={Boolean(busy)} onChange={e=>setRoundName(e.target.value)}/></label><label>First team<select aria-label="First team" value={first} disabled={Boolean(busy)} onChange={e=>setFirst(e.target.value)}><option value="">Choose team</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Second team<select aria-label="Second team" value={second} disabled={Boolean(busy)} onChange={e=>setSecond(e.target.value)}><option value="">Choose opponent</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><button className="primary-button" disabled={Boolean(busy)||!teams.length} onClick={addFixture}>Add fixture</button></div>
      <ol>{plan.map(f=><li key={f.id}>{f.roundId}: {f.teamIds.map(id=>teams.find(t=>t.id===id)?.name).join(' v ')} <button className="link-button" disabled={Boolean(busy)} onClick={()=>setPlan(p=>p.filter(x=>x.id!==f.id))}>Remove fixture</button></li>)}</ol>
      <button className="primary-button" disabled={Boolean(busy)||!name.trim()||!plan.length} onClick={()=>run('Preparing exhibition…',async()=>{const c=await request<{id:string}>({action:'create-exhibition',competitionId:draftId,seasonId,name,fixtures:plan});setSelected(c.id);setRefresh(n=>n+1);setDraftId(crypto.randomUUID());setPlan([]);setMessage('Exhibition prepared. Review its fixtures before activation.');})}>Save exhibition draft</button>
    </details>:null}
  </div>;
}
