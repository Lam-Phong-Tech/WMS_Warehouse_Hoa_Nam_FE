import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button, Result } from "antd";

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
        <Result
          status="error"
          title="Đã xảy ra lỗi"
          subTitle="Có lỗi không mong muốn. Vui lòng thử tải lại trang."
          extra={
            <Button type="primary" onClick={this.handleReload}>
              Tải lại trang
            </Button>
          }
        />
      );
    }
    return this.props.children;
  }
}
