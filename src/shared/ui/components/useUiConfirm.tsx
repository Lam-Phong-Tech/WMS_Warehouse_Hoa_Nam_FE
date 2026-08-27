/**
 * useUiConfirm — API dạng promise thay thế `Modal.confirm` của antd:
 *
 *   const { confirm, confirmDialog } = useUiConfirm();
 *   ...
 *   const ok = await confirm({ title: "Đổi trạng thái?", content: "..." });
 *   ...
 *   return (<> ... {confirmDialog} </>);
 *
 * Render bằng UiConfirmDialog canonical (token Vuexy, motion contract) —
 * `confirmDialog` PHẢI được render trong cây component gọi hook.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { UiConfirmDialog } from "./UiConfirmDialog";

export interface UiConfirmOptions {
  title: ReactNode;
  content?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: "primary" | "danger";
}

interface PendingConfirm extends UiConfirmOptions {
  resolve: (accepted: boolean) => void;
}

export function useUiConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  // Giữ resolve trong ref để đóng dialog (state null) vẫn resolve đúng lượt.
  const pendingRef = useRef<PendingConfirm | null>(null);

  const confirm = useCallback((options: UiConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      // Nếu còn lượt confirm trước chưa trả lời, coi như bị huỷ.
      pendingRef.current?.resolve(false);
      const next: PendingConfirm = { ...options, resolve };
      pendingRef.current = next;
      setPending(next);
    });
  }, []);

  const settle = useCallback((accepted: boolean) => {
    pendingRef.current?.resolve(accepted);
    pendingRef.current = null;
    setPending(null);
  }, []);

  const confirmDialog = useMemo(
    () => (
      <UiConfirmDialog
        open={pending !== null}
        title={pending?.title ?? ""}
        confirmText={pending?.confirmText}
        cancelText={pending?.cancelText}
        tone={pending?.tone}
        onConfirm={() => settle(true)}
        onClose={() => settle(false)}
      >
        {pending?.content}
      </UiConfirmDialog>
    ),
    [pending, settle],
  );

  return { confirm, confirmDialog };
}
