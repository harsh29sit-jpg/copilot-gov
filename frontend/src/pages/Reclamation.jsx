import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { AlertTriangle, RotateCcw, Send } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

function NotifyDialog() {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState("project");
  const [value, setValue] = useState("");
  const [title, setTitle] = useState("Please confirm continued Copilot usage");
  const [body, setBody] = useState("Reply within 7 days to keep your license, otherwise it will be reclaimed.");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/notifications/bulk", { scope, value, title, body });
      toast.success(`Sent to ${data.sent} users`);
      setOpen(false);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button data-testid="bulk-notify-btn" className="btn-ghost flex items-center gap-1.5"><Send size={12}/> Bulk notify</button>
      </DialogTrigger>
      <DialogContent className="rounded-sm">
        <DialogHeader>
          <DialogTitle className="font-display tracking-tight">Bulk notify license holders</DialogTitle>
          <DialogDescription>Send an in-app notification to license holders in a scope.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="label-cap">Scope</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="mt-1.5 h-10 rounded-sm"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                  <SelectItem value="cost_center">Cost Center</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="label-cap">Value</Label>
              <Input data-testid="notify-value" value={value} onChange={(e) => setValue(e.target.value)} className="mt-1.5 h-10 rounded-sm" placeholder="e.g. Phoenix"/>
            </div>
          </div>
          <div>
            <Label className="label-cap">Title</Label>
            <Input data-testid="notify-title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5 h-10 rounded-sm"/>
          </div>
          <div>
            <Label className="label-cap">Body</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="mt-1.5 rounded-sm"/>
          </div>
        </div>
        <DialogFooter>
          <button onClick={send} disabled={busy || !value} data-testid="confirm-bulk-notify-btn" className="btn-primary">
            {busy ? "Sending…" : "Send notification"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Reclamation() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get("/reclamation/candidates").then((r) => { setRows(r.data); setLoading(false); });
  };
  useEffect(() => { load(); }, []);

  const reclaim = async (id) => {
    try {
      await api.post(`/licenses/${id}/reclaim`);
      toast.success("License reclaimed");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  return (
    <div className="space-y-5" data-testid="reclamation-page">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="label-cap">Reclamation</div>
          <h1 className="font-display text-3xl tracking-tight text-zinc-900 mt-1">Inactive & overdue licenses</h1>
          <p className="text-sm text-zinc-500 mt-1">{rows.length} candidates identified by usage and renewal signals.</p>
        </div>
        <NotifyDialog />
      </div>

      <div className="panel">
        <table className="tbl">
          <thead>
            <tr>
              <th>License</th>
              <th>User</th>
              <th>Project</th>
              <th>Cost Center</th>
              <th>Last renewal</th>
              <th>GitHub activity</th>
              <th>Reasons</th>
              <th className="num">Action</th>
            </tr>
          </thead>
          <tbody data-testid="reclamation-table-body">
            {loading && [...Array(3)].map((_, i) => (
              <tr key={i}><td colSpan={7}><div className="skeleton h-4" /></td></tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-zinc-500">No candidates. License pool is clean.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} data-testid={`reclaim-row-${r.id}`}>
                <td className="font-mono">{r.license_key}</td>
                <td>{r.assigned_user_name}</td>
                <td>{r.project}</td>
                <td className="font-mono text-[12px]">{r.cost_center}</td>
                <td className="font-mono text-[12px]">{r.last_renewal_at ? new Date(r.last_renewal_at).toLocaleDateString() : "—"}</td>
                <td>
                  {r.gh_last_activity_at ? (
                    <span className="text-[12px] text-zinc-700" title={r.gh_last_activity_at}>GitHub confirms {Math.floor((Date.now() - new Date(r.gh_last_activity_at).getTime()) / 86400000)}d idle</span>
                  ) : r.github_username ? (
                    <span className="text-[11px] text-zinc-400">No GitHub activity data</span>
                  ) : <span className="text-[11px] text-zinc-400">Not linked</span>}
                </td>
                <td>
                  <div className="flex gap-1.5 flex-wrap">
                    {r.reclaim_reasons.map((rr) => (
                      <span key={rr} className="pill pill-rejected"><AlertTriangle size={10}/> {rr.replaceAll("_", " ")}</span>
                    ))}
                  </div>
                </td>
                <td className="num">
                  <button onClick={() => reclaim(r.id)} data-testid={`reclaim-license-btn-${r.id}`} className="btn-danger text-[12px] py-1.5 px-3 inline-flex items-center gap-1.5">
                    <RotateCcw size={12}/> Reclaim
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
