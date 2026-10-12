import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fmt } from "@/i18n/config";
import { getI18n, pageTitle } from "@/i18n/server";
import { PageHeader } from "@/components/shared/page-header";
import { MemberForm } from "../../member-form";

export const generateMetadata = () => pageTitle((t) => t.common.edit);
export const dynamic = "force-dynamic";

export default async function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await getI18n();
  const m = await prisma.member.findUnique({ where: { id } });
  if (!m) notFound();
  return (
    <>
      <PageHeader title={fmt(t.members.editTitle, { name: m.name })} description={m.memberNumber} backHref={`/members/${m.id}`} />
      <MemberForm initial={{ id: m.id, name: m.name, phone: m.phone, email: m.email }} />
    </>
  );
}
