import { useEffect, useRef, useState } from "react";
import { Modal, message } from "antd";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import { getApiErrorMessage } from "@/shared/api/api-error";
import {
  hasAnyWmsPermission,
  WMS_PERMISSION_CATALOG as P,
} from "@/shared/constants/wms-permissions";
import { useAuthStore } from "@/shared/store/auth.store";
import { useMvpSkus } from "@/modules/master-data/hooks/use-mvp-master";
import { fetchWarehouses } from "@/modules/master-data/services/warehouse.service";
import {
  useCreateInbound,
  useInboundDetail,
  useInboundDocuments,
  useUpdateInbound,
} from "@/modules/inbound/hooks/use-inbound";
import { InboundScanModal } from "@/modules/inbound/pages/MvpInboundScreens";
import type {
  CreateInboundPayload,
  InboundDocument,
  InboundLinePayload,
  UpdateInboundPayload,
} from "@/modules/receiving/types";

type WarehouseRow = Record<string, unknown>;

type DraftModalProps = {
  documentId: string | null;
  onClose: () => void;
  onSaved: (documentId: string) => void;
};

const inboundLineSchema = z.object({
  id: z.string().optional(),
  product_id: z.string().min(1, "Chọn SKU."),
  import_batch_id: z.string().nullable().optional(),
  qty_planned: z.number().int().min(1, "Expected qty phải là số nguyên lớn hơn 0."),
  scanned_qty: z.number().int().min(0),
  note: z.string().nullable().optional(),
});

const inboundDraftSchema = z
  .object({
    warehouseId: z.string().min(1, "Chọn kho ACTIVE."),
    documentDate: z.string().min(1, "Chọn ngày chứng từ."),
    sourceName: z.string().max(255, "Nguồn/tham chiếu tối đa 255 ký tự."),
    note: z.string().max(2000, "Ghi chú tối đa 2000 ký tự."),
    lines: z.array(inboundLineSchema).min(1, "Phiếu nhập phải có ít nhất một dòng."),
  })
  .superRefine((values, context) => {
    values.lines.forEach((line, index) => {
      const minimum = Math.max(1, line.scanned_qty);
      if (line.qty_planned < minimum) {
        context.addIssue({
          code: "custom",
          path: ["lines", index, "qty_planned"],
          message: `Expected qty không được nhỏ hơn ${minimum}.`,
        });
      }
    });
  });

type DraftFormValues = z.infer<typeof inboundDraftSchema>;

function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

