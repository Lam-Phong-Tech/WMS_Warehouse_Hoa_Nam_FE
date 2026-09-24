import { UnifiedLoading } from "@/shared/ui/loading/UnifiedLoading";
import { useLoadingParticipant } from "@/shared/ui/loading/loading-context";
/** Route chunks and API data share one loading surface; children remain mounted. */
export function PageSkeleton() {
  useLoadingParticipant(true);
  return <UnifiedLoading minHeight={360} testId="ui-state-loading-skeleton" />;
}
