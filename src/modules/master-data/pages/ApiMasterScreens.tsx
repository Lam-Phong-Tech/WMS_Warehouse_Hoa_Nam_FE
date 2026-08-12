import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Modal } from "antd";
import {
  useCreateMvpAgency,
  useCreateMvpDefect,
  useCreateMvpSku,
  useMvpAgencies,
  useMvpDefects,
  useMvpSkus,
  useUpdateMvpAgency,
  useUpdateMvpDefect,
  useUpdateMvpSku,
} from "@/modules/master-data/hooks/use-mvp-master";
import type {
  AgencyPayload,
  AgencyRecord,
  DefectPayload,
  DefectRecord,
  MasterStatus,
  SkuPayload,
  SkuRecord,
  SkuType,
} from "@/modules/master-data/types/mvp-master.types";
import { getApiErrorMessage, getMutationErrorMessage } from "@/shared/api/api-error";
import { useAuthStore } from "@/shared/store/auth.store";

const STATUS_OPTIONS: Array<{ value: MasterStatus; label: string }> = [
  { value: "ACTIVE", label: "ACTIVE" },
  { value: "INACTIVE", label: "INACTIVE" },
];

interface ScreenProps {
  openCreateOnMount?: boolean;
}

function useCanManage(permission: string) {
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  return isSuperAdmin || permissionCodes.includes(permission);
}

function statusClass(status: MasterStatus) {
  return status === "ACTIVE" ? "pill ok" : "pill warn-pill";
}

