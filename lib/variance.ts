export type VarianceStatus =
  | "match"
  | "short"
  | "over"
  | "unexpected"
  | "uncounted"
  | "mislocated";

export interface VarianceRow {
  id: string;
  sku: string | null;
  barcode: string | null;
  location: string | null;
  description: string | null;
  uom: string | null;
  expected_qty: number;
  counted_qty: number | null;
  is_unexpected: boolean;
  mislocated?: boolean | null;
  variance: number;
  status: VarianceStatus;
}

export function classify(item: {
  expected_qty: number;
  counted_qty: number | null;
  is_unexpected: boolean;
  mislocated?: boolean | null;
  status?: string;
}): VarianceStatus {
  if (item.mislocated) return "mislocated";
  if (item.is_unexpected) return "unexpected";
  if (item.counted_qty == null) return "uncounted";
  const v = item.counted_qty - item.expected_qty;
  if (v === 0) return "match";
  return v < 0 ? "short" : "over";
}

export function toCsv(rows: VarianceRow[]): string {
  const head = [
    "SKU",
    "Barcode",
    "Location",
    "Description",
    "UoM",
    "Expected",
    "Counted",
    "Variance",
    "Status",
  ];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [head.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.sku,
        r.barcode,
        r.location,
        r.description,
        r.uom,
        r.expected_qty,
        r.counted_qty,
        r.variance,
        r.status,
      ]
        .map(escape)
        .join(","),
    );
  }
  return lines.join("\n");
}

export interface SummaryRow extends VarianceRow {
  mislocated?: boolean | null;
  verified_at?: string | null;
}

export function toSummaryCsv(
  rows: SummaryRow[],
  costs: Map<string, number>,
): string {
  const head = [
    "Bin",
    "Part Number",
    "Description",
    "U/M",
    "O.H.",
    "Counted",
    "Variance",
    "Status",
    "Unit $",
    "Variance $",
    "New Qty",
  ];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const filtered = rows
    .filter(
      (i) =>
        !(i.mislocated && i.verified_at && (i.counted_qty ?? 0) === 0),
    )
    .filter(
      (i) =>
        i.is_unexpected ||
        Number(i.expected_qty ?? 0) > 0 ||
        (i.counted_qty != null && Number(i.counted_qty) > 0),
    );
  const lines = [head.join(",")];
  for (const r of filtered) {
    const unit = r.sku ? costs.get(r.sku) ?? 0 : 0;
    const varianceValue = r.variance * unit;
    const newQty = r.counted_qty ?? r.expected_qty;
    lines.push(
      [
        r.location,
        r.sku,
        r.description,
        r.uom,
        r.expected_qty,
        r.counted_qty,
        r.variance,
        r.status,
        unit ? unit.toFixed(2) : "",
        varianceValue ? varianceValue.toFixed(2) : "",
        newQty,
      ]
        .map(escape)
        .join(","),
    );
  }
  return lines.join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
