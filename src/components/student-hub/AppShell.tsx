import {
  BarChart3,
  BookOpen,
  Crown,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Medal,
  Trophy,
  UserRound,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "./Primitives";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/learn", label: "Learn", icon: BookOpen },
  { to: "/quizzes", label: "Quizzes", icon: GraduationCap },
  { to: "/progress", label: "Progress", icon: BarChart3 },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/resources", label: "Resources", icon: FileText },
  { to: "/premium", label: "Premium", icon: Crown },
  { to: "/profile", label: "Profile", icon: UserRound },
];

export function AppShell() {
  const { logout, user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="hidden border-r border-slate-200 bg-white lg:flex lg:min-h-screen lg:flex-col">
        <div className="border-b border-slate-200 p-5">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map(({ icon: Icon, label, to }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-bold transition ${
                  isActive ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                }`
              }
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg bg-blue-600 text-sm font-extrabold text-white">
                {user?.name.slice(0, 1) ?? "D"}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-slate-950">{user?.name}</p>
                <p className="truncate text-xs font-bold text-slate-500">{user?.className}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <Logo compact />
            <div className="flex min-w-0 items-center gap-2">
              <span className="hidden rounded-full bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-700 sm:inline-flex">
                Launch Offer
              </span>
              <div className="grid size-10 place-items-center rounded-lg bg-blue-600 text-sm font-extrabold text-white">
                {user?.name.slice(0, 1) ?? "D"}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto min-h-screen max-w-7xl px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
          <div className="mb-6 hidden items-center justify-between gap-4 lg:flex">
            <div>
              <p className="text-sm font-bold text-blue-700">Diamond Student Hub</p>
              <h1 className="mt-1 text-3xl font-extrabold text-slate-950">Student Workspace</h1>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <Medal className="size-5 text-amber-500" aria-hidden="true" />
              <div>
                <p className="text-sm font-extrabold text-slate-950">{user?.premium ? "Premium" : "Free Plan"}</p>
                <p className="text-xs font-bold text-slate-500">Class 9 Maharashtra Board</p>
              </div>
            </div>
          </div>
          <Outlet />
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white px-2 py-2 shadow-2xl shadow-slate-300 lg:hidden">
          <div className="mx-auto grid max-w-2xl grid-cols-4 gap-1">
            {navItems.slice(0, 8).map(({ icon: Icon, label, to }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `grid min-h-14 place-items-center rounded-lg px-1 text-[0.68rem] font-bold transition ${
                    isActive ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50"
                  }`
                }
              >
                <Icon className="size-5" aria-hidden="true" />
                <span className="max-w-full truncate">{label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
