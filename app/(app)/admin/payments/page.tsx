import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { buttonClass } from "@/components/ui/primitives";
import { isAdmin } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { formatNaira, timeAgo } from "@/lib/format";
import { PASSES } from "@/lib/plans";
import { METHOD_NAMES, transferQueue, type TransferMethod } from "@/lib/transfers";
import { requireViewer } from "@/lib/viewer";
import { resolveTransferAction } from "./actions";

export const metadata: Metadata = { title: "Transfers" };

const now = () => new Date();
/** No alert for this long during the day probably means the forwarding phone is off. */
const QUIET_MS = 6 * 3600_000;

const CHIP = {
  claimed: ["On for now", "bg-accent-soft text-ink"],
  pending: ["Waiting for money", "bg-surface-2 text-ink"],
  expired: ["Expired, pass removed", "bg-wrong-soft text-wrong"],
} as const;

/** Admin: transfers the matcher couldn't confirm by itself, and money in that matched nothing. */
export default async function TransfersAdminPage() {
  const viewer = await requireViewer();
  if (!isAdmin(viewer)) notFound();
  const { waiting, unmatched, lastAlertAt } = await transferQueue(await getDb());
  const at = now();
  const quiet = !lastAlertAt || at.getTime() - lastAlertAt.getTime() > QUIET_MS;
  return (
    <main className="mx-auto flex max-w-[860px] flex-col gap-6 px-5 pt-4 pb-8 lg:px-12 lg:py-10">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-[22px] font-bold lg:text-[32px]">Transfers</h1>
        <p className={cn("text-sm", quiet ? "text-wrong" : "text-ink-muted")} role={quiet ? "alert" : undefined}>
          {lastAlertAt ? `Last alert from the phone ${timeAgo(lastAlertAt, at)}.` : "No alerts from the phone yet."}
          {quiet && " Check the forwarding phone is on, online and signed in to OPay and PalmPay."}
        </p>
      </header>

      <section aria-labelledby="waiting" className="flex flex-col gap-3">
        <h2 id="waiting" className="text-base font-semibold">
          Said they paid · {waiting.length}
        </h2>
        {waiting.length === 0 && <p className="text-sm text-ink-muted">Every transfer has been matched.</p>}
        <ul className="flex flex-col gap-3">
          {waiting.map((p) => {
            const [label, tone] = CHIP[p.status as keyof typeof CHIP];
            return (
              <li key={p.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
                  <span className={cn("rounded-full px-2.5 py-1 font-semibold", tone)}>{label}</span>
                  <span>
                    {p.userName ?? "Student"}
                    {p.userEmail ? ` · ${p.userEmail}` : ""} · said paid {timeAgo(p.claimedAt!, at)}
                  </span>
                </div>
                <dl className="m-0 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  {[
                    ["Pass", PASSES[p.product].name],
                    ["To", METHOD_NAMES[p.method as TransferMethod]],
                    ["Amount", formatNaira(p.transferAmountKobo ?? p.amountKobo)],
                    ["Code", p.code],
                  ].map(([k, v]) => (
                    <div key={k} className="flex flex-col">
                      <dt className="text-ink-muted">{k}</dt>
                      <dd className="m-0 font-semibold">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex gap-2">
                  <form action={resolveTransferAction.bind(null, p.id, "confirm")}>
                    <button type="submit" className={buttonClass("secondary", "sm")}>
                      Money arrived · confirm
                    </button>
                  </form>
                  <form action={resolveTransferAction.bind(null, p.id, "reject")}>
                    <button type="submit" className={buttonClass("ghost", "sm", "text-wrong hover:text-wrong")}>
                      Not paid · reject
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="unmatched" className="flex flex-col gap-3">
        <h2 id="unmatched" className="text-base font-semibold">
          Money in that matched no one · {unmatched.length}
        </h2>
        {unmatched.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing unmatched this week.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
            {unmatched.map((a) => (
              <li key={a.id} className="flex flex-col gap-1 p-4 text-sm">
                <span className="font-semibold">
                  {a.amountKobo ? formatNaira(a.amountKobo) : "Amount not found"}
                  {a.senderName ? ` from ${a.senderName}` : ""}
                  <span className="font-normal text-ink-muted"> · {a.source === "unknown" ? "?" : METHOD_NAMES[a.source as TransferMethod]} · {timeAgo(a.receivedAt, at)}</span>
                </span>
                <span className="text-ink-muted">{a.title ? `${a.title}: ` : ""}{a.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
