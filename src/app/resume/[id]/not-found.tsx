import Link from "next/link";

export default function SharedResumeNotFound() {
  return (
    <div className="py-12 text-center">
      <h1 className="text-lg font-semibold">这份简历的分享链接已关闭或不存在</h1>
      <p className="mt-1 text-meta text-muted">请向求职者要新的链接。</p>
      <Link href="/jobs" className="mt-4 inline-flex min-h-11 items-center text-sm text-brand underline">
        看看找工上的职位
      </Link>
    </div>
  );
}
