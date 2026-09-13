import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import { AuthSessionConfirmation } from "@/modules/auth/components/AuthSessionConfirmation";
import type { AuthContext } from "@/modules/auth/types/auth.types";
import type { User } from "@/shared/types/user";
import {
  noteWorkSessionActivity,
  readWorkSessionActivity,
  startWorkSession,
  WORK_SESSION_IDLE_MS,
} from "@/shared/lib/session-idle";

interface SessionConfirmationGateProps {
  user: User;
  contexts: AuthContext[];
}

/**
 * Chỉ chặn ứng dụng khi tab không có thao tác trong một giờ. Kiểm tra lại mốc
 * khi tab hiển thị trở lại để vẫn chính xác nếu browser đã giảm timer nền.
 */
export function SessionConfirmationGate({
  user,
  contexts,
}: SessionConfirmationGateProps) {
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const lastActivityRef = useRef<number | null>(null);

  const checkIdle = useCallback(() => {
    const lastActivity = lastActivityRef.current;
    if (
      lastActivity !== null &&
      Date.now() - lastActivity >= WORK_SESSION_IDLE_MS
    ) {
      setNeedsConfirmation(true);
    }
  }, []);

  useEffect(() => {
    const storedActivity = readWorkSessionActivity();
    const initialActivity = storedActivity ?? Date.now();
    lastActivityRef.current = initialActivity;
    if (storedActivity === null) startWorkSession(initialActivity);

    let timer: number | undefined;
    const scheduleCheck = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      const lastActivity = lastActivityRef.current;
      if (lastActivity === null) return;
      const remaining = Math.max(
        0,
        WORK_SESSION_IDLE_MS - (Date.now() - lastActivity),
      );
      timer = window.setTimeout(checkIdle, remaining);
    };
    const recordActivity = () => {
      if (needsConfirmation) return;
      const now = Date.now();
      lastActivityRef.current = now;
      noteWorkSessionActivity(now);
      scheduleCheck();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        checkIdle();
        scheduleCheck();
      }
    };
    scheduleCheck();
    const events: Array<keyof DocumentEventMap> = [
      "pointerdown",
      "keydown",
      "touchstart",
      "scroll",
    ];

    events.forEach((event) =>
      document.addEventListener(event, recordActivity, {
        capture: true,
        passive: true,
      }),
    );
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      events.forEach((event) =>
        document.removeEventListener(event, recordActivity, { capture: true }),
      );
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [checkIdle, needsConfirmation]);

  if (needsConfirmation) {
    return (
      <AuthSessionConfirmation
        user={user}
        contexts={contexts}
        onConfirm={() => {
          const now = Date.now();
          lastActivityRef.current = now;
          startWorkSession(now);
          setNeedsConfirmation(false);
        }}
      />
    );
  }

  return <Outlet />;
}
