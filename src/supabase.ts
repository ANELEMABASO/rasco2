import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when both env vars are set. Otherwise the app keeps the old PIN / demo behaviour. */
export const SUPABASE_ENABLED = Boolean(url && key);
export const supabase = SUPABASE_ENABLED ? createClient(url!, key!) : null;
