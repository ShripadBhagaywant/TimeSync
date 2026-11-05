import React, { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { ChevronDown } from "lucide-react";
import { CODE_LANGUAGES, DEFAULT_CODE_LANGUAGE } from "./editorFormatting";

interface CodeLanguageSelectProps {
  editor: Editor;
}

export const CodeLanguageSelect: React.FC<CodeLanguageSelectProps> = ({
  editor,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });
  const containerRef = useRef<HTMLLabelElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedLanguage = editor.isActive("codeBlock")
    ? (editor.getAttributes("codeBlock").language as string | undefined) ?? DEFAULT_CODE_LANGUAGE
    : DEFAULT_CODE_LANGUAGE;

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const toggleMenu = () => {
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const menuHeight = 288;
      const top =
        rect.bottom + 8 + menuHeight <= window.innerHeight
          ? rect.bottom + 8
          : Math.max(8, rect.top - menuHeight - 8);
      setMenuPosition({ left: Math.max(8, rect.left), top });
    }
    setIsOpen((open) => !open);
  };

  const handleLanguageChange = (language: string) => {
    setIsOpen(false);
    const chain = editor.chain().focus();
    if (editor.isActive("codeBlock")) {
      chain.updateAttributes("codeBlock", { language }).run();
      return;
    }
    chain.setCodeBlock({ language }).run();
  };

  return (
    <label ref={containerRef} className="relative hidden items-center sm:inline-flex">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleMenu}
        aria-label="Code block language"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="h-8 w-[6.25rem] appearance-none rounded-lg border border-slate-200 bg-white py-0 pl-2.5 pr-7 text-[11px] font-medium text-slate-700 outline-none transition hover:border-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      >
        {CODE_LANGUAGES.find((language) => language.value === selectedLanguage)?.label ??
          "Plain text"}
      </button>
      <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-400" />
      {isOpen && (
        <div
          role="menu"
          className="fixed z-[80] max-h-72 w-[8rem] mt-4 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl"
          style={menuPosition}
        >
          {CODE_LANGUAGES.map((language) => (
            <button
              key={language.value}
              type="button"
              role="menuitem"
              onClick={() => handleLanguageChange(language.value)}
              className={"block w-full rounded px-2.5 py-1.5 text-left text-[11px] font-medium " + (
                selectedLanguage === language.value
                  ? "bg-blue-600 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              )}
            >
              {language.label}
            </button>
          ))}
        </div>
      )}
    </label>
  );
};
