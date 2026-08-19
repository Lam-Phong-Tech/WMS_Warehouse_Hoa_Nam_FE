import { useMemo, useState } from "react";
import { Button, Form, Input, InputNumber, Modal, Select, Switch, Table, Tabs, Tag } from "antd";
import { toast } from "sonner";
import { PvErrorState } from "@/modules/pv/components/PvErrorState";
import {
  usePvAdminIndustries,
  usePvAdminProfiles,
  usePvAdminRules,
  usePvAdminTags,
  useSavePvIndustry,
  useSavePvProfile,
  useSavePvRule,
  useSavePvTag,
  useSetPvPublished,
} from "@/modules/pv/hooks/use-pv";
import type {
  PvAdminProfile,
  PvAdminRule,
  PvAdminSimpleMaster,
} from "@/modules/pv/types/pv.types";
import { getMutationErrorMessage, normalizeError } from "@/shared/api/api-error";
import { LoadingState } from "@/shared/components/data-display/LoadingState";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";
import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";
import { useAuthStore } from "@/shared/store/auth.store";

/**
 * WWHN-252 — SCR-PV-ADM-01 (PV publish/master).
 *
 * Hai quyền TÁCH BIỆT được thể hiện đúng trên UI (gốc của FE252-P1-03):
 * - `pv.master.manage`: tạo/sửa ngành nghề, tag, rule gợi ý, hồ sơ hiển thị.
 * - `pv.publish`: bật/tắt việc SKU xuất hiện trên mặt công khai.
 * Người chỉ có một trong hai vẫn vào được màn nhưng chỉ thao tác được đúng phần
 * của mình. UI ẩn/khoá chỉ là gợi ý — BE mới là nơi cưỡng chế (§8.4/NFR-SRS-005).
 */
function useCanManagePv() {
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  return {
    canManageMaster:
      isSuperAdmin || permissionCodes.includes(P.PV_MASTER_MANAGE),
    canPublish: isSuperAdmin || permissionCodes.includes(P.PV_PUBLISH),
  };
}

interface MasterFormValues {
  code: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  sort_order: number;
}

