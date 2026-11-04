import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { profileService } from "../services/profile.service";
import { profileKeys, type ProfileAvatar } from "../types/profile.types";

/** Private photo: JWT-backed binary request; object URL exists only for this mounted view. */
export function useProfileAvatarUrl(
  userId: string,
  avatar?: ProfileAvatar | null,
) {
  const photo = useQuery({
    queryKey: profileKeys.avatar(userId, avatar?.updated_at),
    queryFn: profileService.getAvatar,
    enabled: Boolean(userId && avatar),
    staleTime: 300000,
    retry: false,
  });
  const owner = `${userId}:${avatar?.updated_at || ""}`;
  const hasAvatar = Boolean(avatar);
  const [view, setView] = useState<{
    owner: string;
    blob: Blob;
    url: string;
  } | null>(null);
  useEffect(() => {
    if (!photo.data || !hasAvatar) return;
    const next = URL.createObjectURL(photo.data);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Object URL follows the authenticated binary response and is revoked on replacement.
    setView({ owner, blob: photo.data, url: next });
    return () => URL.revokeObjectURL(next);
  }, [photo.data, owner, hasAvatar]);
  return avatar &&
    photo.isSuccess &&
    view?.owner === owner &&
    view.blob === photo.data
    ? view.url
    : "";
}
