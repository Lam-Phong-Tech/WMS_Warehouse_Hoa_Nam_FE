import { useState } from "react";
import { useLanguageStore } from "@/shared/i18n/language.store";
import {
  useImportQualityIssues,
  type ImportQualityIssue,
} from "./import-quality-api";
import "./import-quality-issues.css";

type Props = { batchId: string; sourceFile: string };

function useIssueCopy() {
  const language = useLanguageStore((state) => state.language);
  return (vi: string, en: string, zh: string) =>
    language === "vi" ? vi : language === "zh" ? zh : en;
}

function issueTone(issue: ImportQualityIssue) {
  return issue.severity.toUpperCase() === "WARNING" ||
    issue.code.toUpperCase().includes("DUPLICATE")
    ? "warning"
    : "error";
}

function IssueDetail({
  issue,
  sourceFile,
}: {
  issue: ImportQualityIssue;
  sourceFile: string;
}) {
  const copy = useIssueCopy();
  return (
    <section
      className="hn-import-issues__detail"
      aria-label={copy(
        `Chi tiết dòng ${issue.rowNo}`,
        `Row ${issue.rowNo} details`,
        `第 ${issue.rowNo} 行详情`,
      )}
    >
      <h4>{copy("Chi tiết dòng cần kiểm tra", "Row details to review", "待检查行详情")}</h4>
      <div className={`hn-import-issues__callout is-${issueTone(issue)}`}>
        <span>
          {issueTone(issue) === "warning"
            ? copy("Chênh lệch", "Mismatch", "差异")
            : copy("Lỗi", "Error", "错误")}
        </span>
        <strong>{issue.message || issue.code}</strong>
      </div>
      <dl>
        <div>
          <dt>{copy("Dòng nguồn", "Source row", "源行")}</dt>
          <dd>
            {copy("Dòng", "Row", "行")} {issue.rowNo} ·{" "}
            {sourceFile || copy("Tệp nguồn", "Source file", "源文件")}
          </dd>
        </div>
        <div>
          <dt>{copy("Cột / trường", "Column / field", "列 / 字段")}</dt>
          <dd>{issue.field || "—"}</dd>
        </div>
        <div>
          <dt>{copy("Giá trị trong tệp", "Value in file", "文件中的值")}</dt>
          <dd>{issue.rawValue || copy("(Trống)", "(Empty)", "（空）")}</dd>
        </div>
        <div>
          <dt>{copy("Quy tắc kiểm tra", "Validation rule", "校验规则")}</dt>
          <dd>{issue.code || "—"}</dd>
        </div>
      </dl>
      <h4>{copy("Hướng dẫn xử lý", "How to fix", "处理指引")}</h4>
      <p>
        {issue.suggestedAction ||
          copy(
            "Kiểm tra dữ liệu trong tệp nguồn rồi nhập lại.",
            "Check the source file data and import again.",
            "请检查源文件数据后重新导入。",
          )}
      </p>
    </section>
  );
}

export function ImportQualityIssuePanel({ batchId, sourceFile }: Props) {
  const copy = useIssueCopy();
  const [page, setPage] = useState(1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const query = useImportQualityIssues(batchId, page);
  const rows = query.data?.rows ?? [];
  const activeIndex = Math.min(selectedIndex, rows.length - 1);
  return (
    <section
      className="hn-import-issues"
      aria-label={copy("Các dòng cần kiểm tra", "Rows to review", "待检查行")}
    >
      <div className="hn-import-issues__heading">
        <h3>{copy("Dòng cần kiểm tra", "Rows to review", "待检查行")}</h3>
        <strong>{query.data?.total ?? "—"}</strong>
      </div>
      {query.isLoading ? (
        <p role="status">
          {copy("Đang tải dòng lỗi…", "Loading error rows…", "正在加载错误行…")}
        </p>
      ) : null}
      {query.error ? (
        <p role="alert">
          {copy(
            "Không tải được dòng lỗi của đợt nhập. Hãy thử lại.",
            "Could not load the import error rows. Please try again.",
            "无法加载本次导入的错误行。请重试。",
          )}
        </p>
      ) : null}
      {!query.isLoading && !query.error && rows.length === 0 ? (
        <p>
          {copy(
            "Đợt nhập này không có dòng lỗi đã lưu.",
            "This import has no saved error rows.",
            "本次导入没有已保存的错误行。",
          )}
        </p>
      ) : null}
      {rows.length ? (
        <ol className="hn-import-issues__rows">
          {rows.map((row, index) => (
            <li
              key={`${row.rowNo}-${row.field}-${index}`}
              className={activeIndex === index ? "is-selected" : undefined}
            >
              <button
                type="button"
                className="hn-import-issues__select"
                onClick={() => setSelectedIndex(index)}
                aria-pressed={activeIndex === index}
                aria-label={copy(
                  `Dòng ${row.rowNo}: ${row.message}`,
                  `Row ${row.rowNo}: ${row.message}`,
                  `第 ${row.rowNo} 行：${row.message}`,
                )}
              >
                <span className="hn-import-issues__row-heading">
                  <strong>
                    {copy("Dòng", "Row", "行")} {row.rowNo}
                  </strong>
                  <span
                    className={`hn-import-issues__badge is-${issueTone(row)}`}
                  >
                    {issueTone(row) === "warning"
                      ? copy("Chênh lệch", "Mismatch", "差异")
                      : copy("Lỗi", "Error", "错误")}
                  </span>
                </span>
                <span className="hn-import-issues__message">
                  {row.message || row.code}
                </span>
                <small>{row.field || "—"}</small>
              </button>
              {activeIndex === index ? (
                <IssueDetail issue={row} sourceFile={sourceFile} />
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
      {(query.data?.lastPage ?? 1) > 1 ? (
        <nav
          className="hn-import-issues__pages"
          aria-label={copy(
            "Phân trang dòng lỗi",
            "Error row pagination",
            "错误行分页",
          )}
        >
          <button
            type="button"
            aria-label={copy(
              "Trang dòng lỗi trước",
              "Previous error row page",
              "上一页错误行",
            )}
            disabled={page <= 1}
            onClick={() => {
              setPage((current) => current - 1);
              setSelectedIndex(0);
            }}
          >
            ‹
          </button>
          <span>
            {page} / {query.data?.lastPage}
          </span>
          <button
            type="button"
            aria-label={copy(
              "Trang dòng lỗi sau",
              "Next error row page",
              "下一页错误行",
            )}
            disabled={page >= (query.data?.lastPage ?? 1)}
            onClick={() => {
              setPage((current) => current + 1);
              setSelectedIndex(0);
            }}
          >
            ›
          </button>
        </nav>
      ) : null}
    </section>
  );
}
