/**
 * MST-PV-01 — DANH MỤC SẢN PHẨM APP PV.
 *
 * Vì sao đứng riêng khỏi SCR-PV-ADM-01 (`/pv-admin`): màn kia là bàn quản trị
 * master (ngành nghề / thẻ / quy tắc gợi ý) và trình bày hồ sơ sản phẩm dưới
 * dạng BẢNG. Ở đây người dùng cần nhìn đúng thứ App PV cho khách xem — lưới thẻ
 * có ẢNH — và cần thêm một sản phẩm lên ứng dụng ngay tại chỗ. Hai nhu cầu đó
 * không nhồi chung một màn được, nên tách trang và đặt dưới nhóm "Danh mục".
 *
 * "Thêm sản phẩm" = tạo HỒ SƠ App PV cho một SKU đã có trong kho, chứ không tạo
 * SKU mới: sản phẩm trên App PV luôn phải quy về một SKU thật thì tồn kho hiển
 * thị cho khách mới có nghĩa (REQ-SRS-018). Tạo SKU vẫn là việc của MST-01, và
 * ô chọn SKU ở đây có lối tắt sang đó.
 *
 * Ảnh KHÔNG đi qua BE: trình duyệt upload thẳng lên Cloudinary rồi chỉ gửi URL
 * (xem shared/lib/cloudinary.ts + PvProductImageField).
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Box,
  Grid,
  Stack,
  UiAutocomplete,
  UiCard,
  UiDialog,
  UiPagination,
  UiSelect,
  UiStatusBadge,
  UiTextField,
} from "@/shared/ui";
import { RADIUS, SEMANTIC_LIGHT as S } from "@/shared/ui/tokens";
import { FilterBar, SearchInput } from "@/shared/components";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";
import { LoadingState } from "@/shared/components/data-display/LoadingState";
import { UiStateSurface } from "@/shared/ui";
import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";
import { SkuLink } from "@/shared/components/data-display/SkuLink";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useT, type TranslateFn } from "@/shared/i18n/useT";
import { guardBackdropClose } from "@/shared/utils/dialogGuard";
import {
  getMutationErrorMessage,
  normalizeError,
  resolveFormErrors,
} from "@/shared/api/api-error";
import {
  MVP_PAGE_SIZE_OPTIONS,
  resolveApiPagination,
} from "@/shared/components/mvp/mvp-pagination";
import {
  WMS_PERMISSION_CATALOG as P,
  hasAnyWmsPermission,
} from "@/shared/constants/wms-permissions";
import { useAuthStore } from "@/shared/store/auth.store";
import { useMvpSkus } from "@/modules/master-data/hooks/use-mvp-master";
import { PvSwitch } from "@/modules/pv/components/PvSwitch";
import { PvProductImageField } from "@/modules/pv/components/PvProductImageField";
import {
  usePvAdminIndustries,
  usePvAdminProfiles,
  usePvAdminTags,
  useSavePvProfile,
  useSetPvPublished,
} from "@/modules/pv/hooks/use-pv";
import type {
  PvAdminProfile,
  PvAdminSimpleMaster,
  PvImage,
} from "@/modules/pv/types/pv.types";

/** Trần mô tả — BE không chặn nên FE tự đặt theo mức chung của dự án. */
const DESCRIPTION_MAX = 2000;

/** Cỡ danh sách master đổ vào ô chọn: đủ phủ danh mục của kho, không phân trang. */
const OPTION_PAGE_SIZE = 100;

/**
 * Sentinel "không lọc" của các ô lọc — CHUỖI "ALL" chứ không phải "".
 *
 * `UiSelect` chỉ bật `displayEmpty` khi có `placeholder`; với `value=""` và
 * không placeholder, MUI vẽ một ô TRỐNG TRƠN thay vì nhãn "Tất cả…". Dùng
 * sentinel là đúng quy ước sẵn có của SCR-PV-ADM-01 và các thanh lọc khác.
 */
