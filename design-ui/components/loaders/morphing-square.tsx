"use client";

import { cva } from "class-variance-authority";
import { type HTMLMotionProps, motion } from "motion/react";

import { cn } from "../_utils/cn";

const morphingSquareVariants = cva("flex gap-2 items-center justify-center", {
  variants: {
    messagePlacement: {
      bottom: "flex-col",
      top: "flex-col-reverse",
      right: "flex-row",
      left: "flex-row-reverse",
    },
  },
  defaultVariants: {
    messagePlacement: "bottom",
  },
});

export interface MorphingSquareProps {
  message?: string;
  messagePlacement?: "top" | "bottom" | "left" | "right";
}

export function MorphingSquare({
  className,
  message,
  messagePlacement = "bottom",
  ...props
}: HTMLMotionProps<"div"> & MorphingSquareProps) {
  return (
    <div className={cn(morphingSquareVariants({ messagePlacement }))}>
      <motion.div
        className={cn("h-10 w-10 bg-[#171717]", className)}
        animate={{
          borderRadius: ["6%", "50%", "6%"],
          rotate: [0, 180, 360],
        }}
        transition={{
          duration: 2,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
        {...props}
      />
      {message && <div>{message}</div>}
    </div>
  );
}