function compactRef(value?: string | null) {
  if (!value) return "—";
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function ApiErrorAlert({
  error,
  fallback,
  onRetry,
}: {
  error: unknown;
  fallback: string;
  onRetry: () => void;
}) {
  if (!error) return null;
  return (
    <div className="alert" role="alert" style={{ marginBottom: 14 }}>
      {getApiErrorMessage(error, fallback)}{" "}
      <button className="btn small" type="button" onClick={onRetry}>
        Thử lại
      </button>
    </div>
  );
}

function ModalActions({
  isSaving,
  onCancel,
  submitLabel,
}: {
  isSaving: boolean;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="toolbar" style={{ marginTop: 16, marginBottom: 0 }}>
      <div className="spacer" />
      <button className="btn" type="button" onClick={onCancel} disabled={isSaving}>
        Hủy
      </button>
      <button className="btn primary" type="submit" disabled={isSaving}>
        {isSaving ? "Đang lưu..." : submitLabel}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

// ===== SKU Master =====

type SkuFormState = {
  code: string;
  name: string;
  type: SkuType;
  unit: string;
  brandCode: string;
  categoryCode: string;
  modelCode: string;
  powerSourceCode: string;
  serialTracked: boolean;
  status: MasterStatus;
};

const EMPTY_SKU_FORM: SkuFormState = {
  code: "",
  name: "",
  type: "PRODUCT",
  unit: "cái",
  brandCode: "",
  categoryCode: "",
  modelCode: "",
  powerSourceCode: "",
  serialTracked: true,
  status: "ACTIVE",
};

export function SkuMasterScreen({ openCreateOnMount = false }: ScreenProps) {
  const canManage = useCanManage("sku.manage");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<MasterStatus | "">("");
  const [type, setType] = useState<SkuType | "">("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SkuRecord | null>(null);
  const [form, setForm] = useState<SkuFormState>(EMPTY_SKU_FORM);
  const [formError, setFormError] = useState("");

  const query = useMvpSkus({ keyword: keyword.trim(), status, sku_type: type, per_page: 100 });
  const createMutation = useCreateMvpSku();
  const updateMutation = useUpdateMvpSku();
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const rows = query.data?.data ?? [];

  const openCreate = () => {
    if (!canManage) return;
    setEditing(null);
    setForm({ ...EMPTY_SKU_FORM });
    setFormError("");
    setModalOpen(true);
  };

  useEffect(() => {
    if (openCreateOnMount && canManage) openCreate();
  }, [canManage, openCreateOnMount]);

  const openEdit = (record: SkuRecord) => {
    if (!canManage) return;
    setEditing(record);
    setForm({
      code: record.sku_code ?? record.code ?? "",
      name: record.sku_name ?? record.name ?? "",
      type: record.sku_type,
      unit: record.unit ?? "",
      brandCode: "",
      categoryCode: "",
      modelCode: "",
      powerSourceCode: "",
      serialTracked: Boolean(record.is_serial_tracked),
      status: record.status,
    });
    setFormError("");
    setModalOpen(true);
  };

  const close = () => {
    if (isSaving) return;
    setModalOpen(false);
    setEditing(null);
    setFormError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    const code = form.code.trim();
    const name = form.name.trim();
    if (!code || !name) {
      setFormError("Mã SKU và tên SKU là bắt buộc.");
      return;
    }

    const payload: SkuPayload = {
      code,
      name,
      sku_type: form.type,
      unit: form.unit.trim() || null,
      is_serial_tracked: form.serialTracked,
      status: form.status,
      ...(form.brandCode.trim() ? { brand_code: form.brandCode.trim() } : {}),
      ...(form.categoryCode.trim() ? { category_code: form.categoryCode.trim() } : {}),
      ...(form.modelCode.trim() ? { model_code: form.modelCode.trim() } : {}),
      ...(form.powerSourceCode.trim()
        ? { power_source_code: form.powerSourceCode.trim() }
        : {}),
    };

    try {
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.sku_id ?? editing.id ?? "",
          version: editing.version,
          payload,
        });
      } else {
        await createMutation.mutateAsync(payload);
      }
      setModalOpen(false);
      setEditing(null);
    } catch (error) {
      setFormError(getMutationErrorMessage(error));
    }
  };

  return (
    <div className="hn-mvp-source-screen" data-mvp-screen="MST-01">
      <div className="toolbar">
        <input
          className="input search"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="Tìm mã / tên SKU"
          aria-label="Tìm SKU"
        />
        <select className="select" value={type} onChange={(event) => setType(event.target.value as SkuType | "")}>
          <option value="">Loại: Tất cả</option>
          <option value="PRODUCT">PRODUCT</option>
          <option value="COMPONENT">COMPONENT</option>
        </select>
        <select
          className="select"
          value={status}
          onChange={(event) => setStatus(event.target.value as MasterStatus | "")}
        >
          <option value="">Trạng thái: Tất cả</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="spacer" />
        {canManage ? (
          <button className="btn primary" type="button" onClick={openCreate}>
            + Thêm SKU
          </button>
        ) : null}
      </div>

      <ApiErrorAlert
        error={query.error}
        fallback="Không tải được danh sách SKU."
        onRetry={() => void query.refetch()}
      />

      <div className="table-wrap" aria-busy={query.isLoading}>
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Loại</th>
              <th>ĐVT</th>
              <th>Brand</th>
              <th>Category</th>
              <th>Model</th>
              <th>Nguồn điện</th>
              <th>Serial</th>
              <th>Trạng thái</th>
              <th aria-label="Hành động" />
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td colSpan={10} className="muted">
                  Đang tải dữ liệu từ API...
                </td>
              </tr>
            ) : rows.length > 0 ? (
              rows.map((record) => (
                <tr key={record.sku_id ?? record.id}>
                  <td>
                    {record.sku_code ?? record.code}
                    <br />
                    <span className="muted">{record.sku_name ?? record.name}</span>
                  </td>
                  <td>{record.sku_type}</td>
                  <td>{record.unit || "—"}</td>
                  <td title={record.brand_id ?? undefined}>{compactRef(record.brand_id)}</td>
                  <td title={record.category_id ?? undefined}>{compactRef(record.category_id)}</td>
                  <td title={record.model_id ?? undefined}>{compactRef(record.model_id)}</td>
                  <td>{record.power_or_voltage || compactRef(record.power_source_id)}</td>
                  <td>{record.is_serial_tracked ? "Có" : "Không"}</td>
                  <td>
                    <span className={statusClass(record.status)}>{record.status}</span>
                  </td>
                  <td>
                    {canManage ? (
                      <button className="btn small" type="button" onClick={() => openEdit(record)}>
                        Sửa
                      </button>
                    ) : (
                      <span className="muted">Chỉ xem</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="muted">
                  Không có SKU phù hợp bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        title={editing ? "Sửa SKU" : "Thêm SKU"}
        open={modalOpen}
        onCancel={close}
        footer={null}
        width={980}
        centered
        getContainer={false}
        maskClosable={false}
        closable={!isSaving}
      >
        <form onSubmit={submit}>
          {formError ? <div className="alert" role="alert">{formError}</div> : null}
          <div className="grid-2" style={{ marginTop: formError ? 14 : 0 }}>
            <section className="card">
              <div className="section-title">Thông tin SKU</div>
              <Field label="Mã SKU *">
                <input className="input" style={{ width: "100%" }} value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} disabled={isSaving} />
              </Field>
              <Field label="Tên SKU *">
                <input className="input" style={{ width: "100%" }} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} disabled={isSaving} />
              </Field>
              <Field label="Loại SKU">
                <select className="select" style={{ width: "100%" }} value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as SkuType }))} disabled={isSaving}>
                  <option value="PRODUCT">PRODUCT</option>
                  <option value="COMPONENT">COMPONENT</option>
                </select>
              </Field>
              <Field label="Đơn vị tính">
                <input className="input" style={{ width: "100%" }} value={form.unit} onChange={(event) => setForm((current) => ({ ...current, unit: event.target.value }))} disabled={isSaving} />
              </Field>
              <Field label="Trạng thái">
                <select className="select" style={{ width: "100%" }} value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as MasterStatus }))} disabled={isSaving}>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </Field>
            </section>
            <section className="card">
              <div className="section-title">Master tham chiếu</div>
              <div className="muted" style={{ marginBottom: 10 }}>
                Nhập code master ACTIVE. Khi sửa, để trống để giữ nguyên liên kết hiện tại.
              </div>
              <Field label="Brand code">
                <input className="input" style={{ width: "100%" }} value={form.brandCode} onChange={(event) => setForm((current) => ({ ...current, brandCode: event.target.value }))} disabled={isSaving} />
              </Field>
              <Field label="Category code">
                <input className="input" style={{ width: "100%" }} value={form.categoryCode} onChange={(event) => setForm((current) => ({ ...current, categoryCode: event.target.value }))} disabled={isSaving} />
              </Field>
              <Field label="Model code">
                <input className="input" style={{ width: "100%" }} value={form.modelCode} onChange={(event) => setForm((current) => ({ ...current, modelCode: event.target.value }))} disabled={isSaving} />
              </Field>
              <Field label="Power source code">
                <input className="input" style={{ width: "100%" }} value={form.powerSourceCode} onChange={(event) => setForm((current) => ({ ...current, powerSourceCode: event.target.value }))} disabled={isSaving} />
              </Field>
              <Field label="Theo dõi serial">
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="checkbox" checked={form.serialTracked} onChange={(event) => setForm((current) => ({ ...current, serialTracked: event.target.checked }))} disabled={isSaving} />
                  Có quản lý serial/item identity
                </label>
              </Field>
              {editing ? (
                <Field label="Version hiện tại">
                  <div className="value">{editing.version}</div>
                </Field>
              ) : null}
            </section>
          </div>
          <ModalActions isSaving={isSaving} onCancel={close} submitLabel="Lưu SKU" />
        </form>
      </Modal>
    </div>
  );
}

