import Link from "next/link";

export default function JobNotFound() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-12 text-center">
      <h1 className="font-semibold">这个职位不存在或已下架</h1>
      <p className="mt-1 text-sm text-muted">链接可能有误，或者雇主已经关闭了这个职位。</p>
      <Link href="/" className="mt-5 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
        看看其他职位
      </Link>
    </div>
  );
}
