import { Z_INDEX } from "@/shared/ui/tokens";
import { UnifiedLoading } from "@/shared/ui/loading/UnifiedLoading";
import { useLoadingParticipant } from "@/shared/ui/loading/loading-context";
import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";
/** Bootstrap/permission loading keeps its fullscreen scope, using the same visual. */
export function Loading() {
  useLoadingParticipant(true);
  return (
    <div {...uiStateProps(UI_STATE.LOADING, "ui-state-loading-fullscreen")}
      aria-busy="true" style={{ position: "fixed", inset: 0,
        background: "rgba(255, 255, 255, 0.6)", display: "flex", alignItems: "center",
        justifyContent: "center", backdropFilter: "blur(4px)", zIndex: Z_INDEX.blockingLoading }}>
      <UnifiedLoading />
    </div>
  );
}
