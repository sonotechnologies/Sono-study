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
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
