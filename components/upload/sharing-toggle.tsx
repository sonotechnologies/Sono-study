"use client";

import { useState, useTransition } from "react";
import { setUploadSharingAction } from "@/app/(app)/upload/actions";
import { Switch } from "@/components/ui/switch";

/** The contribute toggle, after the upload: questions and flashcards join (or leave) the course bank. Files never do. */
export function SharingToggle({ uploadId, initial, courseCode }: { uploadId: string; initial: boolean; courseCode: string }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-3.5">
      <label htmlFor="share-upload" className="flex flex-1 flex-col gap-1">
        <span className="text-[15px] font-semibold">Share with your class</span>
        <span className="text-[13px] leading-normal text-ink-muted">
          {on ? `These questions are in the ${courseCode} bank for your school. Your file stays private.` : "Only you can practise these. Your file stays private."}
        </span>
      </label>
      <Switch
        id="share-upload"
        checked={on}
        disabled={pending}
        onCheckedChange={(v) => {
          setOn(v);
          start(async () => {
            const res = await setUploadSharingAction(uploadId, v);
            if (!res.ok) setOn(!v);
          });
        }}
      />
    </div>
  );
}
