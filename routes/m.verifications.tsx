import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { callMobile, clearBadge, useBadge } from "@/lib/mobile-api";
import { MobileHeader, MobileIconButton } from "@/components/mobile-header";
import { recoverFromChunkLoadError } from "@/lib/chunk-recovery";

export const Route = createFileRoute("/m/verifications")({
  component: Verifications,
  errorComponent: MobileError,
});

function MobileError({ error, reset }: { error: Error; reset: () => void }) {
  if (recoverFromChunkLoadError(error)) return null;
  return (
    <div className="min-h-dvh bg-background flex items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold text-foreground">Verifications couldn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground break-words">{error.message}</p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={reset}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
          <a
            href="/m"
            className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground"
          >
            Back to sign-in
          </a>
        </div>
      </div>
    </div>
  );
}

interface Session {
  id: string;
  name: string;
  status: string;
  due_date: string | null;
  baseline_filename: string | null;
  active_badge: string | null;
  locked_by_me: boolean;
}

function Verifications() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState<string | null>(null);
  const badge = useBadge();

  const load = (b: string) => {
    callMobile<{ sessions: Session[] }>("verifications", { badge: b })
      .then((d) => setSessions(d.sessions))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (badge === undefined) return; // not yet hydrated
    if (!badge) {
      navigate({ to: "/m" });
      return;
    }
    load(badge);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badge]);


  const signOut = () => {
    clearBadge();
    navigate({ to: "/m" });
  };

  const open = async (s: Session) => {
    if (!badge) return;
    if (s.active_badge && !s.locked_by_me) {
      toast.error(`In use by badge ${s.active_badge}`);
      return;
    }
    setEntering(s.id);
    try {
      await callMobile("enter", { badge, cycle_id: s.id });
      navigate({ to: "/m/verify/$id", params: { id: s.id } });
    } catch (e) {
      toast.error((e as Error).message);
      load(badge);

    } finally {
      setEntering(null);
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <MobileHeader
        title="Verifications"
        subtitle={badge ? `Badge ${badge}` : undefined}
        left={
          <MobileIconButton onClick={signOut} ariaLabel="Sign out">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
              <line x1="12" y1="2" x2="12" y2="12" />
            </svg>
          </MobileIconButton>
        }
      />

      <div className="px-4 pt-4 pb-10">
        <h1 className="text-lg font-semibold text-foreground">Available Verifications</h1>
        <p className="text-xs text-muted-foreground">Tap a cycle to verify counts.</p>

        <div className="mt-4 space-y-2">
          {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {!loading && sessions.length === 0 && (
            <div className="card-elevated text-center text-sm text-muted-foreground">
              No cycles ready for verification.
            </div>
          )}
          {sessions.map((s) => {
            const lockedByOther = !!s.active_badge && !s.locked_by_me;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => open(s)}
                disabled={lockedByOther || entering === s.id}
                className={`block w-full rounded-lg border border-border bg-card px-4 py-3 text-left shadow-sm transition-colors active:bg-accent ${
                  lockedByOther ? "opacity-60 cursor-not-allowed" : "hover:bg-accent/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-foreground truncate">{s.name}</div>
                  <span className="status-badge status-badge-active uppercase">{s.status}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate">
                    {s.baseline_filename ?? "—"}
                    {s.due_date ? ` · due ${s.due_date}` : ""}
                  </span>
                  {lockedByOther && (
                    <span className="status-badge status-badge-error shrink-0">
                      In use by {s.active_badge}
                    </span>
                  )}
                  {s.locked_by_me && (
                    <span className="status-badge status-badge-active shrink-0">Resume</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
