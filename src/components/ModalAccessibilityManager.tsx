"use client";

import { useEffect } from "react";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getDialogRoots() {
  return Array.from(
    document.querySelectorAll<HTMLElement>("[class~='fixed'][class~='inset-0']"),
  ).filter((element) => {
    const hasDialogLayer = Array.from(element.classList).some((className) =>
      /^z-(?:\d+|\[\d+\])$/.test(className),
    );

    return (
      hasDialogLayer &&
      !element.classList.contains("pointer-events-none") &&
      element.getAttribute("role") !== "presentation" &&
      !element.querySelector("[role='dialog']")
    );
  });
}

function getTopDialog() {
  const dialogs = getDialogRoots();

  return dialogs.length > 0 ? dialogs[dialogs.length - 1] : null;
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(focusableSelector),
  ).filter((element) => !element.hasAttribute("hidden") && element.offsetParent !== null);
}

/**
 * Adds progressive accessibility support to the project\'s existing modal roots.
 * It keeps legacy modal APIs untouched while migrations to BottomSheet happen.
 */
export function ModalAccessibilityManager() {
  useEffect(() => {
    let activeDialog: HTMLElement | null = null;
    let returnFocusTo: HTMLElement | null = null;
    let originalBodyOverflow = "";
    let isScrollLocked = false;

    const decorateDialog = (dialog: HTMLElement) => {
      if (!dialog.hasAttribute("role")) dialog.setAttribute("role", "dialog");
      if (!dialog.hasAttribute("aria-modal")) dialog.setAttribute("aria-modal", "true");
      if (!dialog.hasAttribute("tabindex")) dialog.setAttribute("tabindex", "-1");

      if (!dialog.hasAttribute("aria-label") && !dialog.hasAttribute("aria-labelledby")) {
        const title = dialog.querySelector("h1, h2, h3, h4")?.textContent?.trim();
        dialog.setAttribute("aria-label", title || "Janela de diálogo");
      }
    };

    const syncDialogs = () => {
      const dialog = getTopDialog();

      if (dialog) {
        decorateDialog(dialog);

        if (!isScrollLocked) {
          originalBodyOverflow = document.body.style.overflow;
          document.body.style.overflow = "hidden";
          isScrollLocked = true;
        }

        if (activeDialog !== dialog) {
          returnFocusTo = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
          activeDialog = dialog;

          window.requestAnimationFrame(() => {
            if (activeDialog === dialog && !dialog.contains(document.activeElement)) {
              dialog.focus();
            }
          });
        }

        return;
      }

      if (isScrollLocked) {
        document.body.style.overflow = originalBodyOverflow;
        isScrollLocked = false;
      }

      if (activeDialog && returnFocusTo?.isConnected) {
        returnFocusTo.focus();
      }

      activeDialog = null;
      returnFocusTo = null;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const dialog = getTopDialog();
      if (!dialog) return;

      if (event.key === "Escape") {
        const closeButton = dialog.querySelector<HTMLButtonElement>(
          "button[aria-label*='Fechar'], button[title*='Fechar']",
        );
        closeButton?.click();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = getFocusableElements(dialog);
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    const observer = new MutationObserver(syncDialogs);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("keydown", handleKeyDown);
    syncDialogs();

    return () => {
      observer.disconnect();
      window.removeEventListener("keydown", handleKeyDown);

      if (isScrollLocked) document.body.style.overflow = originalBodyOverflow;
    };
  }, []);

  return null;
}
