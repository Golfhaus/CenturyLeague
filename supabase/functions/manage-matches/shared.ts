export class RequestError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export type MatchDB = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: any; error: any }> };
export async function matchRPC(db: MatchDB, name: string, args: Record<string, unknown>) {
  const { data, error } = await db.rpc(name, args);
  if (error) throw new RequestError(error.code === '40001' ? 'The rehearsal changed. Refresh before retrying.' : error.message, error.code === '40001' ? 409 : 400);
  return data;
}
