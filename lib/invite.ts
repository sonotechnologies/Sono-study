const APP_URL = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://sono.study").replace(/\/$/, "");

export const REFERRAL_COOKIE = "sono_ref";

/** Invite link for a referral code. `display` drops the protocol: "sono.study/i/tolu". */
export function inviteUrl(code: string, opts: { display?: boolean } = {}): string {
  const url = `${APP_URL}/i/${encodeURIComponent(code)}`;
  return opts.display ? url.replace(/^https?:\/\//, "") : url;
}
