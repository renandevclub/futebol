"use client";

import type { KeyboardEvent, ReactNode } from "react";

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  ariaLabel: string;
  className: string;
  id: string;
  onValueChange: (value: T) => void;
  options: readonly SegmentedControlOption<T>[];
  scrollActiveIntoView?: boolean;
  value: T;
  buttonClassName: (option: SegmentedControlOption<T>, isActive: boolean) => string;
}

/**
 * Controle reutilizável para alternar visualizações relacionadas.
 * Mantém a aparência definida por cada tela e centraliza estado ativo,
 * toque, atalhos de teclado e anúncios para leitores de tela.
 */
export function SegmentedControl<T extends string>({
  ariaLabel,
  className,
  id,
  onValueChange,
  options,
  scrollActiveIntoView = false,
  value,
  buttonClassName,
}: SegmentedControlProps<T>) {
  const focusOption = (option: SegmentedControlOption<T>) => {
    window.requestAnimationFrame(() => {
      document.getElementById(`${id}-${option.value}`)?.focus();
    });
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const isPrevious = event.key === "ArrowLeft" || event.key === "ArrowUp";
    const isNext = event.key === "ArrowRight" || event.key === "ArrowDown";
    const isFirst = event.key === "Home";
    const isLast = event.key === "End";

    if (!isPrevious && !isNext && !isFirst && !isLast) return;

    event.preventDefault();
    const nextIndex = isFirst
      ? 0
      : isLast
        ? options.length - 1
        : (index + (isNext ? 1 : -1) + options.length) % options.length;
    const nextOption = options[nextIndex];

    if (!nextOption) return;
    onValueChange(nextOption.value);
    focusOption(nextOption);
  };

  const scrollIntoView = (element: HTMLButtonElement) => {
    if (!scrollActiveIntoView) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    element.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "center",
    });
  };

  return (
    <div role="group" aria-label={ariaLabel} className={className}>
      {options.map((option, index) => {
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            id={`${id}-${option.value}`}
            type="button"
            aria-pressed={isActive}
            onClick={(event) => {
              onValueChange(option.value);
              scrollIntoView(event.currentTarget);
            }}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={buttonClassName(option, isActive)}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
