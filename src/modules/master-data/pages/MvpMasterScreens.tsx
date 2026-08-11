import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Modal } from "antd";

type MasterStatus = "ACTIVE" | "INACTIVE";
type SkuType = "PRODUCT" | "COMPONENT";

type SkuRecord = {
  id: string;
  code: string;
  name: string;
  type: SkuType;
  unit: string;
  brand: string;
  category: string;
  model: string;
  powerSource: string;
  serialTracked: boolean;
  status: MasterStatus;
};

type AgencyRecord = {
  id: string;
  code: string;
  name: string;
  status: MasterStatus;
  group: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
};

type DefectRecord = {
  id: string;
  code: string;
  name: string;
  description: string;
  status: MasterStatus;
  applicableGroup: string;
  note: string;
};

type SkuFormState = Omit<SkuRecord, "id">;
type AgencyFormState = Omit<AgencyRecord, "id">;
type DefectFormState = Omit<DefectRecord, "id">;

const STATUS_OPTIONS: Array<{ value: MasterStatus; label: string }> = [
  { value: "ACTIVE", label: "ACTIVE" },
  { value: "INACTIVE", label: "INACTIVE" },
];

const INITIAL_SKUS: SkuRecord[] = [
  {
    id: "sku-drill",
    code: "DCH-DRILL-DJZ10A-220V-V1",
    name: "Máy khoan Dongcheng DJZ10A 220V",
    type: "PRODUCT",
    unit: "cái",
    brand: "Dongcheng",
    category: "DRILL",
    model: "DJZ10A",
    powerSource: "Điện trực tiếp 220V",
    serialTracked: true,
    status: "ACTIVE",
  },
  {
    id: "sku-battery",
    code: "LK-DCH-PIN-20V-V1",
    name: "Pin 20V Dongcheng",
    type: "COMPONENT",
    unit: "cái",
    brand: "Dongcheng",
    category: "BATTERY",
    model: "20V",
    powerSource: "Pin",
    serialTracked: true,
    status: "ACTIVE",
  },
  {
    id: "sku-screw",
    code: "LK-DCH-OC-VIT-M2-V1",
    name: "Ốc vít M2",
    type: "COMPONENT",
    unit: "cái",
    brand: "Dongcheng",
    category: "FASTENER",
    model: "M2",
    powerSource: "Không áp dụng",
    serialTracked: false,
    status: "ACTIVE",
  },
];

const INITIAL_AGENCIES: AgencyRecord[] = [
  {
    id: "agency-hn-001",
    code: "AG-HN-001",
    name: "Đại lý Minh Anh",
    status: "ACTIVE",
    group: "Đại lý cấp 1",
    contactName: "Nguyễn Văn A",
    phone: "0901 234 567",
    email: "daily.minhanh@example.com",
    address: "Số 12 Hoàng Quốc Việt, Hà Nội",
  },
  {
    id: "agency-hp-002",
    code: "AG-HP-002",
    name: "Đại lý Hải Phòng",
    status: "ACTIVE",
    group: "Đại lý cấp 1",
    contactName: "Trần Văn B",
    phone: "0912 888 999",
    email: "daily.haiphong@example.com",
    address: "Hải Phòng",
  },
];

const INITIAL_DEFECTS: DefectRecord[] = [
  {
    id: "defect-motor",
    code: "DF-MOTOR-01",
    name: "Không chạy motor",
    description: "Motor không quay khi cấp nguồn",
    status: "ACTIVE",
    applicableGroup: "Máy khoan / máy mài",
    note: "Dùng cho báo cáo bảo hành",
  },
  {
    id: "defect-battery",
    code: "DF-BATT-02",
    name: "Pin tụt nhanh",
    description: "Dung lượng giảm bất thường",
    status: "ACTIVE",
    applicableGroup: "Thiết bị dùng pin",
    note: "Dùng cho báo cáo bảo hành",
  },
  {
    id: "defect-old",
    code: "DF-OLD-01",
    name: "Lỗi cũ không dùng",
    description: "Giữ lịch sử",
    status: "INACTIVE",
    applicableGroup: "Lịch sử",
    note: "Không chọn cho case mới",
  },
];

