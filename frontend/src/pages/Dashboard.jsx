import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import { ArrowRight, AlertTriangle, CheckCircle2, KeyRound, Clock, Users, RotateCcw } from "lucide-react";

const CHART_COLORS = ["#0F52BA", "#16A34A", "#D97706", "#7C3AED", "#0EA5E9", "#DC2626"];

function Metric({ label, value, accent, testid, hint }) {
  return (
    <div className="panel p-5" data-testid={testid}>
      <div className="label-cap">{label}</div>
      <div className={`metric-num text-3xl mt-2 ${accent || "text-zinc-900"}`}>{value}</div>
      {hint && <div className="text-[12px] text-zinc-500 mt-1">{hint}</div>}
    </div>
  );
}

function EmployeeDashboard({ user }) {
  const [myLic, setMyLic] = useState(null);
  const [reqs, setReqs] = useState([]);
  const [renewal, setRenewal] = useState(null);

  useEffect(() => {
    api.get("/licenses/mine").then((r) => setMyLic(r.data));
    api.get("/requests/mine").then((r) => setReqs(r.data));
    api.get("/renewals/mine").then((r) => setRenewal(r.data));
  }, []);

  const hasLic = !!myLic;
  const pending = reqs.find((r) => r.status === "pending");

  return (
    <div className="space-y-6" data-testid="employee-dashboard">
      <div>
        <div className="label-cap">Hello, {user.name.split(" ")[0]}</div>
        <h1 className="font-display text-3xl tracking-tight text-zinc-900 mt-1">Your Copilot access</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="panel md:col-span-2 p-6">
          <div className="label-cap mb-3">License status</div>
          {hasLic ? (
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-mono text-lg text-zinc-900">{myLic.license_key}</div>
                <div className="text-sm text-zinc-500 mt-1">{myLic.project} · {myLic.team} · {myLic.cost_center}</div>
                <div className="flex gap-2 mt-3">
                  <span className="pill pill-assigned">Assigned</span>
                  {renewal?.overdue && <span className="pill pill-rejected">Renewal overdue</span>}
                  {renewal?.due && !renewal?.overdue && <span className="pill pill-pending">Renewal due</span>}
                </div>
              </div>
              <Link to="/renewals" data-testid="manage-renewal-link" className="btn-ghost flex items-center gap-1.5">
                Manage <ArrowRight size={14} />
              </Link>
            </div>
          ) : pending ? (
            <div>
              <div className="text-sm text-zinc-900">Your request for <strong>{pending.project}</strong> is awaiting manager approval.</div>
              <div className="text-xs text-zinc-500 mt-1">Submitted {new Date(pending.created_at).toLocaleDateString()}</div>
              <span className="pill pill-pending mt-3">Pending</span>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-zinc-900">You don&apos;t have a Copilot license yet.</div>
                <div className="text-xs text-zinc-500 mt-1">Submit a request and your manager will approve and assign one.</div>
              </div>
              <Link to="/my-requests/new" data-testid="request-access-link" className="btn-primary">Request access</Link>
            </div>
          )}
        </div>

        <div className="panel p-6">
          <div className="label-cap mb-3">Recent activity</div>
          <ul className="space-y-3">
            {reqs.slice(0, 4).map((r) => (
              <li key={r.id} className="flex items-center justify-between text-[13px]">
                <div>
                  <div className="text-zinc-900">{r.project}</div>
                  <div className="text-[11px] text-zinc-500">{new Date(r.created_at).toLocaleDateString()}</div>
                </div>
                <span className={`pill pill-${r.status}`}>{r.status}</span>
              </li>
            ))}
            {reqs.length === 0 && <li className="text-xs text-zinc-500">No requests yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ManagerDashboard() {
  const [overview, setOverview] = useState(null);
  const [byProject, setByProject] = useState([]);
  const [byCC, setByCC] = useState([]);
  const [trend, setTrend] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get("/analytics/overview"),
      api.get("/analytics/by-project"),
      api.get("/analytics/by-cost-center"),
      api.get("/analytics/requests-trend"),
    ]).then(([o, p, c, t]) => {
      setOverview(o.data);
      setByProject(p.data);
      setByCC(c.data);
      setTrend(t.data);
    });
  }, []);

  if (!overview) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => <div key={i} className="skeleton h-24" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="manager-dashboard">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="label-cap">Overview</div>
          <h1 className="font-display text-3xl tracking-tight text-zinc-900 mt-1">License governance at a glance</h1>
        </div>
        <Link to="/approvals" data-testid="go-to-approvals-link" className="btn-primary flex items-center gap-1.5">
          Review approvals <ArrowRight size={14} />
        </Link>
      </div>

      {/* North star + key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="panel p-6 lg:col-span-2" data-testid="metric-utilization">
          <div className="flex items-center gap-2 label-cap"><Users size={12}/> Utilization</div>
          <div className="metric-num text-5xl mt-2 text-zinc-900">{overview.utilization}<span className="text-2xl text-zinc-400">%</span></div>
          <div className="text-[12px] text-zinc-500 mt-1">{overview.assigned} of {overview.total} seats in active use</div>
          <div className="mt-4 h-1.5 w-full rounded-sm bg-zinc-100 overflow-hidden">
            <div className="h-full bg-[#0F52BA]" style={{ width: `${overview.utilization}%` }} />
          </div>
        </div>
        <Metric label="Total seats" value={overview.total} testid="metric-total" />
        <Metric label="Assigned" value={overview.assigned} accent="text-zinc-900" testid="metric-assigned" />
        <Metric label="Available" value={overview.available} accent="text-[#16A34A]" testid="metric-available" />
        <Metric label="Pending requests" value={overview.pending_requests} accent="text-[#D97706]" testid="metric-pending" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric label="Renewal due" value={overview.renewal_due} accent="text-[#D97706]" testid="metric-renewal-due"
          hint={<span className="inline-flex items-center gap-1"><Clock size={11}/> Next 14 days</span>} />
        <Metric label="Reclaimable" value={overview.reclaimable} accent="text-[#DC2626]" testid="metric-reclaimable"
          hint={<span className="inline-flex items-center gap-1"><AlertTriangle size={11}/> Inactive/overdue</span>} />
        <Metric label="Active users" value={overview.active_users} accent="text-[#16A34A]" testid="metric-active"
          hint={<span className="inline-flex items-center gap-1"><CheckCircle2 size={11}/> 60d activity</span>} />
        <Metric label="License waste" value={`${overview.waste}%`} accent="text-zinc-900" testid="metric-waste" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="panel p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="label-cap">Requests trend</div>
              <div className="font-display text-base text-zinc-900 mt-0.5">Last 30 days</div>
            </div>
          </div>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={trend} margin={{ top: 5, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#e4e4e7" strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#71717a" }} />
                <YAxis tick={{ fontSize: 11, fill: "#71717a" }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="submitted" stroke="#0F52BA" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="approved" stroke="#16A34A" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="rejected" stroke="#DC2626" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-5">
          <div className="label-cap">Cost by center</div>
          <div className="font-display text-base text-zinc-900 mt-0.5 mb-4">Monthly attribution</div>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byCC} dataKey="monthly_cost" nameKey="cost_center" innerRadius={50} outerRadius={85} paddingAngle={2}>
                  {byCC.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => `$${v}/mo`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 space-y-1.5">
            {byCC.map((row, i) => (
              <li key={row.cost_center} className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-sm" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="text-zinc-700">{row.cost_center}</span>
                </span>
                <span className="font-mono text-zinc-900">${row.monthly_cost}/mo</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="panel p-5">
        <div className="label-cap mb-4">Project allocation</div>
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={byProject} margin={{ top: 5, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="#e4e4e7" strokeDasharray="3 3" />
              <XAxis dataKey="project" tick={{ fontSize: 11, fill: "#71717a" }} />
              <YAxis tick={{ fontSize: 11, fill: "#71717a" }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="assigned" fill="#0F52BA" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/reclamation" className="btn-ghost flex items-center gap-1.5" data-testid="quick-reclaim-link"><RotateCcw size={14}/> Reclamation center</Link>
        <Link to="/licenses" className="btn-ghost flex items-center gap-1.5" data-testid="quick-licenses-link"><KeyRound size={14}/> License inventory</Link>
        <Link to="/audit" className="btn-ghost flex items-center gap-1.5" data-testid="quick-audit-link">Audit log</Link>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  if (user.role === "employee") return <EmployeeDashboard user={user} />;
  return <ManagerDashboard />;
}
