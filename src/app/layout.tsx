import type { Metadata, Viewport } from "next";
import "@fontsource-variable/funnel-display";
import "@fontsource-variable/funnel-sans";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { profile } from "@/data/profile";
import { Providers } from "@/components/Providers";
import { THEME_SCRIPT } from "@/components/Theme";

export const metadata: Metadata = {
  metadataBase: new URL(profile.url),
  title: { default: `${profile.name} · Front-end creativo`, template: `%s · ${profile.name}` },
  description: profile.summary,
  openGraph: { title: `${profile.name} · Front-end creativo`, description: profile.summary, type: "website", locale: "es_MX" },
};

export const viewport: Viewport = { themeColor: "#131814", colorScheme: "light dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // el tema y el idioma se fijan en <head> antes de pintar; por eso <html> puede diferir al hidratar
    <html lang="es-MX" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
