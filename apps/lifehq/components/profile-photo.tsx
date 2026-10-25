"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { Button } from "@lifehq/ui";
export function ProfilePhoto({
  value,
  name,
  onChange,
}: {
  value: string | null;
  name: string;
  onChange: (value: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function choose(file: File) {
    setError("");
    setBusy(true);
    let bitmap: ImageBitmap | undefined;
    try {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 2 * 1024 * 1024
      )
        throw new Error("Choose a JPEG, PNG or WebP image smaller than 2 MB.");
      bitmap = await createImageBitmap(file);
      if (
        !bitmap.width ||
        !bitmap.height ||
        bitmap.width * bitmap.height > 40_000_000
      )
        throw new Error("Choose an image smaller than 40 megapixels.");
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 128;
      const context = canvas.getContext("2d");
      if (!context)
        throw new Error("Your browser could not resize this image.");
      context.fillStyle = "#f7f6f2";
      context.fillRect(0, 0, 128, 128);
      const side = Math.min(bitmap.width, bitmap.height);
      context.drawImage(
        bitmap,
        (bitmap.width - side) / 2,
        (bitmap.height - side) / 2,
        side,
        side,
        0,
        0,
        128,
        128,
      );
      const photo = canvas.toDataURL("image/jpeg", 0.82);
      if (photo.length > 64000)
        throw new Error("Please choose a simpler image.");
      onChange(photo);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "This image could not be opened.",
      );
    } finally {
      bitmap?.close();
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div className="profile-photo-editor">
      <div className="profile-photo-preview">
        {value ? (
          <Image
            src={value}
            alt="Your chosen profile photo"
            width={76}
            height={76}
            unoptimized
          />
        ) : (
          <span aria-hidden="true">{name[0]?.toUpperCase() || "?"}</span>
        )}
      </div>
      <div className="stack compact">
        <div className="row wrap">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {busy ? "Resizing…" : "Choose profile photo"}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => onChange(null)}
            >
              Remove photo
            </Button>
          )}
        </div>
        <p className="subtle">
          JPEG, PNG or WebP, up to 2 MB. Cropped to a square. Save preferences
          to keep it.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
      <input
        type="file"
        ref={input}
        hidden
        accept="image/jpeg,image/png,image/webp"
        aria-label="Profile photo file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void choose(f);
        }}
      />
    </div>
  );
}
