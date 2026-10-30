"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { claimTransferAction } from "@/app/(app)/billing/actions";
import { buttonClass, ButtonLink } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { formatDate, formatNaira } from "@/lib/format";

type Status = "new" | "granted" | "waiting" | "closed";

function CopyRow({ label, value, display, hint }: { label: string; value: string; display?: string; hint?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex min-h-16 items-center gap-3 border-t border-border py-3 first:border-t-0">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <dt className="text-[13px] text-ink-muted">{label}</dt>
        <dd className="m-0 truncate font-display text-xl font-bold">{display ?? value}</dd>
        {hint && <span className="text-[13px] text-ink-muted">{hint}</span>}
      </div>
      <button
        type="button"
        aria-label={`Copy ${label.toLowerCase()}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            window.prompt(`Copy ${label.toLowerCase()}`, value);
          }
        }}
        className={buttonClass("secondary", "sm", "w-[92px] flex-none")}
      >
        {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
        <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}

export function TransferSteps(props: {
  reference: string;
  status: Status;
  passName: string;
  amountKobo: number;
  /** The pass price; the difference is this payment's unique extra. */
  priceKobo: number;
  code: string;
  methodName: string;
  accountNumber: string | null;
  accountName: string | null;
  proUntil: string | null;
  graceHours: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { status } = props;
  const amount = formatNaira(props.amountKobo);
  const exact = (props.amountKobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 0 });

  // While we wait for the transfer to show up, check every 10 seconds.
  useEffect(() => {
    if (status !== "granted" && status !== "waiting") return;
    const t = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(t);
  }, [status, router]);

  if (status === "closed") {
    return (
      <>
        <h1 className="font-display text-[34px] font-bold leading-[1.05]">We couldn&apos;t find this transfer.</h1>
        <p className="text-base leading-normal text-ink-muted">
          No {amount} transfer with code {props.code} reached our {props.methodName} account, so the pass was switched off. If you did send it,
          email us your receipt and we&apos;ll sort it out.
        </p>
        <div className="mt-auto flex flex-col gap-2">
          <ButtonLink href="/profile?paywall=1" size="lg">
            Start a new payment
          </ButtonLink>
          <ButtonLink href="/home" variant="ghost" size="sm">
            Back to studying
          </ButtonLink>
        </div>
      </>
    );
  }

  if (status === "granted" || status === "waiting") {
    return (
      <>
        <span className="grid size-14 place-items-center rounded-full bg-accent-soft text-accent" aria-hidden>
          <span className="size-3 animate-pulse rounded-full bg-accent" />
        </span>
        <h1 className="font-display text-[34px] font-bold leading-[1.05]">
          {status === "granted" ? `Your ${props.passName} is on.` : "Waiting for your transfer…"}
        </h1>
        <p className="text-base leading-normal text-ink-muted" role="status">
          {status === "granted"
            ? `We're confirming your ${amount} transfer. It usually takes a minute. If it doesn't reach us within ${props.graceHours} hours, the pass switches off.`
            : `Your pass switches on as soon as your ${amount} reaches our ${props.methodName} account. It usually takes a minute. You can leave this screen.`}
        </p>
        <dl className="m-0 flex flex-col gap-2.5 rounded-2xl border border-border bg-surface p-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-muted">Amount</dt>
            <dd className="m-0 font-semibold">{amount}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-muted">Code</dt>
            <dd className="m-0 font-mono">{props.code}</dd>
          </div>
          {props.proUntil && status === "granted" && (
            <div className="flex justify-between">
              <dt className="text-ink-muted">Pro until</dt>
              <dd className="m-0 font-semibold">{formatDate(new Date(props.proUntil))}</dd>
            </div>
          )}
        </dl>
        <div className="mt-auto flex flex-col gap-2">
          <ButtonLink href="/home" size="lg">
            {status === "granted" ? "Start studying" : "Back to studying"}
          </ButtonLink>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-accent">
          {props.passName} · {props.methodName}
        </span>
        <h1 className="font-display text-[34px] font-bold leading-[1.05]">Send exactly {amount}</h1>
        <p className="text-[15px] leading-normal text-ink-muted">
          Open your {props.methodName} app (or any bank app) and transfer to the account below. The extra {formatNaira(props.amountKobo - props.priceKobo)} is
          how we know it&apos;s you, so your pass switches on by itself.
        </p>
      </div>
      {props.accountNumber ? (
        <dl className="m-0 rounded-2xl border border-border bg-surface px-4">
          <CopyRow label="Amount" value={exact.replace(/,/g, "")} display={amount} />
          <CopyRow label="Account number" value={props.accountNumber} hint={`${props.accountName} · ${props.methodName}`} />
          <CopyRow label="Note / remark" value={props.code} hint="Paste it in the transfer note if there's one" />
        </dl>
      ) : (
        <p className="text-wrong">{props.methodName} payments aren&apos;t set up yet.</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-wrong">
          {error}
        </p>
      )}
      <div className="mt-auto flex flex-col gap-2">
        <button
          type="button"
          disabled={pending || !props.accountNumber}
          className={cn(buttonClass("primary", "lg", "w-full"))}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await claimTransferAction(props.reference);
              if (!res.ok) setError(res.error);
              else router.refresh();
            })
          }
        >
          {pending ? "One moment…" : `I've sent ${amount}`}
        </button>
        <ButtonLink href="/profile?paywall=1" variant="ghost" size="sm">
          Choose another way
        </ButtonLink>
      </div>
    </>
  );
}
