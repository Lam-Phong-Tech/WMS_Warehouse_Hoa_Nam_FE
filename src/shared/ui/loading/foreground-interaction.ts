/**
 * Identify reads started synchronously by a local user interaction. Arming is
 * NOT loading: validation-only clicks, saves and exports never block by itself.
 * Only a QueryCache fetch event consumes this evidence; a later polling tick
 * cannot inherit the user's click. Async read handlers use useForegroundRead.
 */
export function createForegroundReadIntent(
  defer: (callback: () => void) => void = queueMicrotask,
) {
  let revision = 0;
  let armed = false;
  return {
    arm() {
      const current = ++revision;
      armed = true;
      defer(() => {
        if (revision === current) armed = false;
      });
    },
    isArmed: () => armed,
    clear() {
      revision += 1;
      armed = false;
    },
  };
}
