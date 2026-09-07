/**
 * UiAddressField — ô nhập ĐỊA CHỈ VIỆT NAM theo địa giới sau sáp nhập
 * (Tỉnh/Thành → Phường/Xã → địa chỉ cụ thể), điều khiển trực tiếp
 * (value/onChange) như UiTextField để lắp vào các form useState hiện có.
 *
 * `value` là CHUỖI lưu trong cột địa chỉ (JSON của FE hoặc chuỗi cũ nhập tự
 * do — xem @/shared/lib/vn-address). `onChange` nhận chuỗi JSON đã serialize
 * (rỗng khi người dùng xoá hết) — nơi gọi cứ ghi thẳng vào payload.
 *
 * Danh mục tỉnh/xã đọc từ JSON TRONG REPO (@/shared/lib/vn-address/data) —
 * không gọi dịch vụ ngoài: tỉnh/thành nằm trong bundle nên luôn sẵn sàng,
 * phường/xã ở chunk riêng nạp lười. Chunk hỏng thì có cảnh báo + nút tải lại,
 * còn ô tỉnh/thành và "Địa chỉ cụ thể" vẫn dùng bình thường.
 */
import { useId, useMemo, type ReactNode } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import type { FilterOptionsState } from "@mui/material/useAutocomplete";
import Box from "@mui/material/Box";
import FormHelperText from "@mui/material/FormHelperText";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import { useT } from "@/shared/i18n/useT";
import {
  EMPTY_STRUCTURED_ADDRESS,
  joinAddressParts,
  normalizeVietnamese,
  parseAddress,
  serializeAddress,
  useVnProvinces,
  useVnWards,
  type StructuredAddress,
  type VnProvince,
  type VnWard,
} from "@/shared/lib/vn-address";
import { flatIconClass } from "../icons/icon-family";
import { SEMANTIC_LIGHT as S, RADIUS } from "../tokens";
import { UiButton } from "../components/UiButton";
import { UiSpinner } from "../components/UiSpinner";

export interface UiAddressFieldProps {
  /** Chuỗi lưu trong cột địa chỉ (JSON FE hoặc chuỗi cũ). */
  value: string | null | undefined;
  /** Nhận chuỗi JSON đã serialize ("" khi rỗng hoàn toàn). */
  onChange: (next: string) => void;
  /** Tiêu đề nhóm (vd "Địa chỉ nhận", "Địa chỉ khách"). Mặc định "Địa chỉ". */
  label?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  /** Lỗi từ validate/server — hiện đỏ dưới nhóm. */
  error?: boolean;
  helperText?: ReactNode;
  /** Giới hạn ký tự phần địa chỉ cụ thể (mặc định 200 — vừa cột 500 ký tự). */
  maxDetailLength?: number;
  /**
   * "grid" (mặc định): Tỉnh | Xã cùng hàng ở ≥ sm, địa chỉ cụ thể hàng dưới.
   * "stacked": mỗi ô một hàng (khối hẹp, sidebar/drawer).
   */
  layout?: "grid" | "stacked";
  /** Tự focus ô tỉnh/thành khi mount. */
  autoFocus?: boolean;
  id?: string;
  "data-testid"?: string;
}

/** Lọc không dấu, khớp cả "ha noi" lẫn "thanh pho ha noi". */
function filterVietnamese<T extends { name: string }>(
  options: T[],
  state: FilterOptionsState<T>,
): T[] {
  const query = normalizeVietnamese(state.inputValue);
  if (!query) return options;
  return options.filter((option) =>
    normalizeVietnamese(option.name).includes(query),
  );
}

function findProvince(
  provinces: VnProvince[],
  address: StructuredAddress,
): VnProvince | null {
  if (address.province_code !== null) {
    const byCode = provinces.find((p) => p.code === address.province_code);
    if (byCode) return byCode;
  }
  if (address.province) {
    const byName = provinces.find((p) => p.name === address.province);
    if (byName) return byName;
    // Đang tải hoặc mất mạng: vẫn hiển thị tên đã lưu.
    return {
      code: address.province_code ?? -1,
      name: address.province,
      codename: "",
      division_type: "",
    };
  }
  return null;
}

function findWard(wards: VnWard[], address: StructuredAddress): VnWard | null {
  if (address.ward_code !== null) {
    const byCode = wards.find((w) => w.code === address.ward_code);
    if (byCode) return byCode;
  }
  if (address.ward) {
    const byName = wards.find((w) => w.name === address.ward);
    if (byName) return byName;
    return {
      code: address.ward_code ?? -1,
      name: address.ward,
      codename: "",
      division_type: "",
      province_code: address.province_code ?? -1,
    };
  }
  return null;
}

