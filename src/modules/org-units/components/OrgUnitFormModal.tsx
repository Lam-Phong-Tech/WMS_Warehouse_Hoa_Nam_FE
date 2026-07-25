import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Grid,
  Input,
  Radio,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
  Upload,
} from 'antd';
import type { UploadProps } from 'antd';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { UploadOutlined } from '@ant-design/icons';
import { FormModal, FormSection, confirmDialog } from '@/shared/components';
import { useApiFormErrors } from '@/shared/hooks/useApiFormErrors';
import { useFormDraft } from '@/shared/hooks/useFormDraft';
import { FormField, FormInput, FormSelect } from '@/shared/components/forms';
import { storageUrl } from '@/shared/utils/storage-url';
import {
  orgUnitSchema,
  type OrgUnitFormValues,
  validateParentId,
} from '@/modules/org-units/schemas/org-unit.schema';
import {
  UNIT_TYPE_OPTIONS,
  type OrgUnit,
} from '@/modules/org-units/types/org-units.types';
import {
  getValidParentOptions,
  VALID_PARENT_TYPES,
  TMP_DEFAULT_DAYS,
} from '@/modules/org-units/utils/org-units.service-helpers';
import {
  useGenerateTmpCode,
  useGenerateOrgUnitCode,
  useCheckTaxCode,
} from '@/modules/org-units/hooks/use-org-units';
import { useEmployeeList } from '@/modules/employees/hooks/use-employees';
import {
  fetchProvinces,
  fetchDistrictsByProvince,
  fetchLegacyProvinces,
  lookupNewWardFromLegacyName,
  type Province,
  type District,
  type LegacyProvince,
  type LegacyDistrict,
  type LegacyWardCandidate,
} from '@/modules/org-units/services/vietnam-address.service';

// ---------------------------------------------------------------------------
// Constants & static styles (P2.2 — tập trung inline style ra ngoài JSX)
// ---------------------------------------------------------------------------

const ACCEPTED_LOGO_TYPES = [
  'image/jpeg',
  'image/png',
  'image/svg+xml',
  'image/webp',
];
const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB (API contract: max 2048 KB)

const DEFAULTS: OrgUnitFormValues = {
  code: '',
  name: '',
  unitType: 'chi_nhanh',
  taxCode: '',
  managerId: null,
  email: '',
  phone: '',
  address: '',
  province: '',
  ward: '',
  addressMode: 'current',
  parentId: null,
  active: true,
  // P0.1: Bổ sung trường cho luồng TMP vào giá trị mặc định
  taxCodeStatus: null,
  taxCodeDueDate: null,
  tmpCodeLocked: false,
};

const STATUS_OPTIONS = [
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'inactive', label: 'Ngừng hoạt động' },
];

// P2.4 — helper text mô tả từng loại đơn vị
const UNIT_TYPE_HELPERS: Record<string, string> = {
  cong_ty_me: 'Pháp nhân độc lập, đứng đầu chuỗi tổ chức. Không có đơn vị cha.',
  cong_ty_con:
    'Pháp nhân con thuộc Công ty mẹ. Bắt buộc chọn Công ty mẹ làm đơn vị cha.',
  chi_nhanh:
    'Chi nhánh có thể trực thuộc Công ty mẹ hoặc Công ty con theo rule đã chốt. Tỉnh/Thành phố là trường bắt buộc.',
};

// Style constants (P2.2)
const twoCols: CSSProperties = {
  display: 'grid',
  // minmax(0, 1fr) thay vì '1fr' — tránh cột grid bị đẩy rộng ra ngoài modal
  // khi nội dung con (VD: label dài trong Select) không tự xuống dòng/ellipsis.
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
  columnGap: 16,
};

const radioGroupStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  width: '100%',
};

const radioCardStyle = (active: boolean): CSSProperties => ({
  flex: 1,
  margin: 0,
  padding: '6px 10px',
  border: `1px solid ${active ? '#1677ff' : '#d9d9d9'}`,
  borderRadius: 8,
  background: active ? '#e6f4ff' : '#fff',
  display: 'flex',
  alignItems: 'center',
  transition: 'all .2s',
});

const helperTextStyle: CSSProperties = {
  display: 'block',
  marginTop: 4,
  fontSize: 12,
  color: '#888',
};

