import { useMemo, useState, type ReactNode } from "react";
import {
  Box,
  Grid,
  MenuItem,
  Stack,
  UiAutocomplete,
  UiDescriptions,
  UiDialog,
  UiNumberField,
  UiSelect,
  UiStatusBadge,
  UiTabs,
  UiTabPanel,
  UiText,
  UiTextField,
  FILTER_WIDTH,
} from "@/shared/ui";
import { SEMANTIC_LIGHT as S } from "@/shared/ui/tokens";
import { NUMBER_RULES, checkNumber } from "@/shared/validation/number-rules";
import { codeFormatError } from "@/shared/validation/text-rules";
import { useT, type TranslateFn } from "@/shared/i18n/useT";
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
  PvAdminSimpleMasterPayload,
} from "@/modules/pv/types/pv.types";
import {
  getMutationErrorMessage,
  normalizeError,
  resolveFormErrors,
} from "@/shared/api/api-error";
import { LoadingState } from "@/shared/components/data-display/LoadingState";
import { shortId } from "@/shared/utils/shortId";
import { CopyableId } from "@/shared/components/data-display/CopyableId";
import { SkuLink } from "@/shared/components/data-display/SkuLink";
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
import { EMPTY_TEXT } from "@/shared/constants/display";
import { rowIndexOf } from "@/shared/components/data-display/row-index";

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
  // Giữ CHUỖI đang gõ để "1e5"/"-1" bị báo lỗi thay vì bị `Number() || 0`
  // ép về 0 âm thầm; parse bằng checkNumber lúc submit.
  sort_order: string;
}

/** Định dạng UUID 8-4-4-4-12 — cùng regex với BE `looksLikeUuid` (không xét version). */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Trần mô tả hồ sơ — BE không chặn nên FE tự đặt theo mức chung của dự án. */
const PROFILE_DESCRIPTION_MAX = 2000;

