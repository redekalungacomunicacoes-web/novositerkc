import { supabase } from "./supabase";

export async function signInAdmin(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOutAdmin() {
  return supabase.auth.signOut();
}

export async function getSession() {
  return supabase.auth.getSession();
}
