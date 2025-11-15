"use client";
import { useGlobalStore } from "@client/state/globalStore";
import Dither from "@src/components/background/Dither";
import PixelBlast from "@src/components/background/PixelBlast";
import { AnimatedThemeToggler } from "@src/components/toggler/theme-toggler";

export default function Home() {
  const scheme = useGlobalStore((s) => s.scheme);

  return (
    <div className="w-full h-dvh relative overflow-hidden">
      <div className="absolute right-3 top-3 z-10">
        <AnimatedThemeToggler />
      </div>
      {scheme === "light" && <Dither />}
      {scheme === "dark" && <PixelBlast />}
    </div>
  );
}
