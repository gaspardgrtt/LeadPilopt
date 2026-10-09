"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

type ProgressRingProps = {
  /** Valeur de 0 à 1. */
  value: number;
  size?: number;
  stroke?: number;
  /** Couleur de la piste et de l'arc (classes Tailwind de couleur de trait). */
  trackClassName?: string;
  arcClassName?: string;
  gradientId?: string;
  children?: React.ReactNode;
  className?: string;
};

/** Anneau de progression dont l'arc se dessine à l'affichage. */
export function ProgressRing({
  value,
  size = 160,
  stroke = 12,
  trackClassName = "stroke-white/10",
  arcClassName,
  gradientId,
  children,
  className,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        {gradientId && (
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--primary-light)" />
              <stop offset="100%" stopColor="var(--accent-violet)" />
            </linearGradient>
          </defs>
        )}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className={trackClassName} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={gradientId ? `url(#${gradientId})` : undefined}
          className={arcClassName}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - clamped) }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
