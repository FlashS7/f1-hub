import { describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ db: () => ({}), fetchAll: async () => [], must: (x: unknown) => x }));
vi.mock("../f1", () => ({ getFeaturedWeekend: async () => ({ weekend: null }) }));

const { dueSessions } = await import("./push");

const s = (key: string, start: string) => ({ key, label: key, start, end: start }) as never;
const sessions = [s("FP1", "2026-10-09T09:30:00.000Z"), s("SQ", "2026-10-09T13:30:00.000Z")];

describe("reminder window", () => {
  it("nothing due 11 minutes before", () => {
    expect(dueSessions(sessions, new Date("2026-10-09T13:19:00Z"))).toEqual([]);
  });
  it("due exactly 10 minutes before", () => {
    expect(dueSessions(sessions, new Date("2026-10-09T13:20:00Z")).map((x: { key: string }) => x.key)).toEqual(["SQ"]);
  });
  it("still due if the cron ran late, as long as the session hasn't started", () => {
    expect(dueSessions(sessions, new Date("2026-10-09T13:29:30Z")).map((x: { key: string }) => x.key)).toEqual(["SQ"]);
  });
  it("not due once the session started", () => {
    expect(dueSessions(sessions, new Date("2026-10-09T13:30:00Z"))).toEqual([]);
  });
});