function masterStatusLabel(status: string, t: TranslateFn) {
  return businessLabel(MASTER_STATUS_LABELS, status, t("pv.admin.statusOther"));
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
const MASTER_FORM_FIELDS = ["code", "name", "sort_order"] as const;

const RULE_FORM_FIELDS = [
  "industry_id",
  "sku_id",
  "tag_id",
  "priority",
] as const;

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
    payload: PvAdminSimpleMasterPayload;
  }) => Promise<unknown>;
  testId: string;
}) {
  const t = useT();
  const [editing, setEditing] = useState<PvAdminSimpleMaster | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [formValues, setFormValues] = useState<MasterFormValues>({
    code: "",
    name: "",
    status: "ACTIVE",
    sort_order: "0",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function openForm(row?: PvAdminSimpleMaster) {
    setEditing(row ?? null);
    setFormValues({
      code: row?.code ?? "",
      name: row?.name ?? "",
      status: row?.status ?? "ACTIVE",
      sort_order: String(row?.sort_order ?? 0),
    });
    setFieldErrors({});
    setIsOpen(true);
  }

  async function submit() {
    const errors: Record<string, string> = {};
    if (!formValues.code.trim()) errors.code = t("pv.admin.errCode");
    else {
      const codeError = codeFormatError(formValues.code.trim(), editing?.code);
      if (codeError) errors.code = codeError;
    }
    if (!formValues.name.trim()) errors.name = t("pv.admin.errName");
    const sortOrderCheck = checkNumber(
      formValues.sort_order,
      NUMBER_RULES.sortOrder,
    );
    if (!sortOrderCheck.ok) errors.sort_order = sortOrderCheck.message;
    if (Object.keys(errors).length > 0 || !sortOrderCheck.ok) {
      setFieldErrors(errors);
      return;
    }
    setSaving(true);
    try {
      await onSave({
        id: editing?.id,
        version: editing?.version,
        payload: {
          code: formValues.code.trim(),
          name: formValues.name.trim(),
          status: formValues.status,
          // Để trống = 0 như hành vi cũ (`Number("") || 0`).
          sort_order: sortOrderCheck.value ?? 0,
        },
      });
      toast.success(
        editing
          ? t("pv.admin.masterUpdated", { title })
          : t("pv.admin.masterCreated", { title }),
      );
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
    return (
      <LoadingState tip={t("pv.common.loading")} testId={`${testId}-loading`} />
    );
  if (isError) return <PvErrorState error={error} onRetry={onRetry} />;

  // Part 5: DataTable (antd adapter, freeze) → ResponsiveDataTable — comparator
  // giữ nguyên ngữ nghĩa (localeCompare "vi" / numeric qua sortAccessor).
  const columns: ResponsiveTableColumn<PvAdminSimpleMaster>[] = [
    {
      key: "stt",
      header: "STT",
      align: "center",
      width: 56,
      hideOnMobile: true,
      render: (row) => rowIndexOf(filteredRows, row) + 1,
    },
    {
      key: "code",
      header: t("pv.admin.colCode"),
      sortAccessor: (row) => row.code,
      render: (row) => row.code,
    },
    {
      key: "name",
      header: t("pv.admin.colName"),
      sortAccessor: (row) => row.name,
      render: (row) => row.name,
    },
    {
      key: "status",
      header: t("pv.common.fieldStatus"),
      sortType: "value",
      sortAccessor: (row) => row.status,
      render: (row) => (
        <UiStatusBadge
          tone={row.status === "ACTIVE" ? "success" : "neutral"}
          label={masterStatusLabel(row.status, t)}
        />
      ),
    },
    {
      key: "sort_order",
      header: t("pv.admin.colSortOrder"),
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
            {t("pv.admin.masterCreate", { title })}
          </ActionButton>
        }
      >
        <SearchInput
          placeholder={t("pv.admin.masterSearch", { title })}
          value={search}
          onChange={setSearch}
          width={FILTER_WIDTH.search}
        />
      </FilterBar>

      <ResponsiveDataTable<PvAdminSimpleMaster>
        rows={filteredRows}
        rowKey={(row) => row.id}
        columns={columns}
        loading={isFetching}
        emptyText={
          search.trim()
            ? t("pv.common.noMatch")
            : t("pv.admin.masterEmpty", { title })
        }
        renderRowActions={(row) => (
          <ActionButton
            kind="edit"
            disabled={!canManage}
            data-testid={`${testId}-edit`}
            onClick={() => openForm(row)}
          >
            {t("pv.common.edit")}
          </ActionButton>
        )}
      />

      <UiDialog
        open={isOpen}
        onClose={guardBackdropClose(() => setIsOpen(false))}
        maxWidth="xs"
        title={
          editing
            ? t("pv.admin.masterEdit", { title })
            : t("pv.admin.masterCreate", { title })
        }
        actions={
          <>
            <ActionButton
              kind="cancel"
              onClick={() => setIsOpen(false)}
              disabled={saving}
            >
              {t("pv.common.cancel")}
            </ActionButton>
            <ActionButton
              kind="save"
              onClick={() => void submit()}
              disabled={saving}
            >
              {saving ? t("pv.common.saving") : t("pv.common.save")}
            </ActionButton>
          </>
        }
      >
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <UiTextField
            required
            fullWidth
            label={t("pv.admin.colCode")}
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
            label={t("pv.admin.colName")}
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
            label={t("pv.common.fieldStatus")}
            value={formValues.status}
            onChange={(event) =>
              setFormValues((current) => ({
                ...current,
                status: event.target.value as "ACTIVE" | "INACTIVE",
              }))
            }
          >
            <MenuItem value="ACTIVE">{t("pv.common.statusActive")}</MenuItem>
            <MenuItem value="INACTIVE">
              {t("pv.common.statusInactive")}
            </MenuItem>
          </UiTextField>
          <UiNumberField
            fullWidth
            label={t("pv.admin.sortOrderDisplay")}
            value={formValues.sort_order}
            rule={NUMBER_RULES.sortOrder}
            onChange={(next) => {
              setFormValues((current) => ({ ...current, sort_order: next }));
              setFieldErrors((current) =>
                current.sort_order ? { ...current, sort_order: "" } : current,
              );
            }}
            error={Boolean(fieldErrors.sort_order)}
            helperText={fieldErrors.sort_order}
          />
        </Stack>
      </UiDialog>
    </div>
  );
}

export default function PvAdminPage() {
  const t = useT();
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
    // Chuỗi đang gõ — parse bằng checkNumber lúc submit (xem MasterFormValues).
    sort_order: string;
    industry_ids: string[];
    tag_ids: string[];
  }>({
    display_name: "",
    description: "",
    sort_order: "0",
    industry_ids: [],
    tag_ids: [],
  });
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>(
    {},
  );
  const [savingProfile, setSavingProfile] = useState(false);

  function openProfileForm(row: PvAdminProfile) {
    setProfileEditing(row);
    setProfileForm({
      display_name: row.display_name,
      description: row.description ?? "",
      sort_order: String(row.sort_order ?? 0),
      industry_ids: row.industry_ids,
      tag_ids: row.tag_ids,
    });
    setProfileErrors({});
  }

  async function submitProfile() {
    if (!profileEditing) return;
    const errors: Record<string, string> = {};
    const displayName = profileForm.display_name.trim();
    const description = profileForm.description.trim();
    if (!displayName) errors.display_name = t("pv.admin.errDisplayName");
    else if (displayName.length > 255)
      errors.display_name = t("shared.validation.textMaxLength", { max: 255 });
    if (description.length > PROFILE_DESCRIPTION_MAX)
      errors.description = t("shared.validation.textMaxLength", {
        max: PROFILE_DESCRIPTION_MAX,
      });
    const sortOrderCheck = checkNumber(
      profileForm.sort_order,
      NUMBER_RULES.sortOrder,
    );
    if (!sortOrderCheck.ok) errors.sort_order = sortOrderCheck.message;
    if (Object.keys(errors).length > 0 || !sortOrderCheck.ok) {
      setProfileErrors(errors);
      return;
    }
    setSavingProfile(true);
    try {
      await saveProfile.mutateAsync({
        id: profileEditing.id,
        version: profileEditing.version,
        payload: {
          display_name: displayName,
          description: description || null,
          sort_order: sortOrderCheck.value ?? 0,
          industry_ids: profileForm.industry_ids,
          tag_ids: profileForm.tag_ids,
        },
      });
      toast.success(t("pv.admin.profileUpdated"));
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
      toast.success(next ? t("pv.admin.publishOn") : t("pv.admin.publishOff"));
    } catch (error) {
      const normalized = normalizeError(error);
      if (normalized.status === 412 || normalized.status === 428) {
        await profiles.refetch();
        toast.error(t("pv.admin.publishStale"));
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

  // Part 5: DataTable (antd adapter, freeze) → ResponsiveDataTable.
  const profileColumns: ResponsiveTableColumn<PvAdminProfile>[] = [
    {
      key: "stt",
      header: "STT",
      align: "center",
      width: 56,
      hideOnMobile: true,
      render: (row) => rowIndexOf(filteredProfiles, row) + 1,
    },
    {
      key: "sku_code",
      header: t("pv.admin.skuCode"),
      sortAccessor: (row) => row.sku_code,
      // Bấm mã để xem đúng trang mà khách sẽ thấy — cách nhanh nhất để soát
      // một hồ sơ vừa sửa trước khi bật công tắc publish.
      render: (row) => <SkuLink id={row.sku_id} code={row.sku_code} />,
    },
    {
      key: "display_name",
      header: t("pv.admin.displayName"),
      sortAccessor: (row) => row.display_name,
      render: (row) => row.display_name,
    },
    {
      key: "industries",
      header: t("pv.admin.industry"),
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
                label={industryNameById.get(id) ?? shortId(id)}
              />
            ))}
          </Stack>
        ) : (
          <Box component="span" sx={{ color: S.textDisabled }}>
            {EMPTY_TEXT}
          </Box>
        ),
    },
    {
      key: "published",
      header: t("pv.admin.published"),
      sortType: "value",
      sortAccessor: (row) => Number(row.published),
      render: (row) => (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <PvSwitch
            checked={row.published}
            disabled={!canPublish}
            aria-label={t("pv.admin.publishSwitchAria")}
            data-testid="pv-admin-publish-switch"
            onChange={(checked) => togglePublish(row, checked)}
          />
          <UiStatusBadge
            tone={row.published ? "success" : "neutral"}
            label={
              row.published
                ? t("pv.admin.publishedShown")
                : t("pv.admin.publishedHidden")
            }
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
        {t("pv.common.view")}
      </ActionButton>
      <ActionButton
        kind="edit"
        disabled={!canManageMaster}
        data-testid="pv-admin-profile-edit"
        onClick={() => openProfileForm(row)}
      >
        {t("pv.admin.profileEditAction")}
      </ActionButton>
    </Stack>
  );

  return (
    <Box sx={{ padding: "clamp(8px, 2vw, 16px)" }}>
      {/* Tiêu đề màn do header chung của shell dựng (AppPageHeader). */}
      <Box
        component="p"
        sx={{ color: S.textMedium, fontSize: 13, marginTop: 0 }}
      >
        {t("pv.admin.lead")}
        {canPublish ? "" : " " + t("pv.admin.leadNoPublish")}
      </Box>

      <Box sx={{ mb: 2 }}>
        <UiTabs
          value={activeTab}
          onChange={setActiveTab}
          aria-label={t("pv.admin.tabsAria")}
          items={[
            {
              key: "profiles",
              label: (
                <TabLabel icon={<ProfileOutlined style={{ fontSize: 15 }} />}>
                  {t("pv.admin.tabProfiles")}
                </TabLabel>
              ),
            },
            {
              key: "industries",
              label: (
                <TabLabel icon={<ApartmentOutlined style={{ fontSize: 15 }} />}>
                  {t("pv.admin.tabIndustries")}
                </TabLabel>
              ),
            },
            {
              key: "tags",
              label: (
                <TabLabel icon={<TagOutlined style={{ fontSize: 15 }} />}>
                  {t("pv.admin.tabTags")}
                </TabLabel>
              ),
            },
            {
              key: "rules",
              label: (
                <TabLabel icon={<SettingOutlined style={{ fontSize: 15 }} />}>
                  {t("pv.admin.tabRules")}
                </TabLabel>
              ),
            },
          ]}
        />
      </Box>

      {activeTab === "profiles" ? (
        <UiTabPanel value={activeTab}>
          {profiles.isPending ? (
            <LoadingState
              tip={t("pv.common.loading")}
              testId="pv-admin-profiles-loading"
            />
          ) : profiles.isError ? (
            <PvErrorState
              error={profiles.error}
              onRetry={() => profiles.refetch()}
            />
          ) : (
            <div data-testid="pv-admin-profiles">
              <FilterBar>
                <SearchInput
                  placeholder={t("pv.admin.profileSearch")}
                  value={profileSearch}
                  onChange={setProfileSearch}
                  width={FILTER_WIDTH.search}
                />
                <UiSelect
                  value={profileIndustryFilter}
                  aria-label={t("pv.admin.industryFilterAria")}
                  minWidth={180}
                  onChange={(value) => setProfileIndustryFilter(value)}
                  options={[
                    { value: "ALL", label: t("pv.admin.industryAll") },
                    ...industryOptions,
                  ]}
                />
                <UiSelect
                  value={profilePublishedFilter}
                  aria-label={t("pv.admin.publishedFilterAria")}
                  minWidth={180}
                  onChange={(value) =>
                    setProfilePublishedFilter(
                      value as "ALL" | "PUBLISHED" | "HIDDEN",
                    )
                  }
                  options={[
                    { value: "ALL", label: t("pv.common.statusAll") },
                    {
                      value: "PUBLISHED",
                      label: t("pv.admin.publishedShown"),
                    },
                    { value: "HIDDEN", label: t("pv.admin.publishedHidden") },
                  ]}
                />
              </FilterBar>
              <ResponsiveDataTable<PvAdminProfile>
                rows={filteredProfiles}
                rowKey={(row) => row.id}
                columns={profileColumns}
                loading={profiles.isFetching}
                emptyText={
                  isProfileFilterActive
                    ? t("pv.common.noMatch")
                    : t("pv.admin.profileEmpty")
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
            title={t("pv.admin.masterIndustry")}
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
            title={t("pv.admin.masterTag")}
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
            <LoadingState
              tip={t("pv.common.loading")}
              testId="pv-admin-rules-loading"
            />
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
            {t("pv.admin.profileDetailTitle")}
            <ActionIconButton
              kind="close"
              label={t("common.close")}
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
                label: t("pv.admin.sku"),
                value: `${profileViewing.sku_code} — ${profileViewing.sku_name}`,
              },
              {
                label: t("pv.admin.displayName"),
                value: profileViewing.display_name,
              },
              {
                label: t("pv.admin.description"),
                value: profileViewing.description || EMPTY_TEXT,
              },
              {
                label: t("pv.admin.industry"),
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
                          label={industryNameById.get(id) ?? shortId(id)}
                        />
                      ))}
                    </Stack>
                  ) : (
                    EMPTY_TEXT
                  ),
              },
              {
                label: t("pv.admin.tags"),
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
                          label={tagNameById.get(id) ?? shortId(id)}
                        />
                      ))}
                    </Stack>
                  ) : (
                    EMPTY_TEXT
                  ),
              },
              {
                label: t("pv.admin.sortOrderDisplay"),
                value: profileViewing.sort_order,
              },
              {
                label: t("pv.admin.published"),
                value: (
                  <UiStatusBadge
                    tone={profileViewing.published ? "success" : "neutral"}
                    label={
                      profileViewing.published
                        ? t("pv.admin.publishedShown")
                        : t("pv.admin.publishedHidden")
                    }
                  />
                ),
              },
              {
                label: t("pv.admin.skuStatus"),
                value: (
                  <UiStatusBadge
                    tone={
                      profileViewing.sku_status === "ACTIVE"
                        ? "success"
                        : "neutral"
                    }
                    label={masterStatusLabel(profileViewing.sku_status, t)}
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
        title={t("pv.admin.profileEditTitle")}
        actions={
          <>
            <ActionButton
              kind="cancel"
              onClick={() => setProfileEditing(null)}
              disabled={savingProfile}
            >
              {t("pv.common.cancel")}
            </ActionButton>
            <ActionButton
              kind="save"
              onClick={() => void submitProfile()}
              disabled={savingProfile}
            >
              {savingProfile ? t("pv.common.saving") : t("pv.common.save")}
            </ActionButton>
          </>
        }
      >
        <Grid container spacing={2} sx={{ pt: 0.5 }}>
          <Grid size={{ xs: 12, sm: 8 }}>
            <UiTextField
              required
              fullWidth
              label={t("pv.admin.displayName")}
              value={profileForm.display_name}
              onChange={(event) => {
                const value = event.target.value;
                setProfileForm((current) => ({
                  ...current,
                  display_name: value,
                }));
                setProfileErrors((current) =>
                  current.display_name
                    ? { ...current, display_name: "" }
                    : current,
                );
              }}
              error={Boolean(profileErrors.display_name)}
              helperText={profileErrors.display_name}
              slotProps={{ htmlInput: { maxLength: 255 } }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <UiNumberField
              fullWidth
              label={t("pv.admin.sortOrderDisplay")}
              value={profileForm.sort_order}
              rule={NUMBER_RULES.sortOrder}
              onChange={(next) => {
                setProfileForm((current) => ({ ...current, sort_order: next }));
                setProfileErrors((current) =>
                  current.sort_order ? { ...current, sort_order: "" } : current,
                );
              }}
              error={Boolean(profileErrors.sort_order)}
              helperText={profileErrors.sort_order}
            />
          </Grid>
          <Grid size={12}>
            <UiTextField
              fullWidth
              multiline
              minRows={3}
              label={t("pv.admin.description")}
              value={profileForm.description}
              onChange={(event) => {
                const value = event.target.value;
                setProfileForm((current) => ({
                  ...current,
                  description: value,
                }));
                setProfileErrors((current) =>
                  current.description
                    ? { ...current, description: "" }
                    : current,
                );
              }}
              error={Boolean(profileErrors.description)}
              helperText={profileErrors.description}
              slotProps={{
                htmlInput: { maxLength: PROFILE_DESCRIPTION_MAX },
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <UiAutocomplete
              multiple
              label={t("pv.admin.industry")}
              value={profileForm.industry_ids}
              onChange={(next) =>
                setProfileForm((current) => ({
                  ...current,
                  industry_ids: next.map(String),
                }))
              }
              options={industryOptions.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <UiAutocomplete
              multiple
              label={t("pv.admin.tags")}
              value={profileForm.tag_ids}
              onChange={(next) =>
                setProfileForm((current) => ({
                  ...current,
                  tag_ids: next.map(String),
                }))
              }
              options={tagOptions.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
            />
          </Grid>
          <Grid size={12}>
            <UiText variant="caption">{t("pv.admin.publishHint")}</UiText>
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
  const t = useT();
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
    // Chuỗi đang gõ — parse bằng checkNumber lúc submit (xem MasterFormValues).
    priority: string;
    status: "ACTIVE" | "INACTIVE";
  }>({
    industry_id: "",
    sku_id: "",
    tag_id: "",
    priority: "1",
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
      priority: String(row?.priority ?? 1),
      status: row?.status ?? "ACTIVE",
    });
    setFieldErrors({});
    setIsOpen(true);
  }

  async function submit() {
    const errors: Record<string, string> = {};
    if (!formValues.industry_id) {
      errors.industry_id = t("pv.admin.errIndustry");
    }
    const skuId = formValues.sku_id.trim();
    const tagId = formValues.tag_id || null;
    // BE bắt buộc rule có ít nhất một điều kiện áp dụng (SKU hoặc thẻ) — chặn
    // ở FE để người dùng thấy lỗi ngay ô thay vì toast 422 chung chung.
    if (!skuId && !tagId) {
      errors.sku_id = t("pv.admin.errSelector");
    } else if (skuId && !UUID_PATTERN.test(skuId)) {
      errors.sku_id = t("pv.admin.errSkuIdFormat");
    }
    // `priority` bắt buộc (BE từ chối rỗng) — phép so sánh số cũ không bao giờ
    // đúng vì state đã bị ép về số; giờ state là chuỗi nên kiểm tra được.
    const priorityCheck = checkNumber(
      formValues.priority,
      NUMBER_RULES.sortOrder,
    );
    if (formValues.priority.trim() === "") {
      errors.priority = t("pv.admin.errPriority");
    } else if (!priorityCheck.ok) {
      errors.priority = priorityCheck.message;
    }
    if (Object.keys(errors).length > 0 || !priorityCheck.ok) {
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
          sku_id: skuId || null,
          tag_id: tagId,
          category_id: null,
          priority: priorityCheck.value ?? 0,
          status: formValues.status,
        },
      });
      toast.success(
        editing ? t("pv.admin.ruleUpdated") : t("pv.admin.ruleCreated"),
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
      key: "stt",
      header: "STT",
      align: "center",
      width: 56,
      hideOnMobile: true,
      render: (row) => rowIndexOf(filteredRows, row) + 1,
    },
    {
      key: "industry_name",
      header: t("pv.admin.industry"),
      sortAccessor: (row) => row.industry_name ?? "",
      render: (row) => row.industry_name ?? "",
    },
    {
      key: "priority",
      header: t("pv.admin.priority"),
      align: "right",
      sortType: "value",
      sortAccessor: (row) => row.priority,
      render: (row) => row.priority,
    },
    {
      key: "selector",
      header: t("pv.admin.selector"),
      sortAccessor: (row) => ruleSelectorSortKey(row, tagNameById),
      // PvAdminRule mới chỉ có sku_id/category_id, CHƯA có sku_code/category_name
      // nên không thể hiện tên ở FE — rút gọn + cho sao chép thay vì in UUID thô.
      // Khi BE bổ sung 2 trường mã/tên thì đổi sang hiện thẳng như thẻ phân loại.
      render: (row) =>
        row.sku_id ? (
          <>
            <UiStatusBadge tone="neutral" label={t("pv.admin.sku")} />{" "}
            <CopyableId value={row.sku_id} />
          </>
        ) : row.category_id ? (
          <>
            <UiStatusBadge tone="neutral" label={t("pv.admin.category")} />{" "}
            <CopyableId value={row.category_id} />
          </>
        ) : row.tag_id ? (
          <>
            <UiStatusBadge tone="neutral" label={t("pv.admin.tags")} />{" "}
            {tagNameById.get(row.tag_id) ?? <CopyableId value={row.tag_id} />}
          </>
        ) : (
          EMPTY_TEXT
        ),
    },
    {
      key: "status",
      header: t("pv.common.fieldStatus"),
      sortType: "value",
      sortAccessor: (row) => row.status,
      render: (row) => (
        <UiStatusBadge
          tone={row.status === "ACTIVE" ? "success" : "neutral"}
          label={masterStatusLabel(row.status, t)}
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
            {t("pv.admin.ruleCreate")}
          </ActionButton>
        }
      >
        <SearchInput
          placeholder={t("pv.admin.ruleSearch")}
          value={search}
          onChange={setSearch}
          width={FILTER_WIDTH.search}
        />
        <UiSelect
          value={statusFilter}
          aria-label={t("pv.admin.statusFilterAria")}
          minWidth={180}
          onChange={(value) =>
            setStatusFilter(value as "ALL" | "ACTIVE" | "INACTIVE")
          }
          options={[
            { value: "ALL", label: t("pv.common.statusAll") },
            { value: "ACTIVE", label: t("pv.common.statusActive") },
            { value: "INACTIVE", label: t("pv.common.statusInactive") },
          ]}
        />
      </FilterBar>
      <ResponsiveDataTable<PvAdminRule>
        rows={filteredRows}
        rowKey={(row) => row.id}
        columns={columns}
        // Quy tắc không có mã nghiệp vụ — mô tả bằng ngành nghề + mức ưu tiên
        // thay vì đọc UUID cho người dùng trình đọc màn hình.
        loading={isFetching}
        emptyText={
          search.trim() || statusFilter !== "ALL"
            ? t("pv.common.noMatch")
            : t("pv.admin.ruleEmpty")
        }
        renderRowActions={(row) => (
          <Stack direction="row" spacing={1}>
            <ActionButton kind="view" onClick={() => setViewing(row)}>
              {t("pv.common.view")}
            </ActionButton>
            <ActionButton
              kind="edit"
              disabled={!canManage}
              onClick={() => openForm(row)}
            >
              {t("pv.common.edit")}
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
            {t("pv.admin.ruleDetailTitle")}
            <ActionIconButton
              kind="close"
              label={t("common.close")}
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
                label: t("pv.admin.industry"),
                value: viewing.industry_name ?? EMPTY_TEXT,
              },
              {
                label: t("pv.admin.selector"),
                // Xem chú thích ở cột "Điều kiện áp dụng" của bảng: chưa có
                // sku_code/category_name từ BE nên rút gọn + cho sao chép.
                value: viewing.sku_id ? (
                  <>
                    <UiStatusBadge tone="neutral" label={t("pv.admin.sku")} />{" "}
                    <CopyableId value={viewing.sku_id} />
                  </>
                ) : viewing.category_id ? (
                  <>
                    <UiStatusBadge
                      tone="neutral"
                      label={t("pv.admin.category")}
                    />{" "}
                    <CopyableId value={viewing.category_id} />
                  </>
                ) : viewing.tag_id ? (
                  <>
                    <UiStatusBadge tone="neutral" label={t("pv.admin.tags")} />{" "}
                    {tagNameById.get(viewing.tag_id) ?? (
                      <CopyableId value={viewing.tag_id} />
                    )}
                  </>
                ) : (
                  EMPTY_TEXT
                ),
              },
              { label: t("pv.admin.priority"), value: viewing.priority },
              {
                label: t("pv.common.fieldStatus"),
                value: (
                  <UiStatusBadge
                    tone={viewing.status === "ACTIVE" ? "success" : "neutral"}
                    label={masterStatusLabel(viewing.status, t)}
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
        title={editing ? t("pv.admin.ruleEditTitle") : t("pv.admin.ruleCreate")}
        actions={
          <>
            <ActionButton
              kind="cancel"
              onClick={() => setIsOpen(false)}
              disabled={saving}
            >
              {t("pv.common.cancel")}
            </ActionButton>
            <ActionButton
              kind="save"
              onClick={() => void submit()}
              disabled={saving}
            >
              {saving ? t("pv.common.saving") : t("pv.common.save")}
            </ActionButton>
          </>
        }
      >
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <UiAutocomplete
            required
            label={t("pv.admin.industry")}
            value={formValues.industry_id || null}
            onChange={(next) => {
              const value = next == null ? "" : String(next);
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
            options={industryOptions.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
          <UiTextField
            fullWidth
            label={t("pv.admin.skuSelectorLabel")}
            placeholder={t("pv.admin.skuIdPlaceholder")}
            value={formValues.sku_id}
            onChange={(event) => {
              const value = event.target.value;
              setFormValues((current) => ({ ...current, sku_id: value }));
              // Lỗi "thiếu điều kiện áp dụng" gắn ở ô SKU nhưng chọn thẻ cũng
              // giải quyết được — xoá khi sửa bất kỳ ô nào trong hai.
              setFieldErrors((current) =>
                current.sku_id ? { ...current, sku_id: "" } : current,
              );
            }}
            error={Boolean(fieldErrors.sku_id)}
            helperText={fieldErrors.sku_id}
            // UUID chuẩn dài 36 ký tự — dài hơn chắc chắn không phải UUID.
            slotProps={{ htmlInput: { maxLength: 36 } }}
          />
          <UiAutocomplete
            label={t("pv.admin.tags")}
            value={formValues.tag_id || null}
            onChange={(next) => {
              setFormValues((current) => ({
                ...current,
                tag_id: next == null ? "" : String(next),
              }));
              setFieldErrors((current) =>
                current.sku_id || current.tag_id
                  ? { ...current, sku_id: "", tag_id: "" }
                  : current,
              );
            }}
            placeholder={t("pv.admin.tagNone")}
            error={Boolean(fieldErrors.tag_id)}
            helperText={fieldErrors.tag_id}
            options={tagOptions.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />
          <UiNumberField
            required
            fullWidth
            label={t("pv.admin.priority")}
            value={formValues.priority}
            rule={NUMBER_RULES.sortOrder}
            onChange={(next) => {
              setFormValues((current) => ({ ...current, priority: next }));
              setFieldErrors((current) =>
                current.priority ? { ...current, priority: "" } : current,
              );
            }}
            error={Boolean(fieldErrors.priority)}
            helperText={fieldErrors.priority}
          />
          <UiTextField
            select
            fullWidth
            label={t("pv.common.fieldStatus")}
            value={formValues.status}
            onChange={(event) =>
              setFormValues((current) => ({
                ...current,
                status: event.target.value as "ACTIVE" | "INACTIVE",
              }))
            }
          >
            <MenuItem value="ACTIVE">{t("pv.common.statusActive")}</MenuItem>
            <MenuItem value="INACTIVE">
              {t("pv.common.statusInactive")}
            </MenuItem>
          </UiTextField>
          <UiText variant="caption">{t("pv.admin.ruleHint")}</UiText>
        </Stack>
      </UiDialog>
    </div>
  );
}
