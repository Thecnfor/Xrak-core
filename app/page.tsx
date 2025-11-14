"use client";
import { useGlobalStore } from "../src/client/state/globalStore";
import Dither from "../src/components/background/Dither";
import PixelBlast from "../src/components/background/PixelBlast";

export default function Home() {
  const scheme = useGlobalStore((s) => s.scheme);

  return (
    <div className="w-full h-dvh relative overflow-hidden">
      {scheme && (scheme === "light" ? <Dither /> : <PixelBlast />)}
    </div>
  );
}
