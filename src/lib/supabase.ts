import { createBrowserClient } from "@supabase/ssr";
import { createClient as createJsClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gzykxphmixqjxmwvsuiy.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

// Legacy exports for data.ts compatibility
export const supabase = createJsClient(supabaseUrl, supabaseAnonKey);
export const supabaseAdmin = supabase;
