"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/cn";

/** 48×28 toggle from the design: accent when on, surface-2 + border when off. */
export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative h-7 w-12 flex-none rounded-full border border-border bg-surface-2 transition-colors duration-150",
        "data-[state=checked]:border-accent data-[state=checked]:bg-accent disabled:opacity-60",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "block size-[22px] translate-x-[2px] rounded-full bg-ink-muted transition-transform duration-150",
          "data-[state=checked]:translate-x-[22px] data-[state=checked]:bg-on-accent",
        )}
      />
    </SwitchPrimitive.Root>
  );
}
