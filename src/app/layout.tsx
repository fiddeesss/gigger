import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { PWARegister } from "@/components/pwa-register";
import "./globals.css";

const poppins = Poppins({
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PisoQuest — Small quests. Real pesos.",
  description:
    "Do quick tasks, get reviewed by a person, cash out to GCash, Maya or load. 100 pts = ₱1, always.",
  applicationName: "PisoQuest",
  icons: [{ url: "/icon.svg", type: "image/svg+xml" }],
  openGraph: {
    title: "PisoQuest — Small quests. Real pesos.",
    description:
      "Do quick tasks, get reviewed by a person, cash out to GCash, Maya or load. 100 pts = ₱1, always.",
    type: "website",
    siteName: "PisoQuest",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d3b26",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
