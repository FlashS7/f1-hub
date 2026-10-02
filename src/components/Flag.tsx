import { AE, AT, AU, AZ, BE, BH, BR, CA, CN, ES, GB, HU, IT, JP, MC, MX, MY, NL, QA, SA, SG, US } from "country-flag-icons/react/3x2";

const FLAGS = { AE, AT, AU, AZ, BE, BH, BR, CA, CN, ES, GB, HU, IT, JP, MC, MX, MY, NL, QA, SA, SG, US };

const COUNTRY: Record<string, keyof typeof FLAGS> = {
  Australia: "AU", China: "CN", Japan: "JP", USA: "US", "United States": "US", Canada: "CA", Monaco: "MC",
  Spain: "ES", Austria: "AT", UK: "GB", "United Kingdom": "GB", Belgium: "BE", Hungary: "HU",
  Netherlands: "NL", Italy: "IT", Azerbaijan: "AZ", Malaysia: "MY", Singapore: "SG", Mexico: "MX",
  Brazil: "BR", Qatar: "QA", UAE: "AE", "United Arab Emirates": "AE", Bahrain: "BH", "Saudi Arabia": "SA",
};

export function Flag({ country, className = "h-4 w-6" }: { country: string; className?: string }) {
  const code = COUNTRY[country];
  const F = code ? FLAGS[code] : null;
  if (!F) return <span className={`${className} inline-block bg-surface-3`} aria-hidden />;
  return <F title={country} className={`${className} inline-block shadow-[0_0_0_1px_rgb(255_255_255/0.12)]`} />;
}
