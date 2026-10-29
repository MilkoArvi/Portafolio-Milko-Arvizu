import type { Locale } from "@/config/site";

// Español vive en la raíz y en /proyectos; inglés bajo /en y /en/projects.
// Los slugs y las anclas son los mismos en los dos idiomas.

export const localeOf = (path: string): Locale => (/^\/en(?=$|[/?#])/.test(path) ? "en" : "es");
export const otherLocale = (l: Locale): Locale => (l === "es" ? "en" : "es");
export const htmlLang = (l: Locale) => (l === "en" ? "en" : "es-MX");
export const intlLocale = (l: Locale) => (l === "en" ? "en-US" : "es-MX");

export const homeHref = (l: Locale, hash = "") => (l === "en" ? `/en${hash}` : `/${hash}`);
export const projectHref = (l: Locale, slug: string) => (l === "en" ? `/en/projects/${slug}` : `/proyectos/${slug}`);
export const slugOf = (path: string) => path.match(/\/(?:proyectos|projects)\/([^/?#]+)/)?.[1] ?? "";

// La misma página, en el otro idioma.
export const translatedHref = (path: string) => {
  const to = otherLocale(localeOf(path));
  const slug = slugOf(path);
  return slug ? projectHref(to, slug) : homeHref(to);
};
