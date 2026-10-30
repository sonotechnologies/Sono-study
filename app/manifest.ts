import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sono Study",
    short_name: "Sono Study",
    description: "Upload your notes. Practise like the real CBT.",
    start_url: "/home",
    display: "standalone",
    background_color: "#0B0D17",
    theme_color: "#0B0D17",
    id: "/home",
    scope: "/",
    orientation: "portrait",
    categories: ["education"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
