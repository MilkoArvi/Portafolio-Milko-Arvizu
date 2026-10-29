import type { MetadataRoute } from "next";
import { profile } from "@/data/profile";
import { SLUGS } from "@/data/projects";
import { homeHref, projectHref } from "@/lib/i18n";

// Cada página en los dos idiomas, y cada una sabe cuál es su pareja.
export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => `${profile.url}${path === "/" ? "" : path}`;
  const pair = (es: string, en: string) => [es, en].map((p) => ({ url: url(p), alternates: { languages: { "es-MX": url(es), en: url(en) } } }));
  return [...pair(homeHref("es"), homeHref("en")), ...SLUGS.flatMap((s) => pair(projectHref("es", s), projectHref("en", s)))];
}
