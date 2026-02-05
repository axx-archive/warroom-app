"use client";

import { useEffect, useRef } from "react";
import { KeyboardShortcut, formatShortcut } from "@/hooks/useKeyboardShortcuts";

interface KeyboardShortcutsModalProps {
  shortcuts: KeyboardShortcut[];
  onClose: () => void;
}

export function KeyboardShortcutsModal({
  shortcuts,
  onClose,
}: KeyboardShortcutsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    // Add delay to prevent immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // Group shortcuts by category based on modifiers
  const globalShortcuts = shortcuts.filter(
    (s) => !s.modifiers || s.modifiers.length === 0
  );
  const actionShortcuts = shortcuts.filter(
    (s) => s.modifiers && s.modifiers.length > 0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        ref={modalRef}
        className="bg-[var(--surface-secondary)] border border-[var(--border-dim)] rounded-lg shadow-xl max-w-lg w-full mx-4"
        role="dialog"
        aria-labelledby="shortcuts-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-dim)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[var(--cyan-glow)] border border-[var(--cyan-dim)] flex items-center justify-center">
              <svg
                className="w-4 h-4 text-[var(--cyan)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                />
              </svg>
            </div>
            <h2
              id="shortcuts-title"
              className="text-lg font-medium text-[var(--text-primary)]"
            >
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost p-2 text-[var(--text-ghost)] hover:text-[var(--text-secondary)]"
            title="Close (Esc)"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {/* Action shortcuts */}
          {actionShortcuts.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3 uppercase tracking-wider">
                Actions
              </h3>
              <div className="space-y-2">
                {actionShortcuts.map((shortcut, index) => (
                  <ShortcutRow key={index} shortcut={shortcut} />
                ))}
              </div>
            </div>
          )}

          {/* Navigation shortcuts */}
          {globalShortcuts.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3 uppercase tracking-wider">
                Navigation
              </h3>
              <div className="space-y-2">
                {globalShortcuts.map((shortcut, index) => (
                  <ShortcutRow key={index} shortcut={shortcut} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-dim)] bg-[var(--surface-primary)]">
          <p className="text-sm text-[var(--text-ghost)] text-center">
            Press{" "}
            <kbd className="px-1.5 py-0.5 bg-[var(--surface-secondary)] border border-[var(--border-dim)] rounded text-[var(--text-secondary)] font-mono text-xs">
              Esc
            </kbd>{" "}
            to close
          </p>
        </div>
      </div>
    </div>
  );
}

function ShortcutRow({ shortcut }: { shortcut: KeyboardShortcut }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded bg-[var(--surface-primary)] hover:bg-[var(--surface-secondary)] transition-colors">
      <span
        className={`text-sm ${
          shortcut.disabled
            ? "text-[var(--text-ghost)]"
            : "text-[var(--text-primary)]"
        }`}
      >
        {shortcut.description}
      </span>
      <kbd
        className={`px-2 py-1 min-w-[2.5rem] text-center bg-[var(--surface-secondary)] border border-[var(--border-dim)] rounded font-mono text-sm ${
          shortcut.disabled
            ? "text-[var(--text-ghost)]"
            : "text-[var(--cyan)]"
        }`}
      >
        {formatShortcut(shortcut)}
      </kbd>
    </div>
  );
}
