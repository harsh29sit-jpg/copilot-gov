import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function NewRequest() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [meta, setMeta] = useState({ projects: [], teams: [], cost_centers: [], managers: [] });
  const [form, setForm] = useState({
    project: user.project || "",
    team: user.team || "",
    cost_center: user.cost_center || "",
    manager_id: user.manager_id || "",
    justification: "",
    github_username: user.github_username || "",
  });
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get("/meta/reference").then((r) => setMeta(r.data));
  }, []);

  const update = (k) => (v) => setForm((f) => ({ ...f, [k]: typeof v === "string" ? v : v.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setSubmitting(true);
    try {
      await api.post("/requests", form);
      navigate("/my-requests");
    } catch (e) {
      setErr(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-5" data-testid="new-request-page">
      <div>
        <div className="label-cap">New request</div>
        <h1 className="font-display text-3xl tracking-tight text-zinc-900 mt-1">Request Copilot access</h1>
        <p className="text-sm text-zinc-500 mt-1">Provide context so your manager can approve quickly.</p>
      </div>

      <form onSubmit={submit} className="panel p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-[11px] uppercase tracking-[0.16em] font-semibold text-zinc-600">Employee</Label>
            <Input value={user.name} disabled className="mt-1.5 h-10 rounded-sm bg-zinc-50" />
          </div>
          <div>
            <Label className="text-[11px] uppercase tracking-[0.16em] font-semibold text-zinc-600">Employee ID</Label>
            <Input value={user.id.slice(0, 8).toUpperCase()} disabled className="mt-1.5 h-10 rounded-sm bg-zinc-50 font-mono" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-[11px] uppercase tracking-[0.16em] font-semibold text-zinc-600">Project</Label>
            <Select value={form.project} onValueChange={update("project")}>
              <SelectTrigger data-testid="project-select" className="mt-1.5 h-10 rounded-sm">
                <SelectValue placeholder="Choose project" />
              </SelectTrigger>
              <SelectContent>
                {meta.projects.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] uppercase tracking-[0.16em] font-semibold text-zinc-600">Team</Label>
            <Select value={form.team} onValueChange={update("team")}>
              <SelectTrigger data-testid="team-select" className="mt-1.5 h-10 rounded-sm">
                <SelectValue placeholder="Choose team" />
              </SelectTrigger>
              <SelectContent>
                {meta.teams.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-[11px] uppercase tracking-[0.16em] font-semibold text-zinc-600">Cost Center</Label>
            <Select value={form.cost_center} onValueChange={update("cost_center")}>
              <SelectTrigger data-testid="cc-select" className="mt-1.5 h-10 rounded-sm">
                <SelectValue placeholder="Choose cost center" />
              </SelectTrigger>
              <SelectContent>
                {meta.cost_centers.map((c) => <SelectItem key={c.id} value={c.code}>{c.code} — {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] uppercase tracking-[0.16em] font-semibold text-zinc-600">Manager</Label>
            <Select value={form.manager_id} onValueChange={update("manager_id")}>
              <SelectTrigger data-testid="manager-select" className="mt-1.5 h-10 rounded-sm">
                <SelectValue placeholder="Choose manager" />
              </SelectTrigger>
              <SelectContent>
                {meta.managers.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} ({m.email})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-[11px] uppercase tracking-[0.16em] font-semibold text-zinc-600">GitHub username</Label>
          <Input
            data-testid="github-username-input"
            value={form.github_username}
            onChange={update("github_username")}
            placeholder="e.g. alice-park"
            className="mt-1.5 h-10 rounded-sm font-mono"
          />
          <div className="text-[11px] text-zinc-500 mt-1">Required so the actual GitHub Copilot seat can be assigned to you upon approval.</div>
        </div>

        <div>
          <Label className="text-[11px] uppercase tracking-[0.16em] font-semibold text-zinc-600">Business justification</Label>
          <Textarea
            data-testid="justification-input"
            value={form.justification}
            onChange={update("justification")}
            rows={4}
            className="mt-1.5 rounded-sm"
            placeholder="Explain how Copilot will accelerate your work…"
            required
          />
        </div>

        {err && <div data-testid="new-request-error" className="text-[12.5px] text-[#dc2626] bg-red-50 border border-red-200 px-3 py-2 rounded-sm">{err}</div>}

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={() => navigate("/my-requests")}>Cancel</button>
          <button type="submit" disabled={submitting} data-testid="submit-request-btn" className="btn-primary">
            {submitting ? "Submitting…" : "Submit request"}
          </button>
        </div>
      </form>
    </div>
  );
}
