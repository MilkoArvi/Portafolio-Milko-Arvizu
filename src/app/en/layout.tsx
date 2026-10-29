import type { Metadata } from "next";
import { profileFor } from "@/data/profile";

// Todo lo que vive bajo /en: mismo sitio, metadatos en inglés.
const me = profileFor("en");

export const metadata: Metadata = {
  // absolute: si no, la plantilla del layout raíz se le pega encima y el nombre sale dos veces
  title: { absolute: `${me.name} · Creative front-end`, template: `%s · ${me.name}` },
  description: me.summary,
  openGraph: { title: `${me.name} · Creative front-end`, description: me.summary, type: "website", locale: "en_US" },
};

export default function EnglishLayout({ children }: { children: React.ReactNode }) {
  return children;
}
