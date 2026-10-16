import { Check } from "lucide-react";
import { Countdown } from "@/components/account/countdown";
import { CopyLinkButton } from "@/components/account/copy-link-button";
import { ButtonLink, Card, buttonClass } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { formatDate, formatNaira, ordinal } from "@/lib/format";
import { ACTION_NOUN, PASSES, REFERRAL, type LimitedAction } from "@/lib/plans";

/**
 * Queue / limit / payment states. Phone: full screens (3e–3g). Desktop: the
 * same content as inline cards (6d). `variant` picks the type scale.
 */
type Variant = "screen" | "card";

function Shell({ variant, children, className }: { variant: Variant; children: React.ReactNode; className?: string }) {
  return variant === "card" ? (
    <Card className={cn("flex min-h-[480px] flex-col gap-4 p-7", className)}>{children}</Card>
  ) : (
    <div className={cn("flex min-h-full flex-1 flex-col gap-5 px-5 pb-5 pt-[72px] lg:mx-auto lg:w-full lg:max-w-[480px] lg:px-0 lg:pt-24", className)}>
      {children}
    </div>
  );
}

function Headline({ variant, children }: { variant: Variant; children: React.ReactNode }) {
  return (
    <h1 className={cn("font-display font-bold", variant === "card" ? "text-[28px] leading-[1.15]" : "text-[40px] leading-[1.05]")}>
      {children}
    </h1>
  );
}

function Body({ variant, children }: { variant: Variant; children: React.ReactNode }) {
  return <p className={cn("leading-normal text-ink-muted", variant === "card" ? "text-[15px] leading-relaxed" : "text-base")}>{children}</p>;
}

export function QueueBusyState({
  variant,
  etaMinutes,
  place,
  progress,
  savedWhat,
  courseCode,
  cardsDue,
}: {
  variant: Variant;
  etaMinutes: number;
  place: number;
  /** 0–1 through the queue since joining it */
  progress: number;
  savedWhat: string;
  courseCode?: string;
  cardsDue: number;
}) {
  return (
    <Shell variant={variant}>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-flag">Exam week rush</span>
        <Headline variant={variant}>
          Busy right now. Ready in about {etaMinutes} min.
        </Headline>
        <Body variant={variant}>
          {variant === "screen" && courseCode ? `Lots of ${courseCode} students uploading tonight. ` : ""}
          Your {savedWhat} {savedWhat.endsWith("s") ? "are" : "is"} saved and in line.
          {variant === "card" && " We'll notify you."}
        </Body>
      </div>
      <div className={cn("flex flex-col gap-2.5", variant === "screen" && "rounded-2xl border border-border bg-surface p-4")}>
        <div className="flex justify-between text-sm">
          <span className="text-ink-muted">Your place</span>
          <span className="font-display font-bold">
            {ordinal(place)}
            {variant === "screen" && " in line"}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Queue progress"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 rounded-full bg-surface-2"
        >
          <div className="h-full rounded-full bg-flag" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        {variant === "screen" && <span className="text-[13px] text-ink-muted">We&apos;ll notify you. You can close the app.</span>}
      </div>
      <div className="mt-auto flex flex-col gap-2">
        <ButtonLink href="/cards" size={variant === "screen" ? "lg" : "md"}>
          {variant === "screen" ? `Do ${cardsDue} flashcards while you wait` : "Do flashcards while you wait"}
        </ButtonLink>
        <ButtonLink href="?paywall=1" scroll={false} variant="secondary" size={variant === "screen" ? "md" : "sm"}>
          Skip the queue · {variant === "screen" ? `${PASSES.week.name} ` : ""}
          {formatNaira(PASSES.week.amountKobo)}
        </ButtonLink>
      </div>
    </Shell>
  );
}

