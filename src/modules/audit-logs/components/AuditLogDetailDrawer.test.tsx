import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";
import { AuditLogDetailDrawer } from "./AuditLogDetailDrawer";
import type { AuditLog } from "../types/audit-logs.types";

/** Bản ghi thật rút từ DB dev — đúng ca người dùng chụp màn hình 2026-09-07. */
const LOG: AuditLog = {
  id: "01a07b3c-0000-0000-0000-0000000036196c",
  actor_id: "user-1",
  actor: {
    user_id: "user-1",
    username: "quanlykho03",
    display_name: "Quản lý kho 03",
    email: "quanlykho03@gmail.com",
    phone: null,
    department_id: null,
    status: "ACTIVE",
    created_at: "2026-08-27T10:00:00Z",
    updated_at: "2026-08-27T10:00:00Z",
    deleted_at: null,
  },
  action: "POST_ISSUE",
  object_type: "stock_document",
  object_id: "ecd447d4-aae2-460b-8626-66b146951de1",
  module: "OUTBOUND",
  reason: null,
  description:
    "POST_ISSUE stock_document #ecd447d4-aae2-460b-8626-66b146951de1",
  request_id: null,
  result: "SUCCESS",
  error_code: null,
  ip_address: "127.0.0.1",
  before_data: { status: "SCANNING" },
  after_data: {
    status: "POSTED",
    doc_no: "PX-COV-00038",
    stock_effect: "NONE",
  },
  created_at: "2026-09-30T16:00:00Z",
};

describe("AuditLogDetailDrawer (Chi tiết nhật ký hệ thống)", () => {
  afterEach(() => {
    cleanupTestState();
  });

  it("mô tả và đối tượng là tiếng Việt, không in chuỗi ghép máy của BE", () => {
    renderWithProviders(
      <AuditLogDetailDrawer open onClose={vi.fn()} auditLog={LOG} />,
    );

    expect(
      screen.getByText("Ghi nhận xuất kho — Phiếu nhập/xuất kho PX-COV-00038"),
    ).toBeInTheDocument();
    expect(screen.queryByText(LOG.description)).not.toBeInTheDocument();
    expect(screen.getByText("Phiếu nhập/xuất kho")).toBeInTheDocument();
    expect(screen.queryByText("stock_document")).not.toBeInTheDocument();
  });

  it("dữ liệu trước/sau thay đổi hiện dạng 'tên trường – giá trị', tuyệt đối không còn JSON (UAT TC_UI_13)", () => {
    renderWithProviders(
      <AuditLogDetailDrawer open onClose={vi.fn()} auditLog={LOG} />,
    );

    expect(screen.getByText("Dữ liệu trước thay đổi")).toBeInTheDocument();
    expect(screen.getByText("Dữ liệu sau thay đổi")).toBeInTheDocument();
    expect(screen.getAllByText("Trạng thái")).toHaveLength(2);
    expect(screen.getByText("Đang quét")).toBeInTheDocument();
    expect(screen.getByText("Đã ghi sổ")).toBeInTheDocument();
    expect(screen.getByText("Số chứng từ")).toBeInTheDocument();
    expect(screen.getByText("Không đổi tồn")).toBeInTheDocument();
    // UAT TC_UI_13: JSON thô không được xuất hiện dưới BẤT KỲ dạng nào —
    // nút "Xem dữ liệu gốc" đã bị gỡ hẳn.
    expect(screen.queryByText(/"status": "SCANNING"/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /dữ liệu gốc/i }),
    ).not.toBeInTheDocument();
  });
});
