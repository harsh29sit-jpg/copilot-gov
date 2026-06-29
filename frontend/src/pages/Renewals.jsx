import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function MovedDialog({ onDone }) {
  const [open, setOpen] = useState(false);
  const [meta, setMeta] = useState({ projects: [], teams: [], cost_centers: [], managers: [] });
  const [f, setF] = useState({ new_project: "", new_team: "", new_cost_center: "", new_manager_id: "", justification: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) api.get("/meta/reference").then((r) => setMeta(r.data)); }, [open]);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post("/renewals/action", { action: "moved", ...f });
      toast.success("Transfer requested — pending new manager approval");
      setOpen(false);
      onDone();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button data-testid="moved-project-btn" className="btn-ghost">Moved project</button>
      </DialogTrigger>
      <DialogContent className="rounded-sm">
        <DialogHeader>
          <DialogTitle className="font-display tracking-tight">Transfer to new project</DialogTitle>
          <DialogDescription>Your current license will return to the pool and a new approval will start.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="label-cap">New project</Label>
            <Select value={f.new_project} onValueChange={(v) => setF({ ...f, new_project: v })}>
              <SelectTrigger data-testid="moved-project-select" className="mt-1.5 h-10 rounded-sm"><SelectValue placeholder="Choose"/></SelectTrigger>
              <SelectContent>{meta.projects.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="label-cap">New team</Label>
            <Select value={f.new_team} onValueChange={(v) => setF({ ...f, new_team: v })}>
              <SelectTrigger className="mt-1.5 h-10 rounded-sm"><SelectValue placeholder="Choose"/></SelectTrigger>
              <SelectContent>{meta.teams.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="label-cap">Cost center</Label>
            <Select value={f.new_cost_center} onValueChange={(v) => setF({ ...f, new_cost_center: v })}>
              <SelectTrigger className="mt-1.5 h-10 rounded-sm"><SelectValue placeholder="Choose"/></SelectTrigger>
              <SelectContent>{meta.cost_centers.map((c) => <SelectItem key={c.id} value={c.code}>{c.code} — {c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="label-cap">New manager</Label>
            <Select value={f.new_manager_id} onValueChange={(v) => setF({ ...f, new_manager_id: v })}>
              <SelectTrigger data-testid="moved-manager-select" className="mt-1.5 h-10 rounded-sm"><SelectValue placeholder="Choose"/></SelectTrigger>
              <SelectContent>{meta.managers.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <Textarea
          placeholder="Add context for new manager…"
          rows={3}
          value={f.justification}
          onChange={(e) => setF({ ...f, justification: e.target.value })}
          className="rounded-sm mt-3"
        />
        <DialogFooter>
          <button onClick={submit} disabled={busy} data-testid="confirm-moved-btn" className="btn-primary">
            {busy ? "Submitting…" : "Submit transfer"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmployeeRenewal() {
  const [data, setData] = useState(null);

  const load = () => api.get("/renewals/mine").then((r) => setData(r.data));
  useEffect(() => { load(); }, []);

  const act = async (action) => {
    try {
      await api.post("/renewals/action", { action });
      toast.success(action === "continue" ? "Renewed for 90 days" : "License released");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  if (!data) return <div className="skeleton h-24 w-full" />;

  if (!data.license) {
    return (
      <div className="panel p-8 text-center text-zinc-500">
        You have no assigned license. Visit <span className="font-medium text-zinc-900">My Requests</span> to apply.
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="employee-renewal-panel">
      <div className="panel p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="label-cap">Current license</div>
            <div className="font-mono text-2xl mt-2 text-zinc-900">{data.license.license_key}</div>
            <div className="text-sm text-zinc-600 mt-1">{data.license.project} · {data.license.team} · {data.license.cost_center}</div>
            <div className="flex gap-2 mt-3">
              {data.overdue ? <span className="pill pill-rejected">Renewal overdue</span> :
                data.due ? <span className="pill pill-pending">Renewal due in {data.days_until_due}d</span> :
                <span className="pill pill-assigned">Active · {data.days_until_due}d to renew</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="panel p-6">
        <div className="label-cap mb-1">Confirm your usage</div>
        <h2 className="font-display text-xl text-zinc-900">What would you like to do?</h2>
        <div className="grid md:grid-cols-3 gap-3 mt-4">
          <button data-testid="continue-renewal-btn" onClick={() => act("continue")} className="text-left panel p-4 hover:border-zinc-400 transition-colors">
            <div className="text-[12px] uppercase tracking-[0.16em] font-semibold text-[#16A34A]">Continue</div>
            <div className="font-display text-base text-zinc-900 mt-1">Keep using</div>
            <div className="text-[12px] text-zinc-500 mt-1">Renews for another 90 days.</div>
          </button>
          <button data-testid="release-renewal-btn" onClick={() => act("release")} className="text-left panel p-4 hover:border-zinc-400 transition-colors">
            <div className="text-[12px] uppercase tracking-[0.16em] font-semibold text-[#DC2626]">Release</div>
            <div className="font-display text-base text-zinc-900 mt-1">Return to pool</div>
            <div className="text-[12px] text-zinc-500 mt-1">You&apos;ll lose Copilot access immediately.</div>
          </button>
          <div className="text-left panel p-4 hover:border-zinc-400 transition-colors">
            <div className="text-[12px] uppercase tracking-[0.16em] font-semibold text-[#0F52BA]">Transfer</div>
            <div className="font-display text-base text-zinc-900 mt-1">Moved project</div>
            <div className="text-[12px] text-zinc-500 mt-1 mb-3">Request new approval under new manager.</div>
            <MovedDialog onDone={load} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ManagerRenewal() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => api.get("/renewals/due").then((r) => { setRows(r.data); setLoading(false); });
  useEffect(() => { load(); }, []);

  return (
    <div className="panel" data-testid="manager-renewals-panel">
      <table className="tbl">
        <thead>
          <tr>
            <th>License</th><th>User</th><th>Project</th><th>Last renewal</th><th>Due</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          {loading && [...Array(3)].map((_, i) => (<tr key={i}><td colSpan={6}><div className="skeleton h-4"/></td></tr>))}
          {!loading && rows.length === 0 && (<tr><td colSpan={6} className="text-center py-8 text-zinc-500">No renewals due in the next 14 days.</td></tr>)}
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="font-mono">{r.license_key}</td>
              <td>{r.assigned_user_name}</td>
              <td>{r.project}</td>
              <td className="font-mono text-[12px]">{r.last_renewal_at ? new Date(r.last_renewal_at).toLocaleDateString() : "—"}</td>
              <td className="font-mono text-[12px]">{new Date(r.next_renewal_due).toLocaleDateString()}</td>
              <td>{r.overdue ? <span className="pill pill-rejected">Overdue {Math.abs(r.days_until_due)}d</span> : <span className="pill pill-pending">In {r.days_until_due}d</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Renewals() {
  const { user } = useAuth();

  return (
    <div className="space-y-5" data-testid="renewals-page">
      <div>
        <div className="label-cap">Renewals</div>
        <h1 className="font-display text-3xl tracking-tight text-zinc-900 mt-1">
          {user.role === "employee" ? "Recertify your license" : "Upcoming renewals"}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {user.role === "employee"
            ? "Quarterly recertification keeps your access active."
            : "Track licenses approaching renewal in the next 14 days."}
        </p>
      </div>

      {user.role === "employee" ? <EmployeeRenewal /> : <ManagerRenewal />}
    </div>
  );
}
