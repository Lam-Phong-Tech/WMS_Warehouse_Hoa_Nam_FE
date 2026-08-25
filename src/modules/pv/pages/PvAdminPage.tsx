import { useMemo, useState } from "react";
import {
  Button,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
} from "antd";
import { EyeOutlined } from "@ant-design/icons";
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
import {
  getMutationErrorMessage,
  normalizeError,
} from "@/shared/api/api-error";
import { LoadingState } from "@/shared/components/data-display/LoadingState";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";
import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";
import {
  MASTER_STATUS_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import { useAuthStore } from "@/shared/store/auth.store";

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

function masterStatusLabel(status: string) {
  return businessLabel(MASTER_STATUS_LABELS, status, "Trạng thái khác");
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

  if (isPending)
    return <LoadingState tip="Đang tải…" testId={`${testId}-loading`} />;
  if (isError) return <PvErrorState error={error} onRetry={onRetry} />;

  return (
    <div data-testid={testId}>
      <div style={{ marginBottom: 12 }}>
        <Button
          type="primary"
          disabled={!canManage}
          data-testid={`${testId}-create`}
          {...(canManage
            ? {}
            : uiStateProps(UI_STATE.DISABLED, `${testId}-create-disabled`))}
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
              <Tag color={status === "ACTIVE" ? "green" : "default"}>
                {masterStatusLabel(status)}
              </Tag>
            ),
          },
          { title: "Thứ tự", dataIndex: "sort_order" },
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
        cancelText="Hủy"
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
                { value: "ACTIVE", label: "Đang sử dụng" },
                { value: "INACTIVE", label: "Ngừng sử dụng" },
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
      (tags.data?.data ?? []).map((tag) => ({
        value: tag.id,
        label: tag.name,
      })),
    [tags.data],
  );

  const [profileEditing, setProfileEditing] = useState<PvAdminProfile | null>(
    null,
  );
  const [profileViewing, setProfileViewing] = useState<PvAdminProfile | null>(
    null,
  );
  const industryNameById = useMemo(
    () => new Map(industryOptions.map((item) => [item.value, item.label])),
    [industryOptions],
  );
  const tagNameById = useMemo(
    () => new Map(tagOptions.map((item) => [item.value, item.label])),
    [tagOptions],
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
      toast.success("Đã cập nhật hồ sơ hiển thị.");
      setProfileEditing(null);
    } catch (error) {
      toast.error(getMutationErrorMessage(error));
    }
  }

  async function togglePublish(row: PvAdminProfile, next: boolean) {
    try {
      await setPublished.mutateAsync({
        skuId: row.sku_id,
        published: next,
        profileVersion: row.version,
      });
      toast.success(
        next
          ? "Đã đưa sản phẩm lên ứng dụng phân vùng."
          : "Đã gỡ sản phẩm khỏi ứng dụng phân vùng.",
      );
    } catch (error) {
      const normalized = normalizeError(error);
      if (normalized.status === 412 || normalized.status === 428) {
        await profiles.refetch();
        toast.error(
          "Hồ sơ sản phẩm đã được cập nhật ở phiên khác. Danh sách vừa được tải lại; hãy kiểm tra rồi thao tác lại.",
        );
        return;
      }
      toast.error(getMutationErrorMessage(error));
    }
  }

  return (
    <div style={{ padding: "clamp(8px, 2vw, 16px)" }}>
      <h1 style={{ fontSize: "clamp(17px, 3vw, 22px)", fontWeight: 700 }}>
        Quản trị ứng dụng phân vùng
      </h1>
      <p style={{ color: "#7a766c", fontSize: 13, marginTop: 0 }}>
        Quản lý ngành nghề, thẻ phân loại, quy tắc gợi ý và hồ sơ sản phẩm hiển
        thị trên ứng dụng.
        {canPublish
          ? ""
          : " Tài khoản hiện tại không có quyền bật hoặc tắt hiển thị sản phẩm."}
      </p>

      <Tabs
        destroyOnHidden
        items={[
          {
            key: "profiles",
            label: "Hồ sơ sản phẩm",
            children: profiles.isPending ? (
              <LoadingState
                tip="Đang tải…"
                testId="pv-admin-profiles-loading"
              />
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
                      "Chưa có hồ sơ sản phẩm nào. Hồ sơ được tạo khi sản phẩm được đưa lên ứng dụng lần đầu.",
                  }}
                  columns={[
                    { title: "Mã SKU", dataIndex: "sku_code" },
                    { title: "Tên hiển thị", dataIndex: "display_name" },
                    {
                      title: "Ngành nghề",
                      key: "industries",
                      render: (_, row) =>
                        row.industry_ids.length > 0 ? (
                          <Space size={[4, 4]} wrap>
                            {row.industry_ids.map((id) => (
                              <Tag key={id}>
                                {industryNameById.get(id) ?? id}
                              </Tag>
                            ))}
                          </Space>
                        ) : (
                          <span style={{ color: "#8c887e" }}>—</span>
                        ),
                    },
                    {
                      title: "Hiển thị trên ứng dụng",
                      key: "published",
                      render: (_, row) => (
                        <Space size={8}>
                          <Switch
                            checked={row.published}
                            disabled={!canPublish}
                            loading={setPublished.isPending}
                            data-testid="pv-admin-publish-switch"
                            onChange={(next) => togglePublish(row, next)}
                          />
                          <span>{row.published ? "Đang hiển thị" : "Đang ẩn"}</span>
                        </Space>
                      ),
                    },
                    {
                      title: "",
                      key: "actions",
                      render: (_, row) => (
                        <Space size={8}>
                          <Button
                            size="small"
                            icon={<EyeOutlined />}
                            data-testid="pv-admin-profile-view"
                            onClick={() => setProfileViewing(row)}
                          >
                            Xem
                          </Button>
                          <Button
                            size="small"
                            disabled={!canManageMaster}
                            data-testid="pv-admin-profile-edit"
                            onClick={() => openProfileForm(row)}
                          >
                            Sửa hiển thị
                          </Button>
                        </Space>
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
            label: "Thẻ phân loại",
            children: (
              <SimpleMasterTab
                testId="pv-admin-tags"
                title="thẻ phân loại"
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
            label: "Quy tắc gợi ý",
            children: rules.isPending ? (
              <LoadingState tip="Đang tải…" testId="pv-admin-rules-loading" />
            ) : rules.isError ? (
              <PvErrorState
                error={rules.error}
                onRetry={() => rules.refetch()}
              />
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
        open={profileViewing !== null}
        title="Chi tiết hồ sơ sản phẩm"
        onCancel={() => setProfileViewing(null)}
        footer={null}
        destroyOnHidden
      >
        {profileViewing ? (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="SKU">
              {profileViewing.sku_code} — {profileViewing.sku_name}
            </Descriptions.Item>
            <Descriptions.Item label="Tên hiển thị">
              {profileViewing.display_name}
            </Descriptions.Item>
            <Descriptions.Item label="Mô tả">
              {profileViewing.description || "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Ngành nghề">
              {profileViewing.industry_ids.length > 0 ? (
                <Space size={[4, 4]} wrap>
                  {profileViewing.industry_ids.map((id) => (
                    <Tag key={id}>{industryNameById.get(id) ?? id}</Tag>
                  ))}
                </Space>
              ) : (
                "—"
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Thẻ phân loại">
              {profileViewing.tag_ids.length > 0 ? (
                <Space size={[4, 4]} wrap>
                  {profileViewing.tag_ids.map((id) => (
                    <Tag key={id}>{tagNameById.get(id) ?? id}</Tag>
                  ))}
                </Space>
              ) : (
                "—"
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Thứ tự hiển thị">
              {profileViewing.sort_order}
            </Descriptions.Item>
            <Descriptions.Item label="Hiển thị trên ứng dụng">
              <Tag color={profileViewing.published ? "green" : "default"}>
                {profileViewing.published ? "Đang hiển thị" : "Đang ẩn"}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái SKU">
              <Tag>{masterStatusLabel(profileViewing.sku_status)}</Tag>
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>

      <Modal
        open={profileEditing !== null}
        title="Sửa thông tin hiển thị"
        onCancel={() => setProfileEditing(null)}
        onOk={submitProfile}
        okText="Lưu"
        cancelText="Hủy"
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
          <Form.Item name="tag_ids" label="Thẻ phân loại">
            <Select mode="multiple" options={tagOptions} allowClear />
          </Form.Item>
          <Form.Item name="sort_order" label="Thứ tự hiển thị">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
        <p style={{ fontSize: 12, color: "#8c887e", marginBottom: 0 }}>
          Bật hoặc tắt hiển thị sản phẩm bằng công tắc ở bảng danh sách.
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
  const [viewing, setViewing] = useState<PvAdminRule | null>(null);
  const [form] = Form.useForm();
  const tagNameById = useMemo(
    () => new Map(tagOptions.map((item) => [item.value, item.label])),
    [tagOptions],
  );

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
      toast.success(
        editing ? "Đã cập nhật quy tắc gợi ý." : "Đã thêm quy tắc gợi ý.",
      );
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
          Thêm quy tắc gợi ý
        </Button>
      </div>
      <Table<PvAdminRule>
        rowKey="id"
        size="small"
        scroll={{ x: "max-content" }}
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: "Chưa có quy tắc gợi ý nào." }}
        columns={[
          { title: "Ngành nghề", dataIndex: "industry_name" },
          { title: "Mức ưu tiên", dataIndex: "priority" },
          {
            title: "Điều kiện áp dụng",
            key: "selector",
            render: (_, row) =>
              row.sku_id ? (
                <>
                  <Tag>SKU</Tag> {row.sku_id}
                </>
              ) : row.category_id ? (
                <>
                  <Tag>Nhóm hàng</Tag> {row.category_id}
                </>
              ) : row.tag_id ? (
                <>
                  <Tag>Thẻ phân loại</Tag>{" "}
                  {tagNameById.get(row.tag_id) ?? row.tag_id}
                </>
              ) : (
                "—"
              ),
          },
          {
            title: "Trạng thái",
            dataIndex: "status",
            render: (status: string) => (
              <Tag color={status === "ACTIVE" ? "green" : "default"}>
                {masterStatusLabel(status)}
              </Tag>
            ),
          },
          {
            title: "",
            key: "actions",
            render: (_, row) => (
              <Space size={8}>
                <Button
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => setViewing(row)}
                >
                  Xem
                </Button>
                <Button
                  size="small"
                  disabled={!canManage}
                  onClick={() => openForm(row)}
                >
                  Sửa
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        open={viewing !== null}
        title="Chi tiết quy tắc gợi ý"
        onCancel={() => setViewing(null)}
        footer={null}
        destroyOnHidden
      >
        {viewing ? (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Ngành nghề">
              {viewing.industry_name ?? viewing.industry_id}
            </Descriptions.Item>
            <Descriptions.Item label="Điều kiện áp dụng">
              {viewing.sku_id ? (
                <>
                  <Tag>SKU</Tag> {viewing.sku_id}
                </>
              ) : viewing.category_id ? (
                <>
                  <Tag>Nhóm hàng</Tag> {viewing.category_id}
                </>
              ) : viewing.tag_id ? (
                <>
                  <Tag>Thẻ phân loại</Tag>{" "}
                  {tagNameById.get(viewing.tag_id) ?? viewing.tag_id}
                </>
              ) : (
                "—"
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Mức ưu tiên">
              {viewing.priority}
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <Tag color={viewing.status === "ACTIVE" ? "green" : "default"}>
                {masterStatusLabel(viewing.status)}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>

      <Modal
        open={isOpen}
        title={editing ? "Sửa quy tắc gợi ý" : "Thêm quy tắc gợi ý"}
        onCancel={() => setIsOpen(false)}
        onOk={submit}
        okText="Lưu"
        cancelText="Hủy"
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
          <Form.Item
            name="sku_id"
            label="SKU áp dụng (chọn SKU hoặc thẻ phân loại)"
          >
            <Input placeholder="Mã định danh SKU" />
          </Form.Item>
          <Form.Item name="tag_id" label="Thẻ phân loại">
            <Select options={tagOptions} allowClear />
          </Form.Item>
          <Form.Item
            name="priority"
            label="Mức ưu tiên"
            rules={[{ required: true, message: "Nhập mức ưu tiên" }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="status" label="Trạng thái">
            <Select
              options={[
                { value: "ACTIVE", label: "Đang sử dụng" },
                { value: "INACTIVE", label: "Ngừng sử dụng" },
              ]}
            />
          </Form.Item>
        </Form>
        <p style={{ fontSize: 12, color: "#8c887e", marginBottom: 0 }}>
          Quy tắc phải có ít nhất một điều kiện áp dụng (SKU hoặc thẻ phân loại)
          và mức ưu tiên không được trùng với quy tắc đang sử dụng khác trong cùng
          ngành nghề.
        </p>
      </Modal>
    </div>
  );
}
