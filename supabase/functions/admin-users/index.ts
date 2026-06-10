// Admin user management edge function
// Routes: list, create, set-roles, delete
// Caller must have 'admin' role.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

type Role = "admin" | "verifier" | "counter";
const VALID_ROLES: Role[] = ["admin", "verifier", "counter"];
const VALID_TEAMS = new Set([
  "red-alpha","orange-nova","yellow-magna","green-gamma","blue-theta","indigo-delta","violet-sigma",
]);
function normalizeTeam(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  const s = String(v);
  return VALID_TEAMS.has(s) ? s : null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  // Verify caller and check admin role using their JWT
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: isAdmin } = await admin.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  if (!isAdmin) return json({ error: "Forbidden" }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const action = body?.action as string;

  try {
    if (action === "list") {
      const { data: users, error } = await admin.auth.admin.listUsers({ perPage: 200 });
      if (error) throw error;
      const ids = users.users.map((u) => u.id);
      const { data: roles } = await admin.from("user_roles").select("user_id, role").in("user_id", ids);
      const { data: profiles } = await admin.from("profiles").select("id, full_name, badge_id, team_id").in("id", ids);
      const rolesByUser = new Map<string, Role[]>();
      (roles ?? []).forEach((r: any) => {
        const arr = rolesByUser.get(r.user_id) ?? [];
        arr.push(r.role);
        rolesByUser.set(r.user_id, arr);
      });
      const profById = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      return json({
        users: users.users.map((u) => ({
          id: u.id,
          email: u.email,
          full_name: profById.get(u.id)?.full_name ?? null,
          badge_id: profById.get(u.id)?.badge_id ?? null,
          team_id: profById.get(u.id)?.team_id ?? null,
          created_at: u.created_at,
          roles: rolesByUser.get(u.id) ?? [],
        })),
      });
    }

    if (action === "create") {
      const { email, password, full_name, roles, badge_id, team_id } = body;
      if (!email || !password) return json({ error: "Email and password required" }, 400);
      const requestedRoles: Role[] = Array.isArray(roles)
        ? roles.filter((r: string) => VALID_ROLES.includes(r as Role))
        : [];
      const badge = badge_id ? String(badge_id).trim() : null;
      const team = normalizeTeam(team_id);

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name ?? email },
      });
      if (cErr) throw cErr;
      const newId = created.user!.id;

      // handle_new_user trigger inserts default 'counter' role + profile.
      // Sync to requested role set.
      await admin.from("user_roles").delete().eq("user_id", newId);
      if (requestedRoles.length > 0) {
        await admin.from("user_roles").insert(
          requestedRoles.map((role) => ({ user_id: newId, role })),
        );
      }
      const profileUpdate: Record<string, unknown> = {};
      if (full_name) profileUpdate.full_name = full_name;
      if (badge !== null) profileUpdate.badge_id = badge || null;
      if (team !== undefined) profileUpdate.team_id = team;
      if (Object.keys(profileUpdate).length > 0) {
        const { error: pErr } = await admin.from("profiles").update(profileUpdate).eq("id", newId);
        if (pErr) {
          // Roll back user if badge collision
          await admin.auth.admin.deleteUser(newId);
          return json({ error: pErr.message.includes("unique") ? "Badge ID already in use" : pErr.message }, 400);
        }
      }
      return json({ id: newId });
    }


    if (action === "set-roles") {
      const { user_id, roles, badge_id, team_id } = body;
      if (!user_id) return json({ error: "user_id required" }, 400);
      if (Array.isArray(roles)) {
        const requestedRoles: Role[] = roles.filter((r: string) => VALID_ROLES.includes(r as Role));
        await admin.from("user_roles").delete().eq("user_id", user_id);
        if (requestedRoles.length > 0) {
          const { error } = await admin.from("user_roles").insert(
            requestedRoles.map((role) => ({ user_id, role })),
          );
          if (error) throw error;
        }
      }
      if (badge_id !== undefined) {
        const badge = badge_id ? String(badge_id).trim() : null;
        const { error: pErr } = await admin
          .from("profiles")
          .update({ badge_id: badge || null })
          .eq("id", user_id);
        if (pErr) return json({ error: pErr.message.includes("unique") ? "Badge ID already in use" : pErr.message }, 400);
      }
      const team = normalizeTeam(team_id);
      if (team !== undefined) {
        const { error: tErr } = await admin
          .from("profiles")
          .update({ team_id: team })
          .eq("id", user_id);
        if (tErr) return json({ error: tErr.message }, 400);
      }
      return json({ ok: true });
    }

    if (action === "delete") {
      const { user_id } = body;
      if (!user_id) return json({ error: "user_id required" }, 400);
      if (user_id === userData.user.id) return json({ error: "Cannot delete yourself" }, 400);
      const { error } = await admin.auth.admin.deleteUser(user_id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "reset-password") {
      const { user_id, password } = body;
      if (!user_id) return json({ error: "user_id required" }, 400);
      if (!password || String(password).length < 6) {
        return json({ error: "Password must be at least 6 characters" }, 400);
      }
      const { error } = await admin.auth.admin.updateUserById(user_id, {
        password: String(password),
      });
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
