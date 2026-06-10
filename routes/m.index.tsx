import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { callMobile, clearBadge, setBadge } from "@/lib/mobile-api";
import { MobileHeader, MobileIconButton } from "@/components/mobile-header";

export const Route = createFileRoute("/m/")({
  component: BadgeSignIn,
});

function BadgeSignIn() {
  const navigate = useNavigate();
  const [badge, setBadgeInput] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState<"sessions" | "verifications" | null>(null);

  useEffect(() => {
    clearBadge();
  }, []);

  const submit = async (target: "sessions" | "verifications") => {
    const a = badge.trim();
    const b = confirm.trim();
    if (!a || !b) return toast.error("Enter your badge ID twice");
    if (a !== b) return toast.error("Badge IDs do not match");
    setLoading(target);
    try {
      const res = await callMobile<{ user_id: string; full_name: string | null }>("signin", { badge: a });
      setBadge(a);
      toast.success(`Welcome${res.full_name ? `, ${res.full_name}` : ""}`);
      navigate({ to: target === "sessions" ? "/m/sessions" : "/m/verifications" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <MobileHeader
        title="Cycle Counting"
        subtitle="Badge sign in"
        left={
          <MobileIconButton
            onClick={() => navigate({ to: "/app/dashboard" })}
            ariaLabel="Back to dashboard"
          >
            <PowerIcon />
          </MobileIconButton>
        }
      />

      <div className="flex flex-1 flex-col items-center px-6 pt-8 pb-12">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit("sessions");
          }}
          className="w-full max-w-sm space-y-5"
        >
          <div className="card-elevated space-y-5">
            <div>
              <label className="block text-sm font-semibold text-foreground">Badge ID</label>
              <input
                autoFocus
                inputMode="text"
                autoComplete="off"
                value={badge}
                onChange={(e) => setBadgeInput(e.target.value)}
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-3 text-lg shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground">Confirm Badge ID</label>
              <input
                inputMode="text"
                autoComplete="off"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-3 text-lg shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading !== null}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-4 text-base font-semibold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-60"
          >
            <PlayIcon />
            {loading === "sessions" ? "Loading…" : "View Sessions"}
          </button>

          <button
            type="button"
            onClick={() => submit("verifications")}
            disabled={loading !== null}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-4 text-base font-semibold text-foreground shadow-sm hover:bg-accent disabled:opacity-60"
          >
            <CheckIcon />
            {loading === "verifications" ? "Loading…" : "View Verifications"}
          </button>
        </form>
      </div>
    </div>
  );
}

function PowerIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="6,4 20,12 6,20" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12.5l3 3 5-6" />
    </svg>
  );
}
