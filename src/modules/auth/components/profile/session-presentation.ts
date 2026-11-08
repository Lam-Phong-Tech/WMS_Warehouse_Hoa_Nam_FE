import type { ProfileSession } from "../../types/profile.types";

export function sessionName(session: ProfileSession): string {
  if (session.client_type === "app")
    return /scanner/i.test(session.user_agent || "") ? "App Scanner" : "App";
  const ua = session.user_agent || "";
  if (/Edg\/|EdgiOS\/|EdgA\//i.test(ua)) return "Edge";
  if (/Firefox\/|FxiOS\//i.test(ua)) return "Firefox";
  if (/Chrome\/|CriOS\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua)) return "Safari";
  return session.client_type === "web" ? "Web" : "—";
}