const FILTER_ALL = "ALL";

/**
 * Field 422 của BE được phép gắn vào ô nào. Giữ nguyên tên field của BE vì form
 * này đặt state theo đúng payload; lỗi thuộc field ngoài danh sách rơi về toast
 * tổng (xem `resolveFormErrors`). `images` nằm trong danh sách để lỗi "quá 8
 * ảnh" / "hai ảnh đại diện" hiện ngay dưới ô ảnh.
 */
const FORM_FIELDS = [
  "sku_id",
  "display_name",
  "description",
  "images",
] as const;

interface ProfileFormState {
  sku_id: string;
  display_name: string;
  description: string;
  /**
   * KHÔNG có ô nhập trên form (phản hồi người dùng 06/09/2026: người quản kho
   * không xếp tay thứ tự sản phẩm). Vẫn giữ trong state vì `updatePvProfile`
   * gửi cả object: bỏ hẳn field thì mọi lần sửa sẽ nén sort_order của hồ sơ cũ
   * về 0 và xáo lại thứ tự hiển thị trên App PV. Tạo mới thì để 0.
   */
  sort_order: number;
  industry_ids: string[];
  tag_ids: string[];
  images: PvImage[];
}

const EMPTY_FORM: ProfileFormState = {
  sku_id: "",
  display_name: "",
  description: "",
  sort_order: 0,
  industry_ids: [],
  tag_ids: [],
  images: [],
};

function masterOptions(rows: PvAdminSimpleMaster[] | undefined) {
  return (rows ?? [])
    .filter((row) => row.status === "ACTIVE")
    .map((row) => ({ value: row.id, label: row.name || row.code }));
}

function primaryImage(profile: PvAdminProfile): PvImage | undefined {
  return (
    profile.images?.find((image) => image.is_primary) ?? profile.images?.[0]
  );
}

