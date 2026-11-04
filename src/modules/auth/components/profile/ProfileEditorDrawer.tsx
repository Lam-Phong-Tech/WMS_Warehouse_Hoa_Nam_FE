import { useEffect, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { UiAlert, UiConfirmDialog, UiDrawer, UiTextField } from "@/shared/ui";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";
import { useT } from "@/shared/i18n/useT";
import { resolveFormErrors } from "@/shared/api/api-error";
import { captureAuthOwner } from "@/shared/store/auth-owner";
import { profileService } from "../../services/profile.service";
import type { MeResponse } from "../../types/me.types";

export function ProfileEditorDrawer({
  profile,
  avatarUrl,
  onClose,
  onSaved,
  onReload,
}: {
  profile: MeResponse;
  avatarUrl?: string;
  onClose: () => void;
  onSaved: (profile: MeResponse) => void | Promise<void>;
  onReload: () => void;
}) {
  const t = useT();
  const [baseline] = useState(profile);
  const [name, setName] = useState(profile.display_name || profile.name);
  const [phone, setPhone] = useState(profile.phone || "");
  const [email, setEmail] = useState(profile.email);
  const [password, setPassword] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [reloadRequested, setReloadRequested] = useState(false);
  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Preview URL follows the selected local file and is revoked on replacement.
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  const dirty =
    name !== (baseline.display_name || baseline.name) ||
    phone !== (baseline.phone || "") ||
    email !== baseline.email ||
    Boolean(photo);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const emailChanged = email.trim() !== baseline.email;
  const mutation = useMutation({
    mutationFn: async () => {
      const changes = {
        display_name: name.trim(),
        phone: phone.trim() || null,
        ...(emailChanged
          ? { email: email.trim(), current_password: password }
          : {}),
      };
      return photo
        ? profileService.uploadAvatar(photo, baseline.version, changes)
        : profileService.updateMe(changes, baseline.version);
    },
  });
  const close = () => {
    if (mutation.isPending) return;
    if (dirty) setDiscard(true);
    else onClose();
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.displayName = t("auth.profile.nameRequired");
    else if (name.trim().length > 255)
      next.displayName = t("auth.profile.nameTooLong");
    if (phone.trim() && !/^0\d{9}$/.test(phone.trim()))
      next.phone = t("auth.profile.phoneInvalid");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 255)
      next.email = t("auth.validation.emailInvalid");
    if (emailChanged && !password)
      next.currentPassword = t("auth.validation.currentPasswordRequired");
    setErrors(next);
    setError("");
    if (Object.keys(next).length) return;
    try {
      const stillCurrent = captureAuthOwner();
      const updated = await mutation.mutateAsync();
      if (!stillCurrent()) return;
      setPassword("");
      await onSaved(updated);
      onClose();
    } catch (cause) {
      if (isAxiosError(cause) && cause.response?.status === 412) {
        setError(t("auth.personal.stale"));
        setStale(true);
        return;
      }
      const resolved = resolveFormErrors(cause, [
        "displayName",
        "phone",
        "email",
        "currentPassword",
      ]);
      setErrors(resolved.fieldErrors);
      setError(resolved.message || t("auth.personal.saveError"));
    }
  };
  return (
    <>
      <UiDrawer
        open
        onClose={close}
        width={640}
        className="hn-personal-drawer"
        slotProps={{ paper: { role: "dialog", "aria-modal": true } }}
        title={
          <span className="hn-personal-drawer-title">
            {t("auth.personal.editProfile")}
            <ActionIconButton
              kind="close"
              label={t("auth.personal.close")}
              onClick={close}
              disabled={mutation.isPending}
            />
          </span>
        }
        actions={
          <div className="hn-personal-actions">
            <ActionButton
              kind="cancel"
              onClick={close}
              disabled={mutation.isPending}
            >
              {t("auth.personal.cancel")}
            </ActionButton>
            <ActionButton
              kind="save"
              type="submit"
              form="personal-profile-form"
              disabled={!dirty || stale}
              loading={mutation.isPending}
            >
              {t("auth.personal.save")}
            </ActionButton>
          </div>
        }
      >
        <form
          id="personal-profile-form"
          onSubmit={submit}
          className="hn-personal-form"
          noValidate
        >
          <div className="hn-personal-avatar-editor">
            {photoUrl || avatarUrl ? (
              <img
                src={photoUrl || avatarUrl}
                alt={t("auth.personal.avatar")}
              />
            ) : (
              <span className="hn-personal-avatar-fallback">
                {name.slice(0, 1).toLocaleUpperCase()}
              </span>
            )}
            <ActionButton
              kind="edit"
              onClick={() => setAvatarOpen(true)}
              disabled={mutation.isPending}
            >
              {t("auth.personal.changeAvatar")}
            </ActionButton>
          </div>
          <UiTextField
            label={t("auth.personal.name")}
            required
            fullWidth
            value={name}
            disabled={mutation.isPending}
            error={Boolean(errors.displayName)}
            helperText={errors.displayName}
            onChange={(event) => setName(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 255 } }}
          />
          <UiTextField
            label={t("auth.personal.email")}
            required
            fullWidth
            type="email"
            value={email}
            disabled={mutation.isPending}
            error={Boolean(errors.email)}
            helperText={errors.email}
            onChange={(event) => setEmail(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 255 } }}
          />
          {emailChanged ? (
            <UiTextField
              label={t("auth.personal.currentPassword")}
              type="password"
              autoComplete="current-password"
              required
              fullWidth
              value={password}
              disabled={mutation.isPending}
              error={Boolean(errors.currentPassword)}
              helperText={
                errors.currentPassword || t("auth.personal.emailReauth")
              }
              onChange={(event) => setPassword(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 128 } }}
            />
          ) : null}
          <UiTextField
            label={t("auth.personal.phone")}
            fullWidth
            value={phone}
            disabled={mutation.isPending}
            error={Boolean(errors.phone)}
            helperText={errors.phone}
            onChange={(event) =>
              setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))
            }
            slotProps={{ htmlInput: { inputMode: "tel", maxLength: 10 } }}
          />
          <UiTextField
            label={t("auth.personal.department")}
            value={
              profile.department?.department_name ||
              profile.department?.name ||
              t("auth.personal.unknown")
            }
            fullWidth
            slotProps={{ htmlInput: { readOnly: true } }}
          />
          <p className="hn-personal-note">{t("auth.personal.managedAccess")}</p>
          {error ? (
            <UiAlert tone="error">
              {error}
              {stale ? (
                <ActionButton
                  kind="refresh"
                  onClick={() => {
                    setReloadRequested(true);
                    setDiscard(true);
                  }}
                >
                  {t("auth.personal.reload")}
                </ActionButton>
              ) : null}
            </UiAlert>
          ) : null}
        </form>
      </UiDrawer>
      {avatarOpen ? (
        <AvatarChooser
          initialUrl={photoUrl || avatarUrl}
          onClose={() => setAvatarOpen(false)}
          onApply={(file) => {
            setPhoto(file);
            setAvatarOpen(false);
          }}
        />
      ) : null}
      <UiConfirmDialog
        open={discard}
        title={t("auth.personal.unsavedTitle")}
        tone="danger"
        confirmText={t("auth.personal.discard")}
        cancelText={t("auth.personal.keepEditing")}
        onConfirm={() => {
          if (reloadRequested) onReload();
          else onClose();
        }}
        onClose={() => setDiscard(false)}
      >
        {t("auth.personal.unsavedBody")}
      </UiConfirmDialog>
    </>
  );
}

