import { NextResponse, type NextRequest } from "next/server";

/**
 * Optional HTTP Basic Auth for hosted deployments.
 * Enabled only when BASIC_AUTH_USER and BASIC_AUTH_PASSWORD are both set.
 */
export function middleware(req: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASSWORD;
  if (!user || !password) return NextResponse.next();

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const [u, ...rest] = atob(header.slice(6)).split(":");
    if (u === user && rest.join(":") === password) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Smart Store ERP", charset="UTF-8"' },
  });
}

export const config = {
  // /api/integrations/* has its own bearer-token check (n8n can't do the Basic Auth dance)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/integrations|api/mock-pos|api/health).*)"],
};
