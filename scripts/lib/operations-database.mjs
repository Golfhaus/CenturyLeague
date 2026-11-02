import { executeOperation, operationsView } from '../../packages/simulation-core/dist/competitive/index.js';

/** Backend validation adapter. This is not exposed by the live Edge endpoint.
 * The caller must supply an authenticated actor and resolve result context from
 * immutable saved proposals. Official result/effect atomic integration is gated. */
export async function readOperationsCandidate(db,streamId,actor) {
 const r=(await db.query('select public.read_operations_candidate_v1($1,$2) receipt',[actor.id,streamId])).rows[0].receipt;
 if(r.purpose!=='validation')throw Error('Validation-only stream required');
 operationsView(r.state);return r;
}
export async function commitOperationCandidate(db,streamId,command,actor,context={}) {
 const saved=await readOperationsCandidate(db,streamId,actor);
 const resolved={...context};delete resolved.result;
 if(command.operation.type==='accept'){
  const proposal=(await db.query('select public.read_operations_proposal_candidate_v1($1,$2,$3) receipt',
   [actor.id,streamId,command.operation.proposalId])).rows[0].receipt;
  if(proposal.sha256!==command.operation.resultSHA256)throw Error('Saved proposal digest mismatch');
  resolved.result=proposal.result;
 }
 const executed=executeOperation(saved.state,command,actor,resolved);
 if(!executed.added)return {added:false,revision:executed.event.revision};
 return (await db.query('select public.append_operation_candidate_v1($1,$2,$3,$4,$5) receipt',
  [actor.id,streamId,saved.state.revision,saved.headSHA256,JSON.stringify(executed.event)])).rows[0].receipt;
}
