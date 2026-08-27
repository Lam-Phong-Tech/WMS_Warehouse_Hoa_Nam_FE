/** Nội bộ render bằng design-system foundation (Part 3) — public API giữ nguyên. */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { UiStateSurface } from "@/shared/ui";
import { ActionButton } from "@/shared/components/actions";

export interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/** Chặn lỗi render của cây con, hiển thị màn hình lỗi thay vì trắng trang. */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log lỗi để debug — trong production nên gửi tới monitoring service
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary]", error, info);
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <UiStateSurface
          kind="error"
          title="Đã xảy ra lỗi"
          description="Có lỗi không mong muốn. Vui lòng thử tải lại trang."
          action={
            <ActionButton kind="refresh" onClick={this.handleReload}>
              Tải lại trang
            </ActionButton>
          }
        />
      );
    }
    return this.props.children;
  }
}
