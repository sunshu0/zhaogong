import { connection } from "next/server";
import { Suspense } from "react";
import { takedownEmail } from "@/config/external-companies";

/** 公司要求删除 (Round 18 draft 3.7): under every external job page, how a company has its jobs taken down. */
export function TakedownNote() {
  return (
    <section aria-labelledby="takedown-heading" className="space-y-1 border-t border-border pt-4 text-meta text-muted">
      <h2 id="takedown-heading" className="font-medium text-foreground">
        公司要求删除
      </h2>
      <p>
        外部职位的信息来自各公司招聘系统公开的职位接口，只列事实，不转载原文，也不代表公司和找工有合作。公司不希望在这里出现，请联系我们，我们当天下架这家公司的全部职位。
      </p>
      <Suspense fallback={<p className="h-5" />}>
        <Address />
      </Suspense>
    </section>
  );
}

async function Address() {
  await connection(); // read at request time, not baked into the build
  const email = takedownEmail();
  return email ? (
    <p>
      邮箱：
      <a href={`mailto:${email}`} className="text-brand underline underline-offset-2">
        {email}
      </a>
      （请写明公司名和职位链接）
    </p>
  ) : (
    <p>联系邮箱上线前公布。</p>
  );
}
