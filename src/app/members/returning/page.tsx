import { fmt } from "@/i18n/config";
import { getI18n, pageTitle } from "@/i18n/server";
import { MemberList } from "../member-list";

export const generateMetadata = () => pageTitle((t) => t.nav.membersReturning);
export const dynamic = "force-dynamic";

export default async function ReturningMembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t } = await getI18n();
  return (
    <MemberList
      title={t.nav.membersReturning}
      description={fmt(t.members.ruleDesc, { rule: t.enums.segmentDesc.RETURNING })}
      basePath="/members/returning"
      fixedSegment="RETURNING"
      searchParams={await searchParams}
    />
  );
}
