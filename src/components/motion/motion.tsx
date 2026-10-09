"use client";

import * as React from "react";
import { MotionConfig, motion, type HTMLMotionProps } from "framer-motion";

// Animations de l'application : apparitions courtes (≤ 400 ms), sans rebond, désactivées
// automatiquement si l'utilisateur a demandé de réduire les animations (MotionProvider).

const EASE = [0.2, 0, 0, 1] as const;

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

type FadeInProps = HTMLMotionProps<"div"> & {
  delay?: number;
  /** Décalage vertical de départ, en pixels. */
  y?: number;
};

/** Apparition en fondu avec léger glissement vers le haut. */
export function FadeIn({ delay = 0, y = 8, children, ...props }: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
};

/** Conteneur dont les enfants <StaggerItem> apparaissent l'un après l'autre. */
export function Stagger({ children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" {...props}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div variants={staggerItem} {...props}>
      {children}
    </motion.div>
  );
}
