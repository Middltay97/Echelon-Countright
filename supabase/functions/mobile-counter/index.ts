// Mobile counter edge function — used by the badge-only mobile PWA.
// Badge -> user resolved server-side. All cycles in draft/in_progress are
// visible to any badge holder, but only one badge can hold a cycle at a time
// via the cycle_active_counter lock table.
//
// Actions:
//  - signin    { badge }
//  - sessions  { badge }
//  - enter     { badge, cycle_id }
//  - heartbeat { badge, cycle_id }
//  - exit      { badge, cycle_id }
//  - items     { badge, cycle_id }
//  - scan      { badge, cycle_id, code, qty?, client_event_id }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STALE_LOCK_MS = 5 * 60 * 1000; // 5 minutes

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

async function resolveBadge(badge: string): Promise<{ user_id: string; full_name: string | null } | null> {
  const b = (badge ?? "").trim();
  if (!b) return null;
  const { data } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("badge_id", b)
    .maybeSingle();
  if (!data) return null;
  return { user_id: data.id, full_name: data.full_name };
}

interface Lock {
  cycle_id: string;
  user_id: string;
  badge_id: string;
  last_seen_at: string;
}

async function getLock(cycle_id: string): Promise<Lock | null> {
  const { data } = await admin
    .from("cycle_active_counter")
    .select("*")
    .eq("cycle_id", cycle_id)
    .maybeSingle();
  return (data as Lock | null) ?? null;
}

function isStale(lock: Lock): boolean {
  return Date.now() - new Date(lock.last_seen_at).getTime() > STALE_LOCK_MS;
}

