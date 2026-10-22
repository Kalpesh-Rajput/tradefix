"use client";

import { MotionConfig } from "framer-motion";

/** App-wide framer-motion policy: transforms are dropped when the OS asks for reduced motion. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
