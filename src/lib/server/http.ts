import { NextResponse } from "next/server";
import { currentProfile } from "./auth";
import { UserError } from "./league";

export async function requireProfile() {
  const p = await currentProfile();
  if (!p) throw new UserError("Create a profile or log in first", 401);
  return p;
}

/** Wraps a route handler: UserError -> its status + message, anything else -> 500. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A) => {
    try {
      const out = await fn(...args);
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof UserError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error(e);
      return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
    }
  };
}

export async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const j = await req.json();
    return j && typeof j === "object" ? j : {};
  } catch {
    throw new UserError("Invalid request body");
  }
}
