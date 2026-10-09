"use client";

import * as React from "react";
import { animate, useReducedMotion } from "framer-motion";

type CountUpProps = {
  value: number;
  format: (value: number) => string;
  duration?: number;
  className?: string;
};

/** Chiffre qui défile de 0 à sa valeur à l'affichage (valeur finale immédiate si animations réduites). */
export function CountUp({ value, format, duration = 1.2, className }: CountUpProps) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = React.useState(() => (reduce ? value : 0));

  React.useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplay(latest),
    });
    return () => controls.stop();
  }, [value, duration, reduce]);

  return (
    <span className={className} aria-label={format(value)}>
      <span aria-hidden>{format(Math.round(display))}</span>
    </span>
  );
}
