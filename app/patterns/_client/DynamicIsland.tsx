"use client";
import dynamic from "next/dynamic";

const Inner = dynamic(() => import("./ClientIsland"), { ssr: false, loading: () => <div>loading client</div> });

export default function DynamicIsland() {
  return <Inner />;
}