import { create } from "zustand";
/** Memory only: survive a fail-closed profile revalidation unmount, never persist
 * one-time credentials. Login/logout and explicit acknowledgement erase them. */
export const useMfaRecoveryStore = create<{
  ownerUserId: string | null;
  ownerEpoch: number | null;
  codes: string[] | null;
  put: (userId: string, epoch: number, codes: string[]) => void;
  clear: () => void;
}>((set) => ({
  ownerUserId: null,
  ownerEpoch: null,
  codes: null,
  put: (ownerUserId, ownerEpoch, codes) =>
    set({ ownerUserId, ownerEpoch, codes }),
  clear: () => set({ ownerUserId: null, ownerEpoch: null, codes: null }),
}));
