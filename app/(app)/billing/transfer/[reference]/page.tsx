import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { PaymentSuccessState } from "@/components/account/state-cards";
import { TransferSteps } from "@/components/account/transfer-steps";
import { getPayment } from "@/lib/payments";
import { PASSES } from "@/lib/plans";
import { CLAIM_GRACE_MS, transferAccount, type TransferMethod } from "@/lib/transfers";
import { requireViewer } from "@/lib/viewer";

export const metadata: Metadata = { title: "Pay by transfer" };

/** OPay / PalmPay transfer: account, exact amount, code, then "I've sent it" and confirmation. */
export default async function TransferPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const viewer = await requireViewer();
  const payment = await getPayment(await getDb(), reference);
  if (!payment || payment.userId !== viewer.id || payment.method === "paystack") notFound();
  const method = payment.method as TransferMethod;
  const account = transferAccount(method);
  const amountKobo = payment.transferAmountKobo ?? payment.amountKobo;

  if (payment.status === "success" && viewer.proUntil) {
    return (
      <main className="flex min-h-[calc(100dvh-64px)] flex-col lg:min-h-dvh">
        <PaymentSuccessState variant="screen" passName={PASSES[payment.product].name} proUntil={viewer.proUntil} amountKobo={amountKobo} reference={payment.code ?? payment.reference} receipt={false} />
      </main>
    );
  }

  return (
    <main className="flex min-h-[calc(100dvh-64px)] flex-col gap-5 px-5 pb-5 pt-10 lg:mx-auto lg:min-h-dvh lg:w-[480px] lg:px-0 lg:pt-20">
      <TransferSteps
        reference={payment.reference}
        status={payment.status === "claimed" ? "granted" : payment.status === "pending" ? (payment.claimedAt ? "waiting" : "new") : "closed"}
        passName={PASSES[payment.product].name}
        amountKobo={amountKobo}
        priceKobo={payment.amountKobo}
        code={payment.code!}
        methodName={account?.name ?? method}
        accountNumber={account?.accountNumber ?? null}
        accountName={account?.accountName ?? null}
        proUntil={viewer.effectivePlan === "pro" ? viewer.proUntil!.toISOString() : null}
        graceHours={CLAIM_GRACE_MS / 3600_000}
      />
    </main>
  );
}
