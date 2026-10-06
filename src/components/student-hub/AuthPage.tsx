import { ArrowRight, Chrome, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "./Primitives";

export function AuthPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { authReady, forgotPassword, login, loginWithGoogle, register, user } = useAuth();
  const mode = location.pathname.includes("register") ? "register" : "login";
  const [name, setName] = useState("Aarav Patil");
  const [email, setEmail] = useState("student@diamondhub.demo");
  const [password, setPassword] = useState("diamond123");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(
    () => (mode === "register" ? "Create your free account" : "Welcome back"),
    [mode],
  );

  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "register") {
        await register({ name, email, password });
      } else {
        await login(email, password);
      }

      navigate("/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleLogin() {
    setBusy(true);
    setError(null);

    try {
      await loginWithGoogle();
      navigate("/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Google login failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPassword() {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      await forgotPassword(email);
      setMessage(
        authReady
          ? "Password reset link sent. Check your inbox."
          : "Demo mode active. Add Firebase config to send real reset emails.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send reset email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <section className="flex flex-col justify-between gap-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <Link to="/" aria-label="Diamond Student Hub home">
              <Logo />
            </Link>
            <Link to="/" className="text-sm font-bold text-slate-500 hover:text-blue-700">
              Home
            </Link>
          </div>

          <div className="max-w-xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Firebase Authentication
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight text-slate-950 sm:text-5xl">{title}</h1>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Start with Class 9 notes, quizzes, progress analytics, weekly tests, and premium study
              resources in one modern dashboard.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["14 days", "Study streak"],
              ["72%", "Overall progress"],
              ["18/20", "Latest quiz"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-2xl font-extrabold text-slate-950">{value}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center">
          <div className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/70 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-950">
                  {mode === "register" ? "Register" : "Login"}
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {authReady ? "Connected to Firebase." : "Demo mode active until Firebase env values are added."}
                </p>
              </div>
              <Link
                to={mode === "register" ? "/login" : "/register"}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:border-blue-200 hover:bg-blue-50"
              >
                {mode === "register" ? "Login" : "Create account"}
              </Link>
            </div>

            <form className="mt-7 grid gap-4" onSubmit={handleSubmit}>
              {mode === "register" && (
                <label className="grid gap-2 text-sm font-bold text-slate-700">
                  Name
                  <span className="relative">
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="min-h-12 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-slate-950 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                      required
                    />
                  </span>
                </label>
              )}

              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Email
                <span className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="min-h-12 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-slate-950 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    required
                  />
                </span>
              </label>

              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Password
                <span className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="min-h-12 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-slate-950 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    minLength={6}
                    required
                  />
                </span>
              </label>

              {error && <p className="rounded-lg bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
              {message && <p className="rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{message}</p>}

              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {mode === "register" ? "Create Free Account" : "Login"}
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            </form>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={busy}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Chrome className="size-4 text-blue-700" aria-hidden="true" />
                Google Login
              </button>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={busy}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Forgot Password
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
