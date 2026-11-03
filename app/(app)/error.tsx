"use client";

import { ErrorScreen } from "@/components/shell/error-screen";

export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen retry={retry} digest={(error as { digest?: string })?.digest} />;
}
