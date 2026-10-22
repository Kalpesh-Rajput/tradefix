"use client";

import { Camera, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import { useAuth } from "@/components/providers/AuthProvider";
import { AvatarCropDialog } from "@/components/settings/AvatarCropDialog";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { AVATAR_ACCEPTED_TYPES, validateAvatarFile } from "@/lib/image-crop";
import { mediaUrl } from "@/lib/media";

export function AvatarUploader() {
  const { user, loading, uploadAvatar, removeAvatar } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  const uploading = progress !== null;
  const hasPhoto = Boolean(user?.avatar_url);

  function resetInput() {
    if (inputRef.current) inputRef.current.value = "";
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    const problem = validateAvatarFile(file);
    resetInput();
    setFileError(problem);
    if (problem) return;
    setError(null);
    setSelected(file);
  }

  function cancel() {
    if (uploading) return;
    setSelected(null);
    setError(null);
  }

  async function save(cropped: File) {
    setError(null);
    setProgress(0);
    try {
      await uploadAvatar(cropped, setProgress);
      toast.success("Profile photo updated");
      setSelected(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      toast.error("Photo upload failed", message);
    } finally {
      setProgress(null);
    }
  }

  async function remove() {
    if (!hasPhoto || removing) return;
    const ok = await confirm({
      title: "Remove profile photo?",
      description: "Your initials will be shown instead. You can upload a new photo at any time.",
      confirmLabel: "Remove photo",
      tone: "danger",
    });
    if (!ok) return;
    setRemoving(true);
    try {
      await removeAvatar();
      toast.success("Profile photo removed");
    } catch (err) {
      toast.error("Could not remove photo", err instanceof Error ? err.message : undefined);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={removing}
        aria-label={hasPhoto ? "Change profile photo" : "Upload profile photo"}
        className="group relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)] disabled:opacity-60"
        data-testid="avatar-change"
      >
        <Avatar
          src={mediaUrl(user?.avatar_url)}
          name={user?.name}
          email={user?.email}
          size="xl"
          ring="accent"
          loading={loading && !user}
          decorative={false}
          className="transition-transform duration-base group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
        />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Camera className="h-5 w-5 text-white" aria-hidden />
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={AVATAR_ACCEPTED_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">{user?.name || "Trader"}</p>
        <p className="truncate text-xs text-[var(--color-text-tertiary)]">{user?.email}</p>
        <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">PNG, JPG or WEBP, up to 2 MB.</p>
        <p role="alert" aria-live="polite" className="min-h-4 text-[11px] text-destructive">
          {fileError}
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={removing} onClick={() => inputRef.current?.click()}>
            <Camera className="h-3.5 w-3.5" aria-hidden />
            {hasPhoto ? "Change photo" : "Upload photo"}
          </Button>
          {hasPhoto ? (
            <Button type="button" variant="ghost" size="sm" loading={removing} onClick={remove}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      <AvatarCropDialog
        file={selected}
        uploading={uploading}
        progress={progress}
        error={error}
        onCancel={cancel}
        onConfirm={save}
      />
    </div>
  );
}
