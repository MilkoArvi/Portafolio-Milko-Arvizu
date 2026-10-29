"use client";

import { usePathname } from "next/navigation";
import { localeOf } from "./i18n";

// El idioma sale de la URL: /en es inglés, todo lo demás es español.
export const useLocale = () => localeOf(usePathname() ?? "/");
