/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { Modal, message } from "antd";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getApiErrorMessage } from "@/shared/api/api-error";
import { ROUTES } from "@/shared/constants/routes";
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
import { InboundSourceScreen } from "@/modules/inbound/pages/MvpInboundScreens";
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

function goUrl(screen: "IN-01" | "IN-03", id?: string) {
  const params = new URLSearchParams({ screen });
  if (id) params.set("id", id);
  return `${ROUTES.INBOUND}?${params.toString()}`;
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
  const hasScanEvidence = Boolean(
    detailQuery.data?.lines.some((line) => line.scanned > 0),
  );
  const isDraft = !documentId || detailQuery.data?.document.status === "DRAFT";
  const saving = createMutation.isPending || updateMutation.isPending;

  const updateLine = (key: string, patch: Partial<LineDraft>) => {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  };

  const handleSave = async () => {
    if (!canCreate || !isDraft) return;
    const normalizedLines = lines.filter((line) => line.product_id && line.qty_planned > 0);
    if (!warehouseId || normalizedLines.length === 0) {
      message.error("Chọn kho và ít nhất một SKU có số lượng hợp lệ.");
      return;
    }

    try {
      if (documentId && detailQuery.data) {
        const payload: UpdateInboundPayload = {
          source_name: sourceName.trim() || null,
          note: note.trim() || null,
          ...(hasScanEvidence
            ? {}
            : {
                lines: normalizedLines.map(({ product_id, qty_planned, note: lineNote }) => ({
                  product_id,
                  qty_planned: Number(qty_planned),
                  note: lineNote ?? null,
                })),
              }),
        };
        const updated = await updateMutation.mutateAsync({
          id: documentId,
          payload,
          ifMatch: detailQuery.data.document.version,
        });
        message.success("Đã cập nhật phiếu nhập DRAFT.");
        onSaved(updated.id);
        return;
      }

      const payload: CreateInboundPayload = {
        dst_warehouse_id: warehouseId,
        source_name: sourceName.trim() || null,
        note: note.trim() || null,
        lines: normalizedLines.map(({ product_id, qty_planned, note: lineNote }) => ({
          product_id,
          qty_planned: Number(qty_planned),
          note: lineNote ?? null,
        })),
      };
      const created = await createMutation.mutateAsync(payload);
      message.success("Đã tạo phiếu nhập DRAFT.");
      onSaved(created.id);
    } catch (error) {
      message.error(getApiErrorMessage(error, "Không lưu được phiếu nhập."));
    }
  };

  return (
    <Modal
      title={documentId ? "Sửa phiếu nhập DRAFT" : "Tạo phiếu nhập DRAFT"}
      open
      width={1120}
      footer={null}
      onCancel={onClose}
      maskClosable={!saving}
      closable={!saving}
    >
      {detailQuery.isError && (
        <div className="footer-note" role="alert" style={{ marginBottom: 14 }}>
          {getApiErrorMessage(detailQuery.error, "Không tải được phiếu nhập DRAFT.")}
        </div>
      )}

      {documentId && detailQuery.data && !isDraft && (
        <div className="alert" style={{ marginBottom: 14 }}>
          Chỉ phiếu ở trạng thái DRAFT mới được sửa tại đây. Phiếu hiện tại đang ở trạng thái{" "}
          <b>{detailQuery.data.document.status}</b>.
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
              disabled={!isDraft}
              onChange={(event) => setSourceName(event.target.value)}
              placeholder="Nhà cung cấp / nguồn nhập"
            />
          </div>
          <div className="field">
            <label>Kho *</label>
            <select
              className="select"
              value={warehouseId}
              disabled={Boolean(documentId) || !isDraft}
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
              disabled={!isDraft}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="card soft">
          <div className="section-title">Quy tắc nhập kho</div>
          <div className="rule">
            <span className="dot" />
            <span>Expected qty là số lượng đầy đủ cần nhận.</span>
          </div>
          <div className="rule">
            <span className="dot" />
            <span>Không có nhập một phần, thiếu/thừa hoặc PARTIALLY_POSTED.</span>
          </div>
          <div className="rule">
            <span className="dot" />
            <span>Scan vượt expected qty bị từ chối.</span>
          </div>
          <div className="rule">
            <span className="dot" />
            <span>Post Receipt chỉ mở khi mọi dòng đã scan đúng đủ số lượng.</span>
          </div>
          {hasScanEvidence && (
            <div className="rule">
              <span className="dot" style={{ background: "#d97706" }} />
              <span>Phiếu đã có scan evidence nên danh sách dòng không còn được thay thế.</span>
            </div>
          )}
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
                      disabled={hasScanEvidence || !isDraft}
                      onChange={(event) => updateLine(line.key, { product_id: event.target.value })}
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
                      value={line.qty_planned}
                      disabled={hasScanEvidence || !isDraft}
                      onChange={(event) =>
                        updateLine(line.key, { qty_planned: Number(event.target.value) })
                      }
                      style={{ width: 110 }}
                    />
                  </td>
                  <td>{sku?.sku_type ?? "-"}</td>
                  <td>
                    {!hasScanEvidence && isDraft && lines.length > 1 && (
                      <button
                        className="btn small"
                        onClick={() =>
                          setLines((current) => current.filter((item) => item.key !== line.key))
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

      {!hasScanEvidence && isDraft && (
        <button
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
        <button className="btn" disabled={saving} onClick={onClose}>
          Hủy
        </button>
        <div className="spacer" />
        <button
          className="btn primary"
          disabled={!canCreate || !isDraft || saving || detailQuery.isLoading}
          onClick={() => void handleSave()}
        >
          {saving ? "Đang lưu..." : "Lưu & bắt đầu quét"}
        </button>
      </div>
    </Modal>
  );
}

function InboundListScreen() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftDocumentId, setDraftDocumentId] = useState<string | null>(null);
  const canCreate = useInboundPermission(P.INBOUND_CREATE);
  const query = useInboundDocuments({
    search,
    status: status || undefined,
    per_page: 100,
  });

  useEffect(() => {
    if (searchParams.get("screen") !== "IN-02") return;
    setDraftDocumentId(searchParams.get("id"));
    setDraftOpen(true);
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
    navigate(goUrl("IN-03", documentId));
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
        <button className="btn" onClick={() => query.refetch()} disabled={query.isFetching}>
          Làm mới
        </button>
        <div className="spacer" />
        {canCreate && (
          <button className="btn primary" onClick={openCreateModal}>
            + Tạo phiếu nhập
          </button>
        )}
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
              <th>Tiến độ</th>
              <th>Trạng thái</th>
              <th>Cập nhật</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(query.data ?? []).map((row) => (
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
                    {canCreate && row.status === "DRAFT" && (
                      <button className="btn small" onClick={() => openEditModal(row.id)}>
                        Sửa
                      </button>
                    )}
                    <button
                      className="btn small"
                      onClick={() => navigate(goUrl("IN-03", row.id))}
                    >
                      {row.status === "POSTED" || row.status === "CANCELLED" ? "Xem" : "Mở"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
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
    </>
  );
}

export default function InboundPage() {
  const [searchParams] = useSearchParams();
  const screen = searchParams.get("screen");

  if (screen === "IN-03") {
    return <InboundSourceScreen screenId="IN-03" />;
  }

  return <InboundListScreen />;
}
