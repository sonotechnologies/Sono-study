import type { Metadata } from "next";
import { getDb } from "@/db";
import { PaymentSuccessState } from "@/components/account/state-cards";
import { ButtonLink } from "@/components/ui/primitives";
import { getPayment } from "@/lib/payments";
import { PASSES } from "@/lib/plans";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Payment" };

export default async function PaymentResultPage({ searchParams }: { searchParams: Promise<{ reference?: string }> }) {
  const { reference } = await searchParams;
  const viewer = await requireViewer();
  const db = await getDb();
  const payment = reference ? await getPayment(db, reference) : null;

  if (payment && payment.userId === viewer.id && payment.status === "success" && viewer.proUntil) {
    return (
      <main className="flex min-h-[calc(100dvh-64px)] flex-col lg:min-h-dvh">
        <PaymentSuccessState
          variant="screen"
          passName={PASSES[payment.product].name}
          proUntil={viewer.proUntil}
          amountKobo={payment.amountKobo}
          reference={payment.reference}
        />
      </main>
    );
  }

  const failed = payment?.status === "failed";
  return (
    <main className="flex min-h-[calc(100dvh-64px)] flex-col gap-5 px-5 pb-5 pt-[72px] lg:mx-auto lg:min-h-dvh lg:max-w-[480px] lg:px-0 lg:pt-24">
      <h1 className="font-display text-[40px] font-bold leading-[1.05]">
        {failed ? "Payment didn't go through." : "Confirming your payment…"}
      </h1>
      <p className="text-base leading-normal text-ink-muted">
        {failed
          ? "You haven't been charged for this attempt. Try again, or use bank transfer or USSD."
          : "Paystack is still confirming it. This usually takes a few seconds. If you were debited, your pass will switch on automatically."}
      </p>
      <div className="mt-auto flex flex-col gap-2">
        {failed ? (
          <ButtonLink href="/profile?paywall=1" size="lg">Try again</ButtonLink>
        ) : (
          <ButtonLink href={`/billing/success?reference=${encodeURIComponent(reference ?? "")}`} size="lg">Check again</ButtonLink>
        )}
        <ButtonLink href="/home" variant="ghost" size="sm">Back to studying</ButtonLink>
      </div>
    </main>
  );
}
