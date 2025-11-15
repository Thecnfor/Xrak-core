import DynamicIsland from "../_client/DynamicIsland";

export default function Page() {
  return (
    <div className="p-6 space-y-3">
      <h1 className="text-xl">Combo SSG+CSR</h1>
      <div>ssg</div>
      <DynamicIsland />
    </div>
  );
}