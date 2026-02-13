import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gzykxphmixqjxmwvsuiy.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_F5pKXtICiTQePPpFaFs4SQ_RrL4KdcL";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Use anon client for everything - RLS policies handle access control
export const supabaseAdmin = supabase;
