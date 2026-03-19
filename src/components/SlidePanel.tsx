"use client";

import { useEffect, useState, useCallback } from "react";
import { X } from "lucide-react";

interface SlidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function SlidePanel({ isOpen, onClose, children }: SlidePanelProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isOpen]);

  // Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={`absolute top-0 right-0 h-full w-full md:w-[65%] bg-surface shadow-2xl transition-transform duration-300 ease-in-out ${visible ? "translate-x-0" : "translate-x-full"}`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-surface-secondary hover:bg-surface-tertiary text-ink-secondary hover:text-ink transition-colors"
          title="Close"
        >
          <X size={18} />
        </button>
        <div className="h-full overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
