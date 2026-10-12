import { fmt } from "@/i18n/config";
import { getI18n, pageTitle } from "@/i18n/server";
import { MemberList } from "../member-list";

export const generateMetadata = () => pageTitle((t) => t.nav.membersNew);
export const dynamic = "force-dynamic";

export default async function NewMembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t } = await getI18n();
  return (
    <MemberList
      title={t.nav.membersNew}
      description={fmt(t.members.ruleDesc, { rule: t.enums.segmentDesc.NEW })}
      basePath="/members/new-members"
      fixedSegment="NEW"
      searchParams={await searchParams}
    />
  );
}