function useCanManagePv() {
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  return {
    canManage: hasAnyWmsPermission(
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

/**
 * Thẻ sản phẩm của lưới. Đây là bản NỘI BỘ của `PvProductCard` (mặt công khai):
 * cùng bố cục ảnh + tên + mã để người quản trị thấy đúng thứ khách sẽ thấy,
 * nhưng thêm công tắc hiển thị và nút sửa — hai thứ không bao giờ được lọt sang
 * mặt công khai, nên hai component cố ý không dùng chung.
 */
function PvCatalogCard({
  profile,
  industryNameById,
  canManage,
  canPublish,
  busy,
  onEdit,
  onTogglePublish,
  t,
}: {
  profile: PvAdminProfile;
  industryNameById: Map<string, string>;
  canManage: boolean;
  canPublish: boolean;
  busy: boolean;
  onEdit: () => void;
  onTogglePublish: (next: boolean) => void;
  t: TranslateFn;
}) {
  const image = primaryImage(profile);
  const industries = profile.industry_ids
    .map((id) => industryNameById.get(id))
    .filter((name): name is string => Boolean(name));

  /**
   * URL ảnh nằm trên CDN ngoài, nên nó CHẾT ĐƯỢC mà DB không hề biết (ảnh bị xoá
   * trên Cloudinary, host cũ ngừng chạy). Không bắt `onError` thì trình duyệt vẽ
   * icon ảnh vỡ + chuỗi alt tràn ra giữa thẻ. Rơi về đúng ô "Chưa có ảnh" để lưới
   * vẫn đọc được và người quản trị thấy ngay sản phẩm nào cần thay ảnh.
   */
  const [imageBroken, setImageBroken] = useState(false);
  const showImage = Boolean(image) && !imageBroken;

  return (
    <Box
      data-testid="pv-catalog-card"
      data-sku-code={profile.sku_code}
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: S.bgSurface,
        border: `1px solid ${S.border}`,
        borderRadius: `${RADIUS.card}px`,
        boxShadow: S.shadowCard,
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          // `position: relative` để ảnh bên trong định vị TUYỆT ĐỐI theo ô này.
          // `height: 100%` trên grid item KHÔNG giải được khi hàng grid tự co
          // (phần trăm chiều cao đối chiếu với hàng, mà hàng lại co theo nội
          // dung): ảnh dọc 502x940 vẫn tràn ra 348px rồi bị `overflow:hidden`
          // cắt, đúng triệu chứng ban đầu. `inset: 0` trên phần tử absolute thì
          // đối chiếu với padding-box — mà `aspect-ratio` đã định nghĩa nó rõ ràng.
          position: "relative",
          aspectRatio: "4 / 3",
          backgroundColor: S.bgSubtle,
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
        }}
      >
        {showImage && image ? (
          <Box
            component="img"
            src={image.url}
            alt={image.alt_text ?? profile.display_name}
            loading="lazy"
            onError={() => setImageBroken(true)}
            sx={{
              // `contain` chứ KHÔNG phải `cover`: ảnh sản phẩm do người dùng tự
              // tải lên nên tỉ lệ tuỳ ý — ảnh dọc 502x940 nhét vào khung 4:3 bằng
              // `cover` sẽ bị phóng to rồi cắt cụt trên/dưới, chỉ còn một lát giữa
              // (phản hồi người dùng 06/09/2026). `contain` giữ trọn khung hình,
              // phần thừa để lộ nền `bgSubtle` của ô.
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        ) : (
          <Box
            component="span"
            sx={{
              fontSize: 12,
              color: imageBroken ? S.errorText : S.textDisabled,
              px: 1,
              textAlign: "center",
            }}
            data-testid="pv-catalog-card-no-image"
            data-image-broken={imageBroken || undefined}
          >
            {imageBroken
              ? t("pv.productCatalog.cardImageBroken")
              : t("pv.productCatalog.cardNoImage")}
          </Box>
        )}
      </Box>

      <Box sx={{ p: 1.5, display: "grid", gap: "6px", flex: 1 }}>
        <Box
          sx={{
            fontWeight: 700,
            fontSize: 14,
            lineHeight: 1.35,
            color: S.textHigh,
          }}
        >
          {profile.display_name}
        </Box>
        <Box sx={{ fontSize: 12, color: S.textMedium }}>
          <SkuLink code={profile.sku_code} />
        </Box>
        <Box component="span" sx={{ fontSize: 12, color: S.textMedium }}>
          {industries.length > 0 ? industries.join(", ") : EMPTY_TEXT}
        </Box>

        <Box
          sx={{
            marginTop: "auto",
            pt: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            flexWrap: "wrap",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <PvSwitch
              checked={profile.published}
              disabled={!canPublish || busy}
              onChange={onTogglePublish}
              aria-label={t("pv.admin.publishSwitchAria")}
              data-testid="pv-catalog-publish-switch"
            />
            <UiStatusBadge
              tone={profile.published ? "success" : "neutral"}
              label={
                profile.published
                  ? t("pv.admin.publishedShown")
                  : t("pv.admin.publishedHidden")
              }
            />
          </Box>
          <ActionIconButton
            kind="edit"
            label={t("pv.productCatalog.editAction")}
            disabled={!canManage}
            onClick={onEdit}
            data-testid="pv-catalog-edit"
            // Thẻ hẹp thì hàng này xuống dòng; `space-between` chỉ căn trong MỘT
            // dòng nên nút sẽ nhảy về mép trái. `auto` giữ nó luôn ở mép phải.
            sx={{ ml: "auto" }}
          />
        </Box>
      </Box>
    </Box>
  );
}

export function PvProductCatalogPage() {
  const t = useT();
  const { canManage, canPublish } = useCanManagePv();

  const [keyword, setKeyword] = useState("");
  const [industryFilter, setIndustryFilter] = useState(FILTER_ALL);
  const [publishedFilter, setPublishedFilter] = useState(FILTER_ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(MVP_PAGE_SIZE_OPTIONS[1]);

  const industries = usePvAdminIndustries({
    status: "ACTIVE",
    per_page: String(OPTION_PAGE_SIZE),
  });
  const tags = usePvAdminTags({
    status: "ACTIVE",
    per_page: String(OPTION_PAGE_SIZE),
  });
  const profiles = usePvAdminProfiles({
    keyword,
    ...(publishedFilter === FILTER_ALL ? {} : { published: publishedFilter }),
    page: String(page),
    per_page: String(pageSize),
  });

  const saveProfile = useSavePvProfile();
  const setPublished = useSetPvPublished();

  const industryOptions = useMemo(
    () => masterOptions(industries.data?.data),
    [industries.data],
  );
  const tagOptions = useMemo(() => masterOptions(tags.data?.data), [tags.data]);
  const industryNameById = useMemo(
    () =>
      new Map(industryOptions.map((option) => [option.value, option.label])),
    [industryOptions],
  );

  const rows = useMemo(() => profiles.data?.data ?? [], [profiles.data]);
  // Ngành nghề lọc phía CLIENT: `GET /pv-admin/resources/product-profiles`
  // không nhận industry_id, và mapping ngành nằm ở bảng phụ nên không thể suy ra
  // từ tham số hiện có. Lọc trên trang hiện tại là đúng phạm vi người dùng đang
  // nhìn; đừng dựng phân trang riêng cho nó.
  const visibleRows = useMemo(
    () =>
      industryFilter === FILTER_ALL
        ? rows
        : rows.filter((row) => row.industry_ids.includes(industryFilter)),
    [rows, industryFilter],
  );

  // `PvPageMeta` khai tường minh từng khoá (không có index signature) nên không
  // khớp `ApiMeta`; hai type mô tả CÙNG một meta phân trang của BE, chỉ khác
  // mức chặt. Ép sang Record ở đúng một chỗ này thay vì nới lỏng PvPageMeta —
  // nới lỏng nó là mở đường cho khoá lạ lọt vào hợp đồng App PV.
  const pagination = resolveApiPagination(
    profiles.data?.meta as Record<string, unknown> | undefined,
    { page, pageSize, rowCount: rows.length },
  );

  /**
   * Đổi điều kiện lọc mà vẫn đứng ở trang 7 thì danh sách rỗng một cách khó
   * hiểu, nên mọi thay đổi lọc đều kéo về trang 1.
   *
   * Đặt ở HÀM XỬ LÝ chứ không phải `useEffect([keyword, ...])`: effect chạy SAU
   * khi đã render (và đã fetch) một lượt với cặp lọc-mới + trang-cũ, tức là
   * thêm một vòng render và một request thừa mỗi lần gõ vào ô tìm.
   */
  function applyFilter(patch: () => void) {
    patch();
    setPage(1);
  }

  // ---- hộp thoại thêm / sửa -------------------------------------------------
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<PvAdminProfile | null>(null);
  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [skuKeyword, setSkuKeyword] = useState("");

  // Chỉ nạp danh sách SKU khi đang ở chế độ THÊM: màn này mở ra chủ yếu để xem
  // lưới, không có lý do gọi /products mỗi lần vào trang.
  const skuQuery = useMvpSkus({
    keyword: skuKeyword,
    status: "ACTIVE",
    per_page: 20,
  });
  const skuOptions = useMemo(() => {
    if (dialogMode !== "create") return [];
    // SKU đã có hồ sơ ở TRANG hiện tại thì loại khỏi ô chọn để bớt va vào 409;
    // BE vẫn là chốt chặn thật (STATE_CONFLICT) vì trang khác có thể đã dùng.
    const taken = new Set(rows.map((row) => row.sku_id));
    return (skuQuery.data?.data ?? [])
      .filter((sku) => !taken.has(sku.sku_id))
      .map((sku) => ({
        value: sku.sku_id,
        label: `${sku.sku_code} — ${sku.sku_name}`,
      }));
  }, [dialogMode, rows, skuQuery.data]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setSkuKeyword("");
    setDialogMode("create");
  }

  function openEdit(row: PvAdminProfile) {
    setEditing(row);
    setForm({
      sku_id: row.sku_id,
      display_name: row.display_name,
      description: row.description ?? "",
      sort_order: row.sort_order ?? 0,
      industry_ids: row.industry_ids,
      tag_ids: row.tag_ids,
      images: row.images ?? [],
    });
    setErrors({});
    setDialogMode("edit");
  }

  function closeDialog() {
    setDialogMode(null);
    setEditing(null);
  }

  function patchForm(patch: Partial<ProfileFormState>, clearKey?: string) {
    setForm((current) => ({ ...current, ...patch }));
    if (clearKey) {
      setErrors((current) =>
        current[clearKey] ? { ...current, [clearKey]: "" } : current,
      );
    }
  }

  async function submit() {
    const nextErrors: Record<string, string> = {};
    const displayName = form.display_name.trim();
    const description = form.description.trim();

    if (dialogMode === "create" && !form.sku_id) {
      nextErrors.sku_id = t("pv.productCatalog.errSku");
    }
    if (!displayName) nextErrors.display_name = t("pv.admin.errDisplayName");
    else if (displayName.length > 255) {
      nextErrors.display_name = t("shared.validation.textMaxLength", {
        max: 255,
      });
    }
    if (description.length > DESCRIPTION_MAX) {
      nextErrors.description = t("shared.validation.textMaxLength", {
        max: DESCRIPTION_MAX,
      });
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      await saveProfile.mutateAsync({
        id: editing?.id,
        version: editing?.version,
        payload: {
          sku_id: dialogMode === "create" ? form.sku_id : undefined,
          display_name: displayName,
          description: description || null,
          sort_order: form.sort_order,
          industry_ids: form.industry_ids,
          tag_ids: form.tag_ids,
          images: form.images,
        },
      });
      toast.success(
        dialogMode === "create"
          ? t("pv.productCatalog.created")
          : t("pv.productCatalog.updated"),
      );
      closeDialog();
    } catch (error) {
      // 409 = SKU đã có hồ sơ (người khác vừa thêm, hoặc nó nằm ở trang khác).
      // Nói thẳng nguyên nhân thay vì để người dùng đọc "STATE_CONFLICT".
      const normalized = normalizeError(error);
      if (normalized.status === 409) {
        setErrors({ sku_id: t("pv.productCatalog.errSkuTaken") });
        return;
      }
      // Lỗi thuộc một ô cụ thể thì hiện ngay dưới ô đó; toast chỉ báo phần còn
      // lại để không lặp cùng một câu ở hai nơi.
      const { fieldErrors, message } = resolveFormErrors(error, FORM_FIELDS);
      setErrors((current) => ({ ...current, ...fieldErrors }));
      if (message) toast.error(message);
    } finally {
      setSaving(false);
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

  const isFilterActive =
    keyword.trim() !== "" ||
    industryFilter !== FILTER_ALL ||
    publishedFilter !== FILTER_ALL;
  const withoutImage = rows.filter(
    (row) => (row.images?.length ?? 0) === 0,
  ).length;

  return (
    <Box data-testid="pv-product-catalog-page">
      <UiCard>
        <Stack spacing={1.5}>
          <Box>
            <Box sx={{ fontSize: 13, color: S.textMedium }}>
              {t("pv.productCatalog.lead")}
            </Box>
            {!canPublish ? (
              <Box
                component="span"
                sx={{ fontSize: 12, color: S.textDisabled }}
              >
                {t("pv.admin.leadNoPublish")}
              </Box>
            ) : null}
          </Box>

          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <Box component="span" sx={{ fontSize: 12, color: S.textMedium }}>
              {t("pv.productCatalog.statTotal", { count: pagination.total })}
            </Box>
            <Box component="span" sx={{ fontSize: 12, color: S.textMedium }}>
              {t("pv.productCatalog.statNoImage", { count: withoutImage })}
            </Box>
          </Box>

          <FilterBar
            actions={
              <ActionButton
                kind="create"
                disabled={!canManage}
                onClick={openCreate}
                data-testid="pv-catalog-add"
              >
                {t("pv.productCatalog.addAction")}
              </ActionButton>
            }
          >
            <SearchInput
              value={keyword}
              onChange={(next) => applyFilter(() => setKeyword(next))}
              placeholder={t("pv.admin.profileSearch")}
              data-testid="pv-catalog-search"
            />
            <UiSelect
              value={industryFilter}
              onChange={(next) => applyFilter(() => setIndustryFilter(next))}
              aria-label={t("pv.admin.industryFilterAria")}
              minWidth={200}
              options={[
                { value: FILTER_ALL, label: t("pv.admin.industryAll") },
                ...industryOptions,
              ]}
              data-testid="pv-catalog-industry-filter"
            />
            <UiSelect
              value={publishedFilter}
              onChange={(next) => applyFilter(() => setPublishedFilter(next))}
              aria-label={t("pv.admin.publishedFilterAria")}
              minWidth={180}
              options={[
                {
                  value: FILTER_ALL,
                  label: t("pv.productCatalog.publishedAll"),
                },
                { value: "true", label: t("pv.admin.publishedShown") },
                { value: "false", label: t("pv.admin.publishedHidden") },
              ]}
              data-testid="pv-catalog-published-filter"
            />
          </FilterBar>

          {profiles.isLoading ? (
            <LoadingState tip={t("pv.common.loading")} />
          ) : profiles.isError ? (
            <UiStateSurface
              kind="error"
              description={getMutationErrorMessage(profiles.error)}
              action={
                <ActionButton
                  kind="refresh"
                  onClick={() => void profiles.refetch()}
                >
                  {t("common.retry")}
                </ActionButton>
              }
            />
          ) : visibleRows.length === 0 ? (
            <Box {...uiStateProps(UI_STATE.EMPTY)}>
              <UiStateSurface
                kind="empty"
                title={
                  isFilterActive
                    ? t("pv.common.noMatch")
                    : t("pv.productCatalog.emptyTitle")
                }
                description={
                  isFilterActive ? undefined : t("pv.productCatalog.emptyHint")
                }
                action={
                  isFilterActive ? null : (
                    <ActionButton
                      kind="create"
                      disabled={!canManage}
                      onClick={openCreate}
                    >
                      {t("pv.productCatalog.addAction")}
                    </ActionButton>
                  )
                }
              />
            </Box>
          ) : (
            <Grid container spacing={2} data-testid="pv-catalog-grid">
              {visibleRows.map((row) => (
                <Grid key={row.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                  <PvCatalogCard
                    profile={row}
                    industryNameById={industryNameById}
                    canManage={canManage}
                    canPublish={canPublish}
                    busy={setPublished.isPending}
                    onEdit={() => openEdit(row)}
                    onTogglePublish={(next) => void togglePublish(row, next)}
                    t={t}
                  />
                </Grid>
              ))}
            </Grid>
          )}

          {pagination.total > 0 ? (
            <UiPagination
              page={pagination.current}
              pageSize={pagination.pageSize}
              total={pagination.total}
              onPageChange={setPage}
              onPageSizeChange={(size) => applyFilter(() => setPageSize(size))}
              pageSizeOptions={[...MVP_PAGE_SIZE_OPTIONS]}
              disabled={profiles.isFetching}
            />
          ) : null}
        </Stack>
      </UiCard>

      <UiDialog
        open={dialogMode !== null}
        onClose={guardBackdropClose(closeDialog)}
        maxWidth="md"
        title={
          dialogMode === "create"
            ? t("pv.productCatalog.dialogCreateTitle")
            : t("pv.productCatalog.dialogEditTitle")
        }
        actions={
          <>
            <ActionButton kind="cancel" onClick={closeDialog} disabled={saving}>
              {t("pv.common.cancel")}
            </ActionButton>
            <ActionButton
              kind="save"
              onClick={() => void submit()}
              disabled={saving}
              data-testid="pv-catalog-submit"
            >
              {saving ? t("pv.common.saving") : t("pv.common.save")}
            </ActionButton>
          </>
        }
      >
        <Grid container spacing={2} sx={{ pt: 0.5 }}>
          {dialogMode === "create" ? (
            <Grid size={12}>
              <UiAutocomplete
                required
                label={t("pv.productCatalog.skuField")}
                value={form.sku_id || null}
                options={skuOptions}
                loading={skuQuery.isFetching}
                onInputChange={setSkuKeyword}
                noOptionsText={t("pv.productCatalog.skuNoOption")}
                onChange={(next) => {
                  const skuId = next ? String(next) : "";
                  const picked = (skuQuery.data?.data ?? []).find(
                    (sku) => sku.sku_id === skuId,
                  );
                  // Tên hiển thị mặc định lấy theo tên SKU: hầu hết sản phẩm
                  // không cần đặt lại tên cho App PV, và ô rỗng bắt người dùng
                  // gõ lại một chuỗi đã có sẵn.
                  patchForm(
                    {
                      sku_id: skuId,
                      display_name:
                        form.display_name.trim() === "" && picked
                          ? picked.sku_name
                          : form.display_name,
                    },
                    "sku_id",
                  );
                }}
                error={Boolean(errors.sku_id)}
                helperText={errors.sku_id || t("pv.productCatalog.skuHint")}
                data-testid="pv-catalog-sku-picker"
              />
            </Grid>
          ) : (
            <Grid size={12}>
              <Box component="span" sx={{ fontSize: 12, color: S.textMedium }}>
                {t("pv.productCatalog.skuField")}:{" "}
                <strong>
                  {editing?.sku_code} — {editing?.sku_name}
                </strong>
              </Box>
            </Grid>
          )}

          {/* Không có ô "Thứ tự hiển thị": xem chú thích của `sort_order` trong
              ProfileFormState. */}
          <Grid size={12}>
            <UiTextField
              required
              fullWidth
              label={t("pv.admin.displayName")}
              value={form.display_name}
              onChange={(event) =>
                patchForm({ display_name: event.target.value }, "display_name")
              }
              error={Boolean(errors.display_name)}
              helperText={errors.display_name}
              slotProps={{ htmlInput: { maxLength: 255 } }}
            />
          </Grid>

          <Grid size={12}>
            <UiTextField
              fullWidth
              multiline
              minRows={3}
              label={t("pv.admin.description")}
              value={form.description}
              onChange={(event) =>
                patchForm({ description: event.target.value }, "description")
              }
              error={Boolean(errors.description)}
              helperText={errors.description}
              slotProps={{ htmlInput: { maxLength: DESCRIPTION_MAX } }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <UiAutocomplete
              multiple
              label={t("pv.admin.industry")}
              value={form.industry_ids}
              onChange={(next) => patchForm({ industry_ids: next.map(String) })}
              options={industryOptions}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <UiAutocomplete
              multiple
              label={t("pv.admin.tags")}
              value={form.tag_ids}
              onChange={(next) => patchForm({ tag_ids: next.map(String) })}
              options={tagOptions}
            />
          </Grid>

          <Grid size={12}>
            <PvProductImageField
              value={form.images}
              onChange={(images) => patchForm({ images }, "images")}
              disabled={saving}
              error={errors.images}
            />
          </Grid>

          <Grid size={12}>
            <Box component="span" sx={{ fontSize: 12, color: S.textDisabled }}>
              {t("pv.admin.publishHint")}
            </Box>
          </Grid>
        </Grid>
      </UiDialog>
    </Box>
  );
}

export default PvProductCatalogPage;