const logoLabelStyle: CSSProperties = { marginBottom: 8 };
const logoPendingStyle: CSSProperties = {
  fontSize: 13,
  color: '#888',
  marginTop: 4,
};
const logoImgStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'contain',
};
const logoUploadInnerStyle: CSSProperties = { marginTop: 4, fontSize: 13 };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface OrgUnitFormModalProps {
  open: boolean;
  editing: OrgUnit | null;
  allUnits: OrgUnit[];
  isPending: boolean;
  apiErrors?: Record<string, string> | null;
  onCancel: () => void;
  onSubmit: (values: OrgUnitFormValues, logoFile?: File | null) => void;
  /**
   * Khóa "Loại đơn vị" về đúng 1 giá trị — dùng cho branch-mode
   * (`/org-units?mode=branch`) để form Thêm/Sửa chi nhánh không cho đổi
   * sang Công ty mẹ/Công ty con.
   */
  lockedUnitType?: 'cong_ty_me' | 'cong_ty_con' | 'chi_nhanh';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OrgUnitFormModal({
  open,
  editing,
  allUnits,
  isPending,
  apiErrors,
  onCancel,
  onSubmit,
  lockedUnitType,
}: OrgUnitFormModalProps) {
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    setError,
    register,
    watch,
  } = useForm<OrgUnitFormValues>({
    resolver: zodResolver(orgUnitSchema),
    defaultValues: {
      ...DEFAULTS,
      unitType: lockedUnitType ?? DEFAULTS.unitType,
    },
    mode: 'onChange', // Kích hoạt validation real-time khi người dùng nhập
  });

  register('tmpCodeLocked');
  register('taxCodeStatus');
  register('taxCodeDueDate');

  const [hasTaxCode, setHasTaxCode] = useState(true);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const provinceValue = useWatch({ control, name: 'province' });

  // Chuyển đổi địa chỉ cũ (trước sáp nhập 2025) sang địa chỉ mới — kiểu Zalo:
  // chọn Tỉnh cũ -> Quận/Huyện cũ -> Phường/Xã cũ, hệ thống tự áp dụng địa chỉ
  // mới, không cần bấm thêm nút nào. 3 cấp thật (Tỉnh/Quận/Phường) lấy từ
  // provinces.open-api.vn API v1 — xem scripts/fetch-vietnam-addresses-old.mjs.
  const [showLegacyLookup, setShowLegacyLookup] = useState(false);
  const [legacyProvinces, setLegacyProvinces] = useState<LegacyProvince[]>([]);
  const [legacyProvinceName, setLegacyProvinceName] = useState<string | null>(
    null,
  );
  const [legacyDistricts, setLegacyDistricts] = useState<LegacyDistrict[]>([]);
  const [legacyDistrictName, setLegacyDistrictName] = useState<string | null>(
    null,
  );
  const [legacyWards, setLegacyWards] = useState<string[]>([]);
  const [legacyCandidates, setLegacyCandidates] = useState<
    LegacyWardCandidate[]
  >([]);
  const [legacyAppliedWard, setLegacyAppliedWard] = useState<string | null>(
    null,
  );
  // Sau khi tra cứu địa chỉ cũ áp dụng thành công, khoá Tỉnh/Phường mới lại
  // (chỉ hiển thị, không cho sửa tay) để tránh lệch với địa chỉ cũ đã chọn.
  const isLegacyApplied =
    showLegacyLookup && !!legacyAppliedWard && legacyCandidates.length === 0;
  const handleResetLegacyLookup = () => {
    setLegacyProvinceName(null);
    setLegacyDistricts([]);
    setLegacyDistrictName(null);
    setLegacyWards([]);
    setLegacyCandidates([]);
    setLegacyAppliedWard(null);
  };

  useEffect(() => {
    if (!showLegacyLookup || legacyProvinces.length > 0) return;
    fetchLegacyProvinces()
      .then(setLegacyProvinces)
      .catch(() => toast.error('Không thể tải danh sách tỉnh/thành cũ'));
  }, [showLegacyLookup, legacyProvinces.length]);

  const handleSelectLegacyProvince = (name: string) => {
    setLegacyProvinceName(name);
    setLegacyDistrictName(null);
    setLegacyWards([]);
    setLegacyCandidates([]);
    setLegacyAppliedWard(null);
    const province = legacyProvinces.find(
      (p) => p.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
    setLegacyDistricts(province?.districts ?? []);
  };

  const handleSelectLegacyDistrict = (name: string) => {
    setLegacyDistrictName(name);
    setLegacyCandidates([]);
    setLegacyAppliedWard(null);
    const district = legacyDistricts.find(
      (d) => d.name.trim().toLowerCase() === name.trim().toLowerCase(),
    );
    setLegacyWards(district?.wards ?? []);
  };

  const handleSelectLegacyWard = async (wardName: string) => {
    if (!legacyProvinceName) return;
    const candidates = await lookupNewWardFromLegacyName(
      wardName,
      legacyProvinceName,
    );
    if (candidates.length === 1) {
      await applyWardCandidate(candidates[0]);
      setLegacyAppliedWard(wardName);
      setLegacyCandidates([]);
    } else if (candidates.length > 1) {
      setLegacyCandidates(candidates);
      setLegacyAppliedWard(wardName);
    } else {
      toast.warning('Không tìm thấy dữ liệu ánh xạ cho phường/xã này');
      setLegacyCandidates([]);
      setLegacyAppliedWard(null);
    }
  };

  // Áp dụng 1 ứng viên phường/xã mới (đã map từ tên cũ) vào select Tỉnh/Quận.
  // Dùng chung cho cả tra cứu thủ công lẫn tự động sau khi lấy MST.
  const applyWardCandidate = async (candidate: LegacyWardCandidate) => {
    const matchedProvince = provinces.find(
      (p) =>
        p.name.trim().toLowerCase() ===
        candidate.new_province_name.trim().toLowerCase(),
    );
    if (!matchedProvince) {
      toast.error('Không tìm thấy tỉnh/thành mới tương ứng trong danh sách');
      return;
    }
    setValue('province', String(matchedProvince.code));
    const provinceDistricts = await fetchDistrictsByProvince(
      matchedProvince.code,
    );
    setDistricts(provinceDistricts);
    const matchedDistrict = provinceDistricts.find(
      (d) =>
        d.name.trim().toLowerCase() ===
        candidate.new_ward_name.trim().toLowerCase(),
    );
    if (matchedDistrict) {
      setValue('ward', String(matchedDistrict.code), {
        shouldValidate: true,
      });
    } else {
      toast.warning(
        'Không tìm thấy phường/xã mới tương ứng trong danh sách hiện có',
      );
    }
  };

  const handleApplyLegacyCandidate = async (candidate: LegacyWardCandidate) => {
    await applyWardCandidate(candidate);
    setLegacyCandidates([]);
  };

  // Người đại diện/phụ trách: tìm nhân sự qua GET /employees?keyword= (search-as-you-type)
  // thay vì load toàn bộ danh sách — tránh danh sách quá lớn với super admin
  // (không bị giới hạn theo scope như user thường).
  const [managerKeyword, setManagerKeyword] = useState('');
  const [debouncedManagerKeyword, setDebouncedManagerKeyword] = useState('');
  const managerKeywordDebounceRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const handleManagerSearch = (value: string) => {
    setManagerKeyword(value);
    if (managerKeywordDebounceRef.current) {
      clearTimeout(managerKeywordDebounceRef.current);
    }
    managerKeywordDebounceRef.current = setTimeout(() => {
      setDebouncedManagerKeyword(value);
    }, 400);
  };
  const managerId = useWatch({ control, name: 'managerId' });
  const { data: managerSearchResult, isFetching: managerSearchLoading } =
    useEmployeeList(
      open
        ? { keyword: debouncedManagerKeyword || undefined, per_page: 20 }
        : {},
    );
  const managerOptions = useMemo(() => {
    const options = (managerSearchResult?.data ?? []).map((e) => ({
      value: e.id,
      label: `${e.code} — ${e.fullName}`,
    }));
    // Giữ hiển thị đúng nhân sự đang chọn (edit hoặc auto-assign) kể cả khi
    // không nằm trong kết quả tìm kiếm hiện tại.
    if (managerId != null && !options.some((o) => o.value === managerId)) {
      const currentLabel =
        editing?.managerName ?? editing?.representativeName ?? null;
      options.unshift({
        value: managerId,
        label: currentLabel ? `${currentLabel}` : `#${managerId}`,
      });
    }
    return options;
  }, [managerSearchResult, managerId, editing]);

  const generateTmpCodeMutation = useGenerateTmpCode();
  const generateOrgUnitCodeMutation = useGenerateOrgUnitCode();
  const [codeGenFailed, setCodeGenFailed] = useState(false);
  const checkTaxCodeMutation = useCheckTaxCode();
  const lastCheckedTaxCodeRef = useRef<string | null>(null);

  const handleCheckTaxCode = async (rawValue: string) => {
    const value = rawValue.trim();
    // Chỉ tra cứu khi có MST thật (không phải mã tạm) và đủ độ dài hợp lệ (10 hoặc 13 số)
    if (!hasTaxCode || !/^\d{10}(\d{3})?$/.test(value)) return;
    if (lastCheckedTaxCodeRef.current === value) return;
    lastCheckedTaxCodeRef.current = value;
    try {
      const info = await checkTaxCodeMutation.mutateAsync(value);
      setValue('name', info.name, { shouldValidate: true });
      setValue('address', info.address, { shouldValidate: true });
      // Tỉnh/Thành, Phường/Xã để người dùng tự chọn — không tự suy ra từ
      // text địa chỉ do Tổng Cục Thuế trả về (dễ sai vì dùng tên hành chính cũ).
      toast.success('Đã tự động điền địa chỉ từ mã số thuế');
    } catch {
      toast.error('Không tìm thấy thông tin doanh nghiệp cho mã số thuế này.');
    }
  };

  const handleGenerateTmp = async () => {
    try {
      const code = await generateTmpCodeMutation.mutateAsync();
      const dueDate = dayjs().add(TMP_DEFAULT_DAYS, 'day').format('YYYY-MM-DD');
      setValue('tmpCodeLocked', true);
      setValue('taxCodeStatus', 'pending');
      setValue('taxCodeDueDate', dueDate);
      setValue('taxCode', code, { shouldValidate: true });
    } catch {
      // P1.1: Updated error message
      toast.error(
        'Không thể tạo mã TMP từ server. Vui lòng thử lại hoặc liên hệ Backend.',
      );
    }
  };

  const handleUnlockTmpCode = () => {
    setValue('tmpCodeLocked', false);
    setValue('taxCode', '');
    setValue('taxCodeStatus', null);
    setValue('taxCodeDueDate', null);
  };

  // Key phải là tên field SAU KHI `extractFieldErrors()` (api-error.ts) đã tự
  // snake_case → camelCase — không phải tên field gốc (snake_case) từ BE (bug đã
  // gặp thật: key cũ `representative_person_id` không bao giờ khớp vì
  // extractFieldErrors trả về `representativePersonId`, khiến lỗi field này bị
  // rơi mất, không hiển thị). Các entry mà tên sau chuyển đổi đã trùng sẵn với
  // tên field form (taxCode, parentId, unitType, managerId, taxCodeStatus...)
  // về bản chất là no-op, giữ lại chỉ để tài liệu hoá tường minh field nào có ánh xạ.
  const SNAKE_TO_CAMEL = useMemo<Record<string, keyof OrgUnitFormValues>>(
    () => ({
      representativePersonId: 'managerId',
      taxCodeStatus: 'taxCodeStatus',
      taxCodeDueDate: 'taxCodeDueDate',
      tmpCodeLocked: 'tmpCodeLocked',
    }),
    [],
  );

  // P2.3 — responsive: stack two-col grid thành single-col trên màn nhỏ
  const screens = Grid.useBreakpoint();
  const colStyle = screens.sm ? twoCols : {};

  // Logo pending state
  const [pendingLogo, setPendingLogo] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);

  const logoUrl =
    pendingLogo?.previewUrl ??
    storageUrl(editing?.logo ?? editing?.org_unit?.logo) ??
    null;

  // Watched values
  const unitType = useWatch({ control, name: 'unitType' });
  const codeValue = useWatch({ control, name: 'code' });
  const parentId = useWatch({ control, name: 'parentId' });
  const taxCodeValue = useWatch({ control, name: 'taxCode' });
  const tmpCodeLocked = useWatch({ control, name: 'tmpCodeLocked' });
  const isParentCompany = unitType === 'cong_ty_me';
  const isBranch = unitType === 'chi_nhanh';
  const isTmpCode =
    typeof taxCodeValue === 'string' && taxCodeValue.startsWith('TMP-');

  // P0.6: Sinh mã đơn vị/chi nhánh tự động theo Wireframe P0 (BA Wireframe P0 - 01 Org Unit).
  // API: POST /org_units/generate-code { unit_type } — chỉ xem, không cho nhập tay.
  // BE yêu cầu `code` bắt buộc khi tạo mới (không tự sinh hộ nếu thiếu), nên nếu
  // generate lỗi phải chặn Lưu và cho phép thử lại thay vì submit thiếu code.
  const runGenerateCode = (targetUnitType: string) => {
    return generateOrgUnitCodeMutation
      .mutateAsync(targetUnitType)
      .then((code) => {
        setCodeGenFailed(false);
        setValue('code', code, { shouldValidate: true });
      })
      .catch(() => {
        setCodeGenFailed(true);
        setValue('code', '', { shouldValidate: true });
        toast.error('Không sinh được mã đơn vị. Vui lòng thử lại.');
      });
  };

  useEffect(() => {
    if (!open || editing) return;
    let cancelled = false;
    generateOrgUnitCodeMutation
      .mutateAsync(unitType)
      .then((code) => {
        if (cancelled) return;
        setCodeGenFailed(false);
        setValue('code', code, { shouldValidate: true });
      })
      .catch(() => {
        if (cancelled) return;
        setCodeGenFailed(true);
        toast.error('Không sinh được mã đơn vị. Vui lòng thử lại.');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, unitType]);

  // P1.2 — Lấy unitType ban đầu khi mở form edit để phát hiện thay đổi.
  // Dùng useMemo để tính toán giá trị này thay vì dùng useState + useEffect để tránh re-render thừa.
  const initialUnitType = useMemo(() => {
    if (editing) {
      return (
        editing.unitType || editing.org_unit?.unit_type || DEFAULTS.unitType
      );
    }
    return null;
  }, [editing]);
  const unitTypeChanged =
    editing !== null &&
    initialUnitType !== null &&
    unitType !== initialUnitType;

  // P1.3 — Khi edit đổi unitType, cần cảnh báo mạnh hơn và reset các field không còn hợp lệ.
  // Dùng ref để tránh gọi reset nhiều lần trong cùng một lần đổi unitType.
  const prevUnitTypeRef = useRef(unitType);
  useEffect(() => {
    if (!unitTypeChanged) {
      prevUnitTypeRef.current = unitType;
      return;
    }
    // Chỉ xử lý khi unitType thực sự thay đổi khác với lần trước
    if (prevUnitTypeRef.current === unitType) return;
    prevUnitTypeRef.current = unitType;

    // Reset các field không còn hợp lệ
    if (unitType === 'cong_ty_me') {
      // Công ty mẹ: không có parent
      setValue('parentId', null);
    }
    if (unitType === 'chi_nhanh') {
      // Chi nhánh: không có người đại diện (managerId)
      setValue('managerId', null);
    }
  }, [unitType, unitTypeChanged, setValue, editing]);

  // Filtered parent options
  const filteredParentOptions = useMemo(
    () => getValidParentOptions(unitType, allUnits, editing),
    [unitType, allUnits, editing],
  );

  // Clear parentId khi không còn hợp lệ sau khi đổi unitType
  useEffect(() => {
    if (isParentCompany) {
      setValue('parentId', null);
      return;
    }
    if (!parentId) return;
    const validTypes = VALID_PARENT_TYPES[unitType] ?? [];
    const parent = allUnits.find((u) => u.id === parentId);
    if (
      parent &&
      validTypes.length > 0 &&
      !validTypes.includes(parent.unitType)
    ) {
      setValue('parentId', null);
    }
  }, [unitType, isParentCompany, parentId, allUnits, setValue]);

  // Logo handlers
  const beforeLogoUpload: UploadProps['beforeUpload'] = (file) => {
    if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
      toast.error('Chỉ chấp nhận ảnh JPG/PNG/SVG/WEBP');
      return Upload.LIST_IGNORE;
    }
    if (file.size > MAX_LOGO_SIZE) {
      toast.error('Ảnh logo phải ≤ 2MB');
      return Upload.LIST_IGNORE;
    }
    setPendingLogo((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return { file, previewUrl: URL.createObjectURL(file) };
    });
    return false;
  };

  const handleAfterClose = () => {
    if (pendingLogo) URL.revokeObjectURL(pendingLogo.previewUrl);
    setPendingLogo(null);
  };

  // Load form data khi mở
  useEffect(() => {
    if (!open) return;

    if (editing) {
      const { address, org_unit, taxCode, ...rest } = editing;
      const currentTaxCode = taxCode ?? org_unit?.tax_code ?? '';
      const isEditingTmp = currentTaxCode.startsWith('TMP-');
      reset({
        ...DEFAULTS,
        ...rest,
        unitType: (lockedUnitType || initialUnitType || DEFAULTS.unitType) as
          | 'cong_ty_me'
          | 'cong_ty_con'
          | 'chi_nhanh',
        taxCode: currentTaxCode,
        managerId: editing.managerId ?? org_unit?.manager_id ?? null,
        email: editing.email ?? org_unit?.email ?? '',
        phone: editing.phone ?? org_unit?.phone ?? '',
        address: address ?? org_unit?.address ?? '',
        province: editing.province ?? org_unit?.province ?? '',
        // Không còn cấp Quận/Huyện thật sau sáp nhập — fallback sang district
        // cho bản ghi cũ chỉ có district mà chưa có ward (xem org-unit.schema.ts).
        ward:
          editing.ward ??
          org_unit?.ward ??
          editing.district ??
          org_unit?.district ??
          '',
        // P0.1: Đồng bộ các trường trạng thái của MST/TMP khi sửa
        taxCodeStatus:
          editing.taxCodeStatus ??
          org_unit?.tax_code_status ??
          (isEditingTmp ? 'pending' : null),
        taxCodeDueDate:
          editing.taxCodeDueDate ??
          org_unit?.tax_code_due_date ??
          (isEditingTmp
            ? dayjs().add(TMP_DEFAULT_DAYS, 'day').format('YYYY-MM-DD')
            : null),
        tmpCodeLocked:
          editing.tmpCodeLocked ?? org_unit?.tmp_code_locked ?? isEditingTmp,
      });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasTaxCode(!isEditingTmp);
    } else {
      reset({ ...DEFAULTS, unitType: lockedUnitType ?? DEFAULTS.unitType });
      setHasTaxCode(true);
    }
  }, [open, editing, reset, initialUnitType, lockedUnitType]);

  // Map lỗi validation từ BE xuống từng field trong form (chuẩn hóa qua useApiFormErrors).
  // Nhiều field MST phụ (taxCodeDueDate/tmpCodeLocked/taxCodeStatus) đều hiển thị
  // lỗi gộp trên field `taxCode` vì UI chỉ có 1 field MST hiển thị cho người dùng.
  useApiFormErrors(apiErrors, setError, SNAKE_TO_CAMEL, (field) =>
    field === 'taxCodeDueDate' ||
    field === 'tmpCodeLocked' ||
    field === 'taxCodeStatus'
      ? 'taxCode'
      : field,
  );

  // P1.1 — Derived labels: chi_nhanh có thể chọn parent là cong_ty_me hoặc cong_ty_con
  const parentLabel =
    unitType === 'cong_ty_con'
      ? 'Công ty mẹ (đơn vị cha)'
      : unitType === 'chi_nhanh'
        ? 'Đơn vị cha (Công ty mẹ hoặc Công ty con)'
        : 'Đơn vị cha';

  const parentPlaceholder = isParentCompany
    ? '— Công ty mẹ không có đơn vị cha —'
    : unitType === 'cong_ty_con'
      ? 'Chọn Công ty mẹ'
      : 'Chọn đơn vị cha';

  // Fetch provinces when modal opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingProvinces(true);
    fetchProvinces()
      .then((data) => {
        if (!cancelled) {
          setProvinces(data);
          setLoadingProvinces(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadingProvinces(false);
          toast.error('Không thể tải danh sách tỉnh/thành phố');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // P1.5 — Khi edit, BE trả province dạng tên (text), nhưng Select dùng code làm value.
  // Sau khi danh sách tỉnh/thành tải xong, map ngược tên -> code để Select hiển thị đúng
  // lựa chọn hiện tại thay vì bắt user chọn lại.
  useEffect(() => {
    if (!open || !editing || provinces.length === 0) return;
    const currentProvince = getValues('province');
    if (!currentProvince) return;
    const isAlreadyCode = provinces.some(
      (p) => String(p.code) === String(currentProvince),
    );
    if (isAlreadyCode) return;
    const matched = provinces.find(
      (p) =>
        p.name.trim().toLowerCase() === currentProvince.trim().toLowerCase(),
    );
    if (matched) {
      setValue('province', String(matched.code));
    }
  }, [open, editing, provinces, getValues, setValue]);

  // P1.5 — Tương tự province, map ward từ tên (text) BE trả về -> code để Select hiển thị đúng
  useEffect(() => {
    if (!open || !editing || districts.length === 0) return;
    const currentWard = getValues('ward');
    if (!currentWard) return;
    const isAlreadyCode = districts.some(
      (d) => String(d.code) === String(currentWard),
    );
    if (isAlreadyCode) return;
    const matched = districts.find(
      (d) => d.name.trim().toLowerCase() === currentWard.trim().toLowerCase(),
    );
    if (matched) {
      setValue('ward', String(matched.code));
    }
  }, [open, editing, districts, getValues, setValue]);

  // Fetch danh sách phường/xã khi đổi tỉnh/thành
  useEffect(() => {
    if (!provinceValue) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDistricts([]);
      setValue('ward', '');
      return;
    }

    // P1.5 — Nếu provinceValue là tên (text) do BE trả về, map thành code trước khi fetch phường/xã
    let provinceCode = Number(provinceValue);
    if (isNaN(provinceCode)) {
      const matched = provinces.find(
        (p) =>
          p.name.trim().toLowerCase() === provinceValue.trim().toLowerCase(),
      );
      if (matched) {
        provinceCode = matched.code;
        // Đồng thời cập nhật province sang code để Select hiển thị đúng
        setValue('province', String(matched.code));
      } else {
        // Không thể xác định province code, không fetch phường/xã
        setDistricts([]);
        setValue('ward', '');
        return;
      }
    }

    let cancelled = false;
    setLoadingDistricts(true);
    fetchDistrictsByProvince(provinceCode)
      .then((data) => {
        if (!cancelled) {
          setDistricts(data);
          setLoadingDistricts(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadingDistricts(false);
          toast.error('Không thể tải danh sách phường/xã');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [provinceValue, setValue, provinces]);

  // ---------------------------------------------------------------------------
  // Draft (lưu tạm khi thoát mà chưa lưu)
  // ---------------------------------------------------------------------------
  const draft = useFormDraft<Partial<OrgUnitFormValues>>('org-unit-create');
  const submittedRef = useRef(false);

  // Restore draft when modal opens for create mode
  useEffect(() => {
    if (!open || editing) return;
    // Wait a tick for form to settle (reset + code generation)
    const timer = setTimeout(() => {
      const saved = draft.restore();
      if (saved) {
        // Merge draft over DEFAULTS — only restore fields the user actually touched
        // (skip code because it's auto-generated on open)
        reset((prev) => ({ ...prev, ...saved }));
      }
    }, 100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  // Save draft when modal closes (unless it was just submitted)
  useEffect(() => {
    if (open === false && !editing && !submittedRef.current) {
      const current = getValues();
      draft.save(current as Partial<OrgUnitFormValues>);
    }
    if (open === false) {
      submittedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  // Save draft on unmount if modal is open (user navigates away to another page)
  useEffect(() => {
    return () => {
      if (open && !editing && !submittedRef.current) {
        const current = getValues();
        draft.save(current as Partial<OrgUnitFormValues>);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  // Autosave draft liên tục khi người dùng gõ (debounce) — đảm bảo dữ liệu
  // không mất khi điều hướng sang trang khác trước khi effect unmount ở trên
  // kịp chạy (ví dụ route chuyển trang bằng SPA navigation).
  useEffect(() => {
    if (!open || editing) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const subscription = watch((values) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        draft.save(values as Partial<OrgUnitFormValues>);
      }, 400);
    });
    return () => {
      if (timer) clearTimeout(timer);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  // P2.3 — modal width: rộng hơn trên màn lớn để form thoải mái
  const modalWidth = screens.md ? 660 : screens.sm ? 560 : undefined;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const handleCancelClick = () => {
    if (!editing) {
      const current = getValues();
      const hasData = Object.values(current).some((val) => {
        if (val === null || val === undefined || val === '') return false;
        if (typeof val === 'boolean') return false;
        return true;
      });
      if (hasData) {
        confirmDialog({
          title: 'Xác nhận hủy',
          content: 'Bạn có chắc chắn muốn hủy? Dữ liệu đã nhập sẽ bị xóa.',
          okText: 'Đồng ý',
          cancelText: 'Tiếp tục nhập',
          danger: true,
          onOk: () => {
            draft.clear();
            onCancel();
          },
        });
        return;
      }
    }
    draft.clear();
    onCancel();
  };

  // Bấm ra ngoài modal / phím Esc / nút X — không hỏi xác nhận, chỉ lưu tạm
  // để mở lại vẫn còn dữ liệu vừa nhập.
  const handleDismiss = () => {
    if (!editing) {
      const current = getValues();
      draft.save(current as Partial<OrgUnitFormValues>);
    }
    onCancel();
  };

  const handleFormSubmit = (values: OrgUnitFormValues) => {
    submittedRef.current = true;
    draft.clear();
    const finalValues = { ...values };

    // Find the province name from the selected code
    const selectedProvince = provinces.find(
      (p) => String(p.code) === String(values.province),
    );
    if (selectedProvince) {
      finalValues.province = selectedProvince.name;
    }

    // Find the ward name from the selected code — BE lưu ward như một chuỗi
    // độc lập, không tự map code→tên, nên phải gửi đúng tên.
    const selectedWard = districts.find(
      (d) => String(d.code) === String(values.ward),
    );
    if (selectedWard) {
      finalValues.ward = selectedWard.name;
    }

    // Client-side circular reference validation (P0: prevent parent being child/grandchild)
    if (editing && finalValues.parentId) {
      const parentError = validateParentId(
        finalValues.unitType,
        finalValues.parentId,
        allUnits,
        editing.id,
      );
      if (parentError) {
        setError('parentId', {
          type: 'manual',
          message: parentError,
        });
        toast.error(parentError);
        return;
      }
    }

    onSubmit(finalValues, pendingLogo?.file ?? null);
  };

  return (
    <>
      <FormModal
        open={open}
        title={
          editing
            ? lockedUnitType
              ? 'Sửa chi nhánh'
              : 'Sửa đơn vị'
            : lockedUnitType
              ? 'Thêm chi nhánh mới'
              : 'Thêm đơn vị mới'
        }
        okText="Lưu đơn vị"
        onOk={() => handleSubmit(handleFormSubmit)()}
        onCancel={handleCancelClick}
        onDismiss={handleDismiss}
        afterClose={handleAfterClose}
        loading={isPending}
        width={modalWidth}
        okButtonProps={{
          disabled: !editing && !codeValue,
          title:
            !editing && !codeValue
              ? 'Chưa có mã đơn vị — vui lòng chờ hệ thống sinh mã hoặc bấm Thử lại'
              : undefined,
        }}
      >
        {/* ── SECTION 1: Thông tin pháp nhân ── */}
        <FormSection title="Thông tin pháp nhân" />

        {/* Loại đơn vị + P2.4 helper text */}
        <FormField
          control={control}
          name="unitType"
          label="Loại đơn vị"
          required
        >
          {(field) => (
            <>
              <Radio.Group
                name="unitType"
                value={field.value}
                onChange={field.onChange}
                disabled={Boolean(lockedUnitType)}
                style={radioGroupStyle}
              >
                {UNIT_TYPE_OPTIONS.map((o) => (
                  <Radio
                    key={o.value}
                    value={o.value}
                    style={radioCardStyle(field.value === o.value)}
                  >
                    {o.label}
                  </Radio>
                ))}
              </Radio.Group>
              {lockedUnitType && (
                <Typography.Text style={{ ...helperTextStyle, marginTop: 4 }}>
                  Màn Quản lý chi nhánh chỉ tạo/sửa đơn vị loại Chi nhánh.
                </Typography.Text>
              )}
            </>
          )}
        </FormField>

        {/* P1.2 — cảnh báo đổi loại khi đang sửa */}
        {unitTypeChanged && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 8 }}
            description="Thay đổi loại đơn vị có thể ảnh hưởng đến quan hệ cha/con hiện tại. Kiểm tra lại cấu trúc phân cấp sau khi lưu."
          />
        )}

        {/* Đơn vị cha gộp cùng hàng với helper text của Loại đơn vị — tránh
            chiếm 1 hàng riêng + section divider riêng, đỡ cuộn trang. */}
        <div style={{ ...colStyle, alignItems: 'start', marginBottom: 16 }}>
          {UNIT_TYPE_HELPERS[unitType] && (
            <Typography.Text style={{ ...helperTextStyle, marginTop: 8 }}>
              {UNIT_TYPE_HELPERS[unitType]}
            </Typography.Text>
          )}
          <FormSelect
            control={control}
            name="parentId"
            label={parentLabel}
            placeholder={parentPlaceholder}
            options={filteredParentOptions}
            disabled={isParentCompany}
            allowClear
            showSearch
            optionFilterProp="label"
            size="middle"
          />
        </div>
        {/* MST & Người đại diện */}
        <div style={colStyle}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              marginBottom: 16,
            }}
          >
            <div style={{ fontWeight: 500 }}>
              Mã số thuế (MST){' '}
              <span style={{ color: '#ff4d4f' }}>{!isBranch && '*'}</span>
            </div>
            <Segmented
              block
              value={hasTaxCode ? 'real' : 'tmp'}
              onChange={(val) => {
                if (val === 'tmp') {
                  setHasTaxCode(false);
                  handleGenerateTmp();
                } else {
                  setHasTaxCode(true);
                  handleUnlockTmpCode();
                }
              }}
              options={[
                { label: 'Đã có mã số thuế', value: 'real' },
                { label: 'Chưa có (Mã tạm)', value: 'tmp' },
              ]}
            />

            <FormField control={control} name="taxCode" required={!isBranch}>
              {(field) => (
                <>
                  <Input
                    {...field}
                    value={field.value as string}
                    onChange={(e) => {
                      const val = e.target.value.trim().toUpperCase();
                      // P0.1: Block manual TMP-* input in "Đã có MST" mode
                      if (hasTaxCode && val.startsWith('TMP-')) {
                        toast.warning(
                          'Không được nhập mã TMP thủ công. Vui lòng chọn "Chưa có mã số thuế" để tạo mã TMP từ hệ thống.',
                        );
                        return; // Don't update the field
                      }
                      field.onChange(val);
                    }}
                    onBlur={(e) => {
                      field.onBlur();
                      handleCheckTaxCode(e.target.value);
                    }}
                    placeholder={
                      hasTaxCode
                        ? 'Ví dụ: 0102030405 (10 hoặc 13 chữ số)'
                        : generateTmpCodeMutation.isPending
                          ? 'Đang sinh mã tạm...'
                          : 'Mã tạm tự động sinh từ hệ thống'
                    }
                    size="middle"
                    disabled={!hasTaxCode || !!tmpCodeLocked}
                  />
                  {isTmpCode && (
                    <Alert
                      type="warning"
                      showIcon
                      style={{ marginTop: 6 }}
                      description="Công ty chưa có MST/giấy phép, cần cập nhật MST trong 7–14 ngày."
                    />
                  )}
                </>
              )}
            </FormField>
          </div>

          {/* P2.3 — Người quản lý: công ty mẹ/con = "Người đại diện", chi nhánh = "Người phụ trách" */}
          <FormSelect
            control={control}
            name="managerId"
            label={isBranch ? 'Người phụ trách' : 'Người đại diện'}
            placeholder="Gõ để tìm theo tên, mã, email, SĐT"
            options={managerOptions}
            showSearch
            allowClear
            filterOption={false}
            onSearch={handleManagerSearch}
            searchValue={managerKeyword}
            loading={managerSearchLoading}
            notFoundContent={
              managerSearchLoading ? 'Đang tìm...' : 'Không tìm thấy nhân sự'
            }
            size="middle"
          />
        </div>
        {/* Tên & Mã */}
        <div style={colStyle}>
          <FormInput
            control={control}
            name="name"
            label="Tên đơn vị"
            placeholder="Ví dụ: FPT Software Hà Nội"
            size="middle"
            maxLength={200}
            // Chỉ khóa tạm trong lúc đang tra cứu MST để tránh người dùng gõ đè
            // lên kết quả sắp trả về. KHÔNG khóa cứng theo mode (hasTaxCode) —
            // nếu tra cứu MST thất bại (không tìm thấy doanh nghiệp), người
            // dùng vẫn phải nhập tay được tên đơn vị, tránh dead-end.
            disabled={checkTaxCodeMutation.isPending}
          />
          <FormField
            control={control}
            name="code"
            label="Mã (IN HOA, 2–20 ký tự)"
            required
          >
            {(field) => (
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  value={field.value as string}
                  placeholder={
                    generateOrgUnitCodeMutation.isPending
                      ? 'Đang sinh mã...'
                      : codeGenFailed
                        ? 'Sinh mã thất bại'
                        : 'Tự động sinh từ hệ thống'
                  }
                  status={codeGenFailed ? 'error' : undefined}
                  maxLength={20}
                  size="middle"
                  disabled
                />
                {codeGenFailed && !editing && (
                  <Button
                    size="middle"
                    loading={generateOrgUnitCodeMutation.isPending}
                    onClick={() => runGenerateCode(unitType)}
                  >
                    Thử lại
                  </Button>
                )}
              </Space.Compact>
            )}
          </FormField>
        </div>

        {/* ── TMP Status Section (P0 FIX) ── */}
        {isTmpCode && (
          <div style={{ ...colStyle, marginBottom: 8 }}>
            <FormField
              control={control}
              name="taxCodeStatus"
              label="Trạng thái MST"
            >
              {(field) => (
                <div>
                  <Tag
                    color={
                      field.value === 'pending'
                        ? 'warning'
                        : field.value === 'active'
                          ? 'success'
                          : 'default'
                    }
                  >
                    {field.value === 'pending'
                      ? 'Chờ cập nhật'
                      : field.value === 'active'
                        ? 'Đã cập nhật'
                        : String(field.value || '—')}
                  </Tag>
                </div>
              )}
            </FormField>
            <FormField
              control={control}
              name="taxCodeDueDate"
              label="Hạn cập nhật"
            >
              {(field) => {
                const dueDate =
                  typeof field.value === 'string' ? field.value : null;
                return (
                  <Typography.Text type={dueDate ? 'warning' : 'secondary'}>
                    {dueDate ? dayjs(dueDate).format('DD/MM/YYYY') : '—'}
                  </Typography.Text>
                );
              }}
            </FormField>
          </div>
        )}

        {/* ── SECTION 2: Thông tin liên hệ ── */}
        <FormSection title="Thông tin liên hệ" />

        <div style={colStyle}>
          <FormInput
            control={control}
            name="email"
            label="Email"
            placeholder="Ví dụ: contact@gmail.com"
            size="middle"
            maxLength={254}
          />
          <FormInput
            control={control}
            name="phone"
            label="Số điện thoại"
            placeholder="Ví dụ: 0912345678"
            size="middle"
            numericOnly
            maxLength={10}
          />
        </div>

        <div
          style={{
            gridColumn: '1 / -1',
            marginBottom: showLegacyLookup ? 8 : 4,
          }}
        >
          <Segmented
            block
            value={showLegacyLookup ? 'legacy' : 'current'}
            onChange={(val) => {
              const checked = val === 'legacy';
              setShowLegacyLookup(checked);
              setValue('addressMode', checked ? 'legacy' : 'current');
              if (!checked) {
                setLegacyProvinceName(null);
                setLegacyDistricts([]);
                setLegacyDistrictName(null);
                setLegacyWards([]);
                setLegacyCandidates([]);
                setLegacyAppliedWard(null);
              }
            }}
            options={[
              { label: 'Biết tên mới (sau sáp nhập)', value: 'current' },
              { label: 'Chỉ biết tên cũ (trước sáp nhập)', value: 'legacy' },
            ]}
          />
          {showLegacyLookup && !isLegacyApplied && (
            <div
              style={{
                marginTop: 8,
                display: 'grid',
                gridTemplateColumns: screens.sm ? '1fr 1fr 1fr' : '1fr',
                columnGap: 16,
                rowGap: 8,
              }}
            >
              <Select
                placeholder="Tỉnh/Thành cũ"
                value={legacyProvinceName ?? undefined}
                onChange={handleSelectLegacyProvince}
                options={legacyProvinces.map((p) => ({
                  value: p.name,
                  label: p.name,
                }))}
                showSearch
                optionFilterProp="label"
                size="middle"
              />
              <Select
                placeholder="Quận/Huyện cũ"
                value={legacyDistrictName ?? undefined}
                onChange={handleSelectLegacyDistrict}
                options={legacyDistricts.map((d) => ({
                  value: d.name,
                  label: d.name,
                }))}
                showSearch
                optionFilterProp="label"
                disabled={!legacyProvinceName}
                size="middle"
              />
              <Select
                placeholder="Phường/Xã cũ"
                value={legacyAppliedWard ?? undefined}
                onChange={handleSelectLegacyWard}
                options={legacyWards.map((w) => ({ value: w, label: w }))}
                showSearch
                optionFilterProp="label"
                disabled={!legacyDistrictName}
                size="middle"
              />
            </div>
          )}
          {isLegacyApplied && (
            <div
              style={{
                marginTop: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <Typography.Text type="success" style={{ fontSize: 12 }}>
                → Đã áp dụng: {legacyAppliedWard}, {legacyDistrictName},{' '}
                {legacyProvinceName}
              </Typography.Text>
              <Button
                type="link"
                size="small"
                style={{ padding: 0, height: 'auto', fontSize: 12 }}
                onClick={handleResetLegacyLookup}
              >
                Chọn lại
              </Button>
            </div>
          )}
          {legacyCandidates.length > 0 && (
            <div
              style={{
                marginTop: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Phường/xã cũ này bị tách vào nhiều đơn vị mới, chọn đúng 1:
              </Typography.Text>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {legacyCandidates.map((c) => (
                  <Tag
                    key={`${c.new_province_name}-${c.new_ward_name}`}
                    color="blue"
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleApplyLegacyCandidate(c)}
                  >
                    {c.new_ward_name}, {c.new_province_name}
                  </Tag>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* P1.4: Tỉnh/Thành phố bắt buộc với Chi nhánh, optional với Công ty mẹ/con */}
        <FormSelect
          control={control}
          name="province"
          label="Tỉnh / Thành phố"
          placeholder="Chọn tỉnh/thành phố"
          options={provinces.map((p) => ({
            value: String(p.code),
            label: p.name,
          }))}
          showSearch
          allowClear
          optionFilterProp="label"
          loading={loadingProvinces}
          notFoundContent={
            loadingProvinces ? 'Đang tải danh sách...' : 'Không tìm thấy'
          }
          required={isBranch && !showLegacyLookup}
          size="middle"
          disabled={showLegacyLookup}
        />

        {/* Sau sáp nhập 07/2025, Việt Nam không còn cấp Quận/Huyện — chỉ còn
            Tỉnh/Thành phố + Phường/Xã. Giá trị map thẳng sang field `ward` của
            BE (xem toPayload trong org-units.mapper.ts). */}
        <FormSelect
          control={control}
          name="ward"
          label="Phường / Xã"
          placeholder="Chọn phường/xã"
          options={districts.map((d) => ({
            value: String(d.code),
            label: d.name,
          }))}
          showSearch
          allowClear
          optionFilterProp="label"
          loading={loadingDistricts}
          disabled={!provinceValue || showLegacyLookup}
          required={isBranch && !showLegacyLookup}
          notFoundContent={
            loadingDistricts
              ? 'Đang tải danh sách...'
              : provinceValue
                ? 'Không tìm thấy'
                : 'Vui lòng chọn tỉnh/thành phố trước'
          }
          size="middle"
        />

        <FormInput
          control={control}
          name="address"
          label="Địa chỉ cụ thể"
          placeholder="Ví dụ: Số 12 ngõ 123 phố X"
          required
          size="middle"
          maxLength={200}
        />

        {/* ── SECTION 3: Logo & Trạng thái ── */}
        <FormSection title="Logo & Trạng thái" />

        <div style={colStyle}>
          <div>
            <div style={logoLabelStyle}>Logo</div>
            <Upload
              listType="picture-card"
              showUploadList={false}
              accept=".jpg,.jpeg,.png,.svg,.webp"
              beforeUpload={beforeLogoUpload}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="logo" style={logoImgStyle} />
              ) : (
                <div>
                  <UploadOutlined />
                  <div style={logoUploadInnerStyle}>Tải ảnh lên</div>
                </div>
              )}
            </Upload>
            {pendingLogo && (
              <div style={logoPendingStyle}>
                Logo sẽ được tải lên sau khi bấm Lưu đơn vị.
              </div>
            )}
          </div>

          <FormField control={control} name="active" label="Trạng thái">
            {(field) => (
              <Select
                value={field.value ? 'active' : 'inactive'}
                onChange={(v) => field.onChange(v === 'active')}
                options={STATUS_OPTIONS}
                style={{ width: '100%' }}
              />
            )}
          </FormField>
        </div>
      </FormModal>
    </>
  );
}
