export async function generateStaticParams() {
  return [{ id: "a" }, { id: "b" }];
}

export default function Page({ params }: { params: { id: string } }) {
  return (
    <div className="p-6 space-y-2">
      <h1 className="text-xl">SSG Dynamic</h1>
      <div>id: {params.id}</div>
    </div>
  );
}