function SimpleMasterTab({
  title,
  rows,
  isPending,
  isError,
  error,
  onRetry,
  canManage,
  onSave,
  testId,
}: {
  title: string;
  rows: PvAdminSimpleMaster[];
  isPending: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  canManage: boolean;
  onSave: (input: {
    id?: string;
    version?: number;
    payload: MasterFormValues;
  }) => Promise<unknown>;
  testId: string;
}) {
  const [editing, setEditing] = useState<PvAdminSimpleMaster | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [form] = Form.useForm<MasterFormValues>();

  function openForm(row?: PvAdminSimpleMaster) {
    setEditing(row ?? null);
    form.setFieldsValue({
      code: row?.code ?? "",
      name: row?.name ?? "",
      status: row?.status ?? "ACTIVE",
      sort_order: row?.sort_order ?? 0,
    });
    setIsOpen(true);
  }

  async function submit() {
    const values = await form.validateFields();
    try {
      await onSave({
        id: editing?.id,
        version: editing?.version,
        payload: values,
      });
      toast.success(editing ? `Đã cập nhật ${title}.` : `Đã thêm ${title}.`);
      setIsOpen(false);
    } catch (mutationError) {
      toast.error(getMutationErrorMessage(mutationError));
    }
  }

  if (isPending) return <LoadingState tip="Đang tải…" testId={`${testId}-loading`} />;
  if (isError) return <PvErrorState error={error} onRetry={onRetry} />;

  return (
    <div data-testid={testId}>
      <div style={{ marginBottom: 12 }}>
        <Button
          type="primary"
          disabled={!canManage}
          data-testid={`${testId}-create`}
          {...(canManage ? {} : uiStateProps(UI_STATE.DISABLED, `${testId}-create-disabled`))}
          onClick={() => openForm()}
        >
          Thêm {title}
        </Button>
      </div>

      <Table<PvAdminSimpleMaster>
        rowKey="id"
        size="small"
        scroll={{ x: "max-content" }}
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: `Chưa có ${title} nào.` }}
        columns={[
          { title: "Mã", dataIndex: "code" },
          { title: "Tên", dataIndex: "name" },
          {
            title: "Trạng thái",
            dataIndex: "status",
            render: (status: string) => (
              <Tag color={status === "ACTIVE" ? "green" : "default"}>{status}</Tag>
            ),
          },
          { title: "Thứ tự", dataIndex: "sort_order" },
          { title: "Version", dataIndex: "version" },
          {
            title: "",
            key: "actions",
            render: (_, row) => (
              <Button
                size="small"
                disabled={!canManage}
                data-testid={`${testId}-edit`}
                onClick={() => openForm(row)}
              >
                Sửa
              </Button>
            ),
          },
        ]}
      />

      <Modal
        open={isOpen}
        title={editing ? `Sửa ${title}` : `Thêm ${title}`}
        onCancel={() => setIsOpen(false)}
        onOk={submit}
        okText="Lưu"
        cancelText="Huỷ"
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="code"
            label="Mã"
            rules={[{ required: true, message: "Nhập mã" }]}
          >
            <Input maxLength={80} />
          </Form.Item>
          <Form.Item
            name="name"
            label="Tên"
            rules={[{ required: true, message: "Nhập tên" }]}
          >
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item name="status" label="Trạng thái">
            <Select
              options={[
                { value: "ACTIVE", label: "ACTIVE" },
                { value: "INACTIVE", label: "INACTIVE" },
              ]}
            />
          </Form.Item>
          <Form.Item name="sort_order" label="Thứ tự hiển thị">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default function PvAdminPage() {
  const { canManageMaster, canPublish } = useCanManagePv();

  const industries = usePvAdminIndustries();
  const tags = usePvAdminTags();
  const rules = usePvAdminRules();
  const profiles = usePvAdminProfiles();

  const saveIndustry = useSavePvIndustry();
  const saveTag = useSavePvTag();
  const saveRule = useSavePvRule();
  const saveProfile = useSavePvProfile();
  const setPublished = useSetPvPublished();

  const industryOptions = useMemo(
    () =>
      (industries.data?.data ?? []).map((industry) => ({
        value: industry.id,
        label: industry.name,
      })),
    [industries.data],
  );
  const tagOptions = useMemo(
    () =>
      (tags.data?.data ?? []).map((tag) => ({ value: tag.id, label: tag.name })),
    [tags.data],
  );

  const [profileEditing, setProfileEditing] = useState<PvAdminProfile | null>(
    null,
  );
  const [profileForm] = Form.useForm<{
    display_name: string;
    description?: string;
    sort_order: number;
    industry_ids: string[];
    tag_ids: string[];
  }>();

  function openProfileForm(row: PvAdminProfile) {
    setProfileEditing(row);
    profileForm.setFieldsValue({
      display_name: row.display_name,
      description: row.description ?? "",
      sort_order: row.sort_order,
      industry_ids: row.industry_ids,
      tag_ids: row.tag_ids,
    });
  }

  async function submitProfile() {
    if (!profileEditing) return;
    const values = await profileForm.validateFields();
    try {
      await saveProfile.mutateAsync({
        id: profileEditing.id,
        version: profileEditing.version,
        payload: {
          display_name: values.display_name,
          description: values.description ?? null,
          sort_order: values.sort_order,
          industry_ids: values.industry_ids ?? [],
          tag_ids: values.tag_ids ?? [],
        },
      });
      toast.success("Đã cập nhật hồ sơ App PV.");
      setProfileEditing(null);
    } catch (error) {
      toast.error(getMutationErrorMessage(error));
    }
  }

  /**
   * FE252-P1-08 — công tắc publish gửi If-Match theo version hồ sơ App PV của
   * ĐÚNG dòng đang bấm (`row.version`, nguồn: GET /pv-admin/resources/
   * product-profiles). Không có version nào được đoán ở đây.
   *
   * 412 STALE_VERSION / 428 PRECONDITION_REQUIRED đều có nghĩa là màn hình đang
   * cầm dữ liệu cũ, nên phải tải lại danh sách rồi mới cho bấm tiếp — báo lỗi
   * suông sẽ khiến người dùng bấm lại đúng version cũ và hỏng lần nữa.
   */
  async function togglePublish(row: PvAdminProfile, next: boolean) {
    try {
      await setPublished.mutateAsync({
        skuId: row.sku_id,
        published: next,
        profileVersion: row.version,
      });
      toast.success(next ? "Đã publish lên App PV." : "Đã gỡ khỏi App PV.");
    } catch (error) {
      const normalized = normalizeError(error);
      if (normalized.status === 412 || normalized.status === 428) {
        await profiles.refetch();
        toast.error(
          "Hồ sơ App PV đã đổi ở phiên khác. Danh sách vừa được tải lại — kiểm tra rồi bật/tắt lại.",
        );
        return;
      }
      toast.error(getMutationErrorMessage(error));
    }
  }

  return (
    <div style={{ padding: "clamp(8px, 2vw, 16px)" }}>
      <h1 style={{ fontSize: "clamp(17px, 3vw, 22px)", fontWeight: 700 }}>
        Quản trị App PV
      </h1>
      <p style={{ color: "#7a766c", fontSize: 13, marginTop: 0 }}>
        Ngành nghề, tag, rule gợi ý và hồ sơ hiển thị của trang công khai.
        {canPublish ? "" : " Bạn không có quyền pv.publish nên không bật/tắt được publish."}
      </p>

      <Tabs
        destroyOnHidden
        items={[
          {
            key: "profiles",
            label: "Hồ sơ sản phẩm",
            children: profiles.isPending ? (
              <LoadingState tip="Đang tải…" testId="pv-admin-profiles-loading" />
            ) : profiles.isError ? (
              <PvErrorState
                error={profiles.error}
                onRetry={() => profiles.refetch()}
              />
            ) : (
              <div data-testid="pv-admin-profiles">
                <Table<PvAdminProfile>
                  rowKey="id"
                  size="small"
                  scroll={{ x: "max-content" }}
                  dataSource={profiles.data?.data ?? []}
                  pagination={false}
                  locale={{
                    emptyText:
                      "Chưa có hồ sơ App PV nào. Hồ sơ được tạo khi SKU được publish lần đầu.",
                  }}
                  columns={[
                    { title: "Mã SKU", dataIndex: "sku_code" },
                    { title: "Tên hiển thị", dataIndex: "display_name" },
                    {
                      title: "Ngành nghề",
                      key: "industries",
                      render: (_, row) => row.industry_ids.length,
                    },
                    {
                      title: "Publish",
                      key: "published",
                      render: (_, row) => (
                        <Switch
                          checked={row.published}
                          disabled={!canPublish}
                          loading={setPublished.isPending}
                          data-testid="pv-admin-publish-switch"
                          onChange={(next) => togglePublish(row, next)}
                        />
                      ),
                    },
                    {
                      title: "",
                      key: "actions",
                      render: (_, row) => (
                        <Button
                          size="small"
                          disabled={!canManageMaster}
                          data-testid="pv-admin-profile-edit"
                          onClick={() => openProfileForm(row)}
                        >
                          Sửa hiển thị
                        </Button>
                      ),
                    },
                  ]}
                />
              </div>
            ),
          },
          {
            key: "industries",
            label: "Ngành nghề",
            children: (
              <SimpleMasterTab
                testId="pv-admin-industries"
                title="ngành nghề"
                rows={industries.data?.data ?? []}
                isPending={industries.isPending}
                isError={industries.isError}
                error={industries.error}
                onRetry={() => industries.refetch()}
                canManage={canManageMaster}
                onSave={(input) => saveIndustry.mutateAsync(input)}
              />
            ),
          },
          {
            key: "tags",
            label: "Tag",
            children: (
              <SimpleMasterTab
                testId="pv-admin-tags"
                title="tag"
                rows={tags.data?.data ?? []}
                isPending={tags.isPending}
                isError={tags.isError}
                error={tags.error}
                onRetry={() => tags.refetch()}
                canManage={canManageMaster}
                onSave={(input) => saveTag.mutateAsync(input)}
              />
            ),
          },
          {
            key: "rules",
            label: "Rule gợi ý",
            children: rules.isPending ? (
              <LoadingState tip="Đang tải…" testId="pv-admin-rules-loading" />
            ) : rules.isError ? (
              <PvErrorState error={rules.error} onRetry={() => rules.refetch()} />
            ) : (
              <PvRuleTab
                rows={rules.data?.data ?? []}
                industryOptions={industryOptions}
                tagOptions={tagOptions}
                canManage={canManageMaster}
                onSave={(input) => saveRule.mutateAsync(input)}
              />
            ),
          },
        ]}
      />

      <Modal
        open={profileEditing !== null}
        title="Sửa hiển thị App PV"
        onCancel={() => setProfileEditing(null)}
        onOk={submitProfile}
        okText="Lưu"
        cancelText="Huỷ"
        destroyOnHidden
      >
        <Form form={profileForm} layout="vertical">
          <Form.Item
            name="display_name"
            label="Tên hiển thị"
            rules={[{ required: true, message: "Nhập tên hiển thị" }]}
          >
            <Input maxLength={255} />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="industry_ids" label="Ngành nghề">
            <Select mode="multiple" options={industryOptions} allowClear />
          </Form.Item>
          <Form.Item name="tag_ids" label="Tag">
            <Select mode="multiple" options={tagOptions} allowClear />
          </Form.Item>
          <Form.Item name="sort_order" label="Thứ tự hiển thị">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
        <p style={{ fontSize: 12, color: "#8c887e", marginBottom: 0 }}>
          Publish/unpublish không nằm ở form này — dùng công tắc Publish ở bảng
          (yêu cầu quyền pv.publish).
        </p>
      </Modal>
    </div>
  );
}

