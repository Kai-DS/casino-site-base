import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "gold" | "felt" | "ghost" | "danger" | "neon";
type Size = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

const VARIANTS: Record<Variant, string> = {
  gold: "bg-gradient-to-b from-gold-400 to-gold-600 text-wine-900 font-bold hover:brightness-110 shadow-gold disabled:from-gold-600/50 disabled:to-gold-600/50",
  felt: "bg-felt-700 text-white hover:bg-felt-600 border border-gold-500/40 shadow-card",
  ghost: "bg-white/5 text-white hover:bg-white/10 border border-white/15",
  danger: "bg-gradient-to-b from-red-500 to-red-700 text-white font-semibold hover:brightness-110",
  neon: "bg-neon-deep text-neon-blue border border-neon-blue/70 shadow-neon hover:bg-neon-deep/80 font-semibold",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-5 py-2.5 text-base rounded-xl",
  lg: "px-8 py-3.5 text-lg rounded-2xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "gold", size = "md", className = "", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`focus-ring inline-flex items-center justify-center gap-2 font-sans transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});
