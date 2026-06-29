import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { Plus } from "lucide-react";

export default function MyRequests() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => api.get("/requests/mine").then((r) => { setRows(r.data); setLoading(false); });
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-5" data-testid="my-requests-page">
      <div className="flex items-end justify-between">
        <div>
          <div className="label-cap">My requests</div>
          <h1 className="font-display text-3xl tracking-tight text-zinc-900 mt-1">Copilot access history</h1>
        </div>
        <Link to="/my-requests/new" data-testid="new-request-btn" className="btn-primary flex items-center gap-1.5">
          <Plus size={14} /> New request
        </Link>
      </div>

      <div className="panel">
        <table className="tbl">
          <thead>
            <tr>
              <th>Submitted</th>
              <th>Project</th>
              <th>Team</th>
              <th>Cost Center</th>
              <th>Status</th>
              <th>Comments</th>
            </tr>
          </thead>
          <tbody data-testid="my-requests-table-body">
            {loading && [...Array(3)].map((_, i) => (
              <tr key={i}><td colSpan={6}><div className="skeleton h-4 w-full" /></td></tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="text-center text-zinc-500 py-8">No requests yet. Submit your first request.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} data-testid={`request-row-${r.id}`}>
                <td className="font-mono text-[12px] text-zinc-700">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="text-zinc-900">{r.project}</td>
                <td className="text-zinc-700">{r.team}</td>
                <td className="font-mono text-[12px] text-zinc-700">{r.cost_center}</td>
                <td><span className={`pill pill-${r.status}`}>{r.status}</span></td>
                <td className="text-zinc-600 text-[12.5px]">{r.comments || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
