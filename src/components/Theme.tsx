"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { useLocale } from "@/lib/useLocale";

// Modo claro y oscuro. El tema se decide antes de pintar (ver THEME_SCRIPT en el layout)
// para que nunca se vea el destello del tema equivocado. Al cambiarlo, el nuevo tema se abre
// en un círculo desde el botón.

type Theme = "light" | "dark";
const KEY = "theme";

// Corre en <head> antes que cualquier otra cosa: elige el tema guardado o el del sistema.
export const THEME_SCRIPT = `(function(){try{var d=document.documentElement,t=localStorage.getItem("${KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";d.dataset.theme=t;if(/^\\/en(?=$|[/?#])/.test(location.pathname))d.lang="en";}catch(e){}})();`;

const current = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

function apply(next: Theme) {
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem(KEY, next); } catch { /* sin almacenamiento: dura lo que la pestaña */ }
  window.dispatchEvent(new Event("themechange"));
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const l = useLocale();
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const sync = () => setTheme(current());
    sync();
    // si nadie eligió, el sitio sigue al sistema
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onSystem = () => {
      let saved: string | null = null;
      try { saved = localStorage.getItem(KEY); } catch { /* nada */ }
      if (!saved) { document.documentElement.dataset.theme = mq.matches ? "dark" : "light"; sync(); }
    };
    window.addEventListener("themechange", sync);
    mq.addEventListener("change", onSystem);
    return () => { window.removeEventListener("themechange", sync); mq.removeEventListener("change", onSystem); };
  }, []);

  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const next: Theme = current() === "dark" ? "light" : "dark";
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
    if (!doc.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) { apply(next); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const vt = doc.startViewTransition(() => apply(next));
    vt.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
        { duration: 650, easing: "cubic-bezier(0.16, 1, 0.3, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    }).catch(() => {});
  };

  const dark = theme === "dark";
  const label = l === "en" ? (dark ? "Switch to light mode" : "Switch to dark mode") : dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
  return (
    <button type="button" onClick={toggle} aria-label={label} title={label} className={`relative grid size-7 place-items-center rounded-full transition-colors ${className}`}>
      <motion.svg
        aria-hidden
        viewBox="0 0 24 24"
        className="size-[18px] fill-none stroke-current"
        strokeWidth="2"
        strokeLinecap="round"
        initial={false}
        animate={{ rotate: dark ? 0 : 90 }}
        transition={{ type: "spring", stiffness: 300, damping: 18 }}
      >
        {dark ? (
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
          </>
        )}
      </motion.svg>
    </button>
  );
}
