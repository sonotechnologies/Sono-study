"use client";

/** Last resort when the root layout itself fails: plain styles, since the app's CSS may not have loaded. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en-NG">
      <body style={{ margin: 0, minHeight: "100dvh", background: "#0b0d17", color: "#eef0fa", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ maxWidth: 480, margin: "0 auto", padding: "64px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          <h1 style={{ fontSize: 30, margin: 0 }}>Sono Study didn&apos;t load.</h1>
          <p style={{ color: "#9499b5", lineHeight: 1.6, margin: 0 }}>Check your connection and try again.</p>
          <button type="button" onClick={retry} style={{ height: 52, borderRadius: 12, border: 0, background: "#8b7cff", color: "#0b0d17", fontSize: 16, fontWeight: 600 }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
