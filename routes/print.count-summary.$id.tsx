import { createFileRoute, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { classify, type VarianceStatus } from "@/lib/variance";
import { compareSkuLex } from "@/lib/sku-sequence";
import { fetchSkuCostsFor } from "@/lib/sku-costs";

export const Route = createFileRoute("/print/count-summary/$id")({
  component: PrintCountSummary,
  validateSearch: (s: Record<string, unknown>) => ({
    status: typeof s.status === "string" ? s.status : undefined,
  }),
});

interface Item {
  id: string;
  sku: string | null;
  description: string | null;
  location: string | null;
  uom: string | null;
  expected_qty: number;
  counted_qty: number | null;
  is_unexpected: boolean;
  mislocated: boolean;
  verified_at: string | null;
}

const LABEL: Record<VarianceStatus, string> = {
  match: "Match",
  short: "Short",
  over: "Over",
  unexpected: "Unexpected",
  uncounted: "Uncounted",
  mislocated: "Mislocated",
};

function PrintCountSummary() {
  const { id } = useParams({ from: "/print/count-summary/$id" });
  const search = useSearch({ from: "/print/count-summary/$id" });
  const [cycleName, setCycleName] = useState("");
  const [cycleStatus, setCycleStatus] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [costs, setCosts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  const allowedStatuses = useMemo<Set<VarianceStatus> | null>(() => {
    if (!search.status) return null;
    const parts = search.status.split(",").map((p: string) => p.trim()) as VarianceStatus[];
    return new Set(parts);
  }, [search.status]);

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: its }] = await Promise.all([
        supabase.from("cycle_counts").select("name,status").eq("id", id).single(),
        supabase
          .from("count_items")
          .select("id,sku,description,location,uom,expected_qty,counted_qty,is_unexpected,mislocated,verified_at")
          .eq("cycle_id", id)
          .limit(5000),
      ]);
      const costMap = await fetchSkuCostsFor((its ?? []).map((i: any) => i.sku));
      setCycleName(c?.name ?? "");
      setCycleStatus(c?.status ?? "");
      setCosts(costMap);
      setItems((its ?? []) as Item[]);
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [loading]);

  const rows = useMemo(() => {
    return items
      .filter(
        (i) =>
          // Hide merged-into-home-bin ghost rows (mislocated rows folded into
          // their home counterpart leave a verified row with counted_qty=0).
          !(i.mislocated && i.verified_at && (i.counted_qty ?? 0) === 0),
      )
      .filter(
        (i) =>
          i.is_unexpected ||
          Number(i.expected_qty) > 0 ||
          (i.counted_qty != null && Number(i.counted_qty) > 0),
      )
      .map((i) => {
        const variance = (i.counted_qty ?? 0) - i.expected_qty;
        const status = classify(i);
        const unit = i.sku ? costs.get(i.sku) ?? 0 : 0;
        const newQty = i.counted_qty ?? i.expected_qty;
        return {
          ...i,
          variance,
          status,
          unit_cost: unit,
          variance_value: variance * unit,
          new_qty: newQty,
        };
      })
      .filter((r) => (allowedStatuses ? allowedStatuses.has(r.status) : true))
      .sort((a, b) => compareSkuLex(a.sku, b.sku));
  }, [items, allowedStatuses, costs]);

  const totals = useMemo(() => {
    const t = { match: 0, short: 0, over: 0, unexpected: 0, uncounted: 0, mislocated: 0, varianceValue: 0 };
    for (const r of rows) {
      t[r.status]++;
      t.varianceValue += r.variance_value;
    }
    return t;
  }, [rows]);

  if (loading) return <div className="p-8 text-sm">Loading…</div>;

  return (
    <div className="min-h-screen bg-white p-8 font-mono text-black print:p-4">
      <style>{`
        @media print {
          @page { size: letter; margin: 0.35in; }
        }
      `}</style>
      <div className="mb-3 flex items-start justify-between border-b-2 border-black pb-2">
        <div>
          <h1 className="text-lg font-bold uppercase tracking-wide">Count Summary Report</h1>
          <div className="mt-0.5 text-[11px]">
            Cycle: <span className="font-bold">{cycleName}</span> · Status: {cycleStatus} · Printed{" "}
            {new Date().toLocaleString()} · {rows.length} line items
            {allowedStatuses && ` · filter: ${[...allowedStatuses].join(", ")}`}
          </div>
        </div>
        <div className="text-right text-[11px]">
          <div>Finalized By: ____________________</div>
          <div className="mt-1">Date: ______________</div>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-6 gap-2 text-[10px]">
        <Stat label="Match" v={totals.match} />
        <Stat label="Short" v={totals.short} />
        <Stat label="Over" v={totals.over} />
        <Stat label="Unexpected" v={totals.unexpected} />
        <Stat label="Uncounted" v={totals.uncounted} />
        <Stat label="Variance $" v={`$${totals.varianceValue.toFixed(2)}`} />
      </div>

      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-b-2 border-black text-left uppercase tracking-wide">
            <th className="px-2 py-1">Bin</th>
            <th className="px-2 py-1">Part Number</th>
            <th className="px-2 py-1">Description</th>
            <th className="px-2 py-1">U/M</th>
            <th className="px-2 py-1 text-right">O.H.</th>
            <th className="px-2 py-1 text-right">Counted</th>
            <th className="px-2 py-1 text-right">Var</th>
            <th className="px-2 py-1">Status</th>
            <th className="px-2 py-1 text-right">Unit $</th>
            <th className="px-2 py-1 text-right">Var $</th>
            <th className="px-2 py-1 text-right">New Qty</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-gray-400">
              <td className="px-2 py-0.5">{r.location ?? "—"}</td>
              <td className="whitespace-nowrap px-2 py-0.5">{r.sku ?? "—"}</td>
              <td className="px-2 py-0.5">{r.description ?? "—"}</td>
              <td className="px-2 py-0.5">{r.uom ?? "—"}</td>
              <td className="px-2 py-0.5 text-right">{r.expected_qty}</td>
              <td className="px-2 py-0.5 text-right">{r.counted_qty ?? "—"}</td>
              <td className="px-2 py-0.5 text-right font-semibold">
                {r.variance > 0 ? `+${r.variance}` : r.variance}
              </td>
              <td className="px-2 py-0.5">{LABEL[r.status]}</td>
              <td className="px-2 py-0.5 text-right">
                {r.unit_cost ? `$${r.unit_cost.toFixed(2)}` : "—"}
              </td>
              <td className="px-2 py-0.5 text-right">
                {r.variance_value ? `$${r.variance_value.toFixed(2)}` : "—"}
              </td>
              <td className="px-2 py-0.5 text-right font-semibold">{r.new_qty}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={11} className="px-2 py-6 text-center text-gray-500">
                No items match filter.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="mt-3 border-t-2 border-black pt-2 text-center text-[11px] uppercase tracking-wide">
        *** Total Line Items: {rows.length} ***
      </div>

      <div className="no-print mt-6 text-center">
        <button
          onClick={() => window.print()}
          className="rounded-md bg-black px-4 py-2 text-sm text-white"
        >
          Print
        </button>
      </div>
    </div>
  );
}

function Stat({ label, v }: { label: string; v: number | string }) {
  return (
    <div className="border border-black px-2 py-1">
      <div className="text-[9px] uppercase text-gray-600">{label}</div>
      <div className="text-sm font-bold">{v}</div>
    </div>
  );
}
