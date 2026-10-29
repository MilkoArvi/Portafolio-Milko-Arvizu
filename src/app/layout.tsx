import type { Metadata, Viewport } from "next";
import "@fontsource-variable/funnel-display";
import "@fontsource-variable/funnel-sans";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { profile } from "@/data/profile";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  metadataBase: new URL(profile.url),
  title: { default: `${profile.name} · Front-end creativo`, template: `%s · ${profile.name}` },
  description: profile.summary,
  openGraph: { title: `${profile.name} · Front-end creativo`, description: profile.summary, type: "website", locale: "es_MX" },
};

export const viewport: Viewport = { themeColor: "#131814", colorScheme: "light" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" data-scroll-behavior="smooth">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
