import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Search, Download } from "lucide-react";

const ACTION_COLORS = {
  "request.created": "bg-blue-50 text-blue-700 border-blue-200",
  "request.approved": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "request.rejected": "bg-red-50 text-red-700 border-red-200",
  "license.assigned": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "license.released": "bg-violet-50 text-violet-700 border-violet-200",
  "license.reclaimed": "bg-red-50 text-red-700 border-red-200",
  "license.renewed": "bg-blue-50 text-blue-700 border-blue-200",
  "license.transferred": "bg-amber-50 text-amber-700 border-amber-200",
  "notification.bulk_sent": "bg-zinc-50 text-zinc-700 border-zinc-200",
};

export default function Audit() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    api.get(`/audit?${params.toString()}`).then((r) => { setRows(r.data); setLoading(false); });
  };
  useEffect(() => { load(); }, []);

  const exportCsv = () => {
    const header = ["timestamp", "actor_name", "actor_email", "action", "target_type", "target_id"];
    const lines = [header.join(",")].concat(rows.map((r) =>
      header.map((h) => `"${String(r[h] || "").replaceAll('"', '""')}"`).join(",")
    ));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "audit-log.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5" data-testid="audit-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="label-cap">Audit</div>
          <h1 className="font-display text-3xl tracking-tight text-zinc-900 mt-1">Activity log</h1>
          <p className="text-sm text-zinc-500 mt-1">Every state change is captured.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              data-testid="audit-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="Search actor, action, target…"
              className="h-9 pl-8 rounded-sm w-72"
            />
          </div>
          <button data-testid="audit-search-btn" onClick={load} className="btn-ghost">Search</button>
          <button data-testid="audit-export-btn" onClick={exportCsv} className="btn-ghost flex items-center gap-1.5">
            <Download size={12}/> Export CSV
          </button>
        </div>
      </div>

      <div className="panel">
        <table className="tbl">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target</th>
              <th>Meta</th>
            </tr>
          </thead>
          <tbody data-testid="audit-table-body">
            {loading && [...Array(5)].map((_, i) => (<tr key={i}><td colSpan={5}><div className="skeleton h-4"/></td></tr>))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-zinc-500">No matching audit entries.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-mono text-[12px] text-zinc-700">{new Date(r.timestamp).toLocaleString()}</td>
                <td>
                  <div className="text-[13px] text-zinc-900">{r.actor_name || "—"}</div>
                  <div className="text-[11px] text-zinc-500 font-mono">{r.actor_email}</div>
                </td>
                <td>
                  <span className={`pill border ${ACTION_COLORS[r.action] || "bg-zinc-50 text-zinc-700 border-zinc-200"}`}>{r.action}</span>
                </td>
                <td className="font-mono text-[12px] text-zinc-700">{r.target_type}/{r.target_id.slice(0, 8)}</td>
                <td className="font-mono text-[11px] text-zinc-600">{Object.keys(r.meta || {}).length ? JSON.stringify(r.meta) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
