import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { cookies } from "next/headers";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter", display: "swap" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Sono Study", template: "%s · Sono Study" },
  description: "Upload your notes. Practise like the real CBT. Know exactly what to read next.",
  applicationName: "Sono Study",
  appleWebApp: { capable: true, title: "Sono Study", statusBarStyle: "black-translucent" },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0B0D17" },
    { media: "(prefers-color-scheme: light)", color: "#F6F6FB" },
  ],
  width: "device-width",
  initialScale: 1,
};

/**
 * Static pages (like /offline, served by the service worker) are rendered without cookies,
 * so the theme is also applied on the phone before first paint.
 */
const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )theme=(light|dark)/);if(m)document.documentElement.setAttribute("data-theme",m[1])}catch(e){}})()`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get("theme")?.value === "light" ? "light" : "dark";
  return (
    <html lang="en-NG" data-theme={theme} className={`${inter.variable} ${spaceGrotesk.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
