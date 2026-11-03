import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

import { AI_OUTPUT_LANGUAGES } from "../utils/outputLanguage";

interface LanguageSelectProps {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export const LanguageSelect: React.FC<LanguageSelectProps> = ({ value, onChange, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node))
        setIsOpen(false);
    };
    const closeMenu = () => setIsOpen(false);
    const closeOnScroll = (event: Event) => { if (!(event.target instanceof Node) || !menuRef.current?.contains(event.target)) setIsOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && isOpen) { setIsOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener("mousedown", closeOnOutsideClick);
    window.addEventListener("resize", closeMenu);
    document.addEventListener("scroll", closeOnScroll, true);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      window.removeEventListener("resize", closeMenu);
      document.removeEventListener("scroll", closeOnScroll, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const toggleMenu = () => {
    if (disabled) return;
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const menuHeight = 170;
      const top =
        rect.bottom + 4 + menuHeight <= window.innerHeight
          ? rect.bottom + 4
          : Math.max(8, rect.top - menuHeight - 4);
      setMenuPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 120)), top });
    }
    setIsOpen((open) => !open);
  };

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={toggleMenu}
        aria-label="AI output language"
        aria-haspopup="menu"
        aria-expanded={isOpen && !disabled}
        className="inline-flex h-8 w-24 items-center justify-between rounded-lg border border-slate-200 bg-slate-50 py-0 pl-2.5 pr-2.5 text-left text-xs font-medium outline-none hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      >
        <span>{value}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>
      {isOpen && !disabled && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-[80] max-h-[calc(100dvh-16px)] overflow-y-auto w-28 rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
          style={menuPosition}
        >
          {AI_OUTPUT_LANGUAGES.map((language) => (
            <button
              key={language}
              type="button"
              role="menuitem"
              onClick={() => {
                onChange(language);
                setIsOpen(false);
              }}
              className={`block w-full rounded px-2.5 py-1.5 text-left text-xs font-medium ${value === language
                ? "bg-blue-600 text-white"
                : "text-slate-700 hover:bg-slate-100"
                }`}
            >
              {language}
            </button>
          ))}
        </div>
      , document.body)}
    </div>
  );
};

