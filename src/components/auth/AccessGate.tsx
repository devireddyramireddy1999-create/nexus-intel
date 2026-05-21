import { FormEvent, type ReactNode, useEffect, useState } from "react";
import { Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAccessStatus, unlockWithAccessCode } from "@/services/accessService";

type AccessGateProps = {
  children: ReactNode;
};

export function AccessGate({ children }: AccessGateProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isChecking, setIsChecking] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    let active = true;

    getAccessStatus()
      .then((status) => {
        if (!active) return;
        setUnlocked(!status.required || status.authorized);
      })
      .catch(() => {
        if (!active) return;
        setError("NEXUS access check is unavailable. Confirm the backend is online.");
      })
      .finally(() => {
        if (active) setIsChecking(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const status = await unlockWithAccessCode(code.trim());
      setUnlocked(!status.required || status.authorized);
      setCode("");
    } catch {
      setError("Access code rejected.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isChecking) {
    return (
      <AccessFrame>
        <Loader2 className="size-8 animate-spin text-nexus-cyan" />
        <p className="mt-4 text-sm text-muted-foreground">Checking NEXUS access...</p>
      </AccessFrame>
    );
  }

  if (unlocked) {
    return children;
  }

  return (
    <AccessFrame>
      <div className="mx-auto flex size-12 items-center justify-center rounded-lg border border-nexus-cyan/35 bg-nexus-cyan/10 text-nexus-cyan shadow-glow">
        <LockKeyhole className="size-6" />
      </div>
      <p className="mt-5 text-xs uppercase tracking-[0.28em] text-nexus-cyan">Protected App</p>
      <h1 className="mt-2 text-2xl font-semibold text-foreground">NEXUS Intel</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Enter the access code to unlock the dashboard and protected briefing APIs.
      </p>
      <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
        <Input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Access code"
          aria-label="Access code"
          type="password"
          autoComplete="current-password"
          disabled={isSubmitting}
        />
        <Button type="submit" className="w-full" disabled={!code.trim() || isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
          Unlock NEXUS
        </Button>
      </form>
      {error ? <p className="mt-4 text-sm text-nexus-danger">{error}</p> : null}
    </AccessFrame>
  );
}

function AccessFrame({ children }: { children: ReactNode }) {
  return (
    <main className="nexus-shell flex min-h-screen min-h-dvh items-center justify-center overflow-x-hidden px-4 py-10">
      <section className="glass-card panel-line w-full max-w-sm rounded-lg p-5 text-center sm:p-6">{children}</section>
    </main>
  );
}
