import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types.js';

export type { Database } from './database.types.js';

export function createCenturySupabaseClient(url: string, publishableKey: string) {
  return createClient<Database>(url, publishableKey);
}
