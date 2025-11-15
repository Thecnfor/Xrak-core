"use client";
import { useQuery } from "@tanstack/react-query";

export default function Page() {
  const q = useQuery({ queryKey: ["time"], queryFn: async () => {
    const res = await fetch("/patterns/api/time");
    return res.json();
  }});
  return (
    <div className="p-6 space-y-2">
      <h1 className="text-xl">CSR</h1>
      <div>{q.isLoading ? "loading" : String(q.data?.now)}</div>
    </div>
  );
}