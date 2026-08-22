import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PisoQuest — Small quests. Real pesos.",
    short_name: "PisoQuest",
    description:
      "Do quick tasks, get reviewed by a person, cash out to GCash, Maya or load. 100 pts = ₱1, always.",
    start_url: "/quests",
    display: "standalone",
    background_color: "#f2f7f3",
    theme_color: "#0d3b26",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
