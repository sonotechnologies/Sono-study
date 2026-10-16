import { Suspense } from "react";
import { Sidebar, TabBar } from "@/components/shell/nav";
import { Paywall } from "@/components/account/paywall";
import { extendProUntil } from "@/lib/billing";
import { requireViewer } from "@/lib/viewer";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="min-w-0 flex-1 pb-[calc(64px+env(safe-area-inset-bottom))] lg:pb-0">{children}</div>
      <TabBar />
      <Suspense>
        <Paywall
          proUntil={viewer.effectivePlan === "pro" ? viewer.proUntil!.toISOString() : null}
          semesterUntil={extendProUntil(viewer.proUntil, "semester").toISOString()}
        />
      </Suspense>
    </div>
  );
}
