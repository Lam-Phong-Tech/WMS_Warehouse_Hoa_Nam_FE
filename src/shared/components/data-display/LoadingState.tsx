import { UnifiedLoading } from "@/shared/ui/loading/UnifiedLoading";
import { useLoadingParticipant } from "@/shared/ui/loading/loading-context";
import { UI_STATE, uiStateTestId } from "@/shared/constants/ui-state";
export interface LoadingStateProps { tip?: string; minHeight?: number; testId?: string; }
/** Local preparation joins the nearest page/dialog loading group. */
export function LoadingState({ tip, minHeight = 160, testId }: LoadingStateProps) {
  useLoadingParticipant(true);
  return <UnifiedLoading label={tip} minHeight={minHeight} testId={testId ?? uiStateTestId(UI_STATE.LOADING)} />;
}
