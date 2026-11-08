import { useAuthStore } from "./auth.store";
function owner() {
  const state = useAuthStore.getState();
  return String(
    state.profile?.user_id ?? state.user?.user_id ?? state.user?.id ?? "",
  );
}
/** UI race guard only. The server remains the authorization boundary. The returned
 * closure is transient; it does not serialize tokens into mutation context/storage.
 * The backend rotates JWT sid during refresh; use the login lifetime instead. */
export function captureAuthOwner(): () => boolean {
  const id = owner();
  const epoch = useAuthStore.getState().authEpoch;
  return () =>
    Boolean(useAuthStore.getState().token) &&
    owner() === id &&
    useAuthStore.getState().authEpoch === epoch;
}
