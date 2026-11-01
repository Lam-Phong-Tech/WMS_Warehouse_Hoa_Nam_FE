import dayjs from "dayjs";
import { useIoHistorySnapshot } from "@/modules/reports/io-history/io-history-api";
import { DashIcon } from "../components/DashIcon";
import { dashboardNow, fmt } from "./overview-data";
import { useT } from "@/shared/i18n/useT";
import "./dashboard-system-views.css";

export function SnapshotRecentTransactions({
  onNavigate,
}: {
  onNavigate: (route: string) => void;
}) {
  const t = useT();
  const now = dashboardNow();
  const source = useIoHistorySnapshot({
    from: now.subtract(6, "day").format("YYYY-MM-DD"),
    to: now.format("YYYY-MM-DD"),
    type: "",
  });
  const documents = source.snapshot.rows.slice(0, 5);

  return (
    <article className="snapshot-card snapshot-recent">
      <header>
        <h2>{t("dashboard.snapshot.recentDocsTitle")}</h2>
        <button
          type="button"
          onClick={() =>
            onNavigate("/dashboard?screen=MAP-01&view=transaction")
          }
        >
          Xem tất cả <DashIcon name="arrow-right" />
        </button>
      </header>
      {source.error && documents.length > 0 ? (
        <div className="snapshot-partial-alert" role="status">
          Giao dịch có thể đã cũ.{" "}
          <button type="button" onClick={() => void source.refetch()}>
            Thử lại
          </button>
        </div>
      ) : null}
      {source.loading ? (
        <div className="snapshot-recent-state" role="status">
          Đang tải giao dịch…
        </div>
      ) : source.error && documents.length === 0 ? (
        <div className="snapshot-recent-state" role="alert">
          Không tải được giao dịch.{" "}
          <button type="button" onClick={() => void source.refetch()}>
            Thử lại
          </button>
        </div>
      ) : documents.length === 0 ? (
        <div className="snapshot-recent-state">
          <strong>Chưa có giao dịch trong 7 ngày gần nhất</strong>
          <span>Tồn kho hiện tại vẫn được giữ theo ảnh chụp mới nhất.</span>
        </div>
      ) : (
        <div className="snapshot-recent-table">
          <table>
            <thead>
              <tr>
                <th>Ghi sổ</th>
                <th>Chứng từ</th>
                <th>Loại</th>
                <th>Đối tác</th>
                <th>Số lượng</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => {
                return (
                  <tr key={document.id}>
                    <td>{dayjs(document.postedAt).format("DD/MM HH:mm")}</td>
                    <td>
                      <strong>{document.documentNo}</strong>
                    </td>
                    <td>
                      {document.type === "INBOUND"
                        ? "Nhập"
                        : document.type === "OUTBOUND"
                          ? "Xuất"
                          : "Hoàn tác"}
                    </td>
                    <td>{document.party || "—"}</td>
                    <td>
                      {document.qty === null
                        ? "—"
                        : `${document.qty > 0 ? "+" : ""}${fmt(document.qty)}`}
                    </td>
                    <td>
                      <button
                        type="button"
                        aria-label={`Xem ${document.documentNo}`}
                        onClick={() =>
                          onNavigate(
                            `/dashboard?screen=MAP-01&view=transaction&document=${encodeURIComponent(document.id)}`,
                          )
                        }
                      >
                        Xem
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
