import { ButtonLink } from "@/components/ui/primitives";

/** Placeholder for screens from later build milestones. */
export function ComingSoon({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex max-w-[720px] flex-col gap-4 px-5 pt-6 lg:px-0 lg:pt-10">
      <h1 className="font-display text-[28px] font-bold lg:text-[40px]">{title}</h1>
      <p className="text-[15px] leading-relaxed text-ink-muted">{body}</p>
      <ButtonLink href="/leaderboard" variant="secondary" className="self-start">
        See the leaderboard
      </ButtonLink>
    </main>
  );
}
