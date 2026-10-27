import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.js';

export type { Database } from './database.types.js';
export type CenturySupabaseClient = SupabaseClient<Database>;

export function createCenturySupabaseClient(
  url: string,
  publishableKey: string
): CenturySupabaseClient {
  return createClient<Database>(url, publishableKey);
}
