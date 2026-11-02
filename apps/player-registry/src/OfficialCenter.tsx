import {useEffect,useState} from 'react';
import {request} from './lib/match-api';
import RehearsalCenter from './RehearsalCenter';
type Gate={category:string;policyApproved:boolean;formatApproved:boolean;activationEnabled:boolean;hasJournal:boolean};
export default function OfficialCenter(){
 const [gates,setGates]=useState<Gate[]>([]),[error,setError]=useState('');
 useEffect(()=>{let ignore=false;request<Gate[]>({action:'official-readiness'}).then(data=>{if(!ignore)setGates(data);}).catch(e=>{if(!ignore)setError(e.message);});return()=>{ignore=true;};},[]);
 return <section className="generate-stack" aria-label="Official competition readiness">
  <p>Official activation awaits the recovery-policy decision, the competition format and the final release check. The inaugural tournament is unscheduled.</p>
  {error?<p role="alert">{error}</p>:!gates.length?<p>Loading official readiness…</p>:<div className="match-table-wrap"><table><caption>Official release decisions</caption><thead><tr><th>League</th><th>Recovery policy</th><th>Format</th><th>Activation</th></tr></thead><tbody>{gates.map(g=><tr key={g.category}><th>{g.category==='men'?"Men's league":"Women's league"}</th><td>{g.policyApproved?'Approved':'Pending'}</td><td>{g.formatApproved?'Approved':'Deferred'}</td><td>{g.activationEnabled?'Enabled':'Off'}</td></tr>)}</tbody></table></div>}
  <RehearsalCenter mode="official"/>
 </section>;
}
