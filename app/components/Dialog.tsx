"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/** Backdrop + card shared by every pop-up. Escape, the ✕ and a tap outside
 *  all close it; focus starts on the ✕ so keyboards land somewhere sensible. */
export function Dialog({
  title,
  closeLabel,
  onClose,
  className = "",
  children,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`learning-modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button ref={closeRef} type="button" className="modal-close" onClick={onClose} aria-label={closeLabel}>
          <X size={24} />
        </button>
        <h2 id="modal-title">{title}</h2>
        {children}
      </section>
    </div>
  );
}
