import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, User, Briefcase } from "lucide-react";

const COPY = {
  employee: {
    label: "Employee",
    heading: "Request Copilot. Track it. Done.",
    sub: "A single place to ask for a GitHub Copilot license — your manager gets notified, you get told the moment it's assigned.",
    bullets: [
      "Submit one request, no Teams ping-pong",
      "See approval status in real time",
      "Renew quarterly with one click",
    ],
    defaultEmail: "alice.park@copilot-gov.com",
    defaultPassword: "password123",
    presets: [
      { label: "Alice (assigned)", email: "alice.park@copilot-gov.com" },
      { label: "Carol (renewal due)", email: "carol.singh@copilot-gov.com" },
      { label: "Ivy (no license)", email: "ivy.brown@copilot-gov.com" },
    ],
    cta: "Sign in to Employee portal",
  },
  manager: {
    label: "Manager",
    heading: "Govern every Copilot seat.",
    sub: "Approve requests, monitor utilization by project and cost center, reclaim inactive licenses, and ship an audit trail your security team will love.",
    bullets: [
      "Centralized approval queue",
      "Project & cost-center analytics",
      "One-click reclamation & audit export",
    ],
    defaultEmail: "marcus.chen@copilot-gov.com",
    defaultPassword: "password123",
    presets: [
      { label: "Marcus (Phoenix)", email: "marcus.chen@copilot-gov.com" },
      { label: "Priya (Atlas)", email: "priya.shah@copilot-gov.com" },
      { label: "Admin", email: "admin@copilot-gov.com", password: "admin123" },
    ],
    cta: "Sign in to Manager portal",
  },
};

export default function Login() {
  const { user, login, error } = useAuth();
  const [portal, setPortal] = useState("employee");
  const cfg = COPY[portal];
  const [email, setEmail] = useState(cfg.defaultEmail);
  const [password, setPassword] = useState(cfg.defaultPassword);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  if (user) return <Navigate to="/dashboard" replace />;

  const switchPortal = (p) => {
    setPortal(p);
    setEmail(COPY[p].defaultEmail);
    setPassword(COPY[p].defaultPassword);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const ok = await login(email, password, portal);
    setSubmitting(false);
    if (ok) navigate("/dashboard");
  };

  return (
    <div className="min-h-screen w-screen flex">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-1 bg-zinc-900 text-white p-12 flex-col justify-between grain">
        <div>
          <div className="flex items-center gap-2 mb-12">
            <div className="h-8 w-8 rounded-sm bg-[#0F52BA] flex items-center justify-center font-display font-bold">C</div>
            <span className="font-display font-semibold tracking-tight">Copilot Gov</span>
          </div>
          <div className="label-cap text-zinc-400 mb-3">{cfg.label} portal</div>
          <h1 className="font-display text-4xl sm:text-5xl tracking-tight leading-[1.05] max-w-md">
            {cfg.heading}
          </h1>
          <p className="mt-6 max-w-md text-zinc-400 text-sm leading-relaxed">{cfg.sub}</p>
          <ul className="mt-8 space-y-2.5 max-w-md">
            {cfg.bullets.map((b) => (
              <li key={b} className="text-[13px] text-zinc-300 flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-[#0F52BA]" /> {b}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-zinc-500">
          <ShieldCheck size={14} className="text-zinc-300" />
          SSO · RBAC · Audit-ready
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[var(--bg)]">
        <div className="w-full max-w-sm">
          {/* Portal toggle */}
          <div className="grid grid-cols-2 p-1 bg-white border border-[var(--line)] rounded-sm mb-6" data-testid="portal-toggle">
            <button
              type="button"
              data-testid="portal-employee-tab"
              onClick={() => switchPortal("employee")}
              className={`flex items-center justify-center gap-2 py-2 text-[12.5px] font-medium rounded-sm transition-colors ${
                portal === "employee" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <User size={14} /> Employee
            </button>
            <button
              type="button"
              data-testid="portal-manager-tab"
              onClick={() => switchPortal("manager")}
              className={`flex items-center justify-center gap-2 py-2 text-[12.5px] font-medium rounded-sm transition-colors ${
                portal === "manager" ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <Briefcase size={14} /> Manager
            </button>
          </div>

          <div className="mb-6">
            <div className="label-cap mb-2">{cfg.label} sign in</div>
            <h2 className="font-display text-2xl sm:text-3xl tracking-tight text-zinc-900">Welcome back</h2>
            <p className="text-sm text-zinc-500 mt-1.5">
              {portal === "employee"
                ? "Sign in to request and manage your own Copilot license."
                : "Sign in to approve, monitor and govern Copilot licenses."}
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" data-testid="login-form">
            <div>
              <Label htmlFor="email" className="text-[11px] uppercase tracking-[0.16em] font-semibold text-zinc-600">Email</Label>
              <Input
                id="email"
                data-testid="login-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 h-10 rounded-sm border-zinc-300 focus-visible:ring-1 focus-visible:ring-[#0F52BA]"
                required
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-[11px] uppercase tracking-[0.16em] font-semibold text-zinc-600">Password</Label>
              <Input
                id="password"
                data-testid="login-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 h-10 rounded-sm border-zinc-300 focus-visible:ring-1 focus-visible:ring-[#0F52BA]"
                required
              />
            </div>
            {error && (
              <div data-testid="login-error" className="text-[12.5px] text-[#dc2626] bg-red-50 border border-red-200 px-3 py-2 rounded-sm">
                {error}
              </div>
            )}
            <button
              type="submit"
              data-testid="login-submit-btn"
              disabled={submitting}
              className="w-full btn-primary disabled:opacity-60"
            >
              {submitting ? "Signing in…" : cfg.cta}
            </button>
          </form>

          <div className="mt-8">
            <div className="label-cap mb-2">Try a demo persona</div>
            <div className="grid grid-cols-1 gap-2">
              {cfg.presets.map((p) => (
                <button
                  key={p.email}
                  data-testid={`preset-${p.label.toLowerCase().replace(/[^a-z]/g, "")}`}
                  type="button"
                  onClick={() => { setEmail(p.email); setPassword(p.password || "password123"); }}
                  className="flex items-center justify-between text-left px-3 py-2 border border-zinc-200 hover:border-zinc-400 transition-colors rounded-sm bg-white"
                >
                  <div>
                    <div className="text-[12.5px] font-medium text-zinc-900">{p.label}</div>
                    <div className="text-[11px] text-zinc-500 font-mono">{p.email}</div>
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Use</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