function AvatarChooser({
  initialUrl,
  onClose,
  onApply,
}: {
  initialUrl?: string;
  onClose: () => void;
  onApply: (file: File) => void;
}) {
  const t = useT();
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState(initialUrl || "");
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- This preview is derived from a selected file, not from persisted application state.
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  const apply = async () => {
    if (!file) return;
    setPending(true);
    setError("");
    try {
      const image = await createImageBitmap(file);
      const side = Math.min(image.width, image.height) / zoom;
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      canvas
        .getContext("2d")!
        .drawImage(
          image,
          (image.width - side) / 2,
          (image.height - side) / 2,
          side,
          side,
          0,
          0,
          512,
          512,
        );
      image.close();
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) => (value ? resolve(value) : reject(new Error("encode"))),
          "image/jpeg",
          0.9,
        ),
      );
      onApply(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
    } catch {
      setError(t("auth.personal.avatarInvalid"));
    } finally {
      setPending(false);
    }
  };
  return (
    <UiDrawer
      open
      onClose={() => {
        if (!pending) onClose();
      }}
      width={440}
      className="hn-personal-drawer"
      slotProps={{ paper: { role: "dialog", "aria-modal": true } }}
      title={
        <span className="hn-personal-drawer-title">
          {t("auth.personal.changeAvatar")}
          <ActionIconButton
            kind="close"
            label={t("auth.personal.close")}
            onClick={onClose}
            disabled={pending}
          />
        </span>
      }
      actions={
        <div className="hn-personal-actions">
          <ActionButton kind="cancel" onClick={onClose} disabled={pending}>
            {t("auth.personal.cancel")}
          </ActionButton>
          <ActionButton
            kind="save"
            disabled={!file}
            loading={pending}
            onClick={apply}
          >
            {t("auth.personal.apply")}
          </ActionButton>
        </div>
      }
    >
      <p className="hn-personal-muted">{t("auth.personal.avatarHint")}</p>
      <div className="hn-personal-avatar-crop">
        {url ? (
          <img
            src={url}
            alt={t("auth.personal.avatarPreview")}
            style={{ transform: `scale(${zoom})` }}
          />
        ) : (
          <span>{t("auth.personal.avatar")}</span>
        )}
      </div>
      <label className="hn-personal-range-label">
        {t("auth.personal.zoom")}
        <input
          type="range"
          min="1"
          max="3"
          step=".01"
          value={zoom}
          disabled={!file || pending}
          onChange={(event) => setZoom(Number(event.target.value))}
        />
      </label>
      <label className="hn-personal-file-label">
        {t("auth.personal.chooseImage")}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={pending}
          aria-label={t("auth.personal.chooseImage")}
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (!selected) return;
            if (
              !["image/jpeg", "image/png", "image/webp"].includes(
                selected.type,
              ) ||
              selected.size > 2 * 1024 * 1024
            ) {
              setError(t("auth.personal.avatarInvalid"));
              event.target.value = "";
              return;
            }
            setFile(selected);
            setZoom(1);
            setError("");
          }}
        />
      </label>
      {error ? <UiAlert tone="error">{error}</UiAlert> : null}
    </UiDrawer>
  );
}
