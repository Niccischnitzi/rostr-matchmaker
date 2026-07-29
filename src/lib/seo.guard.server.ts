export const SITE_URL = "https://rostr-matchmaker.lovable.app/";

/** Role check through the caller's RLS-scoped client (never service role). */
export async function requireAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return data === true;
}
