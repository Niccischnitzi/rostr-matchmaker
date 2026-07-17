import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Loader2 } from "lucide-react";
import { RostrMark } from "@/components/squadz/RostrMark";

import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : "",
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Rostr" },
      { name: "description", content: "Sign in or create your Rostr account to find your players, join clubs, and link every gaming platform." },
      { name: "robots", content: "noindex,follow" },
    ],
    links: [{ rel: "canonical", href: "https://rostr-matchmaker.lovable.app/auth" }],
  }),
  component: AuthPage,
});

// Only accept same-origin relative paths ("/foo?bar"), never external URLs.
function safeNext(next: string): string {
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { next } = Route.useSearch();
  const dest = safeNext(next);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.href = dest;
    });
  }, [dest]);

  const friendlyError = (msg: string): { text: string; emailUnconfirmed?: boolean } => {
    const m = msg.toLowerCase();
    if (m.includes("email not confirmed")) {
      return { text: "Check your inbox to confirm your email first.", emailUnconfirmed: true };
    }
    if (m.includes("invalid login")) return { text: "Wrong email or password." };
    if (m.includes("user already registered")) return { text: "Account exists — sign in instead." };
    if (m.includes("password") && m.includes("6")) return { text: "Password must be at least 6 characters." };
    if (m.includes("rate limit")) return { text: "Too many attempts — wait a minute and try again." };
    if (m.includes("pwned") || m.includes("compromised")) return { text: "That password has been leaked online — pick another." };
    return { text: msg };
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNeedsConfirm(false);
    try {
      if (mode === "signup") {
        if (password.length < 6) {
          toast.error("Password must be at least 6 characters");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${dest}`,
            data: { username: username.trim() || undefined },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setNeedsConfirm(true);
          toast.success("Account created — check your email to confirm");
          return;
        }
        toast.success("Welcome to Rostr");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in");
      }
      router.invalidate();
      window.location.href = dest;
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Authentication failed";
      const f = friendlyError(raw);
      if (f.emailUnconfirmed) setNeedsConfirm(true);
      toast.error(f.text);
    } finally {
      setBusy(false);
    }
  };

  const onResendConfirm = async () => {
    if (!email) { toast.error("Enter your email first"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
      toast.success("Confirmation email sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send email");
    } finally {
      setBusy(false);
    }
  };

  const onForgot = async () => {
    if (!email) { toast.error("Enter your email above first"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset link sent");
      setForgotOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send reset email");
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        // redirect_uri MUST be a full public URL, not a protected route.
        // We return to /auth with ?next=<dest> so the session hydrates here
        // and then this page bounces the user back to the original destination
        // (including the OAuth consent screen).
        redirect_uri: `${window.location.origin}/auth?next=${encodeURIComponent(dest)}`,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Google sign-in failed");
        return;
      }
      if (result.redirected) return;
      router.invalidate();
      window.location.href = dest;
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-2 mb-8">
          <RostrMark variant="lockup" size={40} />
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Gaming social hub</p>
        </div>


        <div className="rounded-3xl border border-border bg-card p-6 shadow-xl">
          <div className="grid grid-cols-2 rounded-xl bg-surface p-1 mb-6">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setNeedsConfirm(false); }}
                className={`py-2 text-sm font-bold rounded-lg transition-all ${
                  mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "signup" && (
              <Field label="Username" value={username} onChange={setUsername} placeholder="ghostshot42" autoComplete="username" />
            )}
            <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" required autoComplete="email" />
            <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="At least 6 characters" required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} />

            {mode === "signin" && (
              <div className="flex justify-end -mt-2">
                <button type="button" onClick={() => setForgotOpen((v) => !v)} className="text-xs text-muted-foreground hover:text-primary transition">
                  Forgot password?
                </button>
              </div>
            )}

            {forgotOpen && mode === "signin" && (
              <div className="rounded-xl border border-border bg-surface p-3 text-xs space-y-2">
                <p className="text-muted-foreground">We'll email a reset link to <span className="font-semibold text-foreground">{email || "your email"}</span>.</p>
                <button type="button" onClick={onForgot} disabled={busy} className="w-full h-9 rounded-lg bg-primary text-primary-foreground font-bold disabled:opacity-50">
                  Send reset link
                </button>
              </div>
            )}

            <button type="submit" disabled={busy} className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>

            {needsConfirm && (
              <div className="rounded-xl border border-border bg-surface p-3 text-xs space-y-2">
                <p className="text-muted-foreground">Didn't get the confirmation email?</p>
                <button type="button" onClick={onResendConfirm} disabled={busy} className="w-full h-9 rounded-lg border border-border bg-background font-bold disabled:opacity-50">
                  Resend confirmation
                </button>
              </div>
            )}
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">or</p>
            <div className="h-px flex-1 bg-border" />
          </div>

          <button onClick={onGoogle} disabled={busy} className="w-full h-11 rounded-xl border border-border bg-surface hover:bg-surface-2 font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50">
            <GoogleIcon />
            Continue with Google
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">One passport. Every platform.</p>
        <div className="mt-4 flex justify-center gap-4 text-[11px] text-muted-foreground/70">
          <a href="/privacy" className="hover:text-foreground underline-offset-4 hover:underline">Privacy</a>
          <span aria-hidden>·</span>
          <a href="/terms" className="hover:text-foreground underline-offset-4 hover:underline">Terms</a>
        </div>
      </div>
      <Toaster theme="dark" position="top-center" />
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full h-11 rounded-xl border border-border bg-surface px-4 text-sm font-medium outline-none focus:border-primary transition"
      />
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.3 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.5l6.3 5.3C40.9 36 44 30.5 44 24c0-1.3-.1-2.3-.4-3.5z"/>
    </svg>
  );
}
