"use client";
import { MotionConfig } from "motion/react";
import { TransitionProvider } from "./Transition";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <TransitionProvider>{children}</TransitionProvider>
    </MotionConfig>
  );
}
