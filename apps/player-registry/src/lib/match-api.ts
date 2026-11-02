import type {MatchResult,matchBriefing} from '@century-league/simulation-core';
import {supabase} from './supabase';
export type Review = { id:string; fixtureId:string; sha256:string; result:MatchResult; briefing:ReturnType<typeof matchBriefing> };
export async function request<T>(body:Record<string,unknown>):Promise<T> {
  if(!supabase)throw Error('Database is not configured');
  const {data,error}=await supabase.functions.invoke('manage-matches',{body});
  if(error){let message=error.message;try{message=(await error.context.json()).error??message;}catch{/* Network failures have no JSON body. */}throw Error(message);}
  return data as T;
}
export function download(name:string,data:unknown) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