// Returns { ok: true } if caller now holds lock; otherwise 409-style error info
async function acquireOrRefresh(cycle_id: string, badge: string, user_id: string) {
  const existing = await getLock(cycle_id);
  if (existing && existing.badge_id !== badge && !isStale(existing)) {
    return { ok: false, active_badge: existing.badge_id };
  }
  const nowIso = new Date().toISOString();
  const { error } = await admin
    .from("cycle_active_counter")
    .upsert(
      {
        cycle_id,
        user_id,
        badge_id: badge,
        acquired_at: existing && existing.badge_id === badge ? existing.last_seen_at : nowIso,
        last_seen_at: nowIso,
      },
      { onConflict: "cycle_id" },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function holdsLock(cycle_id: string, badge: string): Promise<boolean> {
  const lock = await getLock(cycle_id);
  if (!lock) return false;
  if (lock.badge_id !== badge) return false;
  if (isStale(lock)) return false;
  return true;
}

// ────────────────────────────────────────────────────────────────────────────
// Centralized normalization. MUST stay in sync with src/lib/sku-normalize.ts.
// ────────────────────────────────────────────────────────────────────────────
const CONTROL_RE = /[\r\n\t\u00A0\u200B\u200C\u200D\uFEFF]/g;
const UNICODE_DASH_RE = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g;

function normalizeSku(value: unknown): string {
  if (value == null) return "";
  return String(value)
    .replace(CONTROL_RE, "")
    .replace(UNICODE_DASH_RE, "-")
    .replace(/\s+/g, "")
    .toUpperCase();
}

function normalizeBin(value: unknown): string {
  if (value == null) return "";
  return String(value)
    .replace(CONTROL_RE, " ")
    .replace(UNICODE_DASH_RE, "-")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function binsMatch(a: unknown, b: unknown): boolean {
  const na = normalizeBin(a);
  const nb = normalizeBin(b);
  if (na === nb) return true;
  if (/^\d+$/.test(na) && /^\d+$/.test(nb)) {
    return na.replace(/^0+/, "") === nb.replace(/^0+/, "");
  }
  return false;
}

// Canonical SKU parser (mirrors src/lib/sku-normalize.ts).
function parseSkuScan(rawIn: string): { canonical: string | null; body: string | null; pattern: string; valid: boolean } {
  const raw = rawIn ?? "";
  // Apply control-char/dash normalization BEFORE structural matching so that
  // "53153‑02090\r" (NBHY + CR) is still recognized as master-hyphenated.
  const cleaned = raw.replace(CONTROL_RE, "").replace(UNICODE_DASH_RE, "-");
  const upper = cleaned.toUpperCase();
  const fmt = (b: string) =>
    b.length === 10
      ? `${b.slice(0, 5)}-${b.slice(5)}`
      : b.length === 12
        ? `${b.slice(0, 5)}-${b.slice(5, 10)}-${b.slice(10)}`
        : b;
  let m = upper.match(/^([A-Z0-9]{10})\s+[A-Z0-9]$/);
  if (m) return { body: m[1], canonical: fmt(m[1]), pattern: "rule-a-10-space-suffix", valid: true };
  m = upper.match(/^([A-Z0-9]{12})[A-Z0-9]$/);
  if (m) return { body: m[1], canonical: fmt(m[1]), pattern: "rule-b-13-trailing-suffix", valid: true };
  const trimmed = upper.trim();
  if (/^[A-Z0-9]{5}-[A-Z0-9]{5}(-[A-Z0-9]{2})?$/.test(trimmed)) {
    const b = trimmed.replace(/-/g, "");
    return { body: b, canonical: fmt(b), pattern: "master-hyphenated", valid: true };
  }
  const compact = trimmed.replace(/[^A-Z0-9]/g, "");
  if (compact.length === 10) return { body: compact, canonical: fmt(compact), pattern: "compact-10", valid: true };
  if (compact.length === 12) return { body: compact, canonical: fmt(compact), pattern: "compact-12", valid: true };
  if (compact.length === 11) {
    const b = compact.slice(0, 10);
    return { body: b, canonical: fmt(b), pattern: "compact-11-trim-suffix", valid: true };
  }
  if (compact.length === 13) {
    const b = compact.slice(0, 12);
    return { body: b, canonical: fmt(b), pattern: "compact-13-trim-suffix", valid: true };
  }
  return { body: null, canonical: null, pattern: "invalid", valid: false };
}

// Persist a diagnostic row for problem scans. Never throws.
async function recordDiagnostic(input: {
  cycle_id: string | null;
  badge: string | null;
  user_id: string | null;
  raw: string;
  result_status: string;
  lookup_key?: string | null;
  closest_master_sku?: string | null;
  notes?: Record<string, unknown>;
}) {
  try {
    const normalized = normalizeSku(input.raw);
    const charCodes = Array.from(input.raw).map((c) => c.charCodeAt(0));
    await admin.from("scan_diagnostics").insert({
      cycle_id: input.cycle_id,
      badge_id: input.badge,
      user_id: input.user_id,
      raw: input.raw,
      normalized,
      length: normalized.length,
      char_codes: charCodes,
      lookup_key: input.lookup_key ?? normalized,
      result_status: input.result_status,
      closest_master_sku: input.closest_master_sku ?? null,
      notes: input.notes ?? null,
    });
  } catch (_) {
    // swallow — diagnostics must never block a scan
  }
}

// Structured scan resolution.
//   matched          — SKU already in cycle baseline
//   missing_baseline — SKU is in master AND assigned to a bin within this cycle
//   mislocated       — SKU is in master but assigned to a bin outside this cycle
//   sku_not_found    — SKU not in master nor cycle
//   invalid_scan     — could not parse into a usable code
type ScanStatus = "matched" | "missing_baseline" | "mislocated" | "sku_not_found" | "invalid_scan";

async function getCycleBinSet(cycle_id: string): Promise<Set<string>> {
  const { data } = await admin
    .from("count_items")
    .select("location")
    .eq("cycle_id", cycle_id)
    .not("location", "is", null);
  const set = new Set<string>();
  for (const r of data ?? []) {
    const n = normalizeBin(r.location);
    if (n) set.add(n);
  }
  return set;
}

async function resolveCountItem(
  cycle_id: string,
  raw: string,
  user_id: string,
  badge: string | null,
): Promise<{ item: any; status: ScanStatus } | null> {
  const parsed = parseSkuScan(raw);
  const lookupCode = parsed.canonical ?? normalizeSku(raw);
  if (!lookupCode) {
    await recordDiagnostic({
      cycle_id, badge, user_id, raw,
      result_status: "invalid_scan",
      lookup_key: "",
      notes: { reason: "empty after normalize", pattern: parsed.pattern },
    });
    return null;
  }

  // 1. Direct cycle item match
  const { data: matches } = await admin.rpc("find_count_item_by_code", {
    p_cycle_id: cycle_id,
    p_code: lookupCode,
  });
  if (matches && matches.length > 0) return { item: matches[0], status: "matched" };

  // 2. Master SKU fallback — was it supposed to be in this cycle?
  const { data: masterMatches } = await admin.rpc("find_master_sku_by_code", {
    p_code: lookupCode,
  });
  const master = masterMatches && masterMatches.length > 0 ? masterMatches[0] : null;

  if (master) {
    const cycleBins = await getCycleBinSet(cycle_id);
    const masterBin = normalizeBin(master.location);
    const belongsHere = !!masterBin && [...cycleBins].some((b) => binsMatch(b, masterBin));
    const status: ScanStatus = belongsHere ? "missing_baseline" : "mislocated";

    const { data: ins, error: insErr } = await admin
      .from("count_items")
      .insert({
        cycle_id,
        sku: master.sku,
        barcode: master.barcode ?? null,
        location: master.location ?? null,
        location2: master.location2 ?? null,
        description: master.description ?? null,
        uom: master.uom ?? null,
        unit_cost: master.unit_cost ?? null,
        expected_qty: 0,
        is_unexpected: true,
        mislocated: status === "mislocated",
      })
      .select()
      .single();
    if (insErr) throw new Error(insErr.message);

    await admin
      .from("barcode_aliases")
      .insert({ sku: master.sku, barcode: String(raw).trim(), created_by: user_id })
      .then(() => {}, () => {});

    await recordDiagnostic({
      cycle_id, badge, user_id, raw,
      result_status: status,
      lookup_key: lookupCode,
      closest_master_sku: master.sku,
      notes: { master_location: master.location, cycle_bin_count: cycleBins.size },
    });

    return { item: ins, status };
  }

  // 3. Unknown — log canonical (hyphenated) form when parseable
  const fallback = parsed.canonical ?? normalizeSku(raw);
  const { data: ins, error: insErr } = await admin
    .from("count_items")
    .insert({
      cycle_id,
      sku: fallback,
      barcode: fallback,
      expected_qty: 0,
      is_unexpected: true,
    })
    .select()
    .single();
  if (insErr) throw new Error(insErr.message);
  await admin
    .from("barcode_aliases")
    .insert({ sku: fallback, barcode: String(raw).trim(), created_by: user_id })
    .then(() => {}, () => {});

  await recordDiagnostic({
    cycle_id, badge, user_id, raw,
    result_status: "sku_not_found",
    lookup_key: lookupCode,
    notes: { pattern: parsed.pattern },
  });

  return { item: ins, status: "sku_not_found" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const action = body?.action as string;
  const badge = body?.badge as string;

  try {
    if (action === "signin") {
      const me = await resolveBadge(badge);
      if (!me) return json({ error: "Badge not recognized" }, 404);
      return json({ user_id: me.user_id, full_name: me.full_name });
    }

    const me = await resolveBadge(badge);
    if (!me) return json({ error: "Badge not recognized" }, 401);

    if (action === "sessions") {
      const { data: cycles } = await admin
        .from("cycle_counts")
        .select("id,name,status,due_date,baseline_filename,created_at,archived_at")
        .in("status", ["draft", "in_progress"])
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      const ids = (cycles ?? []).map((c) => c.id);
      let locks: Lock[] = [];
      if (ids.length > 0) {
        const { data: l } = await admin
          .from("cycle_active_counter")
          .select("*")
          .in("cycle_id", ids);
        locks = (l ?? []) as Lock[];
      }
      const lockByCycle = new Map<string, Lock>();
      locks.forEach((l) => lockByCycle.set(l.cycle_id, l));
      const sessions = (cycles ?? []).map((c) => {
        const lock = lockByCycle.get(c.id);
        const active = lock && !isStale(lock) ? lock : null;
        return {
          ...c,
          active_badge: active ? active.badge_id : null,
          locked_by_me: !!active && active.badge_id === badge,
        };
      });
      return json({ sessions });
    }

    if (action === "verifications") {
      const { data: cycles } = await admin
        .from("cycle_counts")
        .select("id,name,status,due_date,baseline_filename,created_at,archived_at")
        .eq("status", "verifying")
        .is("archived_at", null)
        .order("created_at", { ascending: false });
      const ids = (cycles ?? []).map((c) => c.id);
      let locks: Lock[] = [];
      if (ids.length > 0) {
        const { data: l } = await admin
          .from("cycle_active_counter")
          .select("*")
          .in("cycle_id", ids);
        locks = (l ?? []) as Lock[];
      }
      const lockByCycle = new Map<string, Lock>();
      locks.forEach((l) => lockByCycle.set(l.cycle_id, l));
      const sessions = (cycles ?? []).map((c) => {
        const lock = lockByCycle.get(c.id);
        const active = lock && !isStale(lock) ? lock : null;
        return {
          ...c,
          active_badge: active ? active.badge_id : null,
          locked_by_me: !!active && active.badge_id === badge,
        };
      });
      return json({ sessions });
    }

    if (action === "transmit_count") {
      const { cycle_id } = body;
      if (!cycle_id) return json({ error: "cycle_id required" }, 400);
      if (!(await holdsLock(cycle_id, badge))) {
        return json({ error: "Cycle is in use by another counter", code: "lock_lost" }, 409);
      }
      const { data: cycle } = await admin
        .from("cycle_counts")
        .select("id,status")
        .eq("id", cycle_id)
        .maybeSingle();
      if (!cycle) return json({ error: "Cycle not found" }, 404);
      if (!["draft", "in_progress"].includes(cycle.status)) {
        return json({ error: `Cycle is ${cycle.status} — cannot transmit` }, 400);
      }
      const nowIso = new Date().toISOString();
      const { error: upErr } = await admin
        .from("cycle_counts")
        .update({
          status: "verifying",
          count_ended_at: nowIso,
          verify_started_at: nowIso,
        })
        .eq("id", cycle_id);
      if (upErr) return json({ error: upErr.message }, 500);
      // Release the lock so the cycle is free for the verifier.
      await admin.from("cycle_active_counter").delete().eq("cycle_id", cycle_id);
      return json({ ok: true });
    }

    if (action === "transmit_verification") {
      const { cycle_id } = body;
      if (!cycle_id) return json({ error: "cycle_id required" }, 400);
      if (!(await holdsLock(cycle_id, badge))) {
        return json({ error: "Cycle is in use by another verifier", code: "lock_lost" }, 409);
      }
      const { data: cycle } = await admin
        .from("cycle_counts")
        .select("id,status")
        .eq("id", cycle_id)
        .maybeSingle();
      if (!cycle) return json({ error: "Cycle not found" }, 404);
      if (cycle.status !== "verifying") {
        return json({ error: `Cycle is ${cycle.status} — cannot transmit verification` }, 400);
      }
      const nowIso = new Date().toISOString();
      const { error: upErr } = await admin
        .from("cycle_counts")
        .update({
          status: "verified",
          verify_ended_at: nowIso,
        })
        .eq("id", cycle_id);
      if (upErr) return json({ error: upErr.message }, 500);
      // Release the lock so the cycle disappears from the mobile interface.
      await admin.from("cycle_active_counter").delete().eq("cycle_id", cycle_id);
      return json({ ok: true });
    }

    if (action === "enter") {
      const { cycle_id } = body;
      if (!cycle_id) return json({ error: "cycle_id required" }, 400);
      const { data: cycle } = await admin
        .from("cycle_counts")
        .select("id,status")
        .eq("id", cycle_id)
        .maybeSingle();
      if (!cycle) return json({ error: "Cycle not found" }, 404);
      if (!["draft", "in_progress", "verifying"].includes(cycle.status)) {
        return json({ error: `Cycle is ${cycle.status}` }, 400);
      }
      const r = await acquireOrRefresh(cycle_id, badge, me.user_id);
      if (!r.ok) {
        return json({ error: `In use by badge ${r.active_badge}`, active_badge: r.active_badge }, 409);
      }
      if (cycle.status === "draft") {
        await admin.from("cycle_counts").update({ status: "in_progress", count_started_at: new Date().toISOString() }).eq("id", cycle_id);
      }
      return json({ ok: true });
    }

    if (action === "heartbeat") {
      const { cycle_id } = body;
      if (!cycle_id) return json({ error: "cycle_id required" }, 400);
      const r = await acquireOrRefresh(cycle_id, badge, me.user_id);
      if (!r.ok) return json({ error: `In use by badge ${r.active_badge}`, active_badge: r.active_badge }, 409);
      return json({ ok: true });
    }

    if (action === "exit") {
      const { cycle_id } = body;
      if (!cycle_id) return json({ error: "cycle_id required" }, 400);
      const lock = await getLock(cycle_id);
      if (lock && lock.badge_id === badge) {
        await admin.from("cycle_active_counter").delete().eq("cycle_id", cycle_id);
      }
      return json({ ok: true });
    }

    if (action === "items") {
      const { cycle_id } = body;
      if (!cycle_id) return json({ error: "cycle_id required" }, 400);
      const { data: events } = await admin
        .from("count_events")
        .select("id, item_id, qty_after, qty_before, created_at")
        .eq("cycle_id", cycle_id)
        .order("created_at", { ascending: false })
        .limit(20);
      const itemIds = Array.from(new Set((events ?? []).map((e) => e.item_id).filter(Boolean) as string[]));
      const itemsById = new Map<string, any>();
      if (itemIds.length > 0) {
        const { data: its } = await admin
          .from("count_items")
          .select("id, sku, location, barcode")
          .in("id", itemIds);
        (its ?? []).forEach((it) => itemsById.set(it.id, it));
      }
      const log = (events ?? []).map((e) => {
        const it = e.item_id ? itemsById.get(e.item_id) : null;
        const qty = (e.qty_after ?? 0) - (e.qty_before ?? 0);
        return {
          id: e.id,
          location: it?.location ?? null,
          sku: it?.sku ?? null,
          barcode: it?.barcode ?? null,
          qty,
          at: e.created_at,
        };
      });
      const { data: cycle } = await admin
        .from("cycle_counts")
        .select("id,name,status,count_started_at,count_ended_at,verify_started_at,verify_ended_at,finalized_at")
        .eq("id", cycle_id)
        .maybeSingle();
      return json({ cycle, log });
    }

    if (action === "scan") {
      const { cycle_id, code, qty, client_event_id } = body;
      if (!cycle_id || !code) return json({ error: "cycle_id and code required" }, 400);

      if (!(await holdsLock(cycle_id, badge))) {
        return json({ error: "Cycle is in use by another counter", code: "lock_lost" }, 409);
      }

      const { data: cycle } = await admin
        .from("cycle_counts")
        .select("id,status")
        .eq("id", cycle_id)
        .maybeSingle();
      if (!cycle) return json({ error: "Cycle not found" }, 404);
      if (!["draft", "in_progress", "verifying"].includes(cycle.status)) {
        return json({ error: `Cycle is ${cycle.status}` }, 400);
      }

      const trimmed = String(code).trim();
      const resolved = await resolveCountItem(cycle_id, trimmed, me.user_id, badge);
      if (!resolved) return json({ error: "Could not resolve SKU", code: "invalid_scan" }, 400);
      const item = resolved.item;

      const addQty = Number.isFinite(Number(qty)) ? Number(qty) : 1;
      if (addQty <= 0) return json({ error: "Qty must be positive" }, 400);

      const nowIso = new Date().toISOString();
      const eventId = client_event_id ?? crypto.randomUUID();

      // Atomic increment + idempotent on (cycle_id, client_event_id).
      // Avoids the read/compute/write race that previously dropped concurrent
      // scans (two scans reading the same counted_qty and overwriting each other).
      const { data: newQty, error: rpcErr } = await admin.rpc("mobile_apply_scan", {
        p_cycle_id: cycle_id,
        p_item_id: item.id,
        p_user_id: me.user_id,
        p_add_qty: addQty,
        p_client_event_id: eventId,
        p_action: item.is_unexpected ? "unexpected" : "count",
      });
      if (rpcErr) return json({ error: rpcErr.message }, 500);
      const after = Number(newQty);

      // Refresh lock heartbeat as part of the scan
      await admin
        .from("cycle_active_counter")
        .update({ last_seen_at: nowIso })
        .eq("cycle_id", cycle_id)
        .eq("badge_id", badge);

      return json({
        item: {
          id: item.id,
          sku: item.sku,
          barcode: item.barcode,
          location: item.location,
          counted_qty: after,
          is_unexpected: item.is_unexpected,
        },
        added: addQty,
      });
    }

    if (action === "verify_items") {
      const { cycle_id } = body;
      if (!cycle_id) return json({ error: "cycle_id required" }, 400);
      if (!(await holdsLock(cycle_id, badge))) {
        return json({ error: "Cycle is in use by another counter", code: "lock_lost" }, 409);
      }
      const { data: cycle } = await admin
        .from("cycle_counts")
        .select("id,name,status,baseline_source,count_started_at,count_ended_at,verify_started_at,verify_ended_at,finalized_at")
        .eq("id", cycle_id)
        .maybeSingle();
      if (!cycle) return json({ error: "Cycle not found" }, 404);
      const { data: items } = await admin
        .from("count_items")
        .select("id,sku,barcode,location,description,expected_qty,counted_qty,is_unexpected,mislocated,verified_at")
        .eq("cycle_id", cycle_id)
        .limit(5000);
      const skus = Array.from(new Set((items ?? []).map((i) => i.sku).filter(Boolean) as string[]));
      const masterMap = new Map<string, string | null>();
      if (skus.length) {
        const { data: master } = await admin
          .from("sku_master")
          .select("sku,location")
          .in("sku", skus);
        for (const m of master ?? []) masterMap.set(m.sku, m.location);
      }
      const rows = (items ?? [])
        .filter((i) =>
          i.is_unexpected ||
          (i as any).mislocated ||
          Number(i.expected_qty ?? 0) > 0 ||
          (i.counted_qty != null && Number(i.counted_qty) > 0),
        )
        .map((i) => {
          const expected = Number(i.expected_qty ?? 0);
          const counted = i.counted_qty == null ? null : Number(i.counted_qty);
          const variance = (counted ?? 0) - expected;
          const mislocated = Boolean((i as any).mislocated);
          let kind: "mismatch" | "unexpected" | "mislocated" | "verified" | "uncounted" | "ok" = "ok";
          if (i.verified_at) kind = "verified";
          else if (mislocated) kind = "mislocated";
          else if (i.is_unexpected) kind = "unexpected";
          else if (counted == null || counted === 0) kind = expected > 0 ? "uncounted" : "ok";
          else if (variance !== 0) kind = "mismatch";
          return {
            id: i.id,
            sku: i.sku,
            barcode: i.barcode,
            location: i.location,
            description: i.description,
            expected_qty: expected,
            counted_qty: counted,
            is_unexpected: i.is_unexpected,
            mislocated,
            verified_at: i.verified_at,
            variance,
            kind,
            master_location: i.sku ? masterMap.get(i.sku) ?? null : null,
            in_master: i.sku ? masterMap.has(i.sku) : false,
          };
        })
        .filter((r) => r.kind !== "ok");

      return json({ cycle, rows });
    }

    if (action === "verify_add_entry") {
      const { cycle_id, code, qty } = body;
      if (!cycle_id || !code) return json({ error: "cycle_id and code required" }, 400);
      if (!(await holdsLock(cycle_id, badge))) {
        return json({ error: "Cycle is in use by another counter", code: "lock_lost" }, 409);
      }
      const n = Number(qty);
      if (!Number.isFinite(n) || n < 0) return json({ error: "Qty must be a non-negative number" }, 400);
      const resolved = await resolveCountItem(cycle_id, String(code), me.user_id, badge);
      if (!resolved) return json({ error: "Could not resolve SKU", code: "invalid_scan" }, 400);
      const item = resolved.item;
      const newQty = Number(item.counted_qty ?? 0) + n;
      const nowIso = new Date().toISOString();
      const { error: upErr } = await admin
        .from("count_items")
        .update({
          counted_qty: newQty,
          counted_by: me.user_id,
          counted_at: nowIso,
          status: "counted",
          verified_at: nowIso,
          verified_by: me.user_id,
        })
        .eq("id", item.id)
        .eq("cycle_id", cycle_id);
      if (upErr) return json({ error: upErr.message }, 500);
      await admin.from("count_events").insert({
        cycle_id,
        item_id: item.id,
        user_id: me.user_id,
        action: "verify_add",
        qty_before: Number(item.counted_qty ?? 0),
        qty_after: newQty,
        source: "mobile-verify",
      });
      return json({ ok: true, item: { ...item, counted_qty: newQty } });
    }

    if (action === "verify_item") {
      const { cycle_id, item_id, new_qty } = body;
      if (!cycle_id || !item_id) return json({ error: "cycle_id and item_id required" }, 400);
      if (!(await holdsLock(cycle_id, badge))) {
        return json({ error: "Cycle is in use by another counter", code: "lock_lost" }, 409);
      }

      // Auto-merge: if the item is mislocated and a home-bin counterpart exists
      // in this cycle for the same SKU, fold the counted qty into that row and
      // verify the mislocated row with counted_qty=0. Only applies when no
      // explicit new_qty override was provided.
      if (new_qty == null) {
        const { data: cur } = await admin
          .from("count_items")
          .select("id,sku,counted_qty,mislocated")
          .eq("id", item_id)
          .eq("cycle_id", cycle_id)
          .maybeSingle();
        if (cur && (cur as any).mislocated && cur.sku) {
          const { data: candidates } = await admin
            .from("count_items")
            .select("id,counted_qty,is_unexpected")
            .eq("cycle_id", cycle_id)
            .eq("sku", cur.sku)
            .eq("mislocated", false)
            .neq("id", item_id);
          const home =
            (candidates ?? []).find((c) => !c.is_unexpected) ??
            (candidates ?? [])[0] ??
            null;
          if (home) {
            const addQty = Number(cur.counted_qty ?? 0);
            const newHomeQty = Number(home.counted_qty ?? 0) + addQty;
            const { error: e1 } = await admin
              .from("count_items")
              .update({ counted_qty: newHomeQty, status: "counted" })
              .eq("id", home.id);
            if (e1) return json({ error: e1.message }, 500);
            const { error: e2 } = await admin
              .from("count_items")
              .update({
                counted_qty: 0,
                verified_at: new Date().toISOString(),
                verified_by: me.user_id,
              })
              .eq("id", item_id);
            if (e2) return json({ error: e2.message }, 500);
            return json({ ok: true, merged: true, moved_qty: addQty });
          }
        }
      }

      const patch: Record<string, unknown> = {
        verified_at: new Date().toISOString(),
        verified_by: me.user_id,
      };
      if (new_qty != null && Number.isFinite(Number(new_qty))) {
        patch.counted_qty = Number(new_qty);
        patch.status = "counted";
      }
      const { error } = await admin.from("count_items").update(patch).eq("id", item_id).eq("cycle_id", cycle_id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }


    if (action === "unverify_item") {
      const { cycle_id, item_id } = body;
      if (!cycle_id || !item_id) return json({ error: "cycle_id and item_id required" }, 400);
      if (!(await holdsLock(cycle_id, badge))) {
        return json({ error: "Cycle is in use by another counter", code: "lock_lost" }, 409);
      }
      const { error } = await admin
        .from("count_items")
        .update({ verified_at: null, verified_by: null })
        .eq("id", item_id)
        .eq("cycle_id", cycle_id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
