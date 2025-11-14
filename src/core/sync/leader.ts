import { BroadcastChannel, createLeaderElection } from "broadcast-channel";
const channel = new BroadcastChannel("xrak-sync");
const leader = createLeaderElection(channel);
export async function awaitLeadership() { await leader.awaitLeadership(); }
export function isLeader() { return leader.isLeader; }
export async function stopLeadership() { await channel.close(); }
