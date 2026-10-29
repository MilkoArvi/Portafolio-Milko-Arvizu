import type { Metadata } from "next";
import type { Locale } from "@/config/site";
import { bySlug } from "@/data/projects";
import { homeHref, projectHref } from "./i18n";

// Metadatos de cada página con su versión en el otro idioma, para que los buscadores las relacionen.

export const homeMetadata = (l: Locale): Metadata => ({
  alternates: { canonical: homeHref(l), languages: { "es-MX": homeHref("es"), en: homeHref("en") } },
});

export const projectMetadata = (slug: string, l: Locale): Metadata => {
  const p = bySlug(slug, l)!;
  return {
    title: p.title,
    description: p.summary,
    alternates: { canonical: projectHref(l, slug), languages: { "es-MX": projectHref("es", slug), en: projectHref("en", slug) } },
  };
};
