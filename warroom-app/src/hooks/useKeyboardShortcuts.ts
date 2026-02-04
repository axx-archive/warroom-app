"use client";

import { useEffect, useCallback, useRef } from "react";

export interface KeyboardShortcut {
  key: string;
  modifiers?: ("cmd" | "shift" | "alt" | "ctrl")[];
  description: string;
  action: () => void;
  disabled?: boolean;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

/**
 * Format a keyboard shortcut for display
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  if (shortcut.modifiers?.includes("cmd")) {
    parts.push("⌘");
  }
  if (shortcut.modifiers?.includes("ctrl")) {
    parts.push("Ctrl");
  }
  if (shortcut.modifiers?.includes("alt")) {
    parts.push("⌥");
  }
  if (shortcut.modifiers?.includes("shift")) {
    parts.push("⇧");
  }

  // Format the key
  let keyDisplay = shortcut.key.toUpperCase();
  if (shortcut.key === "?") {
    keyDisplay = "?";
  } else if (shortcut.key === " ") {
    keyDisplay = "Space";
  } else if (shortcut.key === "Escape") {
    keyDisplay = "Esc";
  }

  parts.push(keyDisplay);

  return parts.join("");
}

/**
 * Hook for registering keyboard shortcuts
 */
export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
}: UseKeyboardShortcutsOptions): void {
  // Use ref to avoid stale closures
  const shortcutsRef = useRef(shortcuts);

  // Update ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcutsRef.current) {
        if (shortcut.disabled) continue;

        const modifiers = shortcut.modifiers || [];

        // Check if required modifiers are pressed
        const cmdRequired = modifiers.includes("cmd");
        const shiftRequired = modifiers.includes("shift");
        const altRequired = modifiers.includes("alt");
        const ctrlRequired = modifiers.includes("ctrl");

        const cmdPressed = event.metaKey;
        const shiftPressed = event.shiftKey;
        const altPressed = event.altKey;
        const ctrlPressed = event.ctrlKey;

        // Check modifier state matches
        if (cmdRequired !== cmdPressed) continue;
        if (shiftRequired !== shiftPressed) continue;
        if (altRequired !== altPressed) continue;
        if (ctrlRequired !== ctrlPressed) continue;

        // Check key matches (case-insensitive for letters)
        const pressedKey = event.key.toLowerCase();
        const shortcutKey = shortcut.key.toLowerCase();

        if (pressedKey === shortcutKey) {
          event.preventDefault();
          shortcut.action();
          return;
        }
      }
    },
    [enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}

/**
 * Focus a specific lane by index (1-9)
 */
export function createLaneFocusAction(
  laneIds: string[],
  index: number
): () => void {
  return () => {
    if (index >= 0 && index < laneIds.length) {
      const laneId = laneIds[index];
      const laneElement = document.querySelector(
        `[data-lane-id="${laneId}"]`
      ) as HTMLElement;
      if (laneElement) {
        laneElement.scrollIntoView({ behavior: "smooth", block: "center" });
        laneElement.focus();
        // Add a brief highlight effect
        laneElement.classList.add("keyboard-focus-highlight");
        setTimeout(() => {
          laneElement.classList.remove("keyboard-focus-highlight");
        }, 1000);
      }
    }
  };
}