const EMPTY_SKU: SkuFormState = {
  code: "",
  name: "",
  type: "PRODUCT",
  unit: "cái",
  brand: "Dongcheng",
  category: "",
  model: "",
  powerSource: "",
  serialTracked: true,
  status: "ACTIVE",
};

const EMPTY_AGENCY: AgencyFormState = {
  code: "",
  name: "",
  status: "ACTIVE",
  group: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
};

const EMPTY_DEFECT: DefectFormState = {
  code: "",
  name: "",
  description: "",
  status: "ACTIVE",
  applicableGroup: "",
  note: "",
};

function createDemoId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function statusPill(status: MasterStatus) {
  return (
    <span className={status === "ACTIVE" ? "pill ok" : "pill danger-pill"}>
      {status}
    </span>
  );
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("vi-VN");
}

function ModalError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="alert" role="alert" style={{ marginBottom: 14 }}>
      {message}
    </div>
  );
}

export interface InPageModalScreenProps {
  openCreateOnMount?: boolean;
}

export function SkuMasterScreen({
  openCreateOnMount = false,
}: InPageModalScreenProps) {
  const [records, setRecords] = useState<SkuRecord[]>(INITIAL_SKUS);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<SkuFormState>(EMPTY_SKU);
  const [formError, setFormError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!openCreateOnMount) return;
    setEditingId(null);
    setFormState({ ...EMPTY_SKU });
    setFormError("");
    setIsModalOpen(true);
  }, [openCreateOnMount]);

  const brands = useMemo(
    () => Array.from(new Set(records.map((record) => record.brand))).sort(),
    [records],
  );

  const filteredRecords = useMemo(() => {
    const keyword = normalize(search);
    return records.filter((record) => {
      const matchesSearch =
        !keyword ||
        normalize(record.code).includes(keyword) ||
        normalize(record.name).includes(keyword) ||
        normalize(record.model).includes(keyword);
      const matchesType = !typeFilter || record.type === typeFilter;
      const matchesBrand = !brandFilter || record.brand === brandFilter;
      return matchesSearch && matchesType && matchesBrand;
    });
  }, [brandFilter, records, search, typeFilter]);

  const openCreate = () => {
    setEditingId(null);
    setFormState({ ...EMPTY_SKU });
    setFormError("");
    setIsModalOpen(true);
  };

  const openEdit = (record: SkuRecord) => {
    setEditingId(record.id);
    setFormState({ ...record });
    setFormError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormError("");
  };

  const updateField = <K extends keyof SkuFormState>(
    key: K,
    value: SkuFormState[K],
  ) => {
    setFormState((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = formState.code.trim();
    const name = formState.name.trim();

    if (
      !code ||
      !name ||
      !formState.unit.trim() ||
      !formState.brand.trim() ||
      !formState.category.trim() ||
      !formState.model.trim() ||
      !formState.powerSource.trim()
    ) {
      setFormError("Vui lòng nhập đầy đủ các trường bắt buộc.");
      return;
    }

    const duplicateCode = records.some(
      (record) => record.id !== editingId && normalize(record.code) === normalize(code),
    );
    if (duplicateCode) {
      setFormError("SKU code đã tồn tại. Vui lòng kiểm tra lại.");
      return;
    }

    const nextRecord: SkuFormState = {
      ...formState,
      code,
      name,
      unit: formState.unit.trim(),
      brand: formState.brand.trim(),
      category: formState.category.trim(),
      model: formState.model.trim(),
      powerSource: formState.powerSource.trim(),
    };

    if (editingId) {
      setRecords((current) =>
        current.map((record) =>
          record.id === editingId ? { ...record, ...nextRecord } : record,
        ),
      );
    } else {
      setRecords((current) => [
        { id: createDemoId("sku"), ...nextRecord },
        ...current,
      ]);
    }
    closeModal();
  };

  return (
    <div className="hn-mvp-source-screen" data-mvp-screen="MST-01">
      <div className="toolbar">
        <input
          className="input search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm SKU / tên / model"
          aria-label="Tìm SKU"
        />
        <select
          className="select"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          aria-label="Lọc loại SKU"
        >
          <option value="">Loại: Tất cả</option>
          <option value="PRODUCT">PRODUCT</option>
          <option value="COMPONENT">COMPONENT</option>
        </select>
        <select
          className="select"
          value={brandFilter}
          onChange={(event) => setBrandFilter(event.target.value)}
          aria-label="Lọc hãng"
        >
          <option value="">Hãng: Tất cả</option>
          {brands.map((brand) => (
            <option key={brand} value={brand}>
              {brand}
            </option>
          ))}
        </select>
        <div className="spacer" />
        <button className="btn primary" type="button" onClick={openCreate}>
          + Tạo SKU
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Tên sản phẩm / linh kiện</th>
              <th>Loại</th>
              <th>Hãng</th>
              <th>Theo dõi serial</th>
              <th>Trạng thái</th>
              <th aria-label="Hành động" />
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((record) => (
              <tr key={record.id}>
                <td>{record.code}</td>
                <td>{record.name}</td>
                <td>{record.type}</td>
                <td>{record.brand}</td>
                <td>{record.serialTracked ? "Có" : "Không"}</td>
                <td>{statusPill(record.status)}</td>
                <td>
                  <button
                    className="btn small"
                    type="button"
                    onClick={() => openEdit(record)}
                  >
                    Sửa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="footer-note">
        Sau cột <b>Trạng thái</b> chỉ giữ action <b>Sửa</b>. SKU code được khóa khi
        sửa để tránh đổi định danh đã được sử dụng.
      </div>

      <Modal
        title={editingId ? "Sửa SKU" : "Tạo SKU"}
        open={isModalOpen}
        onCancel={closeModal}
        footer={null}
        width={920}
        centered
        getContainer={false}
        maskClosable={false}
      >
        <form onSubmit={handleSubmit}>
          <ModalError message={formError} />
          <div className="grid-2">
            <section className="card">
              <div className="section-title">Thông tin định danh</div>
              <div className="field">
                <label htmlFor="sku-code">SKU code *</label>
                <input
                  id="sku-code"
                  className="input"
                  value={formState.code}
                  disabled={Boolean(editingId)}
                  onChange={(event) => updateField("code", event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="sku-name">Tên SKU *</label>
                <input
                  id="sku-name"
                  className="input"
                  value={formState.name}
                  onChange={(event) => updateField("name", event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="sku-type">Loại SKU *</label>
                <select
                  id="sku-type"
                  className="select"
                  value={formState.type}
                  onChange={(event) =>
                    updateField("type", event.target.value as SkuType)
                  }
                >
                  <option value="PRODUCT">PRODUCT</option>
                  <option value="COMPONENT">COMPONENT</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="sku-unit">Đơn vị tính *</label>
                <input
                  id="sku-unit"
                  className="input"
                  value={formState.unit}
                  onChange={(event) => updateField("unit", event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="sku-status">Trạng thái *</label>
                <select
                  id="sku-status"
                  className="select"
                  value={formState.status}
                  onChange={(event) =>
                    updateField("status", event.target.value as MasterStatus)
                  }
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section className="card">
              <div className="section-title">Thông tin sản phẩm</div>
              <div className="field">
                <label htmlFor="sku-brand">Hãng *</label>
                <input
                  id="sku-brand"
                  className="input"
                  value={formState.brand}
                  onChange={(event) => updateField("brand", event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="sku-category">Category *</label>
                <input
                  id="sku-category"
                  className="input"
                  value={formState.category}
                  onChange={(event) => updateField("category", event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="sku-model">Model *</label>
                <input
                  id="sku-model"
                  className="input"
                  value={formState.model}
                  onChange={(event) => updateField("model", event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="sku-power-source">Nguồn điện *</label>
                <input
                  id="sku-power-source"
                  className="input"
                  value={formState.powerSource}
                  onChange={(event) =>
                    updateField("powerSource", event.target.value)
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="sku-serial">Theo dõi serial *</label>
                <select
                  id="sku-serial"
                  className="select"
                  value={formState.serialTracked ? "yes" : "no"}
                  onChange={(event) =>
                    updateField("serialTracked", event.target.value === "yes")
                  }
                >
                  <option value="yes">Có</option>
                  <option value="no">Không</option>
                </select>
              </div>
            </section>
          </div>
          <div className="toolbar" style={{ marginTop: 16, marginBottom: 0 }}>
            <div className="spacer" />
            <button className="btn" type="button" onClick={closeModal}>
              Hủy
            </button>
            <button className="btn primary" type="submit">
              Lưu SKU
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function AgencyMasterScreen({
  openCreateOnMount = false,
}: InPageModalScreenProps) {
  const [records, setRecords] = useState<AgencyRecord[]>(INITIAL_AGENCIES);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<AgencyFormState>(EMPTY_AGENCY);
  const [formError, setFormError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!openCreateOnMount) return;
    setEditingId(null);
    setFormState({ ...EMPTY_AGENCY });
    setFormError("");
    setIsModalOpen(true);
  }, [openCreateOnMount]);

  const filteredRecords = useMemo(() => {
    const keyword = normalize(search);
    return records.filter(
      (record) =>
        !keyword ||
        normalize(record.code).includes(keyword) ||
        normalize(record.name).includes(keyword),
    );
  }, [records, search]);

  const openCreate = () => {
    setEditingId(null);
    setFormState({ ...EMPTY_AGENCY });
    setFormError("");
    setIsModalOpen(true);
  };

  const openEdit = (record: AgencyRecord) => {
    setEditingId(record.id);
    setFormState({ ...record });
    setFormError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormError("");
  };

  const updateField = <K extends keyof AgencyFormState>(
    key: K,
    value: AgencyFormState[K],
  ) => {
    setFormState((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = formState.code.trim();
    const name = formState.name.trim();

    if (!code || !name) {
      setFormError("Mã đại lý và tên đại lý là bắt buộc.");
      return;
    }

    const duplicateCode = records.some(
      (record) => record.id !== editingId && normalize(record.code) === normalize(code),
    );
    if (duplicateCode) {
      setFormError("Mã đại lý đã tồn tại. Vui lòng kiểm tra lại.");
      return;
    }

    const nextRecord: AgencyFormState = {
      ...formState,
      code,
      name,
      group: formState.group.trim(),
      contactName: formState.contactName.trim(),
      phone: formState.phone.trim(),
      email: formState.email.trim(),
      address: formState.address.trim(),
    };

    if (editingId) {
      setRecords((current) =>
        current.map((record) =>
          record.id === editingId ? { ...record, ...nextRecord } : record,
        ),
      );
    } else {
      setRecords((current) => [
        { id: createDemoId("agency"), ...nextRecord },
        ...current,
      ]);
    }
    closeModal();
  };

  return (
    <div className="hn-mvp-source-screen" data-mvp-screen="AGY-01">
      <div className="toolbar">
        <input
          className="input search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm mã / tên đại lý"
          aria-label="Tìm đại lý"
        />
        <div className="spacer" />
        <button className="btn primary" type="button" onClick={openCreate}>
          + Thêm đại lý
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mã</th>
              <th>Tên đại lý / nơi nhận</th>
              <th>Liên hệ</th>
              <th>Địa chỉ</th>
              <th>Trạng thái</th>
              <th aria-label="Hành động" />
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((record) => (
              <tr key={record.id}>
                <td>{record.code}</td>
                <td>{record.name}</td>
                <td>{record.phone || "-"}</td>
                <td>{record.address || "-"}</td>
                <td>{statusPill(record.status)}</td>
                <td>
                  <button
                    className="btn small"
                    type="button"
                    onClick={() => openEdit(record)}
                  >
                    Sửa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="footer-note">
        Đại lý chỉ là nơi nhận hàng, không tạo tồn kho hoặc movement riêng tại đại
        lý.
      </div>

      <Modal
        title={editingId ? "Sửa đại lý / nơi nhận" : "Thêm đại lý / nơi nhận"}
        open={isModalOpen}
        onCancel={closeModal}
        footer={null}
        width={920}
        centered
        getContainer={false}
        maskClosable={false}
      >
        <form onSubmit={handleSubmit}>
          <ModalError message={formError} />
          <div className="grid-2">
            <section className="card">
              <div className="section-title">Thông tin chung</div>
              <div className="field">
                <label htmlFor="agency-code">Mã đại lý *</label>
                <input
                  id="agency-code"
                  className="input"
                  value={formState.code}
                  onChange={(event) => updateField("code", event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="agency-name">Tên đại lý *</label>
                <input
                  id="agency-name"
                  className="input"
                  value={formState.name}
                  onChange={(event) => updateField("name", event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="agency-status">Trạng thái *</label>
                <select
                  id="agency-status"
                  className="select"
                  value={formState.status}
                  onChange={(event) =>
                    updateField("status", event.target.value as MasterStatus)
                  }
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="agency-group">Nhóm đại lý</label>
                <input
                  id="agency-group"
                  className="input"
                  value={formState.group}
                  onChange={(event) => updateField("group", event.target.value)}
                />
              </div>
            </section>

            <section className="card">
              <div className="section-title">Liên hệ</div>
              <div className="field">
                <label htmlFor="agency-contact">Người liên hệ</label>
                <input
                  id="agency-contact"
                  className="input"
                  value={formState.contactName}
                  onChange={(event) =>
                    updateField("contactName", event.target.value)
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="agency-phone">Số điện thoại</label>
                <input
                  id="agency-phone"
                  className="input"
                  value={formState.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="agency-email">Email</label>
                <input
                  id="agency-email"
                  className="input"
                  type="email"
                  value={formState.email}
                  onChange={(event) => updateField("email", event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="agency-address">Địa chỉ</label>
                <input
                  id="agency-address"
                  className="input"
                  value={formState.address}
                  onChange={(event) => updateField("address", event.target.value)}
                />
              </div>
            </section>
          </div>
          <div className="toolbar" style={{ marginTop: 16, marginBottom: 0 }}>
            <div className="spacer" />
            <button className="btn" type="button" onClick={closeModal}>
              Hủy
            </button>
            <button className="btn primary" type="submit">
              Lưu đại lý
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function DefectMasterScreen({
  openCreateOnMount = false,
}: InPageModalScreenProps) {
  const [records, setRecords] = useState<DefectRecord[]>(INITIAL_DEFECTS);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<DefectFormState>(EMPTY_DEFECT);
  const [formError, setFormError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!openCreateOnMount) return;
    setEditingId(null);
    setFormState({ ...EMPTY_DEFECT });
    setFormError("");
    setIsModalOpen(true);
  }, [openCreateOnMount]);

  const filteredRecords = useMemo(() => {
    const keyword = normalize(search);
    return records.filter(
      (record) =>
        !keyword ||
        normalize(record.code).includes(keyword) ||
        normalize(record.name).includes(keyword),
    );
  }, [records, search]);

  const openCreate = () => {
    setEditingId(null);
    setFormState({ ...EMPTY_DEFECT });
    setFormError("");
    setIsModalOpen(true);
  };

  const openEdit = (record: DefectRecord) => {
    setEditingId(record.id);
    setFormState({ ...record });
    setFormError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormError("");
  };

  const updateField = <K extends keyof DefectFormState>(
    key: K,
    value: DefectFormState[K],
  ) => {
    setFormState((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = formState.code.trim();
    const name = formState.name.trim();

    if (!code || !name) {
      setFormError("Mã lỗi và tên bệnh / lỗi là bắt buộc.");
      return;
    }

    const duplicateCode = records.some(
      (record) => record.id !== editingId && normalize(record.code) === normalize(code),
    );
    if (duplicateCode) {
      setFormError("Mã lỗi đã tồn tại. Vui lòng kiểm tra lại.");
      return;
    }

    const nextRecord: DefectFormState = {
      ...formState,
      code,
      name,
      description: formState.description.trim(),
      applicableGroup: formState.applicableGroup.trim(),
      note: formState.note.trim(),
    };

    if (editingId) {
      setRecords((current) =>
        current.map((record) =>
          record.id === editingId ? { ...record, ...nextRecord } : record,
        ),
      );
    } else {
      setRecords((current) => [
        { id: createDemoId("defect"), ...nextRecord },
        ...current,
      ]);
    }
    closeModal();
  };

  return (
    <div className="hn-mvp-source-screen" data-mvp-screen="DEF-01">
      <div className="toolbar">
        <input
          className="input search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm mã / tên bệnh lỗi"
          aria-label="Tìm bệnh lỗi"
        />
        <div className="spacer" />
        <button className="btn primary" type="button" onClick={openCreate}>
          + Thêm bệnh / lỗi
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mã lỗi</th>
              <th>Tên bệnh / lỗi</th>
              <th>Mô tả</th>
              <th>Trạng thái</th>
              <th aria-label="Hành động" />
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((record) => (
              <tr key={record.id}>
                <td>{record.code}</td>
                <td>{record.name}</td>
                <td>{record.description || "-"}</td>
                <td>{statusPill(record.status)}</td>
                <td>
                  <button
                    className="btn small"
                    type="button"
                    onClick={() => openEdit(record)}
                  >
                    Sửa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="footer-note">
        Bệnh / lỗi INACTIVE được giữ để bảo toàn lịch sử nhưng không dùng cho case
        bảo hành mới.
      </div>

      <Modal
        title={editingId ? "Sửa bệnh / lỗi" : "Thêm bệnh / lỗi"}
        open={isModalOpen}
        onCancel={closeModal}
        footer={null}
        width={920}
        centered
        getContainer={false}
        maskClosable={false}
      >
        <form onSubmit={handleSubmit}>
          <ModalError message={formError} />
          <div className="grid-2">
            <section className="card">
              <div className="section-title">Thông tin lỗi</div>
              <div className="field">
                <label htmlFor="defect-code">Mã lỗi *</label>
                <input
                  id="defect-code"
                  className="input"
                  value={formState.code}
                  onChange={(event) => updateField("code", event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="defect-name">Tên bệnh / lỗi *</label>
                <input
                  id="defect-name"
                  className="input"
                  value={formState.name}
                  onChange={(event) => updateField("name", event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="defect-status">Trạng thái *</label>
                <select
                  id="defect-status"
                  className="select"
                  value={formState.status}
                  onChange={(event) =>
                    updateField("status", event.target.value as MasterStatus)
                  }
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section className="card">
              <div className="section-title">Mô tả & sử dụng</div>
              <div className="field">
                <label htmlFor="defect-description">Mô tả</label>
                <textarea
                  id="defect-description"
                  className="textarea"
                  value={formState.description}
                  onChange={(event) =>
                    updateField("description", event.target.value)
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="defect-group">Nhóm áp dụng</label>
                <input
                  id="defect-group"
                  className="input"
                  value={formState.applicableGroup}
                  onChange={(event) =>
                    updateField("applicableGroup", event.target.value)
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="defect-note">Ghi chú nội bộ</label>
                <textarea
                  id="defect-note"
                  className="textarea"
                  value={formState.note}
                  onChange={(event) => updateField("note", event.target.value)}
                />
              </div>
            </section>
          </div>
          <div className="toolbar" style={{ marginTop: 16, marginBottom: 0 }}>
            <div className="spacer" />
            <button className="btn" type="button" onClick={closeModal}>
              Hủy
            </button>
            <button className="btn primary" type="submit">
              Lưu bệnh / lỗi
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
