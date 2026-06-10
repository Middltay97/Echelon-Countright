import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { callMobile, useBadge } from "@/lib/mobile-api";

import { compareSkuLex } from "@/lib/sku-sequence";
import { MobileHeader, MobileIconButton } from "@/components/mobile-header";
import { recoverFromChunkLoadError } from "@/lib/chunk-recovery";


export const Route = createFileRoute("/m/verify/$id")({
  component: VerifyScreen,
  errorComponent: VerifyError,
});

function VerifyError({ error, reset }: { error: Error; reset: () => void }) {
  if (recoverFromChunkLoadError(error)) return null;
  return (
    <div className="min-h-dvh bg-background flex items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold text-foreground">Verification couldn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground break-words">{error.message}</p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={reset}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
          <a
            href="/m/verifications"
            className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground"
          >
            Back to verifications
          </a>
        </div>
      </div>
    </div>
  );
}

interface Row {
  id: string;
  sku: string | null;
  barcode: string | null;
  location: string | null;
  description: string | null;
  expected_qty: number;
  counted_qty: number | null;
  is_unexpected: boolean;
  mislocated?: boolean;
  verified_at: string | null;
  variance: number;
  kind: "mismatch" | "unexpected" | "mislocated" | "verified" | "uncounted";
  master_location: string | null;
  in_master: boolean;
}

type Tab = "short" | "over" | "unexpected" | "mislocated" | "uncounted" | "verified";


