"use client";

import { useState } from "react";

/**
 * Shares the 1080×1080 rank card. Uses the native share sheet with the image
 * (WhatsApp/Instagram status) where supported, otherwise downloads the image.
 */
export function ShareRankButton({
  challengeId,
  text,
  className,
  children,
}: {
  challengeId: string;
  text: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const imageUrl = `/api/share/challenge/${challengeId}`;

  async function share() {
    setBusy(true);
    try {
      const blob = await fetch(imageUrl).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      });
      const file = new File([blob], "sono-study-rank.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      if ((err as Error).name !== "AbortError") window.open(imageUrl, "_blank", "noopener");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={share} disabled={busy} className={className}>
      {busy ? "Preparing…" : children}
    </button>
  );
}
