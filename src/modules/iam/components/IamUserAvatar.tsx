import { useState } from "react";
import { useProfileAvatarUrl } from "@/modules/auth/hooks/use-profile-avatar-url";
import { http } from "@/shared/api/http";
import type { IamUser } from "../types/iam.types";

type AvatarUser = Pick<IamUser, "user_id" | "display_name" | "avatar">;
interface Props {
  user: AvatarUser;
  large?: boolean;
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase();
}

function Photo({ user, large }: Props) {
  const url = useProfileAvatarUrl(user.user_id, user.avatar, () =>
    http.downloadBlob(`/users/${encodeURIComponent(user.user_id)}/avatar`),
  );
  const [failedUrl, setFailedUrl] = useState("");
  return (
    <span
      className={`hn-iam-avatar${large ? " hn-iam-avatar-large" : ""}`}
      aria-hidden="true"
    >
      {url && url !== failedUrl ? (
        <img
          src={url}
          alt=""
          onError={() => setFailedUrl(url)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "inherit",
            display: "block",
          }}
        />
      ) : (
        initials(user.display_name)
      )}
    </span>
  );
}

export function IamUserAvatar({ user, large }: Props) {
  return user.avatar ? (
    <Photo user={user} large={large} />
  ) : (
    <span
      className={`hn-iam-avatar${large ? " hn-iam-avatar-large" : ""}`}
      aria-hidden="true"
    >
      {initials(user.display_name)}
    </span>
  );
}