function VerifyScreen() {
  const { id: cycleId } = useParams({ from: "/m/verify/$id" });
  const navigate = useNavigate();
  const badge = useBadge();

  const [cycleName, setCycleName] = useState("");
  const [verifyStartedAt, setVerifyStartedAt] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<Tab>("short");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [addCode, setAddCode] = useState("");
  const [addQty, setAddQty] = useState("1");
  const [addBusy, setAddBusy] = useState(false);
  const [sortAlpha, setSortAlpha] = useState(false);
  const [transmitting, setTransmitting] = useState(false);


  const load = useCallback(async () => {
    if (!badge) return;
    try {
      const d = await callMobile<{ cycle: { name: string; verify_started_at?: string | null }; rows: Row[] }>(
        "verify_items",
        { badge, cycle_id: cycleId },
      );
      setCycleName(d.cycle?.name ?? "");
      setVerifyStartedAt(d.cycle?.verify_started_at ?? null);
      setRows(d.rows);
    } catch (e) {
      toast.error((e as Error).message);
      navigate({ to: "/m/verifications" });
    } finally {
      setLoading(false);
    }
  }, [badge, cycleId, navigate]);

  useEffect(() => {
    if (badge === undefined) return; // not yet hydrated
    if (!badge) {
      navigate({ to: "/m" });
      return;
    }

    let cancelled = false;
    let hbTimer: ReturnType<typeof setInterval> | null = null;

    (async () => {
      try {
        await callMobile("enter", { badge, cycle_id: cycleId });
      } catch (e) {
        toast.error((e as Error).message);
        navigate({ to: "/m/verifications" });
        return;
      }
      if (cancelled) return;
      await load();
      hbTimer = setInterval(() => {
        callMobile("heartbeat", { badge, cycle_id: cycleId }).catch((e) => {
          toast.error((e as Error).message);
          navigate({ to: "/m/verifications" });
        });
      }, 60_000);
    })();

    const releaseOnUnload = () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mobile-counter`;
        const blob = new Blob(
          [JSON.stringify({ action: "exit", badge, cycle_id: cycleId })],
          { type: "application/json" },
        );
        navigator.sendBeacon?.(url, blob);
      } catch {
        // best-effort
      }
    };
    window.addEventListener("beforeunload", releaseOnUnload);

    return () => {
      cancelled = true;
      if (hbTimer) clearInterval(hbTimer);
      window.removeEventListener("beforeunload", releaseOnUnload);
      callMobile("exit", { badge, cycle_id: cycleId }).catch(() => {});
    };
  }, [badge, cycleId, navigate, load]);

  const groups = useMemo(
    () => ({
      short: rows.filter((r) => r.kind === "mismatch" && r.variance < 0),
      over: rows.filter((r) => r.kind === "mismatch" && r.variance > 0),
      unexpected: rows.filter((r) => r.kind === "unexpected"),
      mislocated: rows.filter((r) => r.kind === "mislocated"),
      uncounted: rows.filter((r) => r.kind === "uncounted"),
      verified: rows.filter((r) => r.kind === "verified"),
    }),
    [rows],
  );

  const visible = useMemo(() => {
    const base =
      tab === "short"
        ? groups.short
        : tab === "over"
          ? groups.over
          : tab === "unexpected"
            ? groups.unexpected
            : tab === "mislocated"
              ? groups.mislocated
              : tab === "uncounted"
                ? groups.uncounted
                : groups.verified;
    return sortAlpha ? [...base].sort((a, b) => compareSkuLex(a.sku, b.sku)) : base;
  }, [tab, groups, sortAlpha]);



  // Recompute a row's `kind` and `variance` after a local edit so it lands
  // in the right tab without a server round-trip.
  const recomputeKind = (r: Row): Row => {
    if (r.verified_at) return { ...r, kind: "verified", variance: (r.counted_qty ?? 0) - r.expected_qty };
    if (r.mislocated) return { ...r, kind: "mislocated", variance: (r.counted_qty ?? 0) - r.expected_qty };
    if (r.is_unexpected) return { ...r, kind: "unexpected", variance: (r.counted_qty ?? 0) - r.expected_qty };
    if (r.counted_qty == null) return { ...r, kind: "uncounted", variance: 0 - r.expected_qty };
    const v = r.counted_qty - r.expected_qty;
    if (v === 0) return { ...r, kind: "verified", variance: 0 };
    return { ...r, kind: "mismatch", variance: v };
  };

  const verify = (r: Row, newQty?: number) => {
    if (!badge) return;
    setBusyId(r.id);
    const prev = rows;
    const nowIso = new Date().toISOString();
    setRows((rs) =>
      rs.map((x) =>
        x.id === r.id
          ? recomputeKind({
              ...x,
              counted_qty: newQty != null ? newQty : x.counted_qty,
              verified_at: nowIso,
            })
          : x,
      ),
    );
    setEdits((e) => {
      const n = { ...e };
      delete n[r.id];
      return n;
    });
    void (async () => {
      try {
        await callMobile("verify_item", {
          badge,
          cycle_id: cycleId,
          item_id: r.id,
          new_qty: newQty,
        });
      } catch (e) {
        setRows(prev);
        toast.error((e as Error).message);
      } finally {
        setBusyId((b) => (b === r.id ? null : b));
      }
    })();
  };

  const undo = (r: Row) => {
    if (!badge) return;
    setBusyId(r.id);
    const prev = rows;
    setRows((rs) =>
      rs.map((x) =>
        x.id === r.id ? recomputeKind({ ...x, verified_at: null }) : x,
      ),
    );
    void (async () => {
      try {
        await callMobile("unverify_item", { badge, cycle_id: cycleId, item_id: r.id });
      } catch (e) {
        setRows(prev);
        toast.error((e as Error).message);
      } finally {
        setBusyId((b) => (b === r.id ? null : b));
      }
    })();
  };

  const addEntry = async () => {
    const code = addCode.trim();
    const n = Number(addQty);
    if (!code) return toast.error("Enter a SKU or barcode");
    if (!Number.isFinite(n) || n < 0) return toast.error("Enter a non-negative quantity");
    setAddBusy(true);
    try {
      const res = await callMobile<{ item: { sku: string | null } }>("verify_add_entry", {
        badge,
        cycle_id: cycleId,
        code,
        qty: n,
      });
      toast.success(`Added ${res.item?.sku ?? code} (+${n})`);
      setAddCode("");
      setAddQty("1");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAddBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background pb-6">
      <MobileHeader
        title={cycleName || "Verify"}
        subtitle={verifyStartedAt ? `Verify started ${new Date(verifyStartedAt).toLocaleString()}` : undefined}
        left={
          <MobileIconButton onClick={() => navigate({ to: "/m/verifications" })} ariaLabel="Back">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </MobileIconButton>
        }
        right={
          <MobileIconButton
            onClick={async () => {
              if (!badge) return;
              if (!confirm("Transmit this verification? The cycle will be marked verified and removed from this device. Finalization is still done in the main program.")) return;
              setTransmitting(true);
              try {
                await callMobile("transmit_verification", { badge, cycle_id: cycleId });
                toast.success("Verification transmitted");
                navigate({ to: "/m/verifications" });
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setTransmitting(false);
              }
            }}
            ariaLabel="Transmit verification"
            title="Transmit verification"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
            </svg>
          </MobileIconButton>
        }
      />
      {transmitting && <div className="px-4 pt-2 text-xs text-muted-foreground">Transmitting…</div>}

      <div className="px-4 pt-4">
        <h1 className="text-lg font-semibold text-foreground">Verify counts</h1>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <TabBtn label="Short" count={groups.short.length} active={tab === "short"} onClick={() => setTab("short")} tone="text-destructive" />
        <TabBtn label="Over" count={groups.over.length} active={tab === "over"} onClick={() => setTab("over")} tone="text-warning-foreground" />
        <TabBtn label="Unexpected" count={groups.unexpected.length} active={tab === "unexpected"} onClick={() => setTab("unexpected")} tone="text-primary" />
        <TabBtn label="Mislocated" count={groups.mislocated.length} active={tab === "mislocated"} onClick={() => setTab("mislocated")} tone="text-warning-foreground" />
        <TabBtn label="Uncounted" count={groups.uncounted.length} active={tab === "uncounted"} onClick={() => setTab("uncounted")} tone="text-warning-foreground" />
        <TabBtn label="Verified" count={groups.verified.length} active={tab === "verified"} onClick={() => setTab("verified")} tone="text-success" />
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={sortAlpha}
          onChange={(e) => setSortAlpha(e.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        Sort A–Z by SKU
      </label>



      <div className="mt-3 rounded-lg border border-border bg-card p-3">
        <div className="text-xs font-medium uppercase text-muted-foreground">Add entry</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={addCode}
            onChange={(e) => setAddCode(e.target.value)}
            placeholder="SKU or scan"
            className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-2 text-sm"
          />
          <input
            type="number"
            inputMode="decimal"
            value={addQty}
            onChange={(e) => setAddQty(e.target.value)}
            className="w-20 rounded-md border border-input bg-background px-2 py-2 text-sm"
          />
          <button
            onClick={addEntry}
            disabled={addBusy || !addCode.trim()}
            className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Add
          </button>
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground">
          Resolves through the canonical SKU resolver and marks the item verified.
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!loading && visible.length === 0 && (
          <div className="rounded-md border border-border bg-card p-4 text-center text-sm text-muted-foreground">
            {tab === "verified" ? "Nothing verified yet." : "Nothing to review here. 🎉"}
          </div>
        )}
        {visible.map((r) => {
          const editVal = edits[r.id] ?? "";
          return (
            <div key={r.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate">{r.sku ?? r.barcode ?? "—"}</div>
                  {r.barcode && r.sku && (
                    <div className="text-xs text-muted-foreground">{r.barcode}</div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {r.location ?? "—"}
                    {r.is_unexpected && r.in_master && r.master_location && r.master_location !== r.location && (
                      <span className="ml-1 text-primary">→ assigned {r.master_location}</span>
                    )}
                    {r.is_unexpected && !r.in_master && (
                      <span className="ml-1 text-destructive">· not in master</span>
                    )}
                  </div>
                </div>
                {r.mislocated ? (
                  <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium uppercase text-warning-foreground">
                    Mislocated
                  </span>
                ) : r.is_unexpected ? (
                  <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase text-primary">
                    Unexpected
                  </span>
                ) : null}

              </div>

              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                <Stat label="Expected" value={r.expected_qty} />
                <Stat label="Counted" value={r.counted_qty ?? "—"} />
                <Stat
                  label="Variance"
                  value={r.variance > 0 ? `+${r.variance}` : r.variance}
                  tone={r.variance < 0 ? "text-destructive" : r.variance > 0 ? "text-warning-foreground" : ""}
                />
              </div>

              {tab === "verified" ? (
                <div className="mt-3 flex items-center justify-between">
                  <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">Verified</span>
                  <button
                    onClick={() => undo(r)}
                    disabled={busyId === r.id}
                    className="text-xs text-muted-foreground hover:underline disabled:opacity-50"
                  >
                    Undo
                  </button>
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={editVal}
                    onChange={(e) => setEdits((s) => ({ ...s, [r.id]: e.target.value }))}
                    placeholder="Adjust"
                    className="w-20 rounded-md border border-input bg-background px-2 py-2 text-sm"
                  />
                  <button
                    onClick={() => {
                      const n = Number(editVal);
                      if (editVal === "" || Number.isNaN(n)) return toast.error("Enter a number");
                      verify(r, n);
                    }}
                    disabled={busyId === r.id || editVal === ""}
                    className="rounded-md border border-border px-2 py-2 text-xs hover:bg-accent disabled:opacity-50"
                  >
                    Adjust & verify
                  </button>
                  <button
                    onClick={() => verify(r)}
                    disabled={busyId === r.id}
                    className="ml-auto rounded-md bg-success px-3 py-2 text-xs font-medium text-success-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    Accept
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

function TabBtn({
  label,
  count,
  active,
  onClick,
  tone,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  tone: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border p-2 text-center transition ${
        active ? "border-primary bg-primary/5" : "border-border bg-card"
      }`}
    >
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${tone}`}>{count}</div>
    </button>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-md bg-muted/40 p-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
