import {
  useMemo,
  useState,
  type InputHTMLAttributes,
  type Key,
  type ReactNode,
} from "react";
import { Tag } from "antd";
import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  ThemeProvider,
  Typography,
} from "@mui/material";
import { muiTheme } from "@/app/mui-theme";
import { EyeOutlined, CloseOutlined } from "@/shared/components/icons";
import { toast } from "sonner";
import { ACTION_ICON_COLORS } from "@/shared/theme/actionIconColors";
import { DataTable } from "@/shared/components";
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

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Grid size={12}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
        {label}
      </Typography>
      <Typography variant="body2" component="div">
        {value}
      </Typography>
    </Grid>
  );
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
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [formValues, setFormValues] = useState<MasterFormValues>({
    code: "",
    name: "",
    status: "ACTIVE",
    sort_order: 0,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openForm(row?: PvAdminSimpleMaster) {
    setEditing(row ?? null);
    setFormValues({
      code: row?.code ?? "",
      name: row?.name ?? "",
      status: row?.status ?? "ACTIVE",
      sort_order: row?.sort_order ?? 0,
    });
    setFormError(null);
    setIsOpen(true);
  }

  async function submit() {
    if (!formValues.code.trim()) {
      setFormError("Nhập mã");
      return;
    }
    if (!formValues.name.trim()) {
      setFormError("Nhập tên");
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
      toast.error(getMutationErrorMessage(mutationError));
    } finally {
      setSaving(false);
    }
  }

  if (isPending)
    return <LoadingState tip="Đang tải…" testId={`${testId}-loading`} />;
  if (isError) return <PvErrorState error={error} onRetry={onRetry} />;

  return (
    <div data-testid={testId}>
      <div style={{ marginBottom: 12 }}>
        <Button
          variant="contained"
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

      <DataTable<PvAdminSimpleMaster>
        rowKey="id"
        size="small"
        scroll={{ x: "max-content" }}
        dataSource={rows}
        pagination={false}
        rowSelection={{
          type: "checkbox",
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
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
                variant="outlined"
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

      <ThemeProvider theme={muiTheme}>
        <Dialog open={isOpen} onClose={() => setIsOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>{editing ? `Sửa ${title}` : `Thêm ${title}`}</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              {formError ? <Alert severity="error">{formError}</Alert> : null}
              <TextField
                required
                fullWidth
                label="Mã"
                value={formValues.code}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, code: event.target.value }))
                }
                slotProps={{ htmlInput: { maxLength: 80 } }}
              />
              <TextField
                required
                fullWidth
                label="Tên"
                value={formValues.name}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, name: event.target.value }))
                }
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
            <Button onClick={() => setIsOpen(false)} disabled={saving}>
              Hủy
            </Button>
            <Button variant="contained" onClick={() => void submit()} disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          </DialogActions>
        </Dialog>
      </ThemeProvider>
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
  const [profileSelectedRowKeys, setProfileSelectedRowKeys] = useState<
    Key[]
  >([]);
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
  const [profileFormError, setProfileFormError] = useState<string | null>(null);
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
    setProfileFormError(null);
  }

  async function submitProfile() {
    if (!profileEditing) return;
    if (!profileForm.display_name.trim()) {
      setProfileFormError("Nhập tên hiển thị");
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

  return (
    <ThemeProvider theme={muiTheme}>
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
        value={activeTab}
        onChange={(_event, value: string) => setActiveTab(value)}
        sx={{ minHeight: 40, mb: 2 }}
      >
        <Tab value="profiles" label="Hồ sơ sản phẩm" sx={{ minHeight: 40, textTransform: "none" }} />
        <Tab value="industries" label="Ngành nghề" sx={{ minHeight: 40, textTransform: "none" }} />
        <Tab value="tags" label="Thẻ phân loại" sx={{ minHeight: 40, textTransform: "none" }} />
        <Tab value="rules" label="Quy tắc gợi ý" sx={{ minHeight: 40, textTransform: "none" }} />
      </Tabs>

      {activeTab === "profiles" ? (
        profiles.isPending ? (
          <LoadingState tip="Đang tải…" testId="pv-admin-profiles-loading" />
        ) : profiles.isError ? (
          <PvErrorState error={profiles.error} onRetry={() => profiles.refetch()} />
        ) : (
          <div data-testid="pv-admin-profiles">
            <DataTable<PvAdminProfile>
              rowKey="id"
              size="small"
              scroll={{ x: "max-content" }}
              dataSource={profiles.data?.data ?? []}
              pagination={false}
              rowSelection={{
                type: "checkbox",
                selectedRowKeys: profileSelectedRowKeys,
                onChange: setProfileSelectedRowKeys,
              }}
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
                      <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
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
                      <span>{row.published ? "Đang hiển thị" : "Đang ẩn"}</span>
                    </Stack>
                  ),
                },
                {
                  title: "",
                  key: "actions",
                  render: (_, row) => (
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<EyeOutlined style={{ color: ACTION_ICON_COLORS.view }} />}
                        data-testid="pv-admin-profile-view"
                        onClick={() => setProfileViewing(row)}
                      >
                        Xem
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={!canManageMaster}
                        data-testid="pv-admin-profile-edit"
                        onClick={() => openProfileForm(row)}
                      >
                        Sửa hiển thị
                      </Button>
                    </Stack>
                  ),
                },
              ]}
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

      <Dialog open={profileViewing !== null} onClose={() => setProfileViewing(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pr: 6, position: "relative" }}>
          Chi tiết hồ sơ sản phẩm
          <IconButton
            aria-label="Đóng"
            onClick={() => setProfileViewing(null)}
            sx={{ position: "absolute", right: 10, top: 8 }}
          >
            <CloseOutlined style={{ fontSize: 15 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {profileViewing ? (
            <Grid container spacing={2}>
              <DetailField
                label="SKU"
                value={`${profileViewing.sku_code} — ${profileViewing.sku_name}`}
              />
              <DetailField label="Tên hiển thị" value={profileViewing.display_name} />
              <DetailField label="Mô tả" value={profileViewing.description || "—"} />
              <DetailField
                label="Ngành nghề"
                value={
                  profileViewing.industry_ids.length > 0 ? (
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
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
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
                      {profileViewing.tag_ids.map((id) => (
                        <Tag key={id}>{tagNameById.get(id) ?? id}</Tag>
                      ))}
                    </Stack>
                  ) : (
                    "—"
                  )
                }
              />
              <DetailField label="Thứ tự hiển thị" value={profileViewing.sort_order} />
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
                value={<Tag>{masterStatusLabel(profileViewing.sku_status)}</Tag>}
              />
            </Grid>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={profileEditing !== null} onClose={() => setProfileEditing(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Sửa thông tin hiển thị</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {profileFormError ? <Alert severity="error">{profileFormError}</Alert> : null}
            <TextField
              required
              fullWidth
              label="Tên hiển thị"
              value={profileForm.display_name}
              onChange={(event) =>
                setProfileForm((current) => ({ ...current, display_name: event.target.value }))
              }
              slotProps={{ htmlInput: { maxLength: 255 } }}
            />
            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Mô tả"
              value={profileForm.description}
              onChange={(event) =>
                setProfileForm((current) => ({ ...current, description: event.target.value }))
              }
            />
            <Autocomplete
              multiple
              options={industryOptions}
              value={industryOptions.filter((option) =>
                profileForm.industry_ids.includes(option.value),
              )}
              getOptionLabel={(option) => option.label}
              isOptionEqualToValue={(option, value) => option.value === value.value}
              onChange={(_event, options) =>
                setProfileForm((current) => ({
                  ...current,
                  industry_ids: options.map((option) => option.value),
                }))
              }
              renderInput={(params) => <TextField {...params} label="Ngành nghề" />}
            />
            <Autocomplete
              multiple
              options={tagOptions}
              value={tagOptions.filter((option) => profileForm.tag_ids.includes(option.value))}
              getOptionLabel={(option) => option.label}
              isOptionEqualToValue={(option, value) => option.value === value.value}
              onChange={(_event, options) =>
                setProfileForm((current) => ({
                  ...current,
                  tag_ids: options.map((option) => option.value),
                }))
              }
              renderInput={(params) => <TextField {...params} label="Thẻ phân loại" />}
            />
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
            <Typography variant="caption" color="text.secondary">
              Bật hoặc tắt hiển thị sản phẩm bằng công tắc ở bảng danh sách.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProfileEditing(null)} disabled={savingProfile}>
            Hủy
          </Button>
          <Button variant="contained" onClick={() => void submitProfile()} disabled={savingProfile}>
            {savingProfile ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogActions>
      </Dialog>
      </div>
    </ThemeProvider>
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
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formValues, setFormValues] = useState<{
    industry_id: string;
    sku_id: string;
    tag_id: string;
    priority: number;
    status: "ACTIVE" | "INACTIVE";
  }>({ industry_id: "", sku_id: "", tag_id: "", priority: 1, status: "ACTIVE" });
  const tagNameById = useMemo(
    () => new Map(tagOptions.map((item) => [item.value, item.label])),
    [tagOptions],
  );

  function openForm(row?: PvAdminRule) {
    setEditing(row ?? null);
    setFormValues({
      industry_id: row?.industry_id ?? "",
      sku_id: row?.sku_id ?? "",
      tag_id: row?.tag_id ?? "",
      priority: row?.priority ?? 1,
      status: row?.status ?? "ACTIVE",
    });
    setFormError(null);
    setIsOpen(true);
  }

  async function submit() {
    if (!formValues.industry_id) {
      setFormError("Chọn ngành nghề");
      return;
    }
    if (!formValues.priority && formValues.priority !== 0) {
      setFormError("Nhập mức ưu tiên");
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
      toast.error(getMutationErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div data-testid="pv-admin-rules">
      <div style={{ marginBottom: 12 }}>
        <Button
          variant="contained"
          disabled={!canManage}
          data-testid="pv-admin-rules-create"
          onClick={() => openForm()}
        >
          Thêm quy tắc gợi ý
        </Button>
      </div>
      <DataTable<PvAdminRule>
        rowKey="id"
        size="small"
        scroll={{ x: "max-content" }}
        dataSource={rows}
        pagination={false}
        rowSelection={{
          type: "checkbox",
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
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
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<EyeOutlined style={{ color: ACTION_ICON_COLORS.view }} />}
                  onClick={() => setViewing(row)}
                >
                  Xem
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={!canManage}
                  onClick={() => openForm(row)}
                >
                  Sửa
                </Button>
              </Stack>
            ),
          },
        ]}
      />

      <Dialog open={viewing !== null} onClose={() => setViewing(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pr: 6, position: "relative" }}>
          Chi tiết quy tắc gợi ý
          <IconButton
            aria-label="Đóng"
            onClick={() => setViewing(null)}
            sx={{ position: "absolute", right: 10, top: 8 }}
          >
            <CloseOutlined style={{ fontSize: 15 }} />
          </IconButton>
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
                  <Tag color={viewing.status === "ACTIVE" ? "green" : "default"}>
                    {masterStatusLabel(viewing.status)}
                  </Tag>
                }
              />
            </Grid>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editing ? "Sửa quy tắc gợi ý" : "Thêm quy tắc gợi ý"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            <TextField
              select
              required
              fullWidth
              label="Ngành nghề"
              value={formValues.industry_id}
              onChange={(event) =>
                setFormValues((current) => ({ ...current, industry_id: event.target.value }))
              }
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
                setFormValues((current) => ({ ...current, sku_id: event.target.value }))
              }
            />
            <TextField
              select
              fullWidth
              label="Thẻ phân loại"
              value={formValues.tag_id}
              onChange={(event) =>
                setFormValues((current) => ({ ...current, tag_id: event.target.value }))
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
              onChange={(event) =>
                setFormValues((current) => ({
                  ...current,
                  priority: Number(event.target.value) || 0,
                }))
              }
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
          <Button onClick={() => setIsOpen(false)} disabled={saving}>
            Hủy
          </Button>
          <Button variant="contained" onClick={() => void submit()} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
