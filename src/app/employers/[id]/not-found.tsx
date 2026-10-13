import Link from "next/link";

export default function EmployerNotFound() {
  return (
    <div className="py-12 text-center">
      <h1 className="text-lg font-semibold">这个雇主不存在或已停用</h1>
      <Link href="/jobs" className="mt-4 inline-flex min-h-11 items-center text-sm text-brand underline">
        看看其他职位
      </Link>
    </div>
  );
}
