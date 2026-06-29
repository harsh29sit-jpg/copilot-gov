import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

function DecisionDialog({ req, onDone }) {
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState(null);
  const [comments, setComments] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/requests/${req.id}/decide`, { decision, comments });
      toast.success(decision === "approved" ? "Request approved & license assigned" : "Request rejected");
      setOpen(false); setDecision(null); setComments("");
      onDone();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button data-testid={`review-btn-${req.id}`} className="btn-ghost text-[12px] py-1.5 px-3">Review</button>
      </DialogTrigger>
      <DialogContent className="rounded-sm">
        <DialogHeader>
          <DialogTitle className="font-display tracking-tight">Review request</DialogTitle>
          <DialogDescription>
            From <strong>{req.employee_name}</strong> · {req.project} / {req.team}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-[12px] text-zinc-500 uppercase tracking-[0.16em] font-semibold">Justification</div>
          <div className="text-sm text-zinc-800 border-l-2 border-zinc-200 pl-3">{req.justification}</div>
          <div className="text-[12px] text-zinc-500 uppercase tracking-[0.16em] font-semibold mt-3">Cost center</div>
          <div className="text-sm font-mono text-zinc-800">{req.cost_center}</div>
          <Textarea
            data-testid="decision-comments"
            placeholder="Add comments (optional)…"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={3}
            className="rounded-sm mt-2"
          />
        </div>
        <DialogFooter className="flex !justify-between">
          <button
            data-testid={`reject-btn-${req.id}`}
            className="btn-danger"
            disabled={busy}
            onClick={() => { setDecision("rejected"); setTimeout(submit, 0); }}
          >
            Reject
          </button>
          <button
            data-testid={`approve-btn-${req.id}`}
            className="btn-primary"
            disabled={busy}
            onClick={() => { setDecision("approved"); setTimeout(submit, 0); }}
          >
            Approve & assign
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Approvals() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");

  const load = () => {
    setLoading(true);
    api.get(`/requests?scope=mine_to_approve${tab === "all" ? "" : `&status=${tab}`}`)
      .then((r) => { setRows(r.data); setLoading(false); });
  };
  useEffect(() => { load(); }, [tab]);

  const TABS = ["pending", "assigned", "rejected", "all"];

  return (
    <div className="space-y-5" data-testid="approvals-page">
      <div>
        <div className="label-cap">Approvals queue</div>
        <h1 className="font-display text-3xl tracking-tight text-zinc-900 mt-1">Requests for you to review</h1>
      </div>

      <div className="flex items-center gap-1 border-b border-[var(--line)]">
        {TABS.map((t) => (
          <button
            key={t}
            data-testid={`tab-${t}`}
            onClick={() => setTab(t)}
            className={`px-3.5 py-2 text-[12.5px] font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? "border-[#0F52BA] text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="panel">
        <table className="tbl">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Project / Team</th>
              <th>Cost Center</th>
              <th>Justification</th>
              <th>Submitted</th>
              <th>Status</th>
              <th className="num">Action</th>
            </tr>
          </thead>
          <tbody data-testid="approvals-table-body">
            {loading && [...Array(3)].map((_, i) => (
              <tr key={i}><td colSpan={7}><div className="skeleton h-4" /></td></tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} className="text-center text-zinc-500 py-8">No requests in this view.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} data-testid={`approval-row-${r.id}`}>
                <td>
                  <div className="text-zinc-900">{r.employee_name}</div>
                  <div className="text-[11px] text-zinc-500 font-mono">{r.employee_email}</div>
                </td>
                <td className="text-zinc-700">{r.project} <span className="text-zinc-400">/</span> {r.team}</td>
                <td className="font-mono text-[12px]">{r.cost_center}</td>
                <td className="max-w-xs"><div className="text-[12.5px] text-zinc-700 line-clamp-2">{r.justification}</div></td>
                <td className="font-mono text-[12px]">{new Date(r.created_at).toLocaleDateString()}</td>
                <td><span className={`pill pill-${r.status}`}>{r.status}</span></td>
                <td className="num">
                  {r.status === "pending" ? <DecisionDialog req={r} onDone={load} /> : <span className="text-[11px] text-zinc-400">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
