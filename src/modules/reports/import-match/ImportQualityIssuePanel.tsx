import { useState } from "react";
import { useImportQualityIssues, type ImportQualityIssue } from "./import-quality-api";
import "./import-quality-issues.css";

type Props = { batchId: string; sourceFile: string };

function issueTone(issue: ImportQualityIssue) {
  return issue.severity.toUpperCase() === "WARNING" || issue.code.toUpperCase().includes("DUPLICATE")
    ? "warning"
    : "error";
}

export function ImportQualityIssuePanel({ batchId, sourceFile }: Props) {
  const [page, setPage] = useState(1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const query = useImportQualityIssues(batchId, page);
  const rows = query.data?.rows ?? [];
  const selected = rows[Math.min(selectedIndex, rows.length - 1)];

  return (
    <section className="hn-import-issues" aria-label="Các dòng cần kiểm tra">
      <div className="hn-import-issues__list">
        <div className="hn-import-issues__heading"><h3>Dòng cần kiểm tra</h3><strong>{query.data?.total ?? 0}</strong></div>
        {query.isLoading ? <p role="status">Đang tải dòng lỗi…</p> : null}
        {query.error ? <p role="alert">Không tải được dòng lỗi của đợt nhập. Hãy thử lại.</p> : null}
        {!query.isLoading && !query.error && rows.length === 0 ? <p>Đợt nhập này không có dòng lỗi đã lưu.</p> : null}
        {rows.length > 0 ? (
          <div className="hn-import-issues__table-wrap"><table>
            <thead><tr><th>Dòng nguồn</th><th>Trường</th><th>Vấn đề</th><th>Kết quả</th></tr></thead>
            <tbody>{rows.map((row, index) => <tr key={`${row.rowNo}-${row.field}-${index}`} className={selectedIndex === index ? "is-selected" : ""}>
              <td><button type="button" onClick={() => setSelectedIndex(index)} aria-label={`Dòng ${row.rowNo}: ${row.message}`}><strong>Dòng {row.rowNo}</strong><small>{sourceFile || "Tệp nguồn"}</small></button></td>
              <td>{row.field || "—"}</td><td><strong>{row.message || row.code}</strong><small>{row.code}</small></td>
              <td><span className={`hn-import-issues__badge is-${issueTone(row)}`}>{issueTone(row) === "warning" ? "Chênh lệch" : "Lỗi"}</span></td>
            </tr>)}</tbody>
          </table></div>
        ) : null}
        {(query.data?.lastPage ?? 1) > 1 ? <nav className="hn-import-issues__pages" aria-label="Phân trang dòng lỗi"><button type="button" disabled={page <= 1} onClick={() => { setPage((current) => current - 1); setSelectedIndex(0); }}>‹</button><span>{page} / {query.data?.lastPage}</span><button type="button" disabled={page >= (query.data?.lastPage ?? 1)} onClick={() => { setPage((current) => current + 1); setSelectedIndex(0); }}>›</button></nav> : null}
      </div>
      <aside className="hn-import-issues__detail">
        <h3>Chi tiết dòng cần kiểm tra</h3>
        {selected ? <>
          <div className={`hn-import-issues__callout is-${issueTone(selected)}`}><span>{issueTone(selected) === "warning" ? "Chênh lệch" : "Lỗi"}</span><strong>{selected.message || selected.code}</strong></div>
          <dl><div><dt>Dòng nguồn</dt><dd>Dòng {selected.rowNo} · {sourceFile || "Tệp nguồn"}</dd></div><div><dt>Cột / trường</dt><dd>{selected.field || "—"}</dd></div><div><dt>Giá trị trong tệp</dt><dd>{selected.rawValue || "(Trống)"}</dd></div><div><dt>Quy tắc kiểm tra</dt><dd>{selected.code || "—"}</dd></div></dl>
          <h4>Hướng dẫn xử lý</h4><p>{selected.suggestedAction || "Kiểm tra dữ liệu trong tệp nguồn rồi nhập lại."}</p>
        </> : <p>Chọn một dòng để xem chi tiết.</p>}
      </aside>
    </section>
  );
}
