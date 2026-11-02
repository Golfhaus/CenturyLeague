import type {Review} from './lib/match-api';
export default function MatchReview({review,accepted,mode='exhibition',statusLabel}:{review:Review;accepted:boolean;mode?:'exhibition'|'rehearsal'|'official';statusLabel?:string}) {
  const {result:r,briefing:b}=review;
  const stats=['points','shots','centralAirScores','bonusesConverted','catches','tackles','recoveries','turnovers','fouls'];
  return <section className="preview-panel match-review" aria-label="Match review">
    <p className="eyebrow">{statusLabel??(mode==='official'?(accepted?'Accepted official result':'Proposed official result'):mode==='rehearsal'?(accepted?'Accepted competitive rehearsal':'Proposed competitive rehearsal'):(accepted?'Accepted exhibition':'Proposed exhibition · awaiting acceptance'))}</p>
    <h3>{r.input.teams[0].name} {r.scores[0]}–{r.scores[1]} {r.input.teams[1].name}</h3>
    <p>{b.winner} won in {b.playingMinutes.toFixed(1)} playing minutes. {b.leadChanges} lead changes; largest lead {b.largestLead}.</p>
    <p>{b.winningPlay.player} delivered the winning central kick, credited with {b.winningPlay.awardedPoints} {b.winningPlay.awardedPoints===1?'point':'points'} (event {b.winningPlay.eventId}).</p>
    <div className="match-table-wrap"><table><caption>Quarter scores</caption><thead><tr><th>Quarter</th><th>Quarter points</th><th>Running score</th></tr></thead><tbody>{r.quarters.map(q=><tr key={q.quarter}><th>{q.quarter}</th><td>{q.points.join('–')}</td><td>{q.cumulative.join('–')}</td></tr>)}</tbody></table></div>
    <div className="match-table-wrap"><table><caption>Team statistics</caption><thead><tr><th>Statistic</th>{r.input.teams.map(t=><th key={t.id}>{t.name}</th>)}</tr></thead><tbody>{stats.map(stat=><tr key={stat}><th>{stat.replace(/([A-Z])/g,' $1')}</th>{r.teamStats.map((s,i)=><td key={i}>{s[stat]??0}</td>)}</tr>)}</tbody></table></div>
    {r.input.teams.map((t,side)=><details key={t.id}><summary>{t.name}: all 35 player statistics</summary><div className="match-table-wrap"><table><thead><tr><th>Player</th><th>Minutes</th><th>Points</th><th>Shots</th><th>Tackles</th><th>Recoveries</th></tr></thead><tbody>{r.players.filter(p=>p.side===side).map(p=><tr key={p.id}><th>{p.name}</th><td>{(p.secondsPlayed/60).toFixed(1)}</td>{['points','shots','tackles','recoveries'].map(s=><td key={s}>{p.stats[s]??0}</td>)}</tr>)}</tbody></table></div></details>)}
    <details><summary>Recorded incidents ({b.noteworthy.length})</summary><ul>{b.noteworthy.map(e=><li key={e.eventId}>Q{e.quarter}, {(e.playingSeconds/60).toFixed(1)} minutes: {e.type.replaceAll('_',' ')} — {e.player??'Team'} ({e.team??'match'}), event {e.eventId}.</li>)}</ul></details>
    <p className="match-note">{mode==='official'?'Fatigue resets after the match. Injury recovery and bans follow players across competitions and monthly seasons.':mode==='rehearsal'?'Fatigue resets after the match. Injury recovery and bans persist within this rehearsal. These results do not count toward official league records.':'Exhibition fatigue and injuries reset after the match. Accepted exhibition records remain separate from official competition.'}</p>
  </section>;
}
