import type { ReactNode } from "react";
import { LoadingSkeleton } from "@/shared/ui/loading/LoadingSkeleton";
import { useLoadingParticipant } from "@/shared/ui/loading/loading-context";

/** The route chunk joins the same group as its API and chart preparation. */
export function PageSkeleton({ children }: { children?: ReactNode }) {
  useLoadingParticipant(true);
  return children ?? <LoadingSkeleton testId="ui-state-loading-skeleton" />;
}
