"use client";
import { useQuery } from "@tanstack/react-query";

export default function ClientIsland() {
  const q = useQuery({ queryKey: ["random"], queryFn: async () => {
    const res = await fetch("/patterns/api/random");
    return res.json();
  }});
  return <div>client: {q.isLoading ? "loading" : String(q.data?.value)}</div>;
}