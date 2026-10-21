/**
 * The Supabase project this build talks to. Both values are public by design (Row Level Security protects the data).
 * Find them in Supabase → Project Settings → API: "Project URL" and the "anon public" key.
 * Leave empty to ship without cloud features; coaches can still enter a project in Settings → Cloud.
 */
export const CLOUD_CONFIG = {
  url: "https://onfeatmlkndsyesiqslg.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uZmVhdG1sa25kc3llc2lxc2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1NDgzOTYsImV4cCI6MjEwODEyNDM5Nn0.-2aXLrvPeyNeAXehKYbJyariVlxPSgjWHNymW68h_WI",
};
