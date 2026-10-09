// Team colours as used on official timing graphics (via OpenF1). Keyed by Jolpica constructorId.
export interface Team {
  id: string;
  name: string;
  short: string;
  color: string;
}

export const TEAMS: Record<string, Team> = {
  mercedes: { id: "mercedes", name: "Mercedes", short: "MER", color: "#00D7B6" },
  ferrari: { id: "ferrari", name: "Ferrari", short: "FER", color: "#ED1131" },
  mclaren: { id: "mclaren", name: "McLaren", short: "MCL", color: "#F47600" },
  red_bull: { id: "red_bull", name: "Red Bull", short: "RBR", color: "#4781D7" },
  rb: { id: "rb", name: "Racing Bulls", short: "RB", color: "#6C98FF" },
  williams: { id: "williams", name: "Williams", short: "WIL", color: "#1868DB" },
  aston_martin: { id: "aston_martin", name: "Aston Martin", short: "AMR", color: "#229971" },
  alpine: { id: "alpine", name: "Alpine", short: "ALP", color: "#FF87BC" }, // BWT pink: tells it apart from the three blue teams
  haas: { id: "haas", name: "Haas", short: "HAA", color: "#9C9FA2" },
  audi: { id: "audi", name: "Audi", short: "AUD", color: "#F50537" },
  cadillac: { id: "cadillac", name: "Cadillac", short: "CAD", color: "#B6BABD" },
};

const FALLBACK: Team = { id: "unknown", name: "Unknown", short: "---", color: "#6B7280" };

export function team(id: string | null | undefined): Team {
  if (!id) return FALLBACK;
  return TEAMS[id] ?? { ...FALLBACK, id, name: id.replace(/_/g, " ") };
}

export const teamColor = (id: string | null | undefined) => team(id).color;
