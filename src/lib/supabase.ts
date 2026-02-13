import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gzykxphmixqjxmwvsuiy.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_F5pKXtICiTQePPpFaFs4SQ_RrL4KdcL";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Service role client for admin operations (org sync, member management)
// In a static export, this runs client-side. For production, use edge functions.
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY || "sb_secret_lh0GhRL__LM7PDDnoSjAsg_oSEBK29g";
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