// ===== Agency =====

const EMPTY_AGENCY_FORM: AgencyPayload = {
  agency_code: "",
  agency_name: "",
  phone: "",
  address: "",
  status: "ACTIVE",
};

export function AgencyMasterScreen({ openCreateOnMount = false }: ScreenProps) {
  const canManage = useCanManage("agency.manage");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<MasterStatus | "">("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AgencyRecord | null>(null);
  const [form, setForm] = useState<AgencyPayload>(EMPTY_AGENCY_FORM);
  const [formError, setFormError] = useState("");
  const query = useMvpAgencies({ keyword: keyword.trim(), status, per_page: 100 });
  const createMutation = useCreateMvpAgency();
  const updateMutation = useUpdateMvpAgency();
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const rows = query.data?.data ?? [];

  const openCreate = () => {
    if (!canManage) return;
    setEditing(null);
    setForm({ ...EMPTY_AGENCY_FORM });
    setFormError("");
    setModalOpen(true);
  };

  useEffect(() => {
    if (openCreateOnMount && canManage) openCreate();
  }, [canManage, openCreateOnMount]);

  const openEdit = (record: AgencyRecord) => {
    if (!canManage) return;
    setEditing(record);
    setForm({
      agency_code: record.agency_code,
      agency_name: record.agency_name,
      phone: record.phone ?? "",
      address: record.address ?? "",
      status: record.status,
    });
    setFormError("");
    setModalOpen(true);
  };

  const close = () => {
    if (isSaving) return;
    setModalOpen(false);
    setEditing(null);
    setFormError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    const payload: AgencyPayload = {
      agency_code: form.agency_code.trim(),
      agency_name: form.agency_name.trim(),
      phone: form.phone?.trim() || null,
      address: form.address?.trim() || null,
      status: form.status,
    };
    if (!payload.agency_code || !payload.agency_name) {
      setFormError("Mã đại lý và tên đại lý là bắt buộc.");
      return;
    }
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.agency_id, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      setModalOpen(false);
      setEditing(null);
    } catch (error) {
      setFormError(getMutationErrorMessage(error));
    }
  };

  return (
    <div className="hn-mvp-source-screen" data-mvp-screen="AGY-01">
      <div className="toolbar">
        <input className="input search" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm mã / tên đại lý" />
        <select className="select" value={status} onChange={(event) => setStatus(event.target.value as MasterStatus | "")}>
          <option value="">Trạng thái: Tất cả</option>
          {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <div className="spacer" />
        {canManage ? <button className="btn primary" type="button" onClick={openCreate}>+ Thêm đại lý</button> : null}
      </div>
      <ApiErrorAlert error={query.error} fallback="Không tải được danh sách đại lý." onRetry={() => void query.refetch()} />
      <div className="table-wrap" aria-busy={query.isLoading}>
        <table>
          <thead><tr><th>Mã</th><th>Tên đại lý</th><th>Điện thoại</th><th>Địa chỉ</th><th>Trạng thái</th><th aria-label="Hành động" /></tr></thead>
          <tbody>
            {query.isLoading ? <tr><td colSpan={6} className="muted">Đang tải dữ liệu từ API...</td></tr> : rows.length > 0 ? rows.map((record) => (
              <tr key={record.agency_id}>
                <td>{record.agency_code}</td><td>{record.agency_name}</td><td>{record.phone || "—"}</td><td>{record.address || "—"}</td>
                <td><span className={statusClass(record.status)}>{record.status}</span></td>
                <td>{canManage ? <button className="btn small" type="button" onClick={() => openEdit(record)}>Sửa</button> : <span className="muted">Chỉ xem</span>}</td>
              </tr>
            )) : <tr><td colSpan={6} className="muted">Không có đại lý phù hợp bộ lọc.</td></tr>}
          </tbody>
        </table>
      </div>
      <Modal title={editing ? "Sửa đại lý" : "Thêm đại lý"} open={modalOpen} onCancel={close} footer={null} width={760} centered getContainer={false} maskClosable={false} closable={!isSaving}>
        <form onSubmit={submit}>
          {formError ? <div className="alert" role="alert" style={{ marginBottom: 14 }}>{formError}</div> : null}
          <div className="grid-2">
            <Field label="Mã đại lý *"><input className="input" style={{ width: "100%" }} value={form.agency_code} onChange={(event) => setForm((current) => ({ ...current, agency_code: event.target.value }))} disabled={isSaving} /></Field>
            <Field label="Tên đại lý *"><input className="input" style={{ width: "100%" }} value={form.agency_name} onChange={(event) => setForm((current) => ({ ...current, agency_name: event.target.value }))} disabled={isSaving} /></Field>
            <Field label="Điện thoại"><input className="input" style={{ width: "100%" }} value={form.phone ?? ""} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} disabled={isSaving} /></Field>
            <Field label="Trạng thái"><select className="select" style={{ width: "100%" }} value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as MasterStatus }))} disabled={isSaving}>{STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
          </div>
          <Field label="Địa chỉ"><textarea className="input" style={{ width: "100%", minHeight: 88 }} value={form.address ?? ""} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} disabled={isSaving} /></Field>
          <ModalActions isSaving={isSaving} onCancel={close} submitLabel="Lưu đại lý" />
        </form>
      </Modal>
    </div>
  );
}

