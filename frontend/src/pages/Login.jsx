import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";

export default function Login() {
  const { user, login, error } = useAuth();
  const [email, setEmail] = useState("admin@copilot-gov.com");
  const [password, setPassword] = useState("admin123");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  if (user) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const ok = await login(email, password);
    setSubmitting(false);
    if (ok) navigate("/dashboard");
  };

  const presets = [
    { label: "Admin", email: "admin@copilot-gov.com", password: "admin123" },
    { label: "Manager (Marcus)", email: "marcus.chen@copilot-gov.com", password: "password123" },
    { label: "Employee (Alice)", email: "alice.park@copilot-gov.com", password: "password123" },
  ];

  return (
    <div className="min-h-screen w-screen flex">
      <div className="hidden lg:flex flex-1 bg-zinc-900 text-white p-12 flex-col justify-between grain">
        <div>
          <div className="flex items-center gap-2 mb-12">
            <div className="h-8 w-8 rounded-sm bg-[#0F52BA] flex items-center justify-center font-display font-bold">C</div>
            <span className="font-display font-semibold tracking-tight">Copilot Gov</span>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl tracking-tight leading-[1.05] max-w-md">
            Stop chasing<br/>Copilot licenses in Teams.
          </h1>
          <p className="mt-6 max-w-md text-zinc-400 text-sm leading-relaxed">
            A single console for requesting, approving, renewing and reclaiming GitHub Copilot seats — with a full audit trail and cost attribution by project and cost center.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-zinc-500">
          <ShieldCheck size={14} className="text-zinc-300" />
          SSO · RBAC · Audit-ready
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-[var(--bg)]">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <div className="label-cap mb-3">Sign in</div>
            <h2 className="font-display text-2xl sm:text-3xl tracking-tight text-zinc-900">Welcome back</h2>
            <p className="text-sm text-zinc-500 mt-1.5">Use your corporate SSO credentials.</p>
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
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-8">
            <div className="label-cap mb-2">Try a demo persona</div>
            <div className="grid grid-cols-1 gap-2">
              {presets.map((p) => (
                <button
                  key={p.email}
                  data-testid={`preset-${p.label.toLowerCase().replace(/[^a-z]/g, "")}`}
                  type="button"
                  onClick={() => { setEmail(p.email); setPassword(p.password); }}
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
