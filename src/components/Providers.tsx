"use client";
import { MotionConfig } from "motion/react";
import { useEffect } from "react";
import { htmlLang } from "@/lib/i18n";
import { useLocale } from "@/lib/useLocale";
import { TransitionProvider } from "./Transition";

// Al cambiar de idioma sin recargar, <html lang> se actualiza para lectores de pantalla y traductores.
function LangSync() {
  const l = useLocale();
  useEffect(() => { document.documentElement.lang = htmlLang(l); }, [l]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <TransitionProvider>
        <LangSync />
        {children}
      </TransitionProvider>
    </MotionConfig>
  );
}
