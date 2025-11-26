import { ensureSeed, listUsers } from "@/lib/db/prisma";

export default async function Home() {
  await ensureSeed();
  const users = await listUsers();
  return (
    <main className="p-10">
      <h1 className="text-2xl font-bold mb-4">用户列表</h1>
      <ul>
        {users.map((u: { id: number; name: string | null; email: string }) => (
          <li key={u.id} className="mb-2 p-2 border rounded">
            <p className="font-semibold">{u.name}</p>
            <p className="text-gray-600">{u.email}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
