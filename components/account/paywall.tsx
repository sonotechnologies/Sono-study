"use client";

import { useActionState, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, X } from "lucide-react";
import { startCheckout, startTransferAction, type CheckoutState } from "@/app/(app)/billing/actions";
import { buttonClass } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { weeklyCostNaira } from "@/lib/billing";
import { formatDate, formatNaira } from "@/lib/format";
import { PASSES, PRO_UNLOCKS, type PassProduct } from "@/lib/plans";
import type { TransferMethod } from "@/lib/transfers";

export const PAYWALL_PARAM = "paywall";

/** Href that opens the paywall over the current page. */
export function usePaywallHref() {
  const pathname = usePathname();
  const params = new URLSearchParams(useSearchParams());
  params.set(PAYWALL_PARAM, "1");
  return `${pathname}?${params}`;
}

/**
 * The paywall: bottom sheet on phones, centred 640px modal on desktop.
 * Open state lives in the URL (?paywall=1) so any screen can link to it.
 */
export function Paywall({
  proUntil,
  semesterUntil,
  methods,
}: {
  /** ISO end of current Pro time, or null when on Free. */
  proUntil: string | null;
  /** ISO end date if a Semester Pass is bought now (stacks on current Pro time). */
  semesterUntil: string;
  /** How students can pay: transfers to Sono's OPay / PalmPay, and Paystack when its key is set. */
  methods: { transfers: { method: TransferMethod; name: string }[]; paystack: boolean };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const open = searchParams.get(PAYWALL_PARAM) === "1";
  const [product, setProduct] = useState<PassProduct>("semester");
  const [paystackState, paystackAction, paystackPending] = useActionState<CheckoutState, FormData>(startCheckout, { error: null });
  const [transferState, transferAction, transferPending] = useActionState<CheckoutState, FormData>(startTransferAction, { error: null });
  const error = transferState.error ?? paystackState.error;
  const pending = paystackPending || transferPending;
  const price = formatNaira(PASSES[product].amountKobo);


  function close() {
    const params = new URLSearchParams(searchParams);
    params.delete(PAYWALL_PARAM);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const passes: (typeof PASSES.week & { sub: React.ReactNode; tag?: string })[] = [
    { ...PASSES.week, sub: `${PASSES.week.days} days` },
    { ...PASSES.semester, sub: (
        <>
          Until {formatDate(new Date(semesterUntil), { year: false })} · <span className="hidden lg:inline">about </span>₦
          {weeklyCostNaira("semester")}/wk
        </>
      ), tag: "Best value" },
  ];

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim animate-[fade-in_200ms_ease-out]" />
        <Dialog.Content
          aria-describedby="paywall-sub"
          // Focus the sheet itself rather than the first control, so nothing looks pre-selected.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).focus();
          }}
          className={cn(
            "fixed z-50 flex flex-col bg-surface outline-none",
            // phone: bottom sheet
            "inset-x-0 bottom-0 max-h-[92dvh] gap-4 overflow-y-auto rounded-t-3xl px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3 animate-[sheet-up_220ms_ease-out]",
            // desktop: centred modal
            "lg:inset-auto lg:left-1/2 lg:top-1/2 lg:w-[640px] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:gap-5 lg:rounded-3xl lg:border lg:border-border lg:p-9 lg:animate-[fade-in_200ms_ease-out]",
          )}
        >
          <div aria-hidden className="h-1 w-10 self-center rounded-full bg-border lg:hidden" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <Dialog.Title className="font-display text-[28px] font-bold leading-[1.15] lg:text-[32px]">
                {proUntil ? "Add more Pro time" : "Go Pro before exams"}
              </Dialog.Title>
              <p id="paywall-sub" className="text-[15px] leading-normal text-ink-muted lg:text-base">
                {proUntil
                  ? `You're Pro until ${formatDate(new Date(proUntil))}. A new pass adds on top.`
                  : "One payment. No subscription, no auto-renew."}
              </p>
            </div>
            <Dialog.Close
              aria-label="Close"
              className="hidden size-10 flex-none place-items-center rounded-full bg-surface-2 text-ink hover:bg-border lg:grid"
            >
              <X size={18} aria-hidden />
            </Dialog.Close>
          </div>

          <ul className="grid gap-2 text-[15px] lg:grid-cols-2 lg:gap-x-5 lg:gap-y-2.5">
            {PRO_UNLOCKS.map((u) => (
              <li key={u} className="flex gap-2.5">
                <Check size={18} strokeWidth={2.5} className="mt-0.5 flex-none text-correct" aria-hidden />
                {u}
              </li>
            ))}
          </ul>

          <form action={methods.transfers.length ? transferAction : paystackAction} className="flex flex-col gap-4 lg:gap-5">
            <fieldset className="grid grid-cols-2 gap-2.5 lg:gap-3.5 lg:pt-2">
              <legend className="sr-only">Choose a pass</legend>
              {passes.map((p) => {
                const selected = product === p.product;
                return (
                  <label
                    key={p.product}
                    className={cn(
                      "relative flex cursor-pointer flex-col gap-1 rounded-2xl lg:gap-1.5",
                      "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                      selected ? "border-2 border-accent bg-accent-soft p-[13px] lg:p-[19px]" : "border border-border bg-surface-2 p-3.5 lg:p-5",
                    )}
                  >
                    <input
                      type="radio"
                      name="product"
                      value={p.product}
                      checked={selected}
                      onChange={() => setProduct(p.product)}
                      className="sr-only"
                    />
                    {p.tag && (
                      <span className="absolute -top-[11px] right-2.5 grid h-[22px] place-items-center rounded-full bg-spark px-2 text-[11px] font-bold text-night lg:-top-3 lg:right-4 lg:h-6 lg:px-2.5 lg:text-xs">
                        {p.tag}
                      </span>
                    )}
                    <span className="text-sm font-semibold lg:text-[15px]">{p.name}</span>
                    <span className="font-display text-[28px] font-bold lg:text-4xl">{formatNaira(p.amountKobo)}</span>
                    <span className="text-[13px] text-ink-muted lg:text-sm">{p.sub}</span>
                  </label>
                );
              })}
            </fieldset>
            {error && (
              <p role="alert" className="text-sm text-wrong">
                {error}
              </p>
            )}
            {methods.transfers.length > 0 && (
              <div className={cn("grid gap-2.5", methods.transfers.length > 1 && "grid-cols-2")}>
                {methods.transfers.map((m, i) => (
                  <button
                    key={m.method}
                    type="submit"
                    name="method"
                    value={m.method}
                    disabled={pending}
                    className={buttonClass(i === 0 ? "primary" : "secondary", "lg", "w-full whitespace-nowrap px-3 lg:h-14 lg:text-[17px]")}
                  >
                    Pay with {m.name}
                  </button>
                ))}
              </div>
            )}
            {methods.paystack && (
              <button
                type="submit"
                formAction={paystackAction}
                disabled={pending}
                className={buttonClass(methods.transfers.length ? "ghost" : "primary", methods.transfers.length ? "md" : "lg", "w-full lg:text-[17px]")}
              >
                {paystackPending ? "Opening Paystack…" : `Pay ${price} with Paystack`}
              </button>
            )}
          </form>
          <p className="text-center text-xs text-ink-muted lg:text-[13px]">
            {methods.transfers.length
              ? `Pay ${price} by transfer from your ${methods.transfers.map((m) => m.name).join(" or ")} app. Your pass switches on as soon as you've sent it.`
              : "Card, bank transfer or USSD · secured by Paystack"}
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
