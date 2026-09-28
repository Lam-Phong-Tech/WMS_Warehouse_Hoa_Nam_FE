import { useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import { AuthSessionConfirmation } from "@/modules/auth/components/AuthSessionConfirmation";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import type { User } from "@/shared/types/user";
import {
  noteWorkSessionActivity, readWorkSessionActivity, startWorkSession, WORK_SESSION_IDLE_MS,
} from "@/shared/lib/session-idle";

interface SessionConfirmationGateProps { user: User; contexts: AuthContext[] }

function needsConfirmationAt(last: number | null, now = Date.now()): boolean {
  return last === null || now - last >= WORK_SESSION_IDLE_MS;
}

/** AUTH UAT: no protected-content flash before initial confirmation. Keep the
 * existing one-hour idle gate, tab visibility checks and logout/cache policy. */
export function SessionConfirmationGate({ user, contexts }: SessionConfirmationGateProps) {
  const [needsConfirmation, setNeedsConfirmation] = useState(() =>
    needsConfirmationAt(readWorkSessionActivity()),
  );
  const lastActivityRef = useRef<number | null>(readWorkSessionActivity());

  useEffect(() => {
    // Typing/clicking on the confirmation card must never confirm implicitly.
    if (needsConfirmation) return;
    let timer: number | undefined;
    const check = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      const last = lastActivityRef.current;
      if (needsConfirmationAt(last)) {
        setNeedsConfirmation(true);
        return;
      }
      timer = window.setTimeout(check, Math.max(1, WORK_SESSION_IDLE_MS - (Date.now() - (last ?? 0))));
    };
    const recordActivity = () => {
      // A first click after sleep must not bypass an already expired idle gate.
      if (needsConfirmationAt(lastActivityRef.current)) {
        setNeedsConfirmation(true);
        return;
      }
      const now = Date.now();
      lastActivityRef.current = now;
      noteWorkSessionActivity(now);
      check();
    };
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    const events: Array<keyof DocumentEventMap> = ["pointerdown", "keydown", "touchstart", "scroll"];
    check();
    events.forEach((event) => document.addEventListener(event, recordActivity, { capture: true, passive: true }));
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      events.forEach((event) => document.removeEventListener(event, recordActivity, { capture: true }));
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [needsConfirmation]);

  if (needsConfirmation) {
    return <AuthSessionConfirmation user={user} contexts={contexts} onConfirm={() => {
      const now = Date.now();
      lastActivityRef.current = now;
      startWorkSession(now);
      setNeedsConfirmation(false);
    }} />;
  }
  return <Outlet />;
}
