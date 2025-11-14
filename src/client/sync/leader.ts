let bc: BroadcastChannel | null = null;
let leader = false;
export async function awaitLeadership() {
  if (typeof window === "undefined") return;
  bc = new BroadcastChannel("sync_leader");
  const id = Math.random().toString(16).slice(2);
  leader = true;
  bc.onmessage = (ev) => { if (ev.data === "ping" && leader) { leader = false; } };
}
export function isLeader() { return leader; }