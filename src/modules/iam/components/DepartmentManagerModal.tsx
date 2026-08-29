import { useState } from "react";
import {
  Box,
  MenuItem,
  Stack,
  UiAlert,
  UiDialog,
  UiStatusBadge,
  UiTextField,
} from "@/shared/ui";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";
import {
  useCreateIamDepartment,
  useIamDepartments,
  useUpdateIamDepartment,
} from "@/modules/iam/hooks/use-iam";
import type { IamDepartment } from "@/modules/iam/types/iam.types";

interface Props {
  open: boolean;
  onClose: () => void;
}

type FormState = {
  department_id: string | null;
  department_code: string;
  department_name: string;
  status: "ACTIVE" | "INACTIVE";
  description: string;
};

const EMPTY_FORM: FormState = {
  department_id: null,
  department_code: "",
  department_name: "",
  status: "ACTIVE",
  description: "",
};

/**
 * Mục 14: tạo/sửa phòng ban (BE Auth\DepartmentController đã có store/update,
 * FE trước đây chỉ đọc). Một chỗ để tạo phòng ban rồi gán người dùng vào ở màn
 * IAM-01.
 */
export function DepartmentManagerModal({ open, onClose }: Props) {
  const departmentsQuery = useIamDepartments({});
  const createMutation = useCreateIamDepartment();
  const updateMutation = useUpdateIamDepartment();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const departments = departmentsQuery.data ?? [];
  const isEditing = form.department_id !== null;
  const saving = createMutation.isPending || updateMutation.isPending;
  const canSave =
    form.department_code.trim() !== "" && form.department_name.trim() !== "";

  const resetForm = () => setForm(EMPTY_FORM);

  const startEdit = (department: IamDepartment) =>
    setForm({
      department_id: department.department_id,
      department_code: department.department_code,
      department_name: department.department_name,
      status: department.status,
      description: department.description ?? "",
    });

  const submit = () => {
    const payload = {
      department_code: form.department_code.trim(),
      department_name: form.department_name.trim(),
      status: form.status,
      description: form.description.trim() || null,
    };
    if (isEditing && form.department_id) {
      updateMutation.mutate(
        { departmentId: form.department_id, payload },
        { onSuccess: resetForm },
      );
    } else {
      createMutation.mutate(payload, { onSuccess: resetForm });
    }
  };

  return (
    <UiDialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      title="Quản lý phòng ban"
      actions={
        <ActionButton kind="close" onClick={onClose}>
          Đóng
        </ActionButton>
      }
    >
      <Stack spacing={2}>
        <UiAlert tone="info">
          Tạo phòng ban tại đây rồi gán người dùng vào phòng ban khi tạo/sửa tài
          khoản.
        </UiAlert>

        {/* Form tạo/sửa */}
        <Box
          sx={{
            display: "grid",
            gap: 1.5,
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          }}
        >
          <UiTextField
            label="Mã phòng ban"
            value={form.department_code}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                department_code: event.target.value,
              }))
            }
            placeholder="VD: HN-DEPT-KHO"
          />
          <UiTextField
            label="Tên phòng ban"
            value={form.department_name}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                department_name: event.target.value,
              }))
            }
            placeholder="VD: Phòng Kho vận"
          />
          <UiTextField
            select
            label="Trạng thái"
            value={form.status}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                status: event.target.value as "ACTIVE" | "INACTIVE",
              }))
            }
          >
            <MenuItem value="ACTIVE">Đang hoạt động</MenuItem>
            <MenuItem value="INACTIVE">Ngừng hoạt động</MenuItem>
          </UiTextField>
          <UiTextField
            label="Mô tả"
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))
            }
            placeholder="Tùy chọn"
          />
        </Box>
        <Stack direction="row" spacing={1}>
          <ActionButton
            kind={isEditing ? "save" : "create"}
            onClick={submit}
            disabled={!canSave || saving}
          >
            {isEditing ? "Lưu thay đổi" : "Thêm phòng ban"}
          </ActionButton>
          {isEditing ? (
            <ActionButton kind="reset" onClick={resetForm} disabled={saving}>
              Hủy sửa
            </ActionButton>
          ) : null}
        </Stack>

        {/* Danh sách phòng ban */}
        <Box>
          {departmentsQuery.isPending ? (
            <Box sx={{ py: 2, textAlign: "center" }}>Đang tải…</Box>
          ) : departments.length === 0 ? (
            <Box sx={{ py: 2, textAlign: "center" }}>
              Chưa có phòng ban nào.
            </Box>
          ) : (
            <Stack spacing={1}>
              {departments.map((department) => (
                <Stack
                  key={department.department_id}
                  direction="row"
                  spacing={1}
                  sx={{
                    alignItems: "center",
                    justifyContent: "space-between",
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                    borderRadius: 1,
                    px: 1.5,
                    py: 1,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ fontWeight: 600 }}>
                      {department.department_name}
                    </Box>
                    <Box sx={{ fontSize: 12, color: "text.secondary" }}>
                      {department.department_code}
                    </Box>
                  </Box>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center" }}
                  >
                    <UiStatusBadge
                      size="small"
                      tone={
                        department.status === "ACTIVE" ? "success" : "neutral"
                      }
                      label={
                        department.status === "ACTIVE" ? "Hoạt động" : "Ngừng"
                      }
                    />
                    <ActionIconButton
                      kind="edit"
                      aria-label={`Sửa ${department.department_name}`}
                      onClick={() => startEdit(department)}
                    />
                  </Stack>
                </Stack>
              ))}
            </Stack>
          )}
        </Box>
      </Stack>
    </UiDialog>
  );
}
