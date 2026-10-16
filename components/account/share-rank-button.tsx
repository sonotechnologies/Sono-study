"use client";

import { useState } from "react";

/**
 * Shares a share-card image. Uses the native share sheet with the image
 * (WhatsApp/Instagram status) where supported, otherwise downloads it.
 */
export function ShareImageButton({
  imageUrl,
  fileName = "sono-study.png",
  text,
  className,
  children,
}: {
  imageUrl: string;
  fileName?: string;
  text: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);

  async function share() {
    setBusy(true);
    try {
      const blob = await fetch(imageUrl).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      });
      const file = new File([blob], fileName, { type: "image/png" });
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

/** 1080×1080 challenge rank card. */
export function ShareRankButton({ challengeId, ...rest }: { challengeId: string; text: string; className?: string; children: React.ReactNode }) {
  return <ShareImageButton imageUrl={`/api/share/challenge/${challengeId}`} fileName="sono-study-rank.png" {...rest} />;
}
