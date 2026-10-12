import { getI18n, pageTitle } from "@/i18n/server";
import { PageHeader } from "@/components/shared/page-header";
import { MemberForm } from "../member-form";

export const generateMetadata = () => pageTitle((t) => t.members.newTitle);

export default async function NewMemberPage() {
  const { t } = await getI18n();
  return (
    <>
      <PageHeader title={t.members.newTitle} description={t.members.newDesc} backHref="/members" />
      <MemberForm initial={{ name: "", phone: "", email: null }} />
    </>
  );
}