function PvRuleTab({
  rows,
  industryOptions,
  tagOptions,
  canManage,
  onSave,
}: {
  rows: PvAdminRule[];
  industryOptions: Array<{ value: string; label: string }>;
  tagOptions: Array<{ value: string; label: string }>;
  canManage: boolean;
  onSave: (input: {
    id?: string;
    version?: number;
    payload: {
      industry_id: string;
      sku_id?: string | null;
      category_id?: string | null;
      tag_id?: string | null;
      priority: number;
      status: "ACTIVE" | "INACTIVE";
    };
  }) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState<PvAdminRule | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [form] = Form.useForm();

  function openForm(row?: PvAdminRule) {
    setEditing(row ?? null);
    form.setFieldsValue({
      industry_id: row?.industry_id,
      sku_id: row?.sku_id ?? "",
      tag_id: row?.tag_id ?? undefined,
      priority: row?.priority ?? 1,
      status: row?.status ?? "ACTIVE",
    });
    setIsOpen(true);
  }

  async function submit() {
    const values = await form.validateFields();
    try {
      await onSave({
        id: editing?.id,
        version: editing?.version,
        payload: {
          industry_id: values.industry_id,
          sku_id: values.sku_id?.trim() ? values.sku_id.trim() : null,
          tag_id: values.tag_id || null,
          category_id: null,
          priority: values.priority,
          status: values.status,
        },
      });
      toast.success(editing ? "Đã cập nhật rule." : "Đã thêm rule.");
      setIsOpen(false);
    } catch (error) {
      toast.error(getMutationErrorMessage(error));
    }
  }

  return (
    <div data-testid="pv-admin-rules">
      <div style={{ marginBottom: 12 }}>
        <Button
          type="primary"
          disabled={!canManage}
          data-testid="pv-admin-rules-create"
          onClick={() => openForm()}
        >
          Thêm rule gợi ý
        </Button>
      </div>
      <Table<PvAdminRule>
        rowKey="id"
        size="small"
        scroll={{ x: "max-content" }}
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: "Chưa có rule gợi ý nào." }}
        columns={[
          { title: "Ngành nghề", dataIndex: "industry_name" },
          { title: "Ưu tiên", dataIndex: "priority" },
          {
            title: "Selector",
            key: "selector",
            render: (_, row) =>
              row.sku_id
                ? "SKU"
                : row.category_id
                  ? "Nhóm hàng"
                  : row.tag_id
                    ? "Tag"
                    : "—",
          },
          {
            title: "Trạng thái",
            dataIndex: "status",
            render: (status: string) => (
              <Tag color={status === "ACTIVE" ? "green" : "default"}>{status}</Tag>
            ),
          },
          {
            title: "",
            key: "actions",
            render: (_, row) => (
              <Button
                size="small"
                disabled={!canManage}
                onClick={() => openForm(row)}
              >
                Sửa
              </Button>
            ),
          },
        ]}
      />

      <Modal
        open={isOpen}
        title={editing ? "Sửa rule gợi ý" : "Thêm rule gợi ý"}
        onCancel={() => setIsOpen(false)}
        onOk={submit}
        okText="Lưu"
        cancelText="Huỷ"
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="industry_id"
            label="Ngành nghề"
            rules={[{ required: true, message: "Chọn ngành nghề" }]}
          >
            <Select options={industryOptions} />
          </Form.Item>
          <Form.Item name="sku_id" label="SKU ID (chọn 1 trong 2 selector)">
            <Input placeholder="UUID của SKU" />
          </Form.Item>
          <Form.Item name="tag_id" label="Tag">
            <Select options={tagOptions} allowClear />
          </Form.Item>
          <Form.Item
            name="priority"
            label="Ưu tiên"
            rules={[{ required: true, message: "Nhập ưu tiên" }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="status" label="Trạng thái">
            <Select
              options={[
                { value: "ACTIVE", label: "ACTIVE" },
                { value: "INACTIVE", label: "INACTIVE" },
              ]}
            />
          </Form.Item>
        </Form>
        <p style={{ fontSize: 12, color: "#8c887e", marginBottom: 0 }}>
          Rule phải có ít nhất một selector (SKU hoặc Tag) và ưu tiên không trùng
          với rule ACTIVE khác trong cùng ngành nghề.
        </p>
      </Modal>
    </div>
  );
}
