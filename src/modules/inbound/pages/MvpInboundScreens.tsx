/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from "react";
import { Input, Modal, message } from "antd";
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
import type { SkuRecord } from "@/modules/master-data/types/mvp-master.types";
import {
  useCancelInbound,
  useCreateInbound,
  useInboundDetail,
  useInboundDocuments,
  usePostInboundReceipt,
  useScanInbound,
  useUpdateInbound,
} from "@/modules/inbound/hooks/use-inbound";
import type {
  CreateInboundPayload,
  InboundDocument,
  InboundLinePayload,
  ReceiptEvidence,
  UpdateInboundPayload,
} from "@/modules/receiving/types";

type ScreenId = "IN-01" | "IN-02" | "IN-03";
type WarehouseRow = Record<string, unknown>;
type LineDraft = InboundLinePayload & { key: string };

type Props = {
  screenId: ScreenId;
};

function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

function makeKey(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
}

function goUrl(screenId: ScreenId, id?: string) {
  const params = new URLSearchParams({ screen: screenId });
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

function InboundListScreen() {
  const navigate = useNavigate();
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const canCreate = useInboundPermission(P.INBOUND_CREATE);
  const query = useInboundDocuments({
    search,
    status: status || undefined,
    per_page: 100,
  });

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
          <button className="btn primary" onClick={() => navigate(goUrl("IN-02"))}>
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
                  <button
                    className="btn small"
                    onClick={() => navigate(goUrl("IN-03", row.id))}
                  >
                    {row.status === "POSTED" || row.status === "CANCELLED" ? "Xem" : "Mở"}
                  </button>
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
    </>
  );
}

function InboundDraftScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");
  const detailQuery = useInboundDetail(id);
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
    if (!id || !detail || initializedId === id) return;
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
    setInitializedId(id);
  }, [detailQuery.data, id, initializedId]);

  const skuRows = skuQuery.data?.data ?? [];
  const warehouseRows = (warehousesQuery.data ?? []) as WarehouseRow[];
  const hasScanEvidence = Boolean(
    detailQuery.data?.lines.some((line) => line.scanned > 0),
  );
  const saving = createMutation.isPending || updateMutation.isPending;

  const updateLine = (key: string, patch: Partial<LineDraft>) => {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  };

  const handleSave = async () => {
    if (!canCreate) return;
    const normalizedLines = lines.filter((line) => line.product_id && line.qty_planned > 0);
    if (!warehouseId || normalizedLines.length === 0) {
      message.error("Chọn kho và ít nhất một SKU có số lượng hợp lệ.");
      return;
    }
    try {
      if (id && detailQuery.data) {
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
          id,
          payload,
          ifMatch: detailQuery.data.document.version,
        });
        message.success("Đã lưu phiếu nhập trên backend.");
        navigate(goUrl("IN-03", updated.id));
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
      navigate(goUrl("IN-03", created.id));
    } catch (error) {
      message.error(getApiErrorMessage(error, "Không lưu được phiếu nhập."));
    }
  };

  return (
    <>
      <div className="grid-2">
        <div className="card">
          <div className="section-title">Thông tin phiếu</div>
          <div className="field">
            <label>Mã phiếu</label>
            <div className="value">{detailQuery.data?.document.code || "Tự sinh sau khi lưu"}</div>
          </div>
          <div className="field">
            <label>Nguồn / tham chiếu</label>
            <input
              className="input"
              value={sourceName}
              onChange={(event) => setSourceName(event.target.value)}
              placeholder="Nhà cung cấp / nguồn nhập"
            />
          </div>
          <div className="field">
            <label>Kho *</label>
            <select
              className="select"
              value={warehouseId}
              disabled={Boolean(id)}
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
              onChange={(event) => setNote(event.target.value)}
              rows={3}
            />
          </div>
        </div>
        <div className="card soft">
          <div className="section-title">Quy tắc</div>
          <div className="rule">
            <span className="dot" />
            <span>qty_planned là số lượng đầy đủ cần nhận.</span>
          </div>
          <div className="rule">
            <span className="dot" />
            <span>Post Receipt chỉ chạy khi mọi dòng đã scan đúng đủ số lượng.</span>
          </div>
          <div className="rule">
            <span className="dot" />
            <span>Scan vượt số lượng kế hoạch bị backend từ chối.</span>
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
                      disabled={hasScanEvidence}
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
                      disabled={hasScanEvidence}
                      onChange={(event) =>
                        updateLine(line.key, { qty_planned: Number(event.target.value) })
                      }
                      style={{ width: 110 }}
                    />
                  </td>
                  <td>{sku?.sku_type ?? "-"}</td>
                  <td>
                    {!hasScanEvidence && lines.length > 1 && (
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
      {!hasScanEvidence && (
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

      <div className="toolbar" style={{ marginTop: 16 }}>
        <button className="btn" onClick={() => navigate(goUrl("IN-01"))}>
          Hủy
        </button>
        <button
          className="btn primary"
          disabled={!canCreate || saving || detailQuery.isLoading}
          onClick={handleSave}
        >
          {saving ? "Đang lưu..." : "Lưu & bắt đầu quét"}
        </button>
      </div>
    </>
  );
}

function InboundScanScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get("id");
  const listQuery = useInboundDocuments({ per_page: 100 });
  const detailQuery = useInboundDetail(documentId);
  const skuQuery = useMvpSkus({ status: "ACTIVE", per_page: 100 });
  const scanMutation = useScanInbound();
  const postMutation = usePostInboundReceipt();
  const cancelMutation = useCancelInbound();
  const [lineId, setLineId] = useState("");
  const [scanCode, setScanCode] = useState("");
  const [scanVersion, setScanVersion] = useState<number | null>(null);
  const [scanLog, setScanLog] = useState<
    { code: string; result: string; lineId?: string }[]
  >([]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [receiptEvidence, setReceiptEvidence] = useState<ReceiptEvidence | null>(null);
  const postKeyRef = useRef<string | null>(null);
  const canCreate = useInboundPermission(P.INBOUND_CREATE);
  const canScan = useInboundPermission(P.INBOUND_SCAN);
  const canPost = useInboundPermission(P.INBOUND_POST);
  const canCancel = useInboundPermission(P.INBOUND_CANCEL);

  const detail = detailQuery.data;
  const skuRows = skuQuery.data?.data ?? [];
  const skuById = useMemo(
    () => new Map<string, SkuRecord>(skuRows.map((sku) => [sku.sku_id, sku])),
    [skuRows],
  );

  useEffect(() => {
    if (!detail) return;
    setScanVersion(detail.document.version);
    const selected = detail.lines.find((line) => line.id === lineId && line.scanned < line.expected);
    if (!selected) {
      setLineId(detail.lines.find((line) => line.scanned < line.expected)?.id ?? "");
    }
  }, [detail, lineId]);

  const selectedLine = detail?.lines.find((line) => line.id === lineId);
  const selectedSku = selectedLine ? skuById.get(selectedLine.productId) : undefined;
  const totalExpected = detail?.lines.reduce((sum, line) => sum + line.expected, 0) ?? 0;
  const totalScanned = detail?.lines.reduce((sum, line) => sum + line.scanned, 0) ?? 0;
  const isFullScan = Boolean(
    detail &&
      detail.lines.length > 0 &&
      detail.lines.every((line) => line.scanned === line.expected),
  );
  const isMutable = detail?.document.status === "DRAFT" || detail?.document.status === "SCANNING";
  const includeCodeValue = Boolean(
    selectedSku?.sku_type === "PRODUCT" || selectedSku?.is_serial_tracked,
  );

  const handleScan = async () => {
    const code = scanCode.trim();
    if (!documentId || !detail || !lineId || !code || scanVersion === null) return;
    try {
      const result = await scanMutation.mutateAsync({
        id: documentId,
        code,
        lineId,
        ifMatch: scanVersion,
        includeCodeValue,
      });
      const first = result[0];
      setScanVersion(first.version);
      setScanLog((current) => [
        { code, result: "Hợp lệ", lineId: first.line_id },
        ...current,
      ]);
      setScanCode("");
      await detailQuery.refetch();
    } catch (error) {
      const errorText = getApiErrorMessage(error, "Scan không hợp lệ.");
      setScanLog((current) => [{ code, result: errorText, lineId }, ...current]);
      message.error(errorText);
      await detailQuery.refetch();
    }
  };

  const handlePost = async () => {
    if (!documentId || !detail || scanVersion === null || !isFullScan) return;
    const idempotencyKey = postKeyRef.current ?? makeKey(`post-receipt-${documentId}`);
    postKeyRef.current = idempotencyKey;
    try {
      const evidence = await postMutation.mutateAsync({
        documentId,
        idempotencyKey,
        ifMatch: scanVersion,
      });
      postKeyRef.current = null;
      setReceiptEvidence(evidence);
      message.success("Post Receipt thành công, tồn kho đã tăng trên backend.");
      await detailQuery.refetch();
    } catch (error) {
      message.error(getApiErrorMessage(error, "Không Post Receipt được."));
    }
  };

  const handleCancel = async () => {
    if (!documentId || !detail || scanVersion === null || !cancelReason.trim()) return;
    try {
      await cancelMutation.mutateAsync({
        id: documentId,
        reason: cancelReason.trim(),
        ifMatch: scanVersion,
      });
      message.success("Đã hủy phiếu nhập trên backend.");
      setCancelOpen(false);
      navigate(goUrl("IN-01"));
    } catch (error) {
      message.error(getApiErrorMessage(error, "Không hủy được phiếu nhập."));
    }
  };

  if (!documentId) {
    return (
      <div className="card">
        <div className="section-title">Chọn phiếu nhập để quét</div>
        <select
          className="select"
          defaultValue=""
          onChange={(event) => {
            if (event.target.value) navigate(goUrl("IN-03", event.target.value));
          }}
        >
          <option value="">Chọn phiếu DRAFT / SCANNING</option>
          {(listQuery.data ?? [])
            .filter((row) => row.status === "DRAFT" || row.status === "SCANNING")
            .map((row) => (
              <option key={row.id} value={row.id}>
                {row.code} · {row.source}
              </option>
            ))}
        </select>
      </div>
    );
  }

  if (detailQuery.isLoading || !detail) {
    return (
      <div className="card">
        {detailQuery.isError
          ? getApiErrorMessage(detailQuery.error, "Không tải được phiếu nhập.")
          : "Đang tải phiếu nhập..."}
      </div>
    );
  }

  return (
    <>
      <div className="stats">
        <div className="stat">
          <div className="n">{totalScanned}</div>
          <div className="l">Đã scan</div>
        </div>
        <div className="stat">
          <div className="n">{totalExpected}</div>
          <div className="l">Số lượng cần nhận</div>
        </div>
        <div className="stat">
          <div className="n">{detail.document.version}</div>
          <div className="l">Version backend</div>
        </div>
        <div className="stat">
          <div className="n">{detail.document.status}</div>
          <div className="l">Trạng thái</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="section-title">Quét hàng · {detail.document.code}</div>
          <div className="field">
            <label>Dòng nhận *</label>
            <select
              className="select"
              value={lineId}
              disabled={!isMutable || scanMutation.isPending}
              onChange={(event) => setLineId(event.target.value)}
            >
              <option value="">Chọn dòng</option>
              {detail.lines.map((line) => {
                const sku = skuById.get(line.productId);
                return (
                  <option key={line.id} value={line.id} disabled={line.scanned >= line.expected}>
                    {sku?.sku_code ?? line.productId} · {line.scanned}/{line.expected}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="toolbar-wrap">
            <input
              className="input search"
              value={scanCode}
              disabled={!canScan || !isMutable || !lineId || scanMutation.isPending}
              placeholder={
                includeCodeValue
                  ? "Quét Barcode / QR của item"
                  : "Quét / nhập mã để ghi nhận 1 đơn vị"
              }
              onChange={(event) => setScanCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleScan();
              }}
            />
            <button
              className="btn primary"
              disabled={!canScan || !isMutable || !lineId || !scanCode.trim() || scanMutation.isPending}
              onClick={() => void handleScan()}
            >
              {scanMutation.isPending ? "Đang scan..." : "Ghi nhận scan"}
            </button>
          </div>
          {selectedLine && (
            <>
              <div className="muted" style={{ marginTop: 10 }}>
                {selectedSku?.sku_code ?? selectedLine.productId}: <b>{selectedLine.scanned} / {selectedLine.expected}</b>
              </div>
              <div className="progress" style={{ marginTop: 8 }}>
                <span
                  style={{
                    width: `${Math.min(100, (selectedLine.scanned / Math.max(selectedLine.expected, 1)) * 100)}%`,
                  }}
                />
              </div>
            </>
          )}
        </div>

        <div className="card soft">
          <div className="section-title">Điều kiện Post Receipt</div>
          <div className="rule">
            <span
              className="dot"
              style={{ background: isFullScan ? "#16a34a" : "#d97706" }}
            />
            <span>
              {isFullScan
                ? "Tất cả dòng đã scan đủ chính xác."
                : `Còn ${Math.max(totalExpected - totalScanned, 0)} đơn vị chưa scan.`}
            </span>
          </div>
          <div className="rule">
            <span className="dot" style={{ background: "#16a34a" }} />
            <span>Scan chỉ ghi evidence, stock_effect=NONE.</span>
          </div>
          <div className="rule">
            <span className="dot" style={{ background: "#16a34a" }} />
            <span>Post dùng If-Match + Idempotency-Key và tăng tồn đúng một lần.</span>
          </div>
          {receiptEvidence && (
            <div className="footer-note">
              Request: <b>{receiptEvidence.requestId}</b><br />
              Movement: {receiptEvidence.movementRefs.join(", ")}
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
              <th>Expected</th>
              <th>Đã scan</th>
              <th>Còn lại</th>
              <th>Kết quả</th>
            </tr>
          </thead>
          <tbody>
            {detail.lines.map((line) => {
              const sku = skuById.get(line.productId);
              return (
                <tr key={line.id}>
                  <td>{sku?.sku_code ?? line.productId}</td>
                  <td>{sku?.sku_name ?? "-"}</td>
                  <td>{line.expected}</td>
                  <td>{line.scanned}</td>
                  <td>{Math.max(line.expected - line.scanned, 0)}</td>
                  <td>
                    <span className={`pill ${line.scanned === line.expected ? "ok" : "warn-pill"}`}>
                      {line.scanned === line.expected ? "ĐỦ" : "CHƯA ĐỦ"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {scanLog.length > 0 && (
        <div className="footer-note">
          Phiên scan hiện tại: {scanLog.slice(0, 5).map((row) => `${row.code}: ${row.result}`).join(" · ")}
        </div>
      )}

      <div className="toolbar" style={{ marginTop: 16 }}>
        <button className="btn" onClick={() => navigate(goUrl("IN-01"))}>
          Quay lại danh sách
        </button>
        {canCreate && detail.document.status === "DRAFT" && (
          <button className="btn" onClick={() => navigate(goUrl("IN-02", documentId))}>
            Sửa phiếu
          </button>
        )}
        <div className="spacer" />
        {canCancel && isMutable && (
          <button className="btn danger" onClick={() => setCancelOpen(true)}>
            Hủy phiếu
          </button>
        )}
        <button
          className="btn success"
          disabled={
            !canPost ||
            !isFullScan ||
            detail.document.status !== "SCANNING" ||
            postMutation.isPending
          }
          onClick={() => void handlePost()}
        >
          {postMutation.isPending ? "Đang Post..." : "Post Receipt toàn bộ"}
        </button>
      </div>

      <Modal
        title="Hủy phiếu nhập"
        open={cancelOpen}
        okText="Xác nhận hủy"
        cancelText="Đóng"
        okButtonProps={{ danger: true, disabled: !cancelReason.trim() }}
        confirmLoading={cancelMutation.isPending}
        onCancel={() => setCancelOpen(false)}
        onOk={() => void handleCancel()}
        getContainer={false}
      >
        <Input.TextArea
          value={cancelReason}
          onChange={(event) => setCancelReason(event.target.value)}
          rows={4}
          placeholder="Lý do hủy *"
        />
      </Modal>
    </>
  );
}

export function InboundSourceScreen({ screenId }: Props) {
  if (screenId === "IN-02") return <InboundDraftScreen />;
  if (screenId === "IN-03") return <InboundScanScreen />;
  return <InboundListScreen />;
}

export default InboundSourceScreen;
