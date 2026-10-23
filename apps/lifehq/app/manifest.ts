import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LifeHQ — Personal Atelier",
    short_name: "LifeHQ",
    description: "A thoughtful space for your days, ideas, and ambitions.",
    start_url: "/workspace",
    display: "standalone",
    background_color: "#faf8f4",
    theme_color: "#9b4935",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
