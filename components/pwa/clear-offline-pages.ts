/** Removes pages the service worker saved for offline use (on sign-out, so a shared phone doesn't keep them). */
export async function clearOfflinePages() {
  if (!("caches" in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k.startsWith("sono-pages-")).map((k) => caches.delete(k)));
}
