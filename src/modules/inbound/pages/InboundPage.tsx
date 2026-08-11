/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { Modal, message } from "antd";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
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
type LineDraft = InboundLinePayload & { key: string };

type DraftModalProps = {
  documentId: string | null;
  onClose: () => void;
  onSaved: (documentId: string) => void;
};

function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

function makeKey(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
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

function normalizeLines(lines: LineDraft[]): InboundLinePayload[] | null {
  if (lines.length === 0) return null;
  const normalized: InboundLinePayload[] = [];
  for (const line of lines) {
    const quantity = Number(line.qty_planned);
    if (!line.product_id || !Number.isInteger(quantity) || quantity <= 0) return null;
    normalized.push({
      product_id: line.product_id,
      qty_planned: quantity,
      import_batch_id: line.import_batch_id ?? null,
      note: line.note ?? null,
    });
  }
  return normalized;
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
  const [warehouseId, setWarehouseId] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([
    { key: makeKey("line"), product_id: "", qty_planned: 1 },
  ]);
  const [initializedId, setInitializedId] = useState<string | null>(null);
  const canCreate = useInboundPermission(P.INBOUND_CREATE);

  useEffect(() => {
    const detail = detailQuery.data;
    if (!documentId || !detail || initializedId === documentId) return;
    setWarehouseId(detail.document.warehouseId);
    setSourceName(detail.document.source === "-" ? "" : detail.document.source);
    setNote(detail.document.note ?? "");
    setLines(
      detail.lines.map((line) => ({
        key: line.id,
        product_id: line.productId,
        qty_planned: line.expected,
        note: line.note ?? null,
      })),
    );
    setInitializedId(documentId);
  }, [detailQuery.data, documentId, initializedId]);

  const skuRows = skuQuery.data?.data ?? [];
  const warehouseRows = (warehousesQuery.data ?? []) as WarehouseRow[];
  const status = detailQuery.data?.document.status;
  const hasScanEvidence = Boolean(
    detailQuery.data?.lines.some((line) => line.scanned > 0),
  );
  const isMutable =
    !documentId || status === "DRAFT" || status === "SCANNING";
  const canEditLines = isMutable && !hasScanEvidence;
  const saving = createMutation.isPending || updateMutation.isPending;

  const updateLine = (key: string, patch: Partial<LineDraft>) => {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  };

  const handleSave = async () => {
    if (!canCreate || !isMutable) return;

    try {
      if (documentId) {
        const detail = detailQuery.data;
        if (!detail) return;
        const payload: UpdateInboundPayload = {
          source_name: sourceName.trim() || null,
          note: note.trim() || null,
        };
        if (canEditLines) {
          const normalizedLines = normalizeLines(lines);
          if (!normalizedLines) {
            message.error("Mỗi dòng phải có SKU và Expected qty là số nguyên lớn hơn 0.");
            return;
          }
          payload.lines = normalizedLines;
        }
        const updated = await updateMutation.mutateAsync({
          id: documentId,
          payload,
          ifMatch: detail.document.version,
        });
        message.success(
          hasScanEvidence
            ? "Đã cập nhật thông tin phiếu; dữ liệu scan được giữ nguyên."
            : "Đã cập nhật phiếu nhập.",
        );
        onSaved(updated.id);
        return;
      }

      const normalizedLines = normalizeLines(lines);
      if (!warehouseId || !normalizedLines) {
        message.error(
          "Chọn kho và khai báo ít nhất một dòng SKU có Expected qty hợp lệ.",
        );
        return;
      }
      const payload: CreateInboundPayload = {
        dst_warehouse_id: warehouseId,
        source_name: sourceName.trim() || null,
        note: note.trim() || null,
        lines: normalizedLines,
      };
      const created = await createMutation.mutateAsync(payload);
      message.success("Đã tạo phiếu nhập DRAFT.");
      onSaved(created.id);
    } catch (error) {
      message.error(getApiErrorMessage(error, "Không lưu được phiếu nhập."));
    }
  };

  const modalTitle = documentId
    ? status === "SCANNING"
      ? "Sửa thông tin phiếu nhập đang SCANNING"
      : "Sửa phiếu nhập DRAFT"
    : "Tạo phiếu nhập DRAFT";

  return (
    <Modal
      title={modalTitle}
      open
      width={1120}
      footer={null}
      onCancel={onClose}
      maskClosable={!saving}
      closable={!saving}
    >
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
          Phiếu đã có scan evidence. Có thể sửa nguồn/tham chiếu và ghi chú, nhưng
          không thay SKU/Expected qty để tránh xóa lịch sử scan. Nếu dữ liệu dòng sai,
          hãy Cancel phiếu và tạo lại theo đúng full-post flow.
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
            <label>Nguồn / tham chiếu</label>
            <input
              className="input"
              value={sourceName}
              disabled={!isMutable}
              onChange={(event) => setSourceName(event.target.value)}
              placeholder="Nhà cung cấp / nguồn nhập"
            />
          </div>
          <div className="field">
            <label>Kho *</label>
            <select
              className="select"
              value={warehouseId}
              disabled={Boolean(documentId) || !isMutable}
              onChange={(event) => setWarehouseId(event.target.value)}
            >
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
          </div>
          <div className="field">
            <label>Ghi chú</label>
            <textarea
              className="input"
              value={note}
              disabled={!isMutable}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
            />
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
        </div>
      </div>

      <div className="table-wrap" style={{ marginTop: 14 }}>
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Tên</th>
              <th>Expected qty</th>
              <th>Loại</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const sku = skuRows.find((item) => item.sku_id === line.product_id);
              return (
                <tr key={line.key}>
                  <td>
                    <select
                      className="select"
                      value={line.product_id}
                      disabled={!canEditLines}
                      onChange={(event) =>
                        updateLine(line.key, { product_id: event.target.value })
                      }
                    >
                      <option value="">Chọn SKU</option>
                      {skuRows.map((item) => (
                        <option key={item.sku_id} value={item.sku_id}>
                          {item.sku_code}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{sku?.sku_name ?? "-"}</td>
                  <td>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      step={1}
                      value={line.qty_planned}
                      disabled={!canEditLines}
                      onChange={(event) =>
                        updateLine(line.key, { qty_planned: Number(event.target.value) })
                      }
                      style={{ width: 110 }}
                    />
                  </td>
                  <td>{sku?.sku_type ?? "-"}</td>
                  <td>
                    {canEditLines && lines.length > 1 && (
                      <button
                        type="button"
                        className="btn small"
                        onClick={() =>
                          setLines((current) =>
                            current.filter((item) => item.key !== line.key),
                          )
                        }
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

      {canEditLines && (
        <button
          type="button"
          className="btn"
          style={{ marginTop: 10 }}
          onClick={() =>
            setLines((current) => [
              ...current,
              { key: makeKey("line"), product_id: "", qty_planned: 1 },
            ])
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
            type="button"
            className="btn primary"
            disabled={!canCreate || saving || detailQuery.isLoading}
            onClick={() => void handleSave()}
          >
            {saving
              ? "Đang lưu..."
              : documentId
                ? "Lưu & tiếp tục quét"
                : "Lưu & bắt đầu quét"}
          </button>
        )}
      </div>
    </Modal>
  );
}

function InboundListScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftDocumentId, setDraftDocumentId] = useState<string | null>(null);
  const [scanDocumentId, setScanDocumentId] = useState<string | null>(null);
  const canCreate = useInboundPermission(P.INBOUND_CREATE);
  const canScan = useInboundPermission(P.INBOUND_SCAN);
  const query = useInboundDocuments({
    search,
    status: status || undefined,
    per_page: 100,
  });

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

  return (
    <>
      <div className="toolbar">
        <input
          className="input search"
          value={searchDraft}
          placeholder="Tìm mã phiếu / nguồn nhập"
          onChange={(event) => {
            setSearchDraft(event.target.value);
            if (!event.target.value) setSearch("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") setSearch(searchDraft.trim());
          }}
        />
        <select
          className="select"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
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
        Luồng chuẩn: <b>Tạo DRAFT → Quét Barcode/QR → đủ chính xác từng dòng → Full Post</b>.
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
            {(query.data ?? []).map((row) => {
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
                          {row.status === "DRAFT" ? "Sửa" : "Sửa thông tin"}
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
            {!query.isLoading && (query.data?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  Không có phiếu nhập phù hợp.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
        />
      )}
    </>
  );
}

export default function InboundPage() {
  return <InboundListScreen />;
}
