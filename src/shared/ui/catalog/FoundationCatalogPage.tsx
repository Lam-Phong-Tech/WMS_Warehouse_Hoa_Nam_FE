/**
 * FOUNDATION CATALOG — golden fixture của design system (Part 2).
 *
 * - Dùng CHÍNH production components (@/shared/ui/components) — không mock UI.
 * - Dữ liệu cố định, tiếng Việt dài để soi wrap/overflow; không phụ thuộc
 *   API/locale/timezone runtime.
 * - Route DEV-only: /ui-foundation. E2E computed-style + screenshot:
 *   e2e/ui-foundation.spec.ts (viewport cố định, chờ settle animation).
 * - Light theme only — dark chưa thuộc baseline (semantic-dark.ts).
 */
import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import {
  SEMANTIC_LIGHT as S,
  UiButton,
  UiCard,
  UiDialog,
  UiDrawer,
  UiFormField,
  UiIcon,
  UiIconButton,
  UiStateSurface,
  UiStatusBadge,
  UiText,
  UiTextField,
} from "@/shared/ui";

const LONG_VI =
  "Phiếu xuất kho số XK-2026-000123 của Đại lý Trần Nguyễn Bách Hóa Tổng Hợp Miền Đông Nam Bộ — kiểm tra xuống dòng, không tràn ngang.";

const TOKEN_SWATCHES: Array<{ name: string; value: string }> = [
  { name: "primary", value: S.primary },
  { name: "primary-dark", value: S.primaryDark },
  { name: "secondary", value: S.secondary },
  { name: "success", value: S.success },
  { name: "warning", value: S.warning },
  { name: "error", value: S.error },
  { name: "info", value: S.info },
  { name: "bg-canvas", value: S.bgCanvas },
];

export default function FoundationCatalogPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <Box
      data-testid="ui-foundation-root"
      sx={{ display: "grid", gap: 3, maxWidth: 1080 }}
    >
      <UiText variant="pageTitle">Foundation catalog (Vuexy baseline)</UiText>

      <UiCard title="Tokens — màu chuẩn (DEC-UI-BASELINE-01)">
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 2 }}>
          {TOKEN_SWATCHES.map((swatch) => (
            <Stack sx={{ alignItems: "center", gap: 0.5 }} key={swatch.name}>
              <Box
                data-testid={`swatch-${swatch.name}`}
                sx={{
                  width: 56,
                  height: 40,
                  borderRadius: 1,
                  backgroundColor: swatch.value,
                  border: `1px solid ${S.border}`,
                }}
              />
              <UiText variant="caption">{swatch.name}</UiText>
            </Stack>
          ))}
        </Stack>
      </UiCard>

      <UiCard title="Typography">
        <Stack sx={{ gap: 1 }}>
          <UiText variant="pageTitle">Tiêu đề trang 24/500</UiText>
          <UiText variant="cardTitle">Tiêu đề card 18/600</UiText>
          <UiText variant="body">Nội dung body 15px — {LONG_VI}</UiText>
          <UiText variant="secondary">Chữ phụ 13px — nhãn, mô tả cột.</UiText>
          <UiText variant="caption">Caption 12px — ghi chú mờ.</UiText>
        </Stack>
      </UiCard>

      <UiCard title="Button / IconButton">
        <Stack sx={{ gap: 2 }}>
          <Stack
            direction="row"
            sx={{ flexWrap: "wrap", gap: 1.5, alignItems: "center" }}
          >
            <UiButton data-testid="btn-filled">Nút chính</UiButton>
            <UiButton appearance="tonal">Nút tonal</UiButton>
            <UiButton appearance="outlined">Nút viền</UiButton>
            <UiButton appearance="text">Nút chữ</UiButton>
            <UiButton color="error">Nguy hiểm</UiButton>
            <UiButton disabled>Vô hiệu</UiButton>
            <UiButton loading>Đang lưu…</UiButton>
            <UiIconButton aria-label="Làm mới" data-testid="icon-btn">
              <UiIcon name="refresh" />
            </UiIconButton>
          </Stack>
          <UiText variant="secondary">
            Hover nhấc 1px, active lún 0.97 — theo motion contract; focus ring
            hiển thị khi điều hướng bàn phím.
          </UiText>
        </Stack>
      </UiCard>

      <UiCard title="TextField / FormField">
        <Stack sx={{ gap: 2, maxWidth: 420 }}>
          <UiTextField
            data-testid="field-default"
            label="Mã phiếu"
            placeholder="VD: XK-2026-000123"
            helperText="Nhập đúng định dạng phiếu."
          />
          <UiTextField
            label="Số lượng"
            error
            helperText="Số lượng phải lớn hơn 0 (request_id: 9f2c-fixture)."
            defaultValue="-1"
          />
          <UiTextField label="Ghi chú dài" defaultValue={LONG_VI} multiline />
          <UiTextField label="Bị khóa" disabled defaultValue="Không sửa được" />
          <UiFormField label="FormField shell (control tùy ý)" required>
            <UiTextField placeholder="Control bên trong shell" />
          </UiFormField>
        </Stack>
      </UiCard>

      <UiCard title="Status badge">
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
          <UiStatusBadge
            tone="primary"
            label="ĐANG XỬ LÝ"
            data-testid="badge-primary"
          />
          <UiStatusBadge tone="success" label="ĐÃ DUYỆT" />
          <UiStatusBadge tone="warning" label="CHỜ DUYỆT" />
          <UiStatusBadge tone="error" label="TỪ CHỐI" />
          <UiStatusBadge tone="info" label="ĐANG QUÉT" />
          <UiStatusBadge tone="neutral" label="NHÁP" />
        </Stack>
      </UiCard>

      <UiCard title="Overlay — Dialog / Drawer">
        <Stack direction="row" sx={{ gap: 1.5 }}>
          <UiButton
            data-testid="open-dialog"
            onClick={() => setDialogOpen(true)}
          >
            Mở dialog
          </UiButton>
          <UiButton appearance="outlined" onClick={() => setDrawerOpen(true)}>
            Mở drawer
          </UiButton>
        </Stack>
        <UiDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Xác nhận hoàn tất xuất kho"
          actions={
            <>
              <UiButton appearance="text" onClick={() => setDialogOpen(false)}>
                Hủy
              </UiButton>
              <UiButton onClick={() => setDialogOpen(false)}>Xác nhận</UiButton>
            </>
          }
        >
          <UiText variant="body">
            Hành động này sẽ trừ tồn kho (fixture — không gọi API). {LONG_VI}
          </UiText>
        </UiDialog>
        <UiDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title="Chi tiết phiếu (drawer)"
        >
          <UiText variant="body">{LONG_VI}</UiText>
        </UiDrawer>
      </UiCard>

      <UiCard title="State surfaces">
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 2,
          }}
        >
          <UiStateSurface kind="loading" />
          <UiStateSurface
            kind="empty"
            description="Chưa có phiếu nào trong bộ lọc hiện tại."
            action={<UiButton appearance="outlined">Tạo phiếu mới</UiButton>}
          />
          <UiStateSurface
            kind="error"
            description="Máy chủ trả lỗi 500 (request_id: a1b2c3-fixture)."
            action={<UiButton>Thử lại</UiButton>}
          />
          <UiStateSurface
            kind="no-permission"
            description="Cần quyền inventory.view."
          />
        </Box>
      </UiCard>
    </Box>
  );
}
