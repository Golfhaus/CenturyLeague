import {useEffect,useState} from 'react';
import {request} from './lib/match-api';
type Job={id:string;matchCode:string;scheduledFor:string;status:string;attempts:number;code:string|null};
type Runner={configured:boolean;enabled?:boolean;paused?:boolean;completedAt?:string|null;busy?:boolean;lastFinishAt?:string|null;jobs?:Job[]};
export default function ScheduledRunner(){
 const [data,setData]=useState<Runner|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[reason,setReason]=useState('');
 const reload=async()=>setData(await request<Runner>({action:'official-runner-status'}));
 useEffect(()=>{let ignore=false;request<Runner>({action:'official-runner-status'}).then(r=>{if(!ignore)setData(r);}).catch(e=>{if(!ignore)setError(e.message);});return()=>{ignore=true;};},[]);
 async function act(body:Record<string,unknown>){setBusy(true);setError('');try{await request(body);await reload();}catch(e){setError(e instanceof Error?e.message:'Unable to update automatic matches');}finally{setBusy(false);}}
 return <details><summary>Automatic match execution</summary>
  {error?<p role="alert">{error}</p>:null}
  {!data?<p>Loading runner status…</p>:!data.configured?<p>The scheduled runner has not been configured.</p>:<>
   <p>{data.completedAt?'Tournament schedule completed.':!data.enabled?'Automatic execution is disabled.':data.paused?'Automatic execution is paused.':data.busy?'Processing a scheduled match.':'Automatic execution is enabled.'} Match windows begin at 7 p.m. Eastern. Results appear as matches finish.</p>
   <button className="primary-button" disabled={busy} onClick={()=>act({action:'official-runner-status'})}>Refresh automatic matches</button>
   <label>Runner decision reason<input value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)} placeholder="At least 10 characters"/></label>
   <button className="primary-button" disabled={busy||!data.enabled||Boolean(data.completedAt)||reason.trim().length<10} onClick={()=>act({action:'official-runner-control',paused:!data.paused,reason})}>{data.paused?'Resume automatic matches':'Pause automatic matches'}</button>
   <div className="match-table-wrap"><table><caption>Scheduled execution history</caption><thead><tr><th>Match</th><th>Status</th><th>Attempts</th><th>Action</th></tr></thead><tbody>{data.jobs?.map(j=><tr key={j.id}><th>{j.matchCode}</th><td>{j.status}{j.code==='commissioner_review'?' · commissioner review required':j.status==='failed'?' · manual recovery required':''}</td><td>{j.attempts}</td><td>{['failed','blocked','retry'].includes(j.status)?<button className="primary-button" disabled={busy||reason.trim().length<10} onClick={()=>act({action:'official-runner-retry',jobId:j.id,reason})}>Retry saved match</button>:null}</td></tr>)}</tbody></table></div>
   {!data.jobs?.length?<p>No execution jobs have been queued yet.</p>:null}
   <p>Retrying keeps the saved fixture and seed. Required incident and match reviews still apply.</p>
  </>}
 </details>;
}
