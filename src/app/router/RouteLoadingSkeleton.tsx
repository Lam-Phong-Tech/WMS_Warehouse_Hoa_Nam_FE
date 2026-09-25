import { useLocation } from "react-router-dom";
import { LoadingSkeleton } from "@/shared/ui/loading/LoadingSkeleton";
import { routeLoadingLayout } from "./route-loading-layout";

/** One layout for the initial route chunk and subsequent data/chart wait. */
export function RouteLoadingSkeleton() {
  const { pathname } = useLocation();
  return <LoadingSkeleton layout={routeLoadingLayout(pathname)} />;
}
