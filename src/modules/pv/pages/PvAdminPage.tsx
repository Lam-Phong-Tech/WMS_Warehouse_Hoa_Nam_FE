import {
  useMemo,
  useState,
  type InputHTMLAttributes,
  type Key,
  type ReactNode,
} from "react";
import { Tag, Select } from "antd";
import {
  Autocomplete,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import {
  ProfileOutlined,
  ApartmentOutlined,
  TagOutlined,
  SettingOutlined,
} from "@/shared/components/icons";
import { toast } from "sonner";
import {
  DataTable,
  FilterBar,
  SearchInput,
  type ColumnWithSortType,
} from "@/shared/components";
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
  resolveFormErrors,
} from "@/shared/api/api-error";
import { LoadingState } from "@/shared/components/data-display/LoadingState";
import {
  WMS_PERMISSION_CATALOG as P,
  hasAnyWmsPermission,
} from "@/shared/constants/wms-permissions";
import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";
import {
  MASTER_STATUS_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import { useAuthStore } from "@/shared/store/auth.store";
import { guardBackdropClose } from "@/shared/utils/dialogGuard";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";

function useCanManagePv() {
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  // hasAnyWmsPermission thay cho `includes()`: dùng chung đúng một quy tắc so
  // khớp mã quyền với route guard, menu và các nút hành động khác.
  return {
    canManageMaster: hasAnyWmsPermission(
      permissionCodes,
      [P.PV_MASTER_MANAGE],
      isSuperAdmin,
    ),
    canPublish: hasAnyWmsPermission(
      permissionCodes,
      [P.PV_PUBLISH],
      isSuperAdmin,
    ),
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

function ruleSelectorSortKey(
  row: PvAdminRule,
  tagNameById: Map<string, string>,
) {
  if (row.sku_id) return row.sku_id;
  if (row.category_id) return row.category_id;
  if (row.tag_id) return tagNameById.get(row.tag_id) ?? row.tag_id;
  return "";
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Grid size={{ xs: 12, sm: 6 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block" }}
      >
        {label}
      </Typography>
      <Typography variant="body2" component="div">
        {value}
      </Typography>
    </Grid>
  );
}

/**
 * Các ô nhập có chỗ hiển thị lỗi riêng (`error` + `helperText`). Lỗi server
 * thuộc field ngoài danh sách sẽ rơi về toast tổng — xem `resolveFormErrors`.
 * Tên field giữ nguyên dạng của BE vì form này đặt state theo đúng payload.
 */
const MASTER_FORM_FIELDS = ["code", "name"] as const;

const RULE_FORM_FIELDS = ["industry_id", "priority"] as const;

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
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [search, setSearch] = useState("");
  const [formValues, setFormValues] = useState<MasterFormValues>({
    code: "",
    name: "",
    status: "ACTIVE",
    sort_order: 0,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function openForm(row?: PvAdminSimpleMaster) {
    setEditing(row ?? null);
    setFormValues({
      code: row?.code ?? "",
      name: row?.name ?? "",
      status: row?.status ?? "ACTIVE",
      sort_order: row?.sort_order ?? 0,
    });
    setFieldErrors({});
    setIsOpen(true);
  }

  async function submit() {
    const errors: Record<string, string> = {};
    if (!formValues.code.trim()) errors.code = "Nhập mã";
    if (!formValues.name.trim()) errors.name = "Nhập tên";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setSaving(true);
    try {
      await onSave({
        id: editing?.id,
        version: editing?.version,
        payload: formValues,
      });
      toast.success(editing ? `Đã cập nhật ${title}.` : `Đã thêm ${title}.`);
      setIsOpen(false);
    } catch (mutationError) {
      // Lỗi thuộc về một ô cụ thể thì hiện ngay dưới ô đó; toast chỉ báo phần
      // còn lại, tránh lặp lại cùng một nội dung ở hai nơi.
      const { fieldErrors: serverFieldErrors, message } = resolveFormErrors(
        mutationError,
        MASTER_FORM_FIELDS,
      );
      setFieldErrors((current) => ({ ...current, ...serverFieldErrors }));
      if (message) toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter(
      (row) =>
        row.code.toLowerCase().includes(query) ||
        row.name.toLowerCase().includes(query),
    );
  }, [rows, search]);

  if (isPending)
    return <LoadingState tip="Đang tải…" testId={`${testId}-loading`} />;
  if (isError) return <PvErrorState error={error} onRetry={onRetry} />;

  const columns: ColumnWithSortType<PvAdminSimpleMaster> = [
    {
      title: "Mã",
      dataIndex: "code",
      sorter: (a, b) => a.code.localeCompare(b.code, "vi"),
    },
    {
      title: "Tên",
      dataIndex: "name",
      sorter: (a, b) => a.name.localeCompare(b.name, "vi"),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      sortType: "value",
      sorter: (a, b) => a.status.localeCompare(b.status),
      render: (status: string) => (
        <Tag color={status === "ACTIVE" ? "green" : "default"}>
          {masterStatusLabel(status)}
        </Tag>
      ),
    },
    {
      title: "Thứ tự",
      dataIndex: "sort_order",
      align: "right",
      sortType: "value",
      sorter: (a, b) => a.sort_order - b.sort_order,
    },
    {
      title: "",
      key: "actions",
      render: (_, row) => (
        <ActionButton
          kind="edit"
          disabled={!canManage}
          data-testid={`${testId}-edit`}
          onClick={() => openForm(row)}
        >
          Sửa
        </ActionButton>
      ),
    },
  ];

  return (
    <div data-testid={testId}>
      <FilterBar
        actions={
          <ActionButton
            kind="create"
            disabled={!canManage}
            data-testid={`${testId}-create`}
            {...(canManage
              ? {}
              : uiStateProps(UI_STATE.DISABLED, `${testId}-create-disabled`))}
            onClick={() => openForm()}
          >
            Thêm {title}
          </ActionButton>
        }
      >
        <SearchInput
          placeholder={`Tìm ${title} theo mã hoặc tên...`}
          value={search}
          onChange={setSearch}
          width={260}
        />
      </FilterBar>

      <DataTable<PvAdminSimpleMaster>
        rowKey="id"
        size="small"
        scroll={{ x: "max-content" }}
        dataSource={filteredRows}
        rowSelection={{
          type: "checkbox",
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        locale={{
          emptyText: search.trim()
            ? "Không có kết quả phù hợp."
            : `Chưa có ${title} nào.`,
        }}
        columns={columns}
      />

      <>
        <Dialog
          open={isOpen}
          onClose={guardBackdropClose(() => setIsOpen(false))}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>
            {editing ? `Sửa ${title}` : `Thêm ${title}`}
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              <TextField
                required
                fullWidth
                label="Mã"
                value={formValues.code}
                onChange={(event) => {
                  const value = event.target.value;
                  setFormValues((current) => ({ ...current, code: value }));
                  setFieldErrors((current) =>
                    current.code ? { ...current, code: "" } : current,
                  );
                }}
                error={Boolean(fieldErrors.code)}
                helperText={fieldErrors.code}
                slotProps={{ htmlInput: { maxLength: 80 } }}
              />
              <TextField
                required
                fullWidth
                label="Tên"
                value={formValues.name}
                onChange={(event) => {
                  const value = event.target.value;
                  setFormValues((current) => ({ ...current, name: value }));
                  setFieldErrors((current) =>
                    current.name ? { ...current, name: "" } : current,
                  );
                }}
                error={Boolean(fieldErrors.name)}
                helperText={fieldErrors.name}
                slotProps={{ htmlInput: { maxLength: 200 } }}
              />
              <TextField
                select
                fullWidth
                label="Trạng thái"
                value={formValues.status}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    status: event.target.value as "ACTIVE" | "INACTIVE",
                  }))
                }
              >
                <MenuItem value="ACTIVE">Đang sử dụng</MenuItem>
                <MenuItem value="INACTIVE">Ngừng sử dụng</MenuItem>
              </TextField>
              <TextField
                fullWidth
                type="number"
                label="Thứ tự hiển thị"
                value={formValues.sort_order}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    sort_order: Number(event.target.value) || 0,
                  }))
                }
                slotProps={{ htmlInput: { min: 0 } }}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <ActionButton
              kind="cancel"
              onClick={() => setIsOpen(false)}
              disabled={saving}
            >
              Hủy
            </ActionButton>
            <ActionButton
              kind="save"
              onClick={() => void submit()}
              disabled={saving}
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </ActionButton>
          </DialogActions>
        </Dialog>
      </>
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

  const [activeTab, setActiveTab] = useState("profiles");

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
  const [profileSelectedRowKeys, setProfileSelectedRowKeys] = useState<Key[]>(
    [],
  );
  const [profileSearch, setProfileSearch] = useState("");
  const [profileIndustryFilter, setProfileIndustryFilter] = useState("ALL");
  const [profilePublishedFilter, setProfilePublishedFilter] = useState<
    "ALL" | "PUBLISHED" | "HIDDEN"
  >("ALL");
  const industryNameById = useMemo(
    () => new Map(industryOptions.map((item) => [item.value, item.label])),
    [industryOptions],
  );
  const tagNameById = useMemo(
    () => new Map(tagOptions.map((item) => [item.value, item.label])),
    [tagOptions],
  );
  const [profileForm, setProfileForm] = useState<{
    display_name: string;
    description: string;
    sort_order: number;
    industry_ids: string[];
    tag_ids: string[];
  }>({
    display_name: "",
    description: "",
    sort_order: 0,
    industry_ids: [],
    tag_ids: [],
  });
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  function openProfileForm(row: PvAdminProfile) {
    setProfileEditing(row);
    setProfileForm({
      display_name: row.display_name,
      description: row.description ?? "",
      sort_order: row.sort_order,
      industry_ids: row.industry_ids,
      tag_ids: row.tag_ids,
    });
    setDisplayNameError(null);
  }

  async function submitProfile() {
    if (!profileEditing) return;
    if (!profileForm.display_name.trim()) {
      setDisplayNameError("Nhập tên hiển thị");
      return;
    }
    setSavingProfile(true);
    try {
      await saveProfile.mutateAsync({
        id: profileEditing.id,
        version: profileEditing.version,
        payload: {
          display_name: profileForm.display_name,
          description: profileForm.description || null,
          sort_order: profileForm.sort_order,
          industry_ids: profileForm.industry_ids,
          tag_ids: profileForm.tag_ids,
        },
      });
      toast.success("Đã cập nhật hồ sơ hiển thị.");
      setProfileEditing(null);
    } catch (error) {
      toast.error(getMutationErrorMessage(error));
    } finally {
      setSavingProfile(false);
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

  const profileRows = profiles.data?.data ?? [];
  const isProfileFilterActive =
    profileSearch.trim() !== "" ||
    profileIndustryFilter !== "ALL" ||
    profilePublishedFilter !== "ALL";
  const filteredProfiles = useMemo(() => {
    const query = profileSearch.trim().toLowerCase();
    return profileRows.filter((row) => {
      if (
        profileIndustryFilter !== "ALL" &&
        !row.industry_ids.includes(profileIndustryFilter)
      ) {
        return false;
      }
      if (profilePublishedFilter === "PUBLISHED" && !row.published) {
        return false;
      }
      if (profilePublishedFilter === "HIDDEN" && row.published) {
        return false;
      }
      if (!query) return true;
      return (
        row.sku_code.toLowerCase().includes(query) ||
        row.display_name.toLowerCase().includes(query)
      );
    });
  }, [
    profileRows,
    profileSearch,
    profileIndustryFilter,
    profilePublishedFilter,
  ]);

  const profileColumns: ColumnWithSortType<PvAdminProfile> = [
    {
      title: "Mã SKU",
      dataIndex: "sku_code",
      sorter: (a, b) => a.sku_code.localeCompare(b.sku_code, "vi"),
    },
    {
      title: "Tên hiển thị",
      dataIndex: "display_name",
      sorter: (a, b) => a.display_name.localeCompare(b.display_name, "vi"),
    },
    {
      title: "Ngành nghề",
      key: "industries",
      sortType: "value",
      sorter: (a, b) => a.industry_ids.length - b.industry_ids.length,
      render: (_, row) =>
        row.industry_ids.length > 0 ? (
          <Stack
            direction="row"
            spacing={0.5}
            sx={{ flexWrap: "wrap", rowGap: 0.5 }}
          >
            {row.industry_ids.map((id) => (
              <Tag key={id}>{industryNameById.get(id) ?? id}</Tag>
            ))}
          </Stack>
        ) : (
          <span style={{ color: "#8c887e" }}>—</span>
        ),
    },
    {
      title: "Hiển thị trên ứng dụng",
      key: "published",
      sortType: "value",
      sorter: (a, b) => Number(a.published) - Number(b.published),
      render: (_, row) => (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Switch
            checked={row.published}
            disabled={!canPublish}
            slotProps={{
              input: {
                "data-testid": "pv-admin-publish-switch",
              } as InputHTMLAttributes<HTMLInputElement>,
            }}
            onChange={(event) => togglePublish(row, event.target.checked)}
          />
          <Tag color={row.published ? "green" : "default"}>
            {row.published ? "Đang hiển thị" : "Đang ẩn"}
          </Tag>
        </Stack>
      ),
    },
    {
      title: "",
      key: "actions",
      render: (_, row) => (
        <Stack direction="row" spacing={1}>
          <ActionButton
            kind="view"
            data-testid="pv-admin-profile-view"
            onClick={() => setProfileViewing(row)}
          >
            Xem
          </ActionButton>
          <ActionButton
            kind="edit"
            disabled={!canManageMaster}
            data-testid="pv-admin-profile-edit"
            onClick={() => openProfileForm(row)}
          >
            Sửa hiển thị
          </ActionButton>
        </Stack>
      ),
    },
  ];

  return (
    <>
      <div style={{ padding: "clamp(8px, 2vw, 16px)" }}>
        <h1 style={{ fontSize: "clamp(17px, 3vw, 22px)", fontWeight: 700 }}>
          Quản trị ứng dụng phân vùng
        </h1>
        <p style={{ color: "#7a766c", fontSize: 13, marginTop: 0 }}>
          Quản lý ngành nghề, thẻ phân loại, quy tắc gợi ý và hồ sơ sản phẩm
          hiển thị trên ứng dụng.
          {canPublish
            ? ""
            : " Tài khoản hiện tại không có quyền bật hoặc tắt hiển thị sản phẩm."}
        </p>

        <Tabs
          value={activeTab}
          onChange={(_event, value: string) => setActiveTab(value)}
          sx={{ minHeight: 40, mb: 2 }}
        >
          <Tab
            value="profiles"
            icon={<ProfileOutlined style={{ fontSize: 15 }} />}
            iconPosition="start"
            label="Hồ sơ sản phẩm"
            sx={{ minHeight: 40, textTransform: "none" }}
          />
          <Tab
            value="industries"
            icon={<ApartmentOutlined style={{ fontSize: 15 }} />}
            iconPosition="start"
            label="Ngành nghề"
            sx={{ minHeight: 40, textTransform: "none" }}
          />
          <Tab
            value="tags"
            icon={<TagOutlined style={{ fontSize: 15 }} />}
            iconPosition="start"
            label="Thẻ phân loại"
            sx={{ minHeight: 40, textTransform: "none" }}
          />
          <Tab
            value="rules"
            icon={<SettingOutlined style={{ fontSize: 15 }} />}
            iconPosition="start"
            label="Quy tắc gợi ý"
            sx={{ minHeight: 40, textTransform: "none" }}
          />
        </Tabs>

        {activeTab === "profiles" ? (
          profiles.isPending ? (
            <LoadingState tip="Đang tải…" testId="pv-admin-profiles-loading" />
          ) : profiles.isError ? (
            <PvErrorState
              error={profiles.error}
              onRetry={() => profiles.refetch()}
            />
          ) : (
            <div data-testid="pv-admin-profiles">
              <FilterBar>
                <SearchInput
                  placeholder="Tìm theo mã SKU hoặc tên hiển thị..."
                  value={profileSearch}
                  onChange={setProfileSearch}
                  width={260}
                />
                <Select
                  value={profileIndustryFilter}
                  style={{ width: 180 }}
                  onChange={(value: string) => setProfileIndustryFilter(value)}
                  options={[
                    { value: "ALL", label: "Tất cả ngành nghề" },
                    ...industryOptions,
                  ]}
                />
                <Select
                  value={profilePublishedFilter}
                  style={{ width: 180 }}
                  onChange={(value: "ALL" | "PUBLISHED" | "HIDDEN") =>
                    setProfilePublishedFilter(value)
                  }
                  options={[
                    { value: "ALL", label: "Tất cả trạng thái" },
                    { value: "PUBLISHED", label: "Đang hiển thị" },
                    { value: "HIDDEN", label: "Đang ẩn" },
                  ]}
                />
              </FilterBar>
              <DataTable<PvAdminProfile>
                rowKey="id"
                size="small"
                scroll={{ x: "max-content" }}
                dataSource={filteredProfiles}
                rowSelection={{
                  type: "checkbox",
                  selectedRowKeys: profileSelectedRowKeys,
                  onChange: setProfileSelectedRowKeys,
                }}
                locale={{
                  emptyText: isProfileFilterActive
                    ? "Không có kết quả phù hợp."
                    : "Chưa có hồ sơ sản phẩm nào. Hồ sơ được tạo khi sản phẩm được đưa lên ứng dụng lần đầu.",
                }}
                columns={profileColumns}
              />
            </div>
          )
        ) : null}

        {activeTab === "industries" ? (
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
        ) : null}

        {activeTab === "tags" ? (
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
        ) : null}

        {activeTab === "rules" ? (
          rules.isPending ? (
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
          )
        ) : null}

        <Dialog
          open={profileViewing !== null}
          onClose={() => setProfileViewing(null)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ pr: 6, position: "relative" }}>
            Chi tiết hồ sơ sản phẩm
            <ActionIconButton
              kind="close"
              label="Đóng"
              onClick={() => setProfileViewing(null)}
              sx={{ position: "absolute", right: 10, top: 8 }}
            />
          </DialogTitle>
          <DialogContent dividers>
            {profileViewing ? (
              <Grid container spacing={2}>
                <DetailField
                  label="SKU"
                  value={`${profileViewing.sku_code} — ${profileViewing.sku_name}`}
                />
                <DetailField
                  label="Tên hiển thị"
                  value={profileViewing.display_name}
                />
                <DetailField
                  label="Mô tả"
                  value={profileViewing.description || "—"}
                />
                <DetailField
                  label="Ngành nghề"
                  value={
                    profileViewing.industry_ids.length > 0 ? (
                      <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{ flexWrap: "wrap", rowGap: 0.5 }}
                      >
                        {profileViewing.industry_ids.map((id) => (
                          <Tag key={id}>{industryNameById.get(id) ?? id}</Tag>
                        ))}
                      </Stack>
                    ) : (
                      "—"
                    )
                  }
                />
                <DetailField
                  label="Thẻ phân loại"
                  value={
                    profileViewing.tag_ids.length > 0 ? (
                      <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{ flexWrap: "wrap", rowGap: 0.5 }}
                      >
                        {profileViewing.tag_ids.map((id) => (
                          <Tag key={id}>{tagNameById.get(id) ?? id}</Tag>
                        ))}
                      </Stack>
                    ) : (
                      "—"
                    )
                  }
                />
                <DetailField
                  label="Thứ tự hiển thị"
                  value={profileViewing.sort_order}
                />
                <DetailField
                  label="Hiển thị trên ứng dụng"
                  value={
                    <Tag color={profileViewing.published ? "green" : "default"}>
                      {profileViewing.published ? "Đang hiển thị" : "Đang ẩn"}
                    </Tag>
                  }
                />
                <DetailField
                  label="Trạng thái SKU"
                  value={
                    <Tag
                      color={
                        profileViewing.sku_status === "ACTIVE"
                          ? "green"
                          : "default"
                      }
                    >
                      {masterStatusLabel(profileViewing.sku_status)}
                    </Tag>
                  }
                />
              </Grid>
            ) : null}
          </DialogContent>
        </Dialog>

        <Dialog
          open={profileEditing !== null}
          onClose={guardBackdropClose(() => setProfileEditing(null))}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Sửa thông tin hiển thị</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 8 }}>
                <TextField
                  required
                  fullWidth
                  label="Tên hiển thị"
                  value={profileForm.display_name}
                  onChange={(event) => {
                    const value = event.target.value;
                    setProfileForm((current) => ({
                      ...current,
                      display_name: value,
                    }));
                    if (displayNameError) setDisplayNameError(null);
                  }}
                  error={Boolean(displayNameError)}
                  helperText={displayNameError}
                  slotProps={{ htmlInput: { maxLength: 255 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Thứ tự hiển thị"
                  value={profileForm.sort_order}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      sort_order: Number(event.target.value) || 0,
                    }))
                  }
                  slotProps={{ htmlInput: { min: 0 } }}
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  label="Mô tả"
                  value={profileForm.description}
                  onChange={(event) =>
                    setProfileForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Autocomplete
                  multiple
                  options={industryOptions}
                  value={industryOptions.filter((option) =>
                    profileForm.industry_ids.includes(option.value),
                  )}
                  getOptionLabel={(option) => option.label}
                  isOptionEqualToValue={(option, value) =>
                    option.value === value.value
                  }
                  onChange={(_event, options) =>
                    setProfileForm((current) => ({
                      ...current,
                      industry_ids: options.map((option) => option.value),
                    }))
                  }
                  renderInput={(params) => (
                    <TextField {...params} label="Ngành nghề" />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Autocomplete
                  multiple
                  options={tagOptions}
                  value={tagOptions.filter((option) =>
                    profileForm.tag_ids.includes(option.value),
                  )}
                  getOptionLabel={(option) => option.label}
                  isOptionEqualToValue={(option, value) =>
                    option.value === value.value
                  }
                  onChange={(_event, options) =>
                    setProfileForm((current) => ({
                      ...current,
                      tag_ids: options.map((option) => option.value),
                    }))
                  }
                  renderInput={(params) => (
                    <TextField {...params} label="Thẻ phân loại" />
                  )}
                />
              </Grid>
              <Grid size={12}>
                <Typography variant="caption" color="text.secondary">
                  Bật hoặc tắt hiển thị sản phẩm bằng công tắc ở bảng danh sách.
                </Typography>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <ActionButton
              kind="cancel"
              onClick={() => setProfileEditing(null)}
              disabled={savingProfile}
            >
              Hủy
            </ActionButton>
            <ActionButton
              kind="save"
              onClick={() => void submitProfile()}
              disabled={savingProfile}
            >
              {savingProfile ? "Đang lưu..." : "Lưu"}
            </ActionButton>
          </DialogActions>
        </Dialog>
      </div>
    </>
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
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "ACTIVE" | "INACTIVE"
  >("ALL");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formValues, setFormValues] = useState<{
    industry_id: string;
    sku_id: string;
    tag_id: string;
    priority: number;
    status: "ACTIVE" | "INACTIVE";
  }>({
    industry_id: "",
    sku_id: "",
    tag_id: "",
    priority: 1,
    status: "ACTIVE",
  });
  const tagNameById = useMemo(
    () => new Map(tagOptions.map((item) => [item.value, item.label])),
    [tagOptions],
  );
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "ALL" && row.status !== statusFilter) return false;
      if (!query) return true;
      const selectorText = row.sku_id
        ? row.sku_id
        : row.category_id
          ? row.category_id
          : row.tag_id
            ? (tagNameById.get(row.tag_id) ?? row.tag_id)
            : "";
      const haystack =
        `${row.industry_name ?? ""} ${selectorText}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [rows, search, statusFilter, tagNameById]);

  function openForm(row?: PvAdminRule) {
    setEditing(row ?? null);
    setFormValues({
      industry_id: row?.industry_id ?? "",
      sku_id: row?.sku_id ?? "",
      tag_id: row?.tag_id ?? "",
      priority: row?.priority ?? 1,
      status: row?.status ?? "ACTIVE",
    });
    setFieldErrors({});
    setIsOpen(true);
  }

  async function submit() {
    const errors: Record<string, string> = {};
    if (!formValues.industry_id) errors.industry_id = "Chọn ngành nghề";
    if (!formValues.priority && formValues.priority !== 0) {
      errors.priority = "Nhập mức ưu tiên";
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setSaving(true);
    try {
      await onSave({
        id: editing?.id,
        version: editing?.version,
        payload: {
          industry_id: formValues.industry_id,
          sku_id: formValues.sku_id.trim() ? formValues.sku_id.trim() : null,
          tag_id: formValues.tag_id || null,
          category_id: null,
          priority: formValues.priority,
          status: formValues.status,
        },
      });
      toast.success(
        editing ? "Đã cập nhật quy tắc gợi ý." : "Đã thêm quy tắc gợi ý.",
      );
      setIsOpen(false);
    } catch (error) {
      // Lỗi thuộc về một ô cụ thể thì hiện ngay dưới ô đó; toast chỉ báo phần
      // còn lại, tránh lặp lại cùng một nội dung ở hai nơi.
      const { fieldErrors: serverFieldErrors, message } = resolveFormErrors(
        error,
        RULE_FORM_FIELDS,
      );
      setFieldErrors((current) => ({ ...current, ...serverFieldErrors }));
      if (message) toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const columns: ColumnWithSortType<PvAdminRule> = [
    {
      title: "Ngành nghề",
      dataIndex: "industry_name",
      sorter: (a, b) =>
        (a.industry_name ?? "").localeCompare(b.industry_name ?? "", "vi"),
    },
    {
      title: "Mức ưu tiên",
      dataIndex: "priority",
      align: "right",
      sortType: "value",
      sorter: (a, b) => a.priority - b.priority,
    },
    {
      title: "Điều kiện áp dụng",
      key: "selector",
      sorter: (a, b) =>
        ruleSelectorSortKey(a, tagNameById).localeCompare(
          ruleSelectorSortKey(b, tagNameById),
          "vi",
        ),
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
            <Tag>Thẻ phân loại</Tag> {tagNameById.get(row.tag_id) ?? row.tag_id}
          </>
        ) : (
          "—"
        ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      sortType: "value",
      sorter: (a, b) => a.status.localeCompare(b.status),
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
        <Stack direction="row" spacing={1}>
          <ActionButton kind="view" onClick={() => setViewing(row)}>
            Xem
          </ActionButton>
          <ActionButton
            kind="edit"
            disabled={!canManage}
            onClick={() => openForm(row)}
          >
            Sửa
          </ActionButton>
        </Stack>
      ),
    },
  ];

  return (
    <div data-testid="pv-admin-rules">
      <FilterBar
        actions={
          <ActionButton
            kind="create"
            disabled={!canManage}
            data-testid="pv-admin-rules-create"
            onClick={() => openForm()}
          >
            Thêm quy tắc gợi ý
          </ActionButton>
        }
      >
        <SearchInput
          placeholder="Tìm theo ngành nghề, SKU, thẻ phân loại..."
          value={search}
          onChange={setSearch}
          width={280}
        />
        <Select
          value={statusFilter}
          style={{ width: 180 }}
          onChange={(value: "ALL" | "ACTIVE" | "INACTIVE") =>
            setStatusFilter(value)
          }
          options={[
            { value: "ALL", label: "Tất cả trạng thái" },
            { value: "ACTIVE", label: "Đang sử dụng" },
            { value: "INACTIVE", label: "Ngừng sử dụng" },
          ]}
        />
      </FilterBar>
      <DataTable<PvAdminRule>
        rowKey="id"
        size="small"
        scroll={{ x: "max-content" }}
        dataSource={filteredRows}
        rowSelection={{
          type: "checkbox",
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        locale={{
          emptyText:
            search.trim() || statusFilter !== "ALL"
              ? "Không có kết quả phù hợp."
              : "Chưa có quy tắc gợi ý nào.",
        }}
        columns={columns}
      />

      <Dialog
        open={viewing !== null}
        onClose={() => setViewing(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pr: 6, position: "relative" }}>
          Chi tiết quy tắc gợi ý
          <ActionIconButton
            kind="close"
            label="Đóng"
            onClick={() => setViewing(null)}
            sx={{ position: "absolute", right: 10, top: 8 }}
          />
        </DialogTitle>
        <DialogContent dividers>
          {viewing ? (
            <Grid container spacing={2}>
              <DetailField
                label="Ngành nghề"
                value={viewing.industry_name ?? viewing.industry_id}
              />
              <DetailField
                label="Điều kiện áp dụng"
                value={
                  viewing.sku_id ? (
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
                  )
                }
              />
              <DetailField label="Mức ưu tiên" value={viewing.priority} />
              <DetailField
                label="Trạng thái"
                value={
                  <Tag
                    color={viewing.status === "ACTIVE" ? "green" : "default"}
                  >
                    {masterStatusLabel(viewing.status)}
                  </Tag>
                }
              />
            </Grid>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isOpen}
        onClose={guardBackdropClose(() => setIsOpen(false))}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {editing ? "Sửa quy tắc gợi ý" : "Thêm quy tắc gợi ý"}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              select
              required
              fullWidth
              label="Ngành nghề"
              value={formValues.industry_id}
              onChange={(event) => {
                const value = event.target.value;
                setFormValues((current) => ({
                  ...current,
                  industry_id: value,
                }));
                setFieldErrors((current) =>
                  current.industry_id
                    ? { ...current, industry_id: "" }
                    : current,
                );
              }}
              error={Boolean(fieldErrors.industry_id)}
              helperText={fieldErrors.industry_id}
            >
              {industryOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              label="SKU áp dụng (chọn SKU hoặc thẻ phân loại)"
              placeholder="Mã định danh SKU"
              value={formValues.sku_id}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  sku_id: event.target.value,
                }))
              }
            />
            <TextField
              select
              fullWidth
              label="Thẻ phân loại"
              value={formValues.tag_id}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  tag_id: event.target.value,
                }))
              }
            >
              <MenuItem value="">
                <em>Không chọn</em>
              </MenuItem>
              {tagOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              required
              fullWidth
              type="number"
              label="Mức ưu tiên"
              value={formValues.priority}
              onChange={(event) => {
                const value = Number(event.target.value) || 0;
                setFormValues((current) => ({
                  ...current,
                  priority: value,
                }));
                setFieldErrors((current) =>
                  current.priority ? { ...current, priority: "" } : current,
                );
              }}
              error={Boolean(fieldErrors.priority)}
              helperText={fieldErrors.priority}
              slotProps={{ htmlInput: { min: 0 } }}
            />
            <TextField
              select
              fullWidth
              label="Trạng thái"
              value={formValues.status}
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  status: event.target.value as "ACTIVE" | "INACTIVE",
                }))
              }
            >
              <MenuItem value="ACTIVE">Đang sử dụng</MenuItem>
              <MenuItem value="INACTIVE">Ngừng sử dụng</MenuItem>
            </TextField>
            <Typography variant="caption" color="text.secondary">
              Quy tắc phải có ít nhất một điều kiện áp dụng (SKU hoặc thẻ phân
              loại) và mức ưu tiên không được trùng với quy tắc đang sử dụng
              khác trong cùng ngành nghề.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <ActionButton
            kind="cancel"
            onClick={() => setIsOpen(false)}
            disabled={saving}
          >
            Hủy
          </ActionButton>
          <ActionButton
            kind="save"
            onClick={() => void submit()}
            disabled={saving}
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </ActionButton>
        </DialogActions>
      </Dialog>
    </div>
  );
}
