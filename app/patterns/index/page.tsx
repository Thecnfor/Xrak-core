import Link from "next/link";

export default function Page() {
  const items = [
    ["SSR", "/patterns/ssr"],
    ["SSR-Stream", "/patterns/ssr-stream"],
    ["SSR-Edge", "/patterns/ssr-edge"],
    ["ISR", "/patterns/isr"],
    ["ISR-Tag", "/patterns/isr-tag"],
    ["SSG", "/patterns/ssg"],
    ["SSG Dynamic", "/patterns/ssg/a"],
    ["CSR", "/patterns/csr"],
    ["Combo SSR+CSR", "/patterns/combo-ssr-csr"],
    ["Combo SSG+CSR", "/patterns/combo-ssg-csr"],
    ["Combo ISR+CSR", "/patterns/combo-isr-csr"],
  ];
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl">Patterns</h1>
      <ul className="space-y-2">
        {items.map(([label, href]) => (
          <li key={href}>
            <Link className="text-blue-600" href={href as string}>{label as string}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}