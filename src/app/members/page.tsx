import { getI18n, pageTitle } from "@/i18n/server";
import { MemberList } from "./member-list";

export const generateMetadata = () => pageTitle((t) => t.nav.membersAll);
export const dynamic = "force-dynamic";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t } = await getI18n();
  return (
    <MemberList
      title={t.nav.membersAll}
      description={t.members.allDesc}
      basePath="/members"
      searchParams={await searchParams}
    />
  );
}
