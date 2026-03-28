const env = import.meta.env;

// Vite exposes only vars prefixed with VITE_ to browser code.
export const projectId =
  env.VITE_SUPABASE_PROJECT_ID ?? "iyoxxvdkdwdpatzjljrs";

export const publicAnonKey =
  env.VITE_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5b3h4dmRrZHdkcGF0empsanJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNTc1NDgsImV4cCI6MjA4MzYzMzU0OH0.MmzkrAjHLsIFg2RS9x-OjEJZlPX-Jin_8SUaQ1M1gBQ";