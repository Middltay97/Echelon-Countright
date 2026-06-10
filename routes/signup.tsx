import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/app/dashboard`,
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created — check your email to verify.");
    router.navigate({ to: "/login" });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4" style={{ background: "var(--gradient-hero)" }}>
      <div className="w-full max-w-sm card-elevated">
        <h1 className="text-2xl font-semibold">Create account</h1>
        <p className="mt-1 text-sm text-muted-foreground">New users start as Counters; an admin can promote you.</p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Full name"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@warehouse.com"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 6 chars)"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button disabled={busy} className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60">
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Have an account? <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
