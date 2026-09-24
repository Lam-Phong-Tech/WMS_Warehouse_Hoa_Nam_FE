import { useContext, useSyncExternalStore, type ReactNode } from "react";
import { useActiveRequestCount } from "@/shared/api/request-activity";
import {
  LoadingContext,
  useLoadingParticipant,
} from "@/shared/ui/loading/loading-context";
import type { LoadingSnapshot } from "@/shared/ui/loading/loading-controller";

const noopSubscribe = () => () => {};
const IDLE_SNAPSHOT: LoadingSnapshot = { phase: "ready", initial: false };
const idleSnapshot = () => IDLE_SNAPSHOT;

/**
 * Nối request HTTP trực tiếp (tầng transport axios) vào barrier loading gần nhất.
 *
 * React Query đã được barrier theo dõi qua QueryCache, nhưng một số màn vận hành
 * vẫn gọi service trực tiếp trong effect (ví dụ phát hành mã vật lý). Trong lúc
 * trang còn tải ban đầu (`snapshot.initial`), mỗi request như vậy là một tác vụ
 * chuẩn bị, nên barrier chờ chung với các read đang chạy thay vì công bố trang khi
 * chỉ query đã xong.
 *
 * Sau lần công bố đầu tiên, request HTTP trực tiếp KHÔNG che lại trang: các đợt đọc
 * do người dùng chủ động vẫn do control tự khai báo (`useBeginLoadingBatch`, hoặc
 * `data-action-kind` / `data-loading-batch`). Không đặt timeout, không tạo delay giả
 * và không đổi request hay dữ liệu nghiệp vụ.
 */
export function PageLoadBoundary({ children }: { children: ReactNode }) {
  const controller = useContext(LoadingContext);
  const activeRequests = useActiveRequestCount();
  const snapshot = useSyncExternalStore(
    controller?.subscribe ?? noopSubscribe,
    controller?.getSnapshot ?? idleSnapshot,
    controller?.getSnapshot ?? idleSnapshot,
  );
  useLoadingParticipant(activeRequests > 0 && snapshot.initial);
  return <>{children}</>;
}