export function DailyLimitState({
  variant,
  action,
  limit,
  resetsAt,
  referralsDone,
  inviteLink,
  inviteDisplay,
}: {
  variant: Variant;
  action: LimitedAction;
  limit: number;
  resetsAt: Date;
  referralsDone: number;
  inviteLink: string;
  inviteDisplay: string;
}) {
  const noun = ACTION_NOUN[action][limit === 1 ? 0 : 1];
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`I'm prepping for exams on Sono Study — upload notes, get CBT mocks. Join me: ${inviteLink}`)}`;
  const done = Math.min(referralsDone, REFERRAL.invitesNeeded);
  return (
    <Shell variant={variant}>
      <div className="flex flex-col gap-2">
        <Headline variant={variant}>
          That&apos;s today&apos;s {limit} free {noun}.
        </Headline>
        <Body variant={variant}>
          Resets in <Countdown to={resetsAt.toISOString()} format="hms" className="font-display font-bold text-ink" />. Flashcards and
          practice still work.
        </Body>
      </div>
      <div className={cn("flex flex-col gap-3 rounded-2xl p-4", variant === "screen" ? "border border-border bg-surface" : "gap-2 rounded-[12px] bg-surface-2 p-3.5")}>
        <div className="flex flex-col gap-1">
          <span className="text-[15px] font-semibold">
            Invite {REFERRAL.invitesNeeded} classmates, get a free {PASSES.week.name}
          </span>
          <span className="text-[13px] leading-normal text-ink-muted">
            {variant === "screen" && "When they sign up and finish one mock. "}
            {done} of {REFERRAL.invitesNeeded} joined.
          </span>
        </div>
        <div className="flex gap-2">
          <span
            className={cn(
              "flex min-w-0 flex-1 items-center truncate rounded-[12px] px-3 font-mono text-[13px] text-ink-muted",
              variant === "screen" ? "h-11 bg-surface-2" : "h-10 rounded-[10px] bg-surface",
            )}
          >
            {inviteDisplay}
          </span>
          <CopyLinkButton
            value={inviteLink}
            className={cn(
              "grid place-items-center rounded-[12px] px-3.5 text-sm font-semibold",
              variant === "screen" ? "h-11 bg-surface-2" : "h-10 rounded-[10px] bg-surface px-3 text-[13px]",
            )}
          />
        </div>
        {variant === "screen" && (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={buttonClass("outline-correct", "md")}>
            Share on WhatsApp
          </a>
        )}
      </div>
      <div className="mt-auto flex flex-col gap-2">
        <ButtonLink href="?paywall=1" scroll={false} size={variant === "screen" ? "lg" : "md"}>
          Go Pro · from {formatNaira(PASSES.week.amountKobo)}
        </ButtonLink>
        <ButtonLink href="/courses" variant="ghost" size="sm" className={variant === "screen" ? "text-[15px]" : undefined}>
          Practise instead
        </ButtonLink>
      </div>
    </Shell>
  );
}

export function PaymentSuccessState({
  variant,
  passName,
  proUntil,
  amountKobo,
  reference,
}: {
  variant: Variant;
  passName: string;
  proUntil: Date;
  amountKobo: number;
  reference: string;
}) {
  return (
    <Shell variant={variant}>
      <div className={cn("relative", variant === "card" ? "size-14" : "size-[72px]")}>
        <span className="absolute inset-0 grid place-items-center rounded-full bg-spark text-night">
          <Check size={variant === "card" ? 28 : 36} strokeWidth={3} aria-hidden />
        </span>
        {variant === "screen" && (
          <>
            <span aria-hidden className="absolute -right-3.5 -top-1.5 size-2.5 rotate-45 bg-accent animate-[spark-burst_250ms_ease-out_both]" />
            <span aria-hidden className="absolute -left-3 bottom-1 size-[7px] rotate-45 bg-spark animate-[spark-burst_250ms_ease-out_80ms_both]" />
          </>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Headline variant={variant}>You&apos;re on {passName}.</Headline>
        <Body variant={variant}>Active until {formatDate(proUntil)}. Go and cook.</Body>
      </div>
      <dl
        className={cn(
          "flex flex-col gap-2.5 text-sm",
          variant === "screen" ? "rounded-2xl border border-border bg-surface p-4" : "gap-2",
        )}
      >
        <div className="flex justify-between">
          <dt className="text-ink-muted">Paid</dt>
          <dd className="font-semibold">{formatNaira(amountKobo)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">Reference</dt>
          <dd className="truncate font-mono text-[13px]">{reference}</dd>
        </div>
        {variant === "screen" && (
          <div className="flex justify-between">
            <dt className="text-ink-muted">Receipt</dt>
            <dd className="font-semibold text-accent">Sent to email</dd>
          </div>
        )}
      </dl>
      <ButtonLink href="/home" size={variant === "screen" ? "lg" : "md"} className="mt-auto">
        Back to studying
      </ButtonLink>
    </Shell>
  );
}
