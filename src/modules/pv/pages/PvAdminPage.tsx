import { useMemo, useState, type ReactNode } from "react";
import {
  Box,
  Grid,
  MenuItem,
  Stack,
  UiDescriptions,
  UiDialog,
  UiSelect,
  UiStatusBadge,
  UiTabs,
  UiTabPanel,
  UiText,
  UiTextField,
} from "@/shared/ui";
import { SEMANTIC_LIGHT as S } from "@/shared/ui/tokens";
import {
  ProfileOutlined,
  ApartmentOutlined,
  TagOutlined,
  SettingOutlined,
} from "@/shared/components/icons";
import { toast } from "sonner";
import { FilterBar, SearchInput } from "@/shared/components";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import { useRowSelection } from "@/shared/hooks/useRowSelection";
import { PvErrorState } from "@/modules/pv/components/PvErrorState";
import { PvSwitch } from "@/modules/pv/components/PvSwitch";
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

/** Nhãn tab kèm icon (UiTabs nhận label ReactNode). */
function TabLabel({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box
      component="span"
      sx={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
    >
      {icon}
      {children}
    </Box>
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
  isFetching,
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
  /** Query đang refetch (sau khi lưu/invalidate) — hiện loading trên bảng. */
  isFetching: boolean;
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
  const rowSelection = useRowSelection(filteredRows, (row) => row.id);

  if (isPending)
    return <LoadingState tip="Đang tải…" testId={`${testId}-loading`} />;
  if (isError) return <PvErrorState error={error} onRetry={onRetry} />;

  // Part 5: DataTable (antd adapter, freeze) → ResponsiveDataTable — comparator
  // giữ nguyên ngữ nghĩa (localeCompare "vi" / numeric qua sortAccessor).
  const columns: ResponsiveTableColumn<PvAdminSimpleMaster>[] = [
    {
      key: "code",
      header: "Mã",
      sortAccessor: (row) => row.code,
      render: (row) => row.code,
    },
    {
      key: "name",
      header: "Tên",
      sortAccessor: (row) => row.name,
      render: (row) => row.name,
    },
    {
      key: "status",
      header: "Trạng thái",
      sortType: "value",
      sortAccessor: (row) => row.status,
      render: (row) => (
        <UiStatusBadge
          tone={row.status === "ACTIVE" ? "success" : "neutral"}
          label={masterStatusLabel(row.status)}
        />
      ),
    },
    {
      key: "sort_order",
      header: "Thứ tự",
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.sort_order,
      render: (row) => row.sort_order,
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

      <ResponsiveDataTable<PvAdminSimpleMaster>
        rows={filteredRows}
        rowKey={(row) => row.id}
        columns={columns}
        rowSelection={rowSelection}
        selectionLabel={(row) => `Chọn ${title} ${row.code}`}
        loading={isFetching}
        emptyText={
          search.trim() ? "Không có kết quả phù hợp." : `Chưa có ${title} nào.`
        }
        renderRowActions={(row) => (
          <ActionButton
            kind="edit"
            disabled={!canManage}
            data-testid={`${testId}-edit`}
            onClick={() => openForm(row)}
          >
            Sửa
          </ActionButton>
        )}
      />

      <UiDialog
        open={isOpen}
        onClose={guardBackdropClose(() => setIsOpen(false))}
        maxWidth="xs"
        title={editing ? `Sửa ${title}` : `Thêm ${title}`}
        actions={
          <>
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
          </>
        }
      >
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <UiTextField
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
          <UiTextField
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
          <UiTextField
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
          </UiTextField>
          <UiTextField
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
      </UiDialog>
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
  const profileRowSelection = useRowSelection(
    filteredProfiles,
    (row) => row.id,
  );

  // Part 5: DataTable (antd adapter, freeze) → ResponsiveDataTable.
  const profileColumns: ResponsiveTableColumn<PvAdminProfile>[] = [
    {
      key: "sku_code",
      header: "Mã SKU",
      sortAccessor: (row) => row.sku_code,
      render: (row) => row.sku_code,
    },
    {
      key: "display_name",
      header: "Tên hiển thị",
      sortAccessor: (row) => row.display_name,
      render: (row) => row.display_name,
    },
    {
      key: "industries",
      header: "Ngành nghề",
      sortType: "value",
      sortAccessor: (row) => row.industry_ids.length,
      render: (row) =>
        row.industry_ids.length > 0 ? (
          <Stack
            direction="row"
            spacing={0.5}
            sx={{ flexWrap: "wrap", rowGap: 0.5 }}
          >
            {row.industry_ids.map((id) => (
              <UiStatusBadge
                key={id}
                tone="neutral"
                label={industryNameById.get(id) ?? id}
              />
            ))}
          </Stack>
        ) : (
          <Box component="span" sx={{ color: S.textDisabled }}>
            —
          </Box>
        ),
    },
    {
      key: "published",
      header: "Hiển thị trên ứng dụng",
      sortType: "value",
      sortAccessor: (row) => Number(row.published),
      render: (row) => (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <PvSwitch
            checked={row.published}
            disabled={!canPublish}
            aria-label="Bật/tắt hiển thị trên ứng dụng"
            data-testid="pv-admin-publish-switch"
            onChange={(checked) => togglePublish(row, checked)}
          />
          <UiStatusBadge
            tone={row.published ? "success" : "neutral"}
            label={row.published ? "Đang hiển thị" : "Đang ẩn"}
          />
        </Stack>
      ),
    },
  ];

  const renderProfileRowActions = (row: PvAdminProfile) => (
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
  );

  return (
    <Box sx={{ padding: "clamp(8px, 2vw, 16px)" }}>
      <Box
        component="h1"
        sx={{
          fontSize: "clamp(17px, 3vw, 22px)",
          fontWeight: 700,
          color: S.textHigh,
          margin: "0 0 4px",
        }}
      >
        Quản trị ứng dụng phân vùng
      </Box>
      <Box
        component="p"
        sx={{ color: S.textMedium, fontSize: 13, marginTop: 0 }}
      >
        Quản lý ngành nghề, thẻ phân loại, quy tắc gợi ý và hồ sơ sản phẩm hiển
        thị trên ứng dụng.
        {canPublish
          ? ""
          : " Tài khoản hiện tại không có quyền bật hoặc tắt hiển thị sản phẩm."}
      </Box>

      <Box sx={{ mb: 2 }}>
        <UiTabs
          value={activeTab}
          onChange={setActiveTab}
          aria-label="Quản trị ứng dụng phân vùng"
          items={[
            {
              key: "profiles",
              label: (
                <TabLabel icon={<ProfileOutlined style={{ fontSize: 15 }} />}>
                  Hồ sơ sản phẩm
                </TabLabel>
              ),
            },
            {
              key: "industries",
              label: (
                <TabLabel icon={<ApartmentOutlined style={{ fontSize: 15 }} />}>
                  Ngành nghề
                </TabLabel>
              ),
            },
            {
              key: "tags",
              label: (
                <TabLabel icon={<TagOutlined style={{ fontSize: 15 }} />}>
                  Thẻ phân loại
                </TabLabel>
              ),
            },
            {
              key: "rules",
              label: (
                <TabLabel icon={<SettingOutlined style={{ fontSize: 15 }} />}>
                  Quy tắc gợi ý
                </TabLabel>
              ),
            },
          ]}
        />
      </Box>

      {activeTab === "profiles" ? (
        <UiTabPanel value={activeTab}>
          {profiles.isPending ? (
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
                <UiSelect
                  value={profileIndustryFilter}
                  aria-label="Lọc theo ngành nghề"
                  minWidth={180}
                  onChange={(value) => setProfileIndustryFilter(value)}
                  options={[
                    { value: "ALL", label: "Tất cả ngành nghề" },
                    ...industryOptions,
                  ]}
                />
                <UiSelect
                  value={profilePublishedFilter}
                  aria-label="Lọc theo trạng thái hiển thị"
                  minWidth={180}
                  onChange={(value) =>
                    setProfilePublishedFilter(
                      value as "ALL" | "PUBLISHED" | "HIDDEN",
                    )
                  }
                  options={[
                    { value: "ALL", label: "Tất cả trạng thái" },
                    { value: "PUBLISHED", label: "Đang hiển thị" },
                    { value: "HIDDEN", label: "Đang ẩn" },
                  ]}
                />
              </FilterBar>
              <ResponsiveDataTable<PvAdminProfile>
                rows={filteredProfiles}
                rowKey={(row) => row.id}
                columns={profileColumns}
                rowSelection={profileRowSelection}
                selectionLabel={(row) => `Chọn hồ sơ ${row.sku_code}`}
                loading={profiles.isFetching}
                emptyText={
                  isProfileFilterActive
                    ? "Không có kết quả phù hợp."
                    : "Chưa có hồ sơ sản phẩm nào. Hồ sơ được tạo khi sản phẩm được đưa lên ứng dụng lần đầu."
                }
                renderRowActions={renderProfileRowActions}
              />
            </div>
          )}
        </UiTabPanel>
      ) : null}

      {activeTab === "industries" ? (
        <UiTabPanel value={activeTab}>
          <SimpleMasterTab
            testId="pv-admin-industries"
            title="ngành nghề"
            rows={industries.data?.data ?? []}
            isPending={industries.isPending}
            isFetching={industries.isFetching}
            isError={industries.isError}
            error={industries.error}
            onRetry={() => industries.refetch()}
            canManage={canManageMaster}
            onSave={(input) => saveIndustry.mutateAsync(input)}
          />
        </UiTabPanel>
      ) : null}

      {activeTab === "tags" ? (
        <UiTabPanel value={activeTab}>
          <SimpleMasterTab
            testId="pv-admin-tags"
            title="thẻ phân loại"
            rows={tags.data?.data ?? []}
            isPending={tags.isPending}
            isFetching={tags.isFetching}
            isError={tags.isError}
            error={tags.error}
            onRetry={() => tags.refetch()}
            canManage={canManageMaster}
            onSave={(input) => saveTag.mutateAsync(input)}
          />
        </UiTabPanel>
      ) : null}

      {activeTab === "rules" ? (
        <UiTabPanel value={activeTab}>
          {rules.isPending ? (
            <LoadingState tip="Đang tải…" testId="pv-admin-rules-loading" />
          ) : rules.isError ? (
            <PvErrorState error={rules.error} onRetry={() => rules.refetch()} />
          ) : (
            <PvRuleTab
              rows={rules.data?.data ?? []}
              isFetching={rules.isFetching}
              industryOptions={industryOptions}
              tagOptions={tagOptions}
              canManage={canManageMaster}
              onSave={(input) => saveRule.mutateAsync(input)}
            />
          )}
        </UiTabPanel>
      ) : null}

      <UiDialog
        open={profileViewing !== null}
        onClose={() => setProfileViewing(null)}
        sx={{ "& .MuiDialogTitle-root": { pr: 6, position: "relative" } }}
        title={
          <>
            Chi tiết hồ sơ sản phẩm
            <ActionIconButton
              kind="close"
              label="Đóng"
              onClick={() => setProfileViewing(null)}
              sx={{ position: "absolute", right: 10, top: 8 }}
            />
          </>
        }
      >
        {profileViewing ? (
          <UiDescriptions
            columns={2}
            items={[
              {
                label: "SKU",
                value: `${profileViewing.sku_code} — ${profileViewing.sku_name}`,
              },
              {
                label: "Tên hiển thị",
                value: profileViewing.display_name,
              },
              {
                label: "Mô tả",
                value: profileViewing.description || "—",
              },
              {
                label: "Ngành nghề",
                value:
                  profileViewing.industry_ids.length > 0 ? (
                    <Stack
                      direction="row"
                      spacing={0.5}
                      sx={{ flexWrap: "wrap", rowGap: 0.5 }}
                    >
                      {profileViewing.industry_ids.map((id) => (
                        <UiStatusBadge
                          key={id}
                          tone="neutral"
                          label={industryNameById.get(id) ?? id}
                        />
                      ))}
                    </Stack>
                  ) : (
                    "—"
                  ),
              },
              {
                label: "Thẻ phân loại",
                value:
                  profileViewing.tag_ids.length > 0 ? (
                    <Stack
                      direction="row"
                      spacing={0.5}
                      sx={{ flexWrap: "wrap", rowGap: 0.5 }}
                    >
                      {profileViewing.tag_ids.map((id) => (
                        <UiStatusBadge
                          key={id}
                          tone="neutral"
                          label={tagNameById.get(id) ?? id}
                        />
                      ))}
                    </Stack>
                  ) : (
                    "—"
                  ),
              },
              {
                label: "Thứ tự hiển thị",
                value: profileViewing.sort_order,
              },
              {
                label: "Hiển thị trên ứng dụng",
                value: (
                  <UiStatusBadge
                    tone={profileViewing.published ? "success" : "neutral"}
                    label={
                      profileViewing.published ? "Đang hiển thị" : "Đang ẩn"
                    }
                  />
                ),
              },
              {
                label: "Trạng thái SKU",
                value: (
                  <UiStatusBadge
                    tone={
                      profileViewing.sku_status === "ACTIVE"
                        ? "success"
                        : "neutral"
                    }
                    label={masterStatusLabel(profileViewing.sku_status)}
                  />
                ),
              },
            ]}
          />
        ) : null}
      </UiDialog>

      <UiDialog
        open={profileEditing !== null}
        onClose={guardBackdropClose(() => setProfileEditing(null))}
        title="Sửa thông tin hiển thị"
        actions={
          <>
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
          </>
        }
      >
        <Grid container spacing={2} sx={{ pt: 0.5 }}>
          <Grid size={{ xs: 12, sm: 8 }}>
            <UiTextField
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
            <UiTextField
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
            <UiTextField
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
            <UiTextField
              select
              fullWidth
              label="Ngành nghề"
              value={profileForm.industry_ids}
              onChange={(event) =>
                setProfileForm((current) => ({
                  ...current,
                  industry_ids: event.target.value as unknown as string[],
                }))
              }
              slotProps={{
                select: {
                  multiple: true,
                  renderValue: (selected) =>
                    (selected as string[])
                      .map((id) => industryNameById.get(id) ?? id)
                      .join(", "),
                },
              }}
            >
              {industryOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </UiTextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <UiTextField
              select
              fullWidth
              label="Thẻ phân loại"
              value={profileForm.tag_ids}
              onChange={(event) =>
                setProfileForm((current) => ({
                  ...current,
                  tag_ids: event.target.value as unknown as string[],
                }))
              }
              slotProps={{
                select: {
                  multiple: true,
                  renderValue: (selected) =>
                    (selected as string[])
                      .map((id) => tagNameById.get(id) ?? id)
                      .join(", "),
                },
              }}
            >
              {tagOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </UiTextField>
          </Grid>
          <Grid size={12}>
            <UiText variant="caption">
              Bật hoặc tắt hiển thị sản phẩm bằng công tắc ở bảng danh sách.
            </UiText>
          </Grid>
        </Grid>
      </UiDialog>
    </Box>
  );
}

function PvRuleTab({
  rows,
  isFetching,
  industryOptions,
  tagOptions,
  canManage,
  onSave,
}: {
  rows: PvAdminRule[];
  /** Query đang refetch (sau khi lưu/invalidate) — hiện loading trên bảng. */
  isFetching: boolean;
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
  const rowSelection = useRowSelection(filteredRows, (row) => row.id);

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

  // Part 5: DataTable (antd adapter, freeze) → ResponsiveDataTable.
  const columns: ResponsiveTableColumn<PvAdminRule>[] = [
    {
      key: "industry_name",
      header: "Ngành nghề",
      sortAccessor: (row) => row.industry_name ?? "",
      render: (row) => row.industry_name ?? "",
    },
    {
      key: "priority",
      header: "Mức ưu tiên",
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.priority,
      render: (row) => row.priority,
    },
    {
      key: "selector",
      header: "Điều kiện áp dụng",
      sortAccessor: (row) => ruleSelectorSortKey(row, tagNameById),
      render: (row) =>
        row.sku_id ? (
          <>
            <UiStatusBadge tone="neutral" label="SKU" /> {row.sku_id}
          </>
        ) : row.category_id ? (
          <>
            <UiStatusBadge tone="neutral" label="Nhóm hàng" /> {row.category_id}
          </>
        ) : row.tag_id ? (
          <>
            <UiStatusBadge tone="neutral" label="Thẻ phân loại" />{" "}
            {tagNameById.get(row.tag_id) ?? row.tag_id}
          </>
        ) : (
          "—"
        ),
    },
    {
      key: "status",
      header: "Trạng thái",
      sortType: "value",
      sortAccessor: (row) => row.status,
      render: (row) => (
        <UiStatusBadge
          tone={row.status === "ACTIVE" ? "success" : "neutral"}
          label={masterStatusLabel(row.status)}
        />
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
        <UiSelect
          value={statusFilter}
          aria-label="Lọc theo trạng thái"
          minWidth={180}
          onChange={(value) =>
            setStatusFilter(value as "ALL" | "ACTIVE" | "INACTIVE")
          }
          options={[
            { value: "ALL", label: "Tất cả trạng thái" },
            { value: "ACTIVE", label: "Đang sử dụng" },
            { value: "INACTIVE", label: "Ngừng sử dụng" },
          ]}
        />
      </FilterBar>
      <ResponsiveDataTable<PvAdminRule>
        rows={filteredRows}
        rowKey={(row) => row.id}
        columns={columns}
        rowSelection={rowSelection}
        selectionLabel={(row) => `Chọn quy tắc ${row.id}`}
        loading={isFetching}
        emptyText={
          search.trim() || statusFilter !== "ALL"
            ? "Không có kết quả phù hợp."
            : "Chưa có quy tắc gợi ý nào."
        }
        renderRowActions={(row) => (
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
        )}
      />

      <UiDialog
        open={viewing !== null}
        onClose={() => setViewing(null)}
        sx={{ "& .MuiDialogTitle-root": { pr: 6, position: "relative" } }}
        title={
          <>
            Chi tiết quy tắc gợi ý
            <ActionIconButton
              kind="close"
              label="Đóng"
              onClick={() => setViewing(null)}
              sx={{ position: "absolute", right: 10, top: 8 }}
            />
          </>
        }
      >
        {viewing ? (
          <UiDescriptions
            columns={2}
            items={[
              {
                label: "Ngành nghề",
                value: viewing.industry_name ?? viewing.industry_id,
              },
              {
                label: "Điều kiện áp dụng",
                value: viewing.sku_id ? (
                  <>
                    <UiStatusBadge tone="neutral" label="SKU" />{" "}
                    {viewing.sku_id}
                  </>
                ) : viewing.category_id ? (
                  <>
                    <UiStatusBadge tone="neutral" label="Nhóm hàng" />{" "}
                    {viewing.category_id}
                  </>
                ) : viewing.tag_id ? (
                  <>
                    <UiStatusBadge tone="neutral" label="Thẻ phân loại" />{" "}
                    {tagNameById.get(viewing.tag_id) ?? viewing.tag_id}
                  </>
                ) : (
                  "—"
                ),
              },
              { label: "Mức ưu tiên", value: viewing.priority },
              {
                label: "Trạng thái",
                value: (
                  <UiStatusBadge
                    tone={viewing.status === "ACTIVE" ? "success" : "neutral"}
                    label={masterStatusLabel(viewing.status)}
                  />
                ),
              },
            ]}
          />
        ) : null}
      </UiDialog>

      <UiDialog
        open={isOpen}
        onClose={guardBackdropClose(() => setIsOpen(false))}
        maxWidth="xs"
        title={editing ? "Sửa quy tắc gợi ý" : "Thêm quy tắc gợi ý"}
        actions={
          <>
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
          </>
        }
      >
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <UiTextField
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
                current.industry_id ? { ...current, industry_id: "" } : current,
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
          </UiTextField>
          <UiTextField
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
          <UiTextField
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
          </UiTextField>
          <UiTextField
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
          <UiTextField
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
          </UiTextField>
          <UiText variant="caption">
            Quy tắc phải có ít nhất một điều kiện áp dụng (SKU hoặc thẻ phân
            loại) và mức ưu tiên không được trùng với quy tắc đang sử dụng khác
            trong cùng ngành nghề.
          </UiText>
        </Stack>
      </UiDialog>
    </div>
  );
}