// ===== Defect Catalog =====

const EMPTY_DEFECT_FORM: DefectPayload = {
  defect_code: "",
  defect_name: "",
  description: "",
  status: "ACTIVE",
};

export function DefectMasterScreen({ openCreateOnMount = false }: ScreenProps) {
  const canManage = useCanManage("defect.manage");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<MasterStatus | "">("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DefectRecord | null>(null);
  const [form, setForm] = useState<DefectPayload>(EMPTY_DEFECT_FORM);
  const [formError, setFormError] = useState("");
  const query = useMvpDefects({ keyword: keyword.trim(), status, per_page: 100 });
  const createMutation = useCreateMvpDefect();
  const updateMutation = useUpdateMvpDefect();
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const rows = query.data?.data ?? [];

  const openCreate = () => {
    if (!canManage) return;
    setEditing(null);
    setForm({ ...EMPTY_DEFECT_FORM });
    setFormError("");
    setModalOpen(true);
  };

  useEffect(() => {
    if (openCreateOnMount && canManage) openCreate();
  }, [canManage, openCreateOnMount]);

  const openEdit = (record: DefectRecord) => {
    if (!canManage) return;
    setEditing(record);
    setForm({ defect_code: record.defect_code, defect_name: record.defect_name, description: record.description ?? "", status: record.status });
    setFormError("");
    setModalOpen(true);
  };

  const close = () => {
    if (isSaving) return;
    setModalOpen(false);
    setEditing(null);
    setFormError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    const payload: DefectPayload = {
      defect_code: form.defect_code.trim(),
      defect_name: form.defect_name.trim(),
      description: form.description?.trim() || null,
      status: form.status,
    };
    if (!payload.defect_code || !payload.defect_name) {
      setFormError("Mã lỗi và tên lỗi là bắt buộc.");
      return;
    }
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.defect_id, payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      setModalOpen(false);
      setEditing(null);
    } catch (error) {
      setFormError(getMutationErrorMessage(error));
    }
  };

  return (
    <div className="hn-mvp-source-screen" data-mvp-screen="DEF-01">
      <div className="toolbar">
        <input className="input search" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm mã / tên lỗi" />
        <select className="select" value={status} onChange={(event) => setStatus(event.target.value as MasterStatus | "")}>
          <option value="">Trạng thái: Tất cả</option>
          {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <div className="spacer" />
        {canManage ? <button className="btn primary" type="button" onClick={openCreate}>+ Thêm lỗi</button> : null}
      </div>
      <ApiErrorAlert error={query.error} fallback="Không tải được danh mục lỗi." onRetry={() => void query.refetch()} />
      <div className="table-wrap" aria-busy={query.isLoading}>
        <table>
          <thead><tr><th>Mã lỗi</th><th>Tên lỗi / bệnh</th><th>Mô tả</th><th>Trạng thái</th><th aria-label="Hành động" /></tr></thead>
          <tbody>
            {query.isLoading ? <tr><td colSpan={5} className="muted">Đang tải dữ liệu từ API...</td></tr> : rows.length > 0 ? rows.map((record) => (
              <tr key={record.defect_id}>
                <td>{record.defect_code}</td><td>{record.defect_name}</td><td>{record.description || "—"}</td>
                <td><span className={statusClass(record.status)}>{record.status}</span></td>
                <td>{canManage ? <button className="btn small" type="button" onClick={() => openEdit(record)}>Sửa</button> : <span className="muted">Chỉ xem</span>}</td>
              </tr>
            )) : <tr><td colSpan={5} className="muted">Không có danh mục lỗi phù hợp bộ lọc.</td></tr>}
          </tbody>
        </table>
      </div>
      <Modal title={editing ? "Sửa lỗi / bệnh" : "Thêm lỗi / bệnh"} open={modalOpen} onCancel={close} footer={null} width={760} centered getContainer={false} maskClosable={false} closable={!isSaving}>
        <form onSubmit={submit}>
          {formError ? <div className="alert" role="alert" style={{ marginBottom: 14 }}>{formError}</div> : null}
          <div className="grid-2">
            <Field label="Mã lỗi *"><input className="input" style={{ width: "100%" }} value={form.defect_code} onChange={(event) => setForm((current) => ({ ...current, defect_code: event.target.value }))} disabled={isSaving} /></Field>
            <Field label="Tên lỗi / bệnh *"><input className="input" style={{ width: "100%" }} value={form.defect_name} onChange={(event) => setForm((current) => ({ ...current, defect_name: event.target.value }))} disabled={isSaving} /></Field>
          </div>
          <Field label="Mô tả"><textarea className="input" style={{ width: "100%", minHeight: 110 }} value={form.description ?? ""} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} disabled={isSaving} /></Field>
          <Field label="Trạng thái"><select className="select" style={{ width: "100%" }} value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as MasterStatus }))} disabled={isSaving}>{STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
          <ModalActions isSaving={isSaving} onCancel={close} submitLabel="Lưu danh mục lỗi" />
        </form>
      </Modal>
    </div>
  );
}
