import { useEffect, useRef } from "react";

// Only the topmost dialog handles focus, so nested confirmations remain usable.
const dialogStack: HTMLElement[] = [];
const focusableSelector = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

export function useDialogFocus<T extends HTMLElement>(isOpen: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const panel = ref.current;
    if (!isOpen || !panel) return;
    const previousFocus = document.activeElement;
    dialogStack.push(panel);
    const focusable = () => Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter(element =>
      !element.closest('[hidden], [inert]') && getComputedStyle(element).display !== "none" && getComputedStyle(element).visibility !== "hidden",
    );
    const initial = panel.querySelector<HTMLElement>('[data-dialog-autofocus]') ?? focusable()[0] ?? panel;
    initial.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (dialogStack.at(-1) !== panel) return;
      if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation(); closeRef.current();
      } else if (event.key === "Tab") {
        const items = focusable();
        const first = items[0] ?? panel;
        const last = items.at(-1) ?? panel;
        if (!panel.contains(document.activeElement) || document.activeElement === panel || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
          event.preventDefault(); (event.shiftKey ? last : first).focus();
        }
      }
    };
    const keepFocus = (event: FocusEvent) => {
      if (dialogStack.at(-1) === panel && event.target instanceof Node && !panel.contains(event.target)) (focusable()[0] ?? panel).focus();
    };
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", keepFocus);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", keepFocus);
      const index = dialogStack.indexOf(panel);
      if (index !== -1) dialogStack.splice(index, 1);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [isOpen]);
  return ref;
}
