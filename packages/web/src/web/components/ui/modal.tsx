import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export function Modal({ open, onClose, title, children, footer, maxWidth = "max-w-lg" }: ModalProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className={`relative z-10 w-full ${maxWidth} rounded-2xl border border-border bg-card shadow-2xl`}
            initial={{ scale: 0.95, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.97, y: 8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h3 className="font-display text-lg font-semibold">{title}</h3>
              <button
                onClick={onClose}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
            {footer && (
              <div className="flex justify-end gap-3 border-t border-border px-6 py-4">{footer}</div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