function localToday(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function defaultDraftValues(): DraftFormValues {
  return {
    warehouseId: "",
    documentDate: localToday(),
    sourceName: "",
    note: "",
    lines: [
      {
        product_id: "",
        qty_planned: 1,
        scanned_qty: 0,
        note: null,
      },
    ],
  };
}

function statusPill(status: InboundDocument["status"]) {
  const cls =
    status === "POSTED"
      ? "ok"
      : status === "SCANNING"
        ? "blue"
        : status === "CANCELLED"
          ? "danger-pill"
          : "warn-pill";
  return <span className={`pill ${cls}`}>{status}</span>;
}

function useInboundPermission(code: string) {
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  return hasAnyWmsPermission(permissionCodes, [code], isSuperAdmin);
}

function toInboundLinePayload(lines: DraftFormValues["lines"]): InboundLinePayload[] {
  return lines.map((line) => {
    const payload: InboundLinePayload = {
      product_id: line.product_id,
      qty_planned: line.qty_planned,
      note: line.note ?? null,
    };
    if (line.id) payload.id = line.id;
    if (line.import_batch_id !== undefined) {
      payload.import_batch_id = line.import_batch_id;
    }
    return payload;
  });
}

function InboundDraftModal({ documentId, onClose, onSaved }: DraftModalProps) {
  const detailQuery = useInboundDetail(documentId);
  const skuQuery = useMvpSkus({ status: "ACTIVE", per_page: 100 });
  const warehousesQuery = useQuery({
    queryKey: ["warehouses", "inbound-active"],
    queryFn: () => fetchWarehouses({ status: "ACTIVE", per_page: 100 }),
  });
  const createMutation = useCreateInbound();
  const updateMutation = useUpdateInbound();
  const initializedIdRef = useRef<string | null>(null);
  const canCreate = useInboundPermission(P.INBOUND_CREATE);
  const form = useForm<DraftFormValues>({
    resolver: zodResolver(inboundDraftSchema),
    defaultValues: defaultDraftValues(),
    mode: "onSubmit",
  });
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "lines",
    keyName: "fieldKey",
  });
  const watchedLines = useWatch({ control, name: "lines" }) ?? [];

  useEffect(() => {
    const detail = detailQuery.data;
    if (!documentId || !detail || initializedIdRef.current === documentId) return;

    reset({
      warehouseId: detail.document.warehouseId,
      documentDate: detail.document.date?.slice(0, 10) || localToday(),
      sourceName: detail.document.source === "-" ? "" : detail.document.source,
      note: detail.document.note ?? "",
      lines: detail.lines.map((line) => ({
        id: line.id,
        product_id: line.productId,
        qty_planned: line.expected,
        scanned_qty: line.scanned,
        note: line.note ?? null,
      })),
    });
    initializedIdRef.current = documentId;
  }, [detailQuery.data, documentId, reset]);

  const skuRows = skuQuery.data?.data ?? [];
  const warehouseRows = (warehousesQuery.data ?? []) as WarehouseRow[];
  const status = detailQuery.data?.document.status;
  const hasScanEvidence = Boolean(
    detailQuery.data?.lines.some((line) => line.scanned > 0),
  );
  const isMutable = !documentId || status === "DRAFT" || status === "SCANNING";
  const canEditStructure = isMutable && !hasScanEvidence;
  const saving = createMutation.isPending || updateMutation.isPending;

  const handleSave = async (values: DraftFormValues) => {
    if (!canCreate || !isMutable) return;

    try {
      const normalizedLines = toInboundLinePayload(values.lines);

      if (documentId) {
        const detail = detailQuery.data;
        if (!detail) return;
        const payload: UpdateInboundPayload = {
          doc_date: values.documentDate || null,
          source_name: values.sourceName.trim() || null,
          note: values.note.trim() || null,
          lines: normalizedLines,
        };
        const updated = await updateMutation.mutateAsync({
          id: documentId,
          payload,
          ifMatch: detail.document.version,
        });
        message.success(
          hasScanEvidence
            ? "Đã cập nhật Expected; line ID và toàn bộ scan evidence được giữ nguyên."
            : "Đã cập nhật phiếu nhập.",
        );
        onSaved(updated.id);
        return;
      }

      const payload: CreateInboundPayload = {
        doc_date: values.documentDate || null,
        dst_warehouse_id: values.warehouseId,
        source_name: values.sourceName.trim() || null,
        note: values.note.trim() || null,
        lines: normalizedLines,
      };
      const created = await createMutation.mutateAsync(payload);
      message.success("Đã tạo phiếu nhập DRAFT.");
      onSaved(created.id);
    } catch (error) {
      message.error(getApiErrorMessage(error, "Không lưu được phiếu nhập."));
      if (documentId) {
        initializedIdRef.current = null;
        const refreshed = await detailQuery.refetch();
        if (refreshed.data) {
          reset({
            warehouseId: refreshed.data.document.warehouseId,
            documentDate: refreshed.data.document.date?.slice(0, 10) || localToday(),
            sourceName:
              refreshed.data.document.source === "-" ? "" : refreshed.data.document.source,
            note: refreshed.data.document.note ?? "",
            lines: refreshed.data.lines.map((line) => ({
              id: line.id,
              product_id: line.productId,
              qty_planned: line.expected,
              scanned_qty: line.scanned,
              note: line.note ?? null,
            })),
          });
          initializedIdRef.current = documentId;
        }
      }
    }
  };

  const submitForm = handleSubmit(handleSave, () => {
    message.error("Kiểm tra lại các trường bắt buộc và Expected qty trước khi lưu.");
  });

  const modalTitle = documentId
    ? status === "SCANNING"
      ? "Sửa phiếu nhập SCANNING"
      : "Sửa phiếu nhập DRAFT"
    : "Tạo phiếu nhập DRAFT";

  return (
    <Modal
      title={modalTitle}
      open
      width={1120}
      footer={null}
      onCancel={onClose}
      centered
      getContainer={false}
      maskClosable={false}
      closable={!saving}
    >
      <form onSubmit={submitForm} noValidate>
        {detailQuery.isError && (
          <div className="footer-note" role="alert" style={{ marginBottom: 14 }}>
            {getApiErrorMessage(detailQuery.error, "Không tải được phiếu nhập.")}
          </div>
        )}

        {documentId && detailQuery.data && !isMutable && (
          <div className="alert" style={{ marginBottom: 14 }}>
            Phiếu <b>{detailQuery.data.document.status}</b> là trạng thái kết thúc và chỉ
            được xem. Chứng từ đã POSTED không sửa/xóa; sai giao dịch phải đi luồng
            Reversal/Correction.
          </div>
        )}

        {hasScanEvidence && isMutable && (
          <div className="alert" style={{ marginBottom: 14 }}>
            Phiếu đã có scan evidence: hệ thống giữ nguyên line ID, SKU, import batch và
            lịch sử quét. Bạn vẫn được sửa <b>Expected qty</b> theo baseline nghiệp vụ,
            nhưng Expected không được nhỏ hơn số đã quét. Muốn đổi cấu trúc SKU/dòng phải
            Cancel và tạo phiếu mới.
          </div>
        )}

        <div className="grid-2">
          <div className="card">
            <div className="section-title">Thông tin phiếu</div>
            <div className="field">
              <label>Mã phiếu</label>
              <div className="value">
                {detailQuery.data?.document.code || "Tự sinh sau khi lưu"}
              </div>
            </div>
            <div className="field">
              <label>Ngày chứng từ *</label>
              <input
                className="input"
                type="date"
                disabled={!isMutable}
                {...register("documentDate")}
              />
              {errors.documentDate?.message && (
                <div className="footer-note" role="alert">
                  {errors.documentDate.message}
                </div>
              )}
            </div>
            <div className="field">
              <label>Nguồn / tham chiếu</label>
              <input
                className="input"
                disabled={!isMutable}
                placeholder="Nhà cung cấp / nguồn nhập"
                {...register("sourceName")}
              />
              {errors.sourceName?.message && (
                <div className="footer-note" role="alert">
                  {errors.sourceName.message}
                </div>
              )}
            </div>
            <div className="field">
              <label>Kho *</label>
              {documentId ? (
                <>
                  <input type="hidden" {...register("warehouseId")} />
                  <div className="value">
                    {warehouseRows.find(
                      (warehouse) =>
                        text(warehouse.id ?? warehouse.warehouse_id) ===
                        detailQuery.data?.document.warehouseId,
                    )
                      ? (() => {
                          const warehouse = warehouseRows.find(
                            (item) =>
                              text(item.id ?? item.warehouse_id) ===
                              detailQuery.data?.document.warehouseId,
                          );
                          return warehouse
                            ? `${text(warehouse.code)} · ${text(warehouse.name)}`
                            : detailQuery.data?.document.warehouseId;
                        })()
                      : detailQuery.data?.document.warehouseId || "Đang tải..."}
                  </div>
                </>
              ) : (
                <select className="select" disabled={!isMutable} {...register("warehouseId")}>
                  <option value="">Chọn kho ACTIVE</option>
                  {warehouseRows.map((warehouse) => {
                    const warehouseKey = text(warehouse.id ?? warehouse.warehouse_id);
                    return (
                      <option key={warehouseKey} value={warehouseKey}>
                        {text(warehouse.code)} · {text(warehouse.name)}
                      </option>
                    );
                  })}
                </select>
              )}
              {errors.warehouseId?.message && (
                <div className="footer-note" role="alert">
                  {errors.warehouseId.message}
                </div>
              )}
            </div>
            <div className="field">
              <label>Ghi chú</label>
              <textarea
                className="input"
                disabled={!isMutable}
                rows={3}
                {...register("note")}
              />
              {errors.note?.message && (
                <div className="footer-note" role="alert">
                  {errors.note.message}
                </div>
              )}
            </div>
          </div>

          <div className="card soft">
            <div className="section-title">Quy tắc nhập kho bắt buộc</div>
            <div className="rule">
              <span className="dot" />
              <span>Expected qty là toàn bộ số lượng phải nhận của từng dòng.</span>
            </div>
            <div className="rule">
              <span className="dot" />
              <span>DRAFT và SCANNING không làm thay đổi tồn kho.</span>
            </div>
            <div className="rule">
              <span className="dot" />
              <span>Không có nhập một phần, thiếu/thừa, remainder hay PARTIALLY_POSTED.</span>
            </div>
            <div className="rule">
              <span className="dot" />
              <span>Scan vượt Expected qty hoặc sai SKU/state phải bị từ chối.</span>
            </div>
            <div className="rule">
              <span className="dot" />
              <span>Full Post chỉ mở khi mọi dòng scanned_qty = expected_qty.</span>
            </div>
            <div className="rule">
              <span className="dot" />
              <span>Putaway sau nhận hàng là stock-neutral, không cộng tồn lần hai.</span>
            </div>
          </div>
        </div>

        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Tên</th>
                <th>Expected qty</th>
                <th>Đã scan</th>
                <th>Loại</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => {
                const line = watchedLines[index] ?? field;
                const sku = skuRows.find((item) => item.sku_id === line.product_id);
                const scannedQty = Number(line.scanned_qty ?? 0);
                return (
                  <tr key={field.fieldKey}>
                    <td>
                      {field.id && <input type="hidden" {...register(`lines.${index}.id`)} />}
                      <input
                        type="hidden"
                        {...register(`lines.${index}.scanned_qty`, { valueAsNumber: true })}
                      />
                      {field.import_batch_id !== undefined && (
                        <input
                          type="hidden"
                          {...register(`lines.${index}.import_batch_id`)}
                        />
                      )}
                      {canEditStructure ? (
                        <select
                          className="select"
                          {...register(`lines.${index}.product_id`)}
                        >
                          <option value="">Chọn SKU</option>
                          {skuRows.map((item) => (
                            <option key={item.sku_id} value={item.sku_id}>
                              {item.sku_code}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <>
                          <input
                            type="hidden"
                            {...register(`lines.${index}.product_id`)}
                          />
                          <div className="value">{sku?.sku_code ?? line.product_id}</div>
                        </>
                      )}
                      {errors.lines?.[index]?.product_id?.message && (
                        <div className="footer-note" role="alert">
                          {errors.lines[index]?.product_id?.message}
                        </div>
                      )}
                    </td>
                    <td>{sku?.sku_name ?? "-"}</td>
                    <td>
                      <input
                        className="input"
                        type="number"
                        min={Math.max(1, scannedQty)}
                        step={1}
                        disabled={!isMutable}
                        style={{ width: 110 }}
                        {...register(`lines.${index}.qty_planned`, { valueAsNumber: true })}
                      />
                      {errors.lines?.[index]?.qty_planned?.message && (
                        <div className="footer-note" role="alert">
                          {errors.lines[index]?.qty_planned?.message}
                        </div>
                      )}
                    </td>
                    <td>
                      <b>{scannedQty}</b>
                      {scannedQty > 0 && (
                        <div className="muted" style={{ fontSize: 12 }}>
                          Expected ≥ {scannedQty}
                        </div>
                      )}
                    </td>
                    <td>{sku?.sku_type ?? "-"}</td>
                    <td>
                      {canEditStructure && fields.length > 1 && (
                        <button
                          type="button"
                          className="btn small"
                          onClick={() => remove(index)}
                        >
                          Xóa dòng
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {canEditStructure && (
          <button
            type="button"
            className="btn"
            style={{ marginTop: 10 }}
            onClick={() =>
              append({
                product_id: "",
                qty_planned: 1,
                scanned_qty: 0,
                note: null,
              })
            }
          >
            + Thêm dòng SKU
          </button>
        )}

        <div className="toolbar" style={{ marginTop: 16, marginBottom: 0 }}>
          <button type="button" className="btn" disabled={saving} onClick={onClose}>
            {isMutable ? "Hủy thao tác" : "Đóng"}
          </button>
          <div className="spacer" />
          {isMutable && (
            <button
              type="submit"
              className="btn primary"
              disabled={!canCreate || saving || detailQuery.isLoading}
            >
              {saving
                ? "Đang lưu..."
                : documentId
                  ? "Lưu & tiếp tục quét"
                  : "Lưu & bắt đầu quét"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

function InboundListScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftDocumentId, setDraftDocumentId] = useState<string | null>(null);
  const [scanDocumentId, setScanDocumentId] = useState<string | null>(null);
  const canCreate = useInboundPermission(P.INBOUND_CREATE);
  const canScan = useInboundPermission(P.INBOUND_SCAN);
  const query = useInboundDocuments({
    search,
    status: status || undefined,
    page,
    per_page: perPage,
  });
  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;
  const currentPage = Number(meta?.current_page ?? page);
  const lastPage = Math.max(1, Number(meta?.last_page ?? 1));
  const total = Number(meta?.total ?? rows.length);
  const from = Number(meta?.from ?? (rows.length ? (currentPage - 1) * perPage + 1 : 0));
  const to = Number(meta?.to ?? (rows.length ? from + rows.length - 1 : 0));

  useEffect(() => {
    const requestedScreen = searchParams.get("screen");
    if (requestedScreen !== "IN-02" && requestedScreen !== "IN-03") return;

    const id = searchParams.get("id");
    if (requestedScreen === "IN-02") {
      setDraftDocumentId(id);
      setDraftOpen(true);
    } else if (id) {
      setScanDocumentId(id);
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("screen", "IN-01");
    nextParams.delete("id");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const applySearch = () => {
    setPage(1);
    setSearch(searchDraft.trim());
  };

  const openCreateModal = () => {
    setDraftDocumentId(null);
    setDraftOpen(true);
  };

  const openEditModal = (documentId: string) => {
    setDraftDocumentId(documentId);
    setDraftOpen(true);
  };

  const closeDraftModal = () => {
    setDraftOpen(false);
    setDraftDocumentId(null);
  };

  const handleSaved = (documentId: string) => {
    closeDraftModal();
    setScanDocumentId(documentId);
  };

  const handleFlowChanged = () => {
    void query.refetch();
  };

  const openExpectedCorrectionFromScan = (documentId: string) => {
    setScanDocumentId(null);
    openEditModal(documentId);
  };

  return (
    <>
      <div className="toolbar">
        <input
          className="input search"
          value={searchDraft}
          placeholder="Tìm mã phiếu / nguồn nhập"
          onChange={(event) => {
            const value = event.target.value;
            setSearchDraft(value);
            if (!value) {
              setPage(1);
              setSearch("");
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") applySearch();
          }}
        />
        <button type="button" className="btn" onClick={applySearch}>
          Tìm
        </button>
        <select
          className="select"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Trạng thái: Tất cả</option>
          <option value="DRAFT">DRAFT</option>
          <option value="SCANNING">SCANNING</option>
          <option value="POSTED">POSTED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
        <button
          type="button"
          className="btn"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          Làm mới
        </button>
        <div className="spacer" />
        {canCreate && (
          <button type="button" className="btn primary" onClick={openCreateModal}>
            + Tạo phiếu nhập
          </button>
        )}
      </div>

      <div className="alert" style={{ marginBottom: 14 }}>
        Luồng chuẩn:{" "}
        <b>Tạo DRAFT → Quét Barcode/QR → đủ chính xác từng dòng → Full Post</b>.
        DRAFT/SCANNING và scan không đổi tồn; tồn chỉ tăng khi Full Post Receipt thành công.
      </div>

      {query.isError && (
        <div className="footer-note" role="alert">
          {getApiErrorMessage(query.error, "Không tải được danh sách phiếu nhập.")}
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Phiếu nhập</th>
              <th>Nguồn</th>
              <th>Tiến độ scan</th>
              <th>Trạng thái</th>
              <th>Cập nhật</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const mutable = row.status === "DRAFT" || row.status === "SCANNING";
              const flowLabel = mutable
                ? canScan
                  ? row.status === "DRAFT"
                    ? "Bắt đầu quét"
                    : "Tiếp tục quét"
                  : "Xem chi tiết"
                : "Xem chi tiết";
              return (
                <tr key={row.id}>
                  <td>{row.code || row.id}</td>
                  <td>{row.source}</td>
                  <td>
                    {row.scanned ?? 0} / {row.expected}
                  </td>
                  <td>{statusPill(row.status)}</td>
                  <td>{row.updatedAt ?? row.date}</td>
                  <td>
                    <div className="toolbar-wrap" style={{ marginBottom: 0 }}>
                      {canCreate && mutable && (
                        <button
                          type="button"
                          className="btn small"
                          onClick={() => openEditModal(row.id)}
                        >
                          {row.status === "DRAFT" ? "Sửa" : "Sửa Expected"}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => setScanDocumentId(row.id)}
                      >
                        {flowLabel}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!query.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Không có phiếu nhập phù hợp.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="toolbar" style={{ marginTop: 12, marginBottom: 0 }}>
        <span className="muted">
          {total > 0 ? `Hiển thị ${from}-${to} / ${total} phiếu` : "0 phiếu"}
        </span>
        <div className="spacer" />
        <label className="muted" htmlFor="inbound-page-size">
          Số dòng/trang
        </label>
        <select
          id="inbound-page-size"
          className="select"
          value={perPage}
          onChange={(event) => {
            setPerPage(Number(event.target.value));
            setPage(1);
          }}
        >
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <button
          type="button"
          className="btn small"
          disabled={currentPage <= 1 || query.isFetching}
          onClick={() => setPage(Math.max(1, currentPage - 1))}
        >
          ← Trước
        </button>
        <span className="muted">
          Trang {currentPage}/{lastPage}
        </span>
        <button
          type="button"
          className="btn small"
          disabled={currentPage >= lastPage || query.isFetching}
          onClick={() => setPage(Math.min(lastPage, currentPage + 1))}
        >
          Sau →
        </button>
      </div>

      {draftOpen && (
        <InboundDraftModal
          documentId={draftDocumentId}
          onClose={closeDraftModal}
          onSaved={handleSaved}
        />
      )}

      {scanDocumentId && (
        <InboundScanModal
          documentId={scanDocumentId}
          onClose={() => setScanDocumentId(null)}
          onChanged={handleFlowChanged}
          onEditExpected={() => openExpectedCorrectionFromScan(scanDocumentId)}
        />
      )}
    </>
  );
}

export default function InboundPage() {
  return <InboundListScreen />;
}
