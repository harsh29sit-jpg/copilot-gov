import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  FileText,
  Inbox,
  KeyRound,
  CalendarClock,
  RotateCcw,
  ScrollText,
  Bell,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["employee", "manager", "admin"] },
  { to: "/my-requests", label: "My Requests", icon: FileText, roles: ["employee", "manager", "admin"] },
  { to: "/approvals", label: "Approvals", icon: Inbox, roles: ["manager", "admin"] },
  { to: "/licenses", label: "Licenses", icon: KeyRound, roles: ["manager", "admin"] },
  { to: "/renewals", label: "Renewals", icon: CalendarClock, roles: ["employee", "manager", "admin"] },
  { to: "/reclamation", label: "Reclamation", icon: RotateCcw, roles: ["manager", "admin"] },
  { to: "/audit", label: "Audit Logs", icon: ScrollText, roles: ["manager", "admin"] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [notifs, setNotifs] = useState([]);

  const loadNotifs = async () => {
    try {
      const { data } = await api.get("/notifications");
      setNotifs(data || []);
    } catch (_) { /* ignore */ }
  };

  useEffect(() => {
    loadNotifs();
    const id = setInterval(loadNotifs, 30000);
    return () => clearInterval(id);
  }, []);

  const unread = notifs.filter((n) => !n.read).length;

  const markAllRead = async () => {
    await api.post("/notifications/read-all");
    loadNotifs();
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const visibleNav = NAV.filter((n) => n.roles.includes(user.role));

  return (
    <div className="h-screen w-screen flex bg-[var(--bg)] overflow-hidden">
      {/* Sidebar */}
      <aside
        data-testid="sidebar"
        className={`sidebar flex flex-col transition-all duration-200 ${collapsed ? "w-[68px]" : "w-[232px]"}`}
      >
        <div className="px-4 py-5 flex items-center justify-between">
          <div className={`flex items-center gap-2 ${collapsed ? "justify-center w-full" : ""}`}>
            <div className="h-7 w-7 rounded-sm bg-[#0F52BA] flex items-center justify-center text-white font-display font-bold text-sm">C</div>
            {!collapsed && (
              <div className="leading-tight">
                <div className="font-display font-semibold text-white text-[13px]">Copilot Gov</div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">License Portal</div>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 py-2">
          {visibleNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
              className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
            >
              <Icon size={16} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <button
          data-testid="sidebar-collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          className="sidebar-link border-t border-zinc-800 mt-auto"
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-[var(--line)] flex items-center justify-between px-6">
          <div>
            <div className="label-cap">Console</div>
            <div className="font-display text-[15px] text-zinc-900 -mt-0.5">GitHub Copilot License Governance</div>
          </div>
          <div className="flex items-center gap-3">
            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  data-testid="notifications-bell"
                  className="relative h-9 w-9 rounded-sm border border-[var(--line)] hover:border-zinc-400 transition-colors flex items-center justify-center"
                >
                  <Bell size={16} className="text-zinc-700" />
                  {unread > 0 && (
                    <span
                      data-testid="notifications-unread-count"
                      className="absolute -top-1 -right-1 bg-[#0F52BA] text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center"
                    >
                      {unread}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 max-h-[420px] overflow-auto">
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>Notifications</span>
                  <button data-testid="notifications-mark-all-read" onClick={markAllRead} className="text-[11px] text-[#0F52BA] hover:underline">
                    Mark all read
                  </button>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifs.length === 0 && (
                  <div className="px-3 py-6 text-xs text-zinc-500 text-center">No notifications yet.</div>
                )}
                {notifs.slice(0, 30).map((n) => (
                  <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-0.5 py-2">
                    <div className="flex items-center gap-2 w-full">
                      {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-[#0F52BA]" />}
                      <span className="text-[12.5px] font-medium text-zinc-900 truncate">{n.title}</span>
                    </div>
                    <span className="text-[11px] text-zinc-500 line-clamp-2">{n.body}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  data-testid="user-menu-btn"
                  className="flex items-center gap-2 h-9 pl-1 pr-3 rounded-sm border border-[var(--line)] hover:border-zinc-400 transition-colors"
                >
                  <div className="h-7 w-7 rounded-sm bg-zinc-900 text-white flex items-center justify-center text-[12px] font-semibold">
                    {(user.name || user.email).slice(0, 1).toUpperCase()}
                  </div>
                  <div className="text-left leading-tight">
                    <div className="text-[12.5px] font-medium text-zinc-900">{user.name}</div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{user.role}</div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-[12px] text-zinc-900 font-medium">{user.email}</div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{user.role}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem data-testid="logout-btn" onClick={handleLogout}>
                  <LogOut size={14} className="mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
