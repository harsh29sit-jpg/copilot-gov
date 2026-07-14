import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Search, RotateCcw, RefreshCw, Github } from "lucide-react";

export default function Licenses() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (q) params.set("q", q);
    api.get(`/licenses?${params.toString()}`).then((r) => { setRows(r.data); setLoading(false); });
  };

  useEffect(() => { load(); }, [status]);

  const reclaim = async (id) => {
    try {
      await api.post(`/licenses/${id}/reclaim`);
      toast.success("License reclaimed and returned to pool");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  const resync = async (id) => {
    try {
      const { data } = await api.post(`/licenses/${id}/gh-sync`);
      const st = data?.gh_sync?.sync_status;
      if (st === "synced") toast.success("GitHub seat synced");
      else if (st === "mock") toast.info("GitHub integration disabled (mock mode)");
      else toast.error(`GitHub sync failed: ${data?.gh_sync?.error || "unknown"}`);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  return (
    <div className="space-y-5" data-testid="licenses-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="label-cap">Inventory</div>
          <h1 className="font-display text-3xl tracking-tight text-zinc-900 mt-1">License inventory</h1>
          <p className="text-sm text-zinc-500 mt-1">{rows.length} licenses in current view</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <Input
              data-testid="licenses-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="Search license or user…"
              className="h-9 pl-8 rounded-sm border-zinc-300 w-64"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger data-testid="licenses-status-filter" className="h-9 rounded-sm w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="panel">
        <table className="tbl">
          <thead>
            <tr>
              <th>License</th>
              <th>Status</th>
              <th>Assigned to</th>
              <th>Project</th>
              <th>Cost Center</th>
              <th>Last renewal</th>
              <th>Next renewal</th>
              <th>GitHub</th>
              <th className="num">Actions</th>
            </tr>
          </thead>
          <tbody data-testid="licenses-table-body">
            {loading && [...Array(5)].map((_, i) => (
              <tr key={i}><td colSpan={8}><div className="skeleton h-4" /></td></tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="text-center text-zinc-500 py-8">No licenses found.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} data-testid={`license-row-${r.id}`}>
                <td className="font-mono text-zinc-900">{r.license_key}</td>
                <td><span className={`pill pill-${r.status}`}>{r.status}</span></td>
                <td>{r.assigned_user_name || <span className="text-zinc-400">—</span>}</td>
                <td>{r.project || <span className="text-zinc-400">—</span>}</td>
                <td className="font-mono text-[12px]">{r.cost_center || <span className="text-zinc-400">—</span>}</td>
                <td className="font-mono text-[12px]">{r.last_renewal_at ? new Date(r.last_renewal_at).toLocaleDateString() : "—"}</td>
                <td className="font-mono text-[12px]">{r.next_renewal_due ? new Date(r.next_renewal_due).toLocaleDateString() : "—"}</td>
                <td>
                  {r.status === "assigned" ? (
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-[11px] text-zinc-700 flex items-center gap-1"><Github size={11}/>{r.github_username || <span className="text-zinc-400">—</span>}</span>
                      {r.gh_sync_status === "synced" && <span className="pill pill-assigned text-[10px]">Synced</span>}
                      {r.gh_sync_status === "mock" && <span className="pill pill-available text-[10px]">Mock</span>}
                      {r.gh_sync_status === "failed" && <span className="pill pill-rejected text-[10px]" title={r.gh_sync_message}>Failed: {r.gh_sync_error}</span>}
                      {r.gh_last_activity_at && <span className="text-[10px] text-zinc-500">Active {new Date(r.gh_last_activity_at).toLocaleDateString()}</span>}
                    </div>
                  ) : <span className="text-[11px] text-zinc-400">—</span>}
                </td>
                <td className="num">
                  {r.status === "assigned" ? (
                    <div className="flex items-center gap-1.5 justify-end">
                      <button data-testid={`resync-btn-${r.id}`} onClick={() => resync(r.id)} className="btn-ghost text-[12px] py-1.5 px-2.5 inline-flex items-center gap-1" title="Resync with GitHub">
                        <RefreshCw size={11}/>
                      </button>
                      <button data-testid={`reclaim-btn-${r.id}`} onClick={() => reclaim(r.id)} className="btn-danger text-[12px] py-1.5 px-3 inline-flex items-center gap-1.5">
                        <RotateCcw size={12} /> Reclaim
                      </button>
                    </div>
                  ) : <span className="text-[11px] text-zinc-400">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
