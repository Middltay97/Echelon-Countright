import { createFileRoute, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { compareSkuLex } from "@/lib/sku-sequence";


export const Route = createFileRoute("/print/count-sheet/$id")({
  validateSearch: (s: Record<string, unknown>) => ({
    all: s.all === "1" || s.all === 1 || s.all === true ? 1 : 0,
  }),
  component: PrintCountSheet,
});

interface Item {
  id: string;
  sku: string | null;
  description: string | null;
  location: string | null;
  uom: string | null;
  expected_qty: number;
}

function PrintCountSheet() {
  const { id } = useParams({ from: "/print/count-sheet/$id" });
  const { all } = useSearch({ from: "/print/count-sheet/$id" });
  const includeZero = all === 1;
  const [cycleName, setCycleName] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: its }] = await Promise.all([
        supabase.from("cycle_counts").select("name").eq("id", id).single(),
        supabase
          .from("count_items")
          .select("id,sku,description,location,uom,expected_qty")
          .eq("cycle_id", id)
          .limit(5000),
      ]);
      setCycleName(c?.name ?? "");
      const filtered = (its ?? [])
        .filter((i) => (includeZero ? true : Number(i.expected_qty) > 0))
        .sort((a, b) => compareSkuLex(a.sku, b.sku));

      setItems(filtered as Item[]);
      setLoading(false);
    })();
  }, [id, includeZero]);

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
          .page-break { page-break-after: always; }
        }
      `}</style>
      <div className="mb-3 flex items-start justify-between border-b-2 border-black pb-2">
        <div>
          <h1 className="text-lg font-bold uppercase tracking-wide">
            {includeZero ? "Full Bin Sheet" : "Parts by Bin Location"}
          </h1>
          <div className="mt-0.5 text-[11px]">
            Cycle: <span className="font-bold">{cycleName}</span> · Printed{" "}
            {new Date().toLocaleString()} · {items.length} line items
            {includeZero ? " (includes zero-qty bins)" : ""}
          </div>
        </div>
        <div className="text-right text-[11px]">
          <div>Counter: ____________________</div>
          <div className="mt-1">Date: ______________</div>
          <div className="mt-1">Signature: __________________</div>
        </div>
      </div>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-b-2 border-black text-left uppercase tracking-wide">
            <th className="px-2 py-1">Bin</th>
            <th className="px-2 py-1">Part Number</th>
            <th className="px-2 py-1">Description</th>
            <th className="px-2 py-1">U/M</th>
            <th className="px-2 py-1 text-right">O.H.</th>
            <th className="px-2 py-1 text-right">Count</th>
            <th className="px-2 py-1 text-center">Init</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-b border-gray-400">
              <td className="px-2 py-0.5">{i.location ?? "—"}</td>
              <td className="whitespace-nowrap px-2 py-0.5">{i.sku ?? "—"}</td>
              <td className="px-2 py-0.5 truncate">{i.description ?? "—"}</td>
              <td className="px-2 py-0.5">{i.uom ?? "—"}</td>
              <td className="px-2 py-0.5 text-right">{i.expected_qty}</td>
              <td className="px-2 py-0.5 text-right">
                <span className="inline-block min-w-[60px] border-b border-black">&nbsp;</span>
              </td>
              <td className="px-2 py-0.5 text-center">
                <span className="inline-block min-w-[40px] border-b border-black">&nbsp;</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 border-t-2 border-black pt-2 text-center text-[11px] uppercase tracking-wide">
        *** Total Line Items: {items.length} ***
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
