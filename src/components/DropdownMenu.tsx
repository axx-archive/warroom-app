"use client";

import { useState, useRef, useEffect, ReactNode } from "react";

export interface DropdownMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}

export interface DropdownMenuGroup {
  label?: string;
  items: DropdownMenuItem[];
}

interface DropdownMenuProps {
  trigger: ReactNode;
  groups: DropdownMenuGroup[];
  align?: "left" | "right";
}

export function DropdownMenu({ trigger, groups, align = "right" }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const handleItemClick = (item: DropdownMenuItem) => {
    if (item.disabled) return;
    item.onClick();
    setIsOpen(false);
  };

  return (
    <div className="dropdown">
      <div
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className={isOpen ? "dropdown-trigger--active" : ""}
      >
        {trigger}
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="dropdown-menu"
          style={{
            left: align === "left" ? 0 : "auto",
            right: align === "right" ? 0 : "auto",
          }}
        >
          {groups.map((group, groupIndex) => (
            <div key={groupIndex} className="dropdown-menu__group">
              {group.label && (
                <div className="dropdown-menu__label">{group.label}</div>
              )}
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={`dropdown-menu__item ${item.danger ? "dropdown-menu__item--danger" : ""}`}
                  onClick={() => handleItemClick(item)}
                  disabled={item.disabled}
                >
                  {item.icon && (
                    <span className="w-4 h-4 flex items-center justify-center">
                      {item.icon}
                    </span>
                  )}
                  <span>{item.label}</span>
                  {item.shortcut && (
                    <span className="dropdown-menu__shortcut">{item.shortcut}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Simple trigger button for the dropdown
interface DropdownTriggerButtonProps {
  label?: string;
  icon?: ReactNode;
  showChevron?: boolean;
  isActive?: boolean;
}

export function DropdownTriggerButton({
  label,
  icon,
  showChevron = true,
  isActive = false,
}: DropdownTriggerButtonProps) {
  return (
    <button
      className={`dropdown-trigger ${isActive ? "dropdown-trigger--active" : ""}`}
      type="button"
    >
      {icon && <span className="w-3.5 h-3.5 flex items-center justify-center">{icon}</span>}
      {label && <span>{label}</span>}
      {showChevron && (
        <svg
          className="w-3 h-3 text-[var(--text-ghost)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      )}
    </button>
  );
}

// Overflow menu (three dots) trigger
export function OverflowMenuTrigger() {
  return (
    <button className="overflow-menu-trigger" type="button" title="More actions">
      <svg
        className="w-4 h-4"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="5" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="12" cy="19" r="2" />
      </svg>
    </button>
  );
}
