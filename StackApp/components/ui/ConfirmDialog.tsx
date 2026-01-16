"use client";

import { useEffect, useCallback } from "react";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "default";
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  isLoading = false,
}: ConfirmDialogProps) {
  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        onClose();
      }
    },
    [onClose, isLoading]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: "🗑️",
      iconBg: "bg-red-500/20",
      confirmBtn: "bg-red-500 hover:bg-red-600 text-white",
      border: "border-red-500/30",
    },
    warning: {
      icon: "⚠️",
      iconBg: "bg-yellow-500/20",
      confirmBtn: "bg-yellow-500 hover:bg-yellow-600 text-black",
      border: "border-yellow-500/30",
    },
    default: {
      icon: "ℹ️",
      iconBg: "bg-pink-500/20",
      confirmBtn: "bg-pink-500 hover:bg-pink-600 text-white",
      border: "border-pink-500/30",
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={!isLoading ? onClose : undefined}
      />

      {/* Dialog */}
      <div
        className={`relative bg-slate-900 border ${styles.border} rounded-xl shadow-2xl max-w-md w-full mx-4 animate-in fade-in zoom-in-95 duration-200`}
      >
        {/* Header */}
        <div className="flex items-center gap-4 p-6 border-b border-slate-700/50">
          <div className={`p-3 rounded-full ${styles.iconBg}`}>
            <span className="text-2xl">{styles.icon}</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-100">{title}</h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-300 whitespace-pre-line">{message}</p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 pt-0">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg bg-slate-700 text-gray-300 hover:bg-slate-600 hover:text-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${styles.confirmBtn}`}
          >
            {isLoading && (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
            {isLoading ? "Deleting..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
