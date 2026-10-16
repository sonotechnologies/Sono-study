const ANIMALS = [
  "owl", "fox", "otter", "heron", "lynx", "panda", "falcon", "gecko",
  "koala", "hare", "ibis", "jaguar", "kudu", "lemur", "okapi", "pelican",
];

/** Stable "Anonymous owl"-style name for a user id. */
export function anonymousName(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return `Anonymous ${ANIMALS[h % ANIMALS.length]}`;
}

export function publicName(user: { id: string; handle: string | null; anonymous: boolean }): string {
  if (user.anonymous || !user.handle) return anonymousName(user.id);
  return `@${user.handle}`;
}

/** 3–20 chars: letters, digits, dots and underscores; starts and ends with a letter or digit. */
export const HANDLE_PATTERN = /^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$/;

/** Lowercases and strips "@"; returns null when the handle is not allowed. */
export function normaliseHandle(raw: string): string | null {
  const h = raw.trim().replace(/^@/, "").toLowerCase();
  return HANDLE_PATTERN.test(h) ? h : null;
}
