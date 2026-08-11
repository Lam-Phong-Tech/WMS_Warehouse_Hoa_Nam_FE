import { useEffect, useMemo, useRef, useState } from "react";
import { Input, InputNumber, Modal, message } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getApiErrorMessage } from "@/shared/api/api-error";
import { ROUTES } from "@/shared/constants/routes";
import { hasAnyWmsPermission, WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";
import { useAuthStore } from "@/shared/store/auth.store";
import { useMvpSkus } from "@/modules/master-data/hooks/use-mvp-master";
import type { SkuRecord } from "@/modules/master-data/types/mvp-master.types";
import {
  useCancelInbound,
  useInboundDetail,
  useInboundDocuments,
  usePostInboundReceipt,
  useRegisterInboundBox,
  useScanInbound,
} from "@/modules/inbound/hooks/use-inbound";
import type { ReceiptEvidence } from "@/modules/receiving/types";

type ScreenId = "IN-01" | "IN-02" | "IN-03";
type Props = { screenId: ScreenId };
function makeKey(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
}
function goUrl(screen: ScreenId, id?: string) {
  const params = new URLSearchParams({ screen });
  if (id) params.set("id", id);
  return `${ROUTES.INBOUND}?${params.toString()}`;
}
function useInboundPermission(code: string) {
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  return hasAnyWmsPermission(permissionCodes, [code], isSuperAdmin);
}

function InboundScanScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get("id");
  const listQuery = useInboundDocuments({ per_page: 100 });
  const detailQuery = useInboundDetail(documentId);
  const skuQuery = useMvpSkus({ status: "ACTIVE", per_page: 100 });
  const registerBoxMutation = useRegisterInboundBox();
  const scanMutation = useScanInbound();
  const postMutation = usePostInboundReceipt();
  const cancelMutation = useCancelInbound();
  const [lineId, setLineId] = useState("");
  const [scanCode, setScanCode] = useState("");
  const [boxCode, setBoxCode] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [scanVersion, setScanVersion] = useState<number | null>(null);
  const [scanLog, setScanLog] = useState<{ code: string; result: string; lineId?: string }[]>([]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [receiptEvidence, setReceiptEvidence] = useState<ReceiptEvidence | null>(null);
  const postKeyRef = useRef<string | null>(null);
  const canScan = useInboundPermission(P.INBOUND_SCAN);
  const canPost = useInboundPermission(P.INBOUND_POST);
  const canCancel = useInboundPermission(P.INBOUND_CANCEL);

  const detail = detailQuery.data;
  const skuRows = skuQuery.data?.data ?? [];
  const skuById = useMemo(() => new Map<string, SkuRecord>(skuRows.map((sku) => [sku.sku_id, sku])), [skuRows]);

  useEffect(() => {
    if (!detail) return;
    setScanVersion(detail.document.version);
    const selected = detail.lines.find((line) => line.id === lineId && line.scanned < line.expected);
    if (!selected) setLineId(detail.lines.find((line) => line.scanned < line.expected)?.id ?? "");
  }, [detail, lineId]);

  const selectedLine = detail?.lines.find((line) => line.id === lineId);
  const selectedSku = selectedLine ? skuById.get(selectedLine.productId) : undefined;
  const remaining = selectedLine ? Math.max(selectedLine.expected - selectedLine.scanned, 0) : 0;
  const isComponent = selectedSku?.sku_type === "COMPONENT";
  const isSerialTracked = Boolean(selectedSku?.is_serial_tracked);
  const totalExpected = detail?.lines.reduce((sum, line) => sum + line.expected, 0) ?? 0;
  const totalScanned = detail?.lines.reduce((sum, line) => sum + line.scanned, 0) ?? 0;
  const isFullScan = Boolean(detail?.lines.length && detail.lines.every((line) => line.scanned === line.expected));
  const isMutable = detail?.document.status === "DRAFT" || detail?.document.status === "SCANNING";
  const busy = scanMutation.isPending || registerBoxMutation.isPending;

  useEffect(() => {
    if (isSerialTracked) setQuantity(1);
    else setQuantity(Math.max(1, Math.min(remaining || 1, quantity)));
  }, [lineId, isSerialTracked, remaining]);

  const handleScan = async () => {
    if (!documentId || !detail || !selectedLine || !selectedSku || scanVersion === null || !canScan) return;
    const normalizedBox = boxCode.trim();
    const normalizedCode = scanCode.trim();
    const scanQuantity = isSerialTracked || !isComponent ? 1 : Math.max(1, Math.min(Number(quantity) || 1, remaining));
    if (isComponent && !normalizedBox) {
      message.error("SKU COMPONENT bắt buộc quét/nhập mã BOX trước khi ghi nhận.");
      return;
    }
    if ((!isComponent || isSerialTracked) && !normalizedCode) {
      message.error("Mã barcode/serial là bắt buộc cho dòng này.");
      return;
    }
    try {
      let containerId: string | undefined;
      if (isComponent) {
        const box = await registerBoxMutation.mutateAsync({ id: documentId, lineId: selectedLine.id, boxCode: normalizedBox });
        if (box.stock_effect !== "NONE" || box.movement_created !== false) throw new Error("Đăng ký BOX không được làm thay đổi tồn kho.");
        containerId = box.container_id;
      }
      const logicalCode = normalizedCode || normalizedBox;
      const result = await scanMutation.mutateAsync({
        id: documentId,
        code: logicalCode,
        lineId: selectedLine.id,
        ifMatch: scanVersion,
        includeCodeValue: !isComponent || isSerialTracked,
        quantity: scanQuantity,
        containerId,
      });
      const first = result[0];
      setScanVersion(first.version);
      setScanLog((current) => [{ code: logicalCode, result: `Hợp lệ · +${scanQuantity}`, lineId: first.line_id }, ...current]);
      setScanCode("");
      if (!isSerialTracked) setQuantity(1);
      await detailQuery.refetch();
    } catch (error) {
      const errorText = getApiErrorMessage(error, "Scan không hợp lệ.");
      setScanLog((current) => [{ code: scanCode.trim() || boxCode.trim(), result: errorText, lineId: selectedLine.id }, ...current]);
      message.error(errorText);
      await detailQuery.refetch();
    }
  };

  const handlePost = async () => {
    if (!documentId || !detail || scanVersion === null || !isFullScan || !canPost) return;
    const idempotencyKey = postKeyRef.current ?? makeKey(`post-receipt-${documentId}`);
    postKeyRef.current = idempotencyKey;
    try {
      const evidence = await postMutation.mutateAsync({ documentId, idempotencyKey, ifMatch: scanVersion });
      postKeyRef.current = null;
      setReceiptEvidence(evidence);
      message.success("Post Receipt thành công. Tồn tăng đúng một lần; BOX linh kiện chuyển sang luồng Putaway.");
      await detailQuery.refetch();
    } catch (error) {
      message.error(getApiErrorMessage(error, "Không Post Receipt được."));
    }
  };

  const handleCancel = async () => {
    if (!documentId || !detail || scanVersion === null || !cancelReason.trim()) return;
    try {
      await cancelMutation.mutateAsync({ id: documentId, reason: cancelReason.trim(), ifMatch: scanVersion });
      message.success("Đã hủy phiếu nhập.");
      navigate(goUrl("IN-01"));
    } catch (error) {
      message.error(getApiErrorMessage(error, "Không hủy được phiếu nhập."));
    }
  };

  if (!documentId) {
    return <div className="card"><div className="section-title">Chọn phiếu nhập để quét</div><select className="select" defaultValue="" onChange={(e) => e.target.value && navigate(goUrl("IN-03", e.target.value))}><option value="">Chọn DRAFT / SCANNING</option>{(listQuery.data ?? []).filter((row) => row.status === "DRAFT" || row.status === "SCANNING").map((row) => <option key={row.id} value={row.id}>{row.code} · {row.source}</option>)}</select></div>;
  }
  if (detailQuery.isLoading || !detail) {
    return <div className="card">{detailQuery.isError ? getApiErrorMessage(detailQuery.error, "Không tải được phiếu nhập.") : "Đang tải phiếu nhập..."}</div>;
  }

  return <>
    <div className="stats">
      <div className="stat"><div className="n">{totalScanned}</div><div className="l">Đã scan</div></div>
      <div className="stat"><div className="n">{totalExpected}</div><div className="l">Expected</div></div>
      <div className="stat"><div className="n">{detail.document.version}</div><div className="l">Version</div></div>
      <div className="stat"><div className="n">{detail.document.status}</div><div className="l">Trạng thái</div></div>
    </div>
    <div className="grid-2">
      <div className="card">
        <div className="section-title">IN-03 · Quét & Full Post Receipt · {detail.document.code}</div>
        <div className="field"><label>Dòng nhận *</label><select className="select" value={lineId} disabled={!isMutable || busy} onChange={(e) => setLineId(e.target.value)}><option value="">Chọn dòng</option>{detail.lines.map((line) => { const sku = skuById.get(line.productId); return <option key={line.id} value={line.id} disabled={line.scanned >= line.expected}>{sku?.sku_code ?? line.productId} · {line.scanned}/{line.expected}</option>; })}</select></div>
        {isComponent && <div className="field"><label>BOX *</label><Input value={boxCode} disabled={!isMutable || busy} placeholder="Quét / nhập mã BOX chứa đúng một SKU" onChange={(e) => setBoxCode(e.target.value)} /></div>}
        <div className="field"><label>{isComponent && !isSerialTracked ? "Mã scan (không bắt buộc với component quantity)" : "Barcode / Serial *"}</label><Input value={scanCode} disabled={!isMutable || busy} placeholder={isSerialTracked ? "Quét serial" : "Quét barcode / nhập tay fallback"} onChange={(e) => setScanCode(e.target.value)} onPressEnter={() => void handleScan()} /></div>
        {isComponent && !isSerialTracked && <div className="field"><label>Số lượng trong lần nhận *</label><InputNumber min={1} max={Math.max(1, remaining)} value={quantity} onChange={(value) => setQuantity(Number(value ?? 1))} disabled={!isMutable || busy} /></div>}
        <button className="btn primary" disabled={!canScan || !isMutable || !lineId || busy || remaining <= 0} onClick={() => void handleScan()}>{busy ? "Đang ghi nhận..." : "Ghi nhận scan"}</button>
        {selectedLine && <div className="footer-note">{selectedSku?.sku_code ?? selectedLine.productId}: <b>{selectedLine.scanned}/{selectedLine.expected}</b> · {isComponent ? "COMPONENT: BOX bắt buộc, putaway sau Post" : "PRODUCT"}</div>}
      </div>
      <div className="card soft">
        <div className="section-title">Điều kiện Full Post</div>
        <div className="rule"><span className="dot" style={{ background: isFullScan ? "#16a34a" : "#d97706" }} /><span>{isFullScan ? "Tất cả dòng đã scan đủ chính xác." : `Còn ${Math.max(totalExpected-totalScanned,0)} đơn vị.`}</span></div>
        <div className="rule"><span className="dot" /><span>Scan và đăng ký BOX luôn stock_effect=NONE.</span></div>
        <div className="rule"><span className="dot" /><span>Post dùng If-Match + Idempotency-Key, tồn chỉ tăng đúng một lần.</span></div>
        <div className="rule"><span className="dot" /><span>COMPONENT sau Post đi PTW-00/PTW-01; Confirm Putaway không tạo movement.</span></div>
        {receiptEvidence && <div className="footer-note">Request: <b>{receiptEvidence.requestId}</b><br/>Movement: {receiptEvidence.movementRefs.join(", ")}</div>}
      </div>
    </div>
    <div className="table-wrap" style={{ marginTop: 14 }}><table><thead><tr><th>SKU</th><th>Tên</th><th>Expected</th><th>Đã scan</th><th>Còn</th><th>Kết quả</th></tr></thead><tbody>{detail.lines.map((line) => { const sku=skuById.get(line.productId); return <tr key={line.id}><td>{sku?.sku_code ?? line.productId}</td><td>{sku?.sku_name ?? "-"}</td><td>{line.expected}</td><td>{line.scanned}</td><td>{Math.max(line.expected-line.scanned,0)}</td><td><span className={`pill ${line.scanned===line.expected?"ok":"warn-pill"}`}>{line.scanned===line.expected?"ĐỦ":"CHƯA ĐỦ"}</span></td></tr>; })}</tbody></table></div>
    {scanLog.length > 0 && <div className="footer-note">Phiên scan: {scanLog.slice(0,5).map((row) => `${row.code}: ${row.result}`).join(" · ")}</div>}
    <div className="toolbar" style={{ marginTop: 16 }}><button className="btn" onClick={() => navigate(goUrl("IN-01"))}>Quay lại</button><div className="spacer" />{canCancel && isMutable && <button className="btn danger" onClick={() => setCancelOpen(true)}>Hủy phiếu</button>}<button className="btn success" disabled={!canPost || !isFullScan || !isMutable || postMutation.isPending} onClick={() => void handlePost()}>{postMutation.isPending ? "Đang Post..." : "Full Post Receipt"}</button></div>
    <Modal title="Hủy phiếu nhập" open={cancelOpen} onCancel={() => setCancelOpen(false)} onOk={() => void handleCancel()} okButtonProps={{ danger: true, disabled: !cancelReason.trim() }} okText="Hủy phiếu"><Input.TextArea rows={4} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Lý do hủy bắt buộc" /></Modal>
  </>;
}

export function InboundSourceScreen({ screenId }: Props) {
  if (screenId !== "IN-03") return <div className="card">IN-01/IN-02 được render bởi InboundPage theo wireframe.</div>;
  return <InboundScanScreen />;
}
