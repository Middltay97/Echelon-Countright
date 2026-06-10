import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { outOfSequenceIndices } from "@/lib/sku-sequence";
import { fetchUserNames } from "@/lib/user-names";

export const Route = createFileRoute("/print/out-of-sequence/$id")({
  component: PrintOutOfSequence,
});

interface EventRow {
  id: string;
  created_at: string;
  user_id: string;
  qty_after: number | null;
  qty_before: number | null;
  action: string;
  item: {
    sku: string | null;
    barcode: string | null;
    location: string | null;
    description: string | null;
  } | null;
}

interface FlaggedRow {
  id: string;
  at: string;
  counter: string;
  location: string | null;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  qty: number;
  prevSku: string | null;
  prevAt: string;
}

function PrintOutOfSequence() {
  const { id } = useParams({ from: "/print/out-of-sequence/$id" });
  const [cycleName, setCycleName] = useState("");
  const [rows, setRows] = useState<FlaggedRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: ev }] = await Promise.all([
        supabase.from("cycle_counts").select("name").eq("id", id).single(),
        supabase
          .from("count_events")
          .select(
            "id,created_at,user_id,qty_after,qty_before,action,item:count_items(sku,barcode,location,description)",
          )
          .eq("cycle_id", id)
          .order("created_at", { ascending: false })
          .limit(10000),
      ]);
      setCycleName(c?.name ?? "");

      const events = (ev ?? []) as unknown as EventRow[];
      const names = await fetchUserNames(events.map((e) => e.user_id));

      // Group by counter, log is newest-first (matches mobile UI order)
      const byUser = new Map<string, EventRow[]>();
      for (const e of events) {
        if (!byUser.has(e.user_id)) byUser.set(e.user_id, []);
        byUser.get(e.user_id)!.push(e);
      }

      const flagged: FlaggedRow[] = [];
      for (const [uid, log] of byUser) {
        const oos = outOfSequenceIndices(
          log.map((e) => ({ sku: e.item?.sku ?? null, barcode: e.item?.barcode ?? null })),
        );
        for (const i of oos) {
          const cur = log[i];
          const prev = log[i + 1];
          const qty =
            (cur.qty_after ?? 0) - (cur.qty_before ?? 0);
          flagged.push({
            id: cur.id,
            at: cur.created_at,
            counter: names.get(uid) ?? "—",
            location: cur.item?.location ?? null,
            sku: cur.item?.sku ?? null,
            barcode: cur.item?.barcode ?? null,
            description: cur.item?.description ?? null,
            qty,
            prevSku: prev?.item?.sku ?? prev?.item?.barcode ?? null,
            prevAt: prev?.created_at ?? "",
          });
        }
      }

      flagged.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
      setRows(flagged);
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [loading]);

  if (loading) return <div className="p-8 text-sm">Loading…</div>;

  return (
    <div className="min-h-screen bg-white p-8 font-mono text-black print:p-4">
      <style>{`
        @media print {
          @page { size: letter; margin: 0.4in; }
        }
      `}</style>
      <div className="mb-3 flex items-start justify-between border-b-2 border-black pb-2">
        <div>
          <h1 className="text-lg font-bold uppercase tracking-wide">
            Out-of-Sequence Scan Report
          </h1>
          <div className="mt-0.5 text-[11px]">
            Cycle: <span className="font-bold">{cycleName}</span> · Printed{" "}
            {new Date().toLocaleString()} · {rows.length} flagged scan
            {rows.length === 1 ? "" : "s"}
          </div>
          <div className="mt-0.5 text-[10px] text-gray-700">
            Each row was scanned out of alpha-numeric order relative to the counter's previous scan
            (same warnings shown on the scanner/mobile interface).
          </div>
        </div>
        <div className="text-right text-[11px]">
          <div>Reviewer: ____________________</div>
          <div className="mt-1">Date: ______________</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-10 text-center text-sm">
          No out-of-sequence scans detected for this cycle.
        </div>
      ) : (
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b-2 border-black text-left uppercase tracking-wide">
              <th className="px-2 py-1">When</th>
              <th className="px-2 py-1">Counter</th>
              <th className="px-2 py-1">Bin</th>
              <th className="px-2 py-1">Part Number</th>
              <th className="px-2 py-1">Description</th>
              <th className="px-2 py-1 text-right">Qty</th>
              <th className="px-2 py-1">Previous Scan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-gray-400">
                <td className="whitespace-nowrap px-2 py-0.5">
                  {new Date(r.at).toLocaleString()}
                </td>
                <td className="px-2 py-0.5">{r.counter}</td>
                <td className="px-2 py-0.5">{r.location ?? "—"}</td>
                <td className="whitespace-nowrap px-2 py-0.5">
                  ⚠ {r.sku ?? r.barcode ?? "—"}
                </td>
                <td className="px-2 py-0.5 truncate">{r.description ?? "—"}</td>
                <td className="px-2 py-0.5 text-right">{r.qty}</td>
                <td className="whitespace-nowrap px-2 py-0.5 text-gray-700">
                  {r.prevSku ?? "—"}
                  {r.prevAt
                    ? ` @ ${new Date(r.prevAt).toLocaleTimeString()}`
                    : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-4 border-t-2 border-black pt-2 text-center text-[11px] uppercase tracking-wide">
        *** Total Out-of-Sequence Scans: {rows.length} ***
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
