import type { MetadataRoute } from "next";
import { profile } from "@/data/profile";
import { projects } from "@/data/projects";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: profile.url }, ...projects.map((p) => ({ url: `${profile.url}/proyectos/${p.slug}` }))];
}