export function UiAddressField({
  value,
  onChange,
  label,
  required = false,
  disabled = false,
  error = false,
  helperText,
  maxDetailLength = 200,
  layout = "grid",
  autoFocus = false,
  id,
  "data-testid": dataTestId,
}: UiAddressFieldProps) {
  const t = useT();
  const reactId = useId();
  const baseId = id ?? `ui-address-${reactId}`;

  const parsed = useMemo(() => parseAddress(value), [value]);
  const address: StructuredAddress = parsed ?? EMPTY_STRUCTURED_ADDRESS;
  const legacy = Boolean(parsed?.legacy);

  const provinces = useVnProvinces(!disabled);
  const wards = useVnWards(address.province_code, !disabled);

  const selectedProvince = useMemo(
    () => findProvince(provinces.data, address),
    [provinces.data, address],
  );
  const selectedWard = useMemo(
    () => findWard(wards.data, address),
    [wards.data, address],
  );

  // Autocomplete cảnh báo khi value không nằm trong options — chèn giá trị
  // đã lưu vào danh sách lúc danh mục chưa về / mất mạng.
  const provinceOptions = useMemo(() => {
    if (
      selectedProvince &&
      !provinces.data.some((p) => p.code === selectedProvince.code)
    ) {
      return [selectedProvince, ...provinces.data];
    }
    return provinces.data;
  }, [provinces.data, selectedProvince]);
  const wardOptions = useMemo(() => {
    if (selectedWard && !wards.data.some((w) => w.code === selectedWard.code)) {
      return [selectedWard, ...wards.data];
    }
    return wards.data;
  }, [wards.data, selectedWard]);

  const emit = (next: StructuredAddress) => onChange(serializeAddress(next));

  const handleProvince = (next: VnProvince | null) => {
    emit({
      ...address,
      province_code: next ? next.code : null,
      province: next ? next.name : "",
      // Đổi tỉnh → xã cũ không còn hợp lệ.
      ward_code: null,
      ward: "",
    });
  };
  const handleWard = (next: VnWard | null) => {
    emit({
      ...address,
      ward_code: next ? next.code : null,
      ward: next ? next.name : "",
    });
  };
  const handleDetail = (next: string) => {
    emit({ ...address, detail: next.slice(0, maxDetailLength) });
  };

  const catalogError = provinces.error || wards.error;
  const retryCatalog = () => {
    if (provinces.error) provinces.retry();
    if (wards.error) wards.retry();
  };
  const preview = joinAddressParts(address);
  const wardDisabled = disabled || address.province_code === null;
  const detailLength = address.detail.length;

  const provinceCol = layout === "grid" ? { xs: 12, sm: 6 } : { xs: 12 };
  const wardCol = provinceCol;

  const groupLabel = label ?? t("shared.address.legend");

  return (
    <Box
      data-testid={dataTestId}
      data-ui="address-field"
      role="group"
      aria-labelledby={`${baseId}-legend`}
      sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}
    >
      <Box
        id={`${baseId}-legend`}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1.2,
          color: error ? S.error : S.textHigh,
        }}
      >
        <i
          className={flatIconClass("marker")}
          aria-hidden
          style={{ fontSize: 14, color: error ? S.error : S.primary }}
        />
        <span>{groupLabel}</span>
        {required ? (
          <Box component="span" sx={{ color: S.error, ml: -0.5 }}>
            *
          </Box>
        ) : null}
      </Box>

      <Grid container spacing={1.5}>
        <Grid size={provinceCol}>
          <Autocomplete
            id={`${baseId}-province`}
            size="small"
            fullWidth
            options={provinceOptions}
            value={selectedProvince}
            disabled={disabled}
            loading={provinces.loading}
            loadingText={t("shared.address.loading")}
            noOptionsText={t("shared.form.noOptions")}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, current) =>
              option.code === current.code
            }
            onChange={(_event, next) => handleProvince(next)}
            filterOptions={filterVietnamese}
            autoHighlight
            openOnFocus
            renderInput={(params) => (
              <TextField
                {...params}
                label={t("shared.address.province")}
                placeholder={t("shared.address.provincePlaceholder")}
                required={required}
                autoFocus={autoFocus}
                error={error}
                slotProps={{
                  ...params.slotProps,
                  input: {
                    ...params.slotProps.input,
                    endAdornment: (
                      <>
                        {provinces.loading ? (
                          <UiSpinner size={16} label={null} />
                        ) : null}
                        {params.slotProps.input.endAdornment}
                      </>
                    ),
                  },
                  htmlInput: {
                    ...params.slotProps.htmlInput,
                    "data-testid": dataTestId
                      ? `${dataTestId}-province`
                      : undefined,
                  },
                }}
              />
            )}
          />
        </Grid>
        <Grid size={wardCol}>
          <Autocomplete
            id={`${baseId}-ward`}
            size="small"
            fullWidth
            options={wardOptions}
            value={selectedWard}
            disabled={wardDisabled}
            loading={wards.loading}
            loadingText={t("shared.address.loading")}
            noOptionsText={t("shared.form.noOptions")}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, current) =>
              option.code === current.code
            }
            onChange={(_event, next) => handleWard(next)}
            filterOptions={filterVietnamese}
            autoHighlight
            openOnFocus
            renderInput={(params) => (
              <TextField
                {...params}
                label={t("shared.address.ward")}
                placeholder={
                  address.province_code === null
                    ? t("shared.address.wardNeedProvince")
                    : t("shared.address.wardPlaceholder")
                }
                required={required}
                error={error}
                slotProps={{
                  ...params.slotProps,
                  input: {
                    ...params.slotProps.input,
                    endAdornment: (
                      <>
                        {wards.loading ? (
                          <UiSpinner size={16} label={null} />
                        ) : null}
                        {params.slotProps.input.endAdornment}
                      </>
                    ),
                  },
                  htmlInput: {
                    ...params.slotProps.htmlInput,
                    "data-testid": dataTestId
                      ? `${dataTestId}-ward`
                      : undefined,
                  },
                }}
              />
            )}
          />
        </Grid>
        <Grid size={12}>
          <TextField
            id={`${baseId}-detail`}
            size="small"
            fullWidth
            label={t("shared.address.detail")}
            placeholder={t("shared.address.detailPlaceholder")}
            value={address.detail}
            disabled={disabled}
            error={error}
            onChange={(event) => handleDetail(event.target.value)}
            autoComplete="off"
            slotProps={{
              htmlInput: {
                maxLength: maxDetailLength,
                "data-testid": dataTestId ? `${dataTestId}-detail` : undefined,
              },
              input: {
                endAdornment:
                  detailLength > 0 ? (
                    <Box
                      component="span"
                      aria-hidden
                      sx={{
                        fontSize: 11,
                        color:
                          detailLength >= maxDetailLength
                            ? S.warningText
                            : S.textDisabled,
                        whiteSpace: "nowrap",
                        ml: 0.5,
                      }}
                    >
                      {detailLength}/{maxDetailLength}
                    </Box>
                  ) : undefined,
              },
            }}
          />
        </Grid>
      </Grid>

      {error && helperText ? (
        <FormHelperText error sx={{ mx: 0, mt: -0.5 }}>
          {helperText}
        </FormHelperText>
      ) : null}

      {catalogError ? (
        <Box
          role="alert"
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            flexWrap: "wrap",
            px: 1.25,
            py: 0.75,
            borderRadius: `${RADIUS.control}px`,
            backgroundColor: S.warningSoft,
            color: S.warningText,
            fontSize: 12.5,
            lineHeight: 1.4,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <i className={flatIconClass("info")} aria-hidden />
            <span>{t("shared.address.loadError")}</span>
          </Box>
          <UiButton
            size="small"
            appearance="text"
            color="warning"
            onClick={retryCatalog}
            startIcon={<i className={flatIconClass("refresh")} aria-hidden />}
          >
            {t("shared.address.retry")}
          </UiButton>
        </Box>
      ) : null}

      {!catalogError && legacy && !disabled ? (
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 0.75,
            fontSize: 12.5,
            lineHeight: 1.4,
            color: S.textMedium,
          }}
        >
          <i
            className={flatIconClass("info")}
            aria-hidden
            style={{ marginTop: 2, color: S.warning }}
          />
          <span>{t("shared.address.legacyHint")}</span>
        </Box>
      ) : null}

      {!error && helperText ? (
        <FormHelperText sx={{ mx: 0, mt: -0.5 }}>{helperText}</FormHelperText>
      ) : null}

      {preview && !legacy ? (
        <Box
          data-testid={dataTestId ? `${dataTestId}-preview` : undefined}
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 0.75,
            px: 1.25,
            py: 0.75,
            borderRadius: `${RADIUS.control}px`,
            backgroundColor: S.bgSubtle,
            border: `1px dashed ${S.border}`,
            fontSize: 12.5,
            lineHeight: 1.45,
            color: S.textMedium,
          }}
        >
          <i
            className={flatIconClass("map-marker")}
            aria-hidden
            style={{ marginTop: 2, color: S.primary }}
          />
          <span>
            {t("shared.address.preview")}:{" "}
            <Box component="b" sx={{ color: S.textHigh, fontWeight: 600 }}>
              {preview}
            </Box>
          </span>
        </Box>
      ) : null}
    </Box>
  );
}
