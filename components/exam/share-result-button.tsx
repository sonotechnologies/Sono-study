"use client";

import { ShareImageButton } from "@/components/account/share-rank-button";

/** 1080×1920 "new best" story card. */
export function ShareResultButton({ attemptId, ...rest }: { attemptId: string; text: string; className?: string; children: React.ReactNode }) {
  return <ShareImageButton imageUrl={`/api/share/result/${attemptId}`} fileName="sono-study-new-best.png" {...rest} />;
}
