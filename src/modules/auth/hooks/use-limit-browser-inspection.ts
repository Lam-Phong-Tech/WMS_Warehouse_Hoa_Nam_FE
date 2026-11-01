import { useEffect } from "react";

/** Discourage casual inspection on the public authentication screens. Browser UI
 * and developer tools remain under the user's control, outside page scripts. */
export function useLimitBrowserInspection() {
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const developerToolsKey = ["i", "j", "c", "k", "e"].includes(key);
      const browserShortcut =
        (event.ctrlKey && event.shiftKey && developerToolsKey) ||
        (event.metaKey && event.altKey && developerToolsKey);
      const viewSource = (event.ctrlKey || event.metaKey) && key === "u";

      if (key === "f12" || browserShortcut || viewSource) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const onContextMenu = (event: MouseEvent) => event.preventDefault();

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("contextmenu", onContextMenu, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("contextmenu", onContextMenu, true);
    };
  }, []);
}
