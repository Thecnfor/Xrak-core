"use client";

import { useRef } from "react";
import { flushSync } from "react-dom";
import { useGlobalStore } from "@client/state/globalStore";
import { Moon, SunDim } from "lucide-react";

type Props = { className?: string };

export const AnimatedThemeToggler = ({ className }: Props) => {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const scheme = useGlobalStore((s) => s.scheme);
  const setScheme = useGlobalStore((s) => s.setScheme);

  const changeTheme = async () => {
    if (!buttonRef.current) return;
    const next = scheme === "dark" ? "light" : "dark";
    if (!document.startViewTransition) {
      setScheme(next);
      return;
    }
    await document.startViewTransition(() => {
      flushSync(() => setScheme(next));
    }).ready;
    const { top, left, width, height } = buttonRef.current.getBoundingClientRect();
    const y = top + height / 2;
    const x = left + width / 2;
    const right = window.innerWidth - left;
    const bottom = window.innerHeight - top;
    const maxRad = Math.hypot(Math.max(left, right), Math.max(top, bottom));
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${maxRad}px at ${x}px ${y}px)`] },
      { duration: 400, easing: "ease-in-out", pseudoElement: "::view-transition-new(root)" }
    );
  };

  return (
    <button
      ref={buttonRef}
      onClick={changeTheme}
      className={`text-[var(--color-btn)] hover:text-[var(--color-text)] transition-colors duration-400 p-1 rounded-md active:scale-95 transform transition-transform cursor-pointer ${className ?? ""}`}
      aria-label={scheme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
    >
      <span className="sr-only">{scheme === "dark" ? "切换到浅色模式" : "切换到深色模式"}</span>
      {scheme === "dark" ? (
        <SunDim size={20} className="transition-transform duration-200" />
      ) : (
        <Moon size={20} className="transition-transform duration-200" />
      )}
    </button>
  );
};
