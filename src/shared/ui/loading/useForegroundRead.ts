import { useContext, useId, useLayoutEffect, useMemo } from "react";
import { LoadingContext } from "./loading-context";
import { createForegroundReadTask } from "./foreground-read";

/** Keep the nearest page/dialog loading until a user-requested read settles. */
export function useForegroundRead() {
  const controller = useContext(LoadingContext);
  const id = useId();
  const task = useMemo(
    () => createForegroundReadTask(controller, id),
    [controller, id],
  );
  useLayoutEffect(() => {
    task.activate();
    return () => task.deactivate();
  }, [task]);
  return task.run;
}
