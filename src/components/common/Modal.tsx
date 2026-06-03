import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

type ModalProps = {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Hide the default close affordance / disable backdrop+Esc close (e.g. blocking flows). */
  dismissible?: boolean;
  maxWidth?: string; // tailwind max-w-* class
};

export function Modal({
  open,
  onClose,
  title,
  children,
  dismissible = true,
  maxWidth = "max-w-md",
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose?.();
    };
    document.addEventListener("keydown", onKey);
    // Lock body scroll while modal is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, dismissible, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
        onClick={() => dismissible && onClose?.()}
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        className={`animate-fadeIn relative w-full ${maxWidth} rounded-2xl border border-gold-500/40 bg-wine-800 p-6 shadow-2xl`}
      >
        {(title || dismissible) && (
          <div className="mb-4 flex items-start justify-between gap-4">
            {title && <h2 className="font-display text-2xl text-gold">{title}</h2>}
            {dismissible && onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="focus-ring -mr-1 -mt-1 rounded-full p-1 text-white/60 hover:text-white"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
