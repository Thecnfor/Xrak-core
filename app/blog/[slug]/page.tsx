export const revalidate = 60

export default function Page({ params }: { params: { slug: string } }) {
  return <div>博客：{params.slug}</div>
}