import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, Caveat, JetBrains_Mono } from "next/font/google";
import { InstallHint } from "@/components/InstallHint";
import { LightsOut } from "@/components/LightsOut";
import { SiteHeader } from "@/components/SiteHeader";
import { Signature } from "@/components/Signature";
import { SwRegister } from "@/components/SwRegister";
import { TimezoneProvider } from "@/components/Timezone";
import "./globals.css";

const display = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "800"],
  style: ["normal", "italic"],
});
const body = Barlow({ variable: "--font-body", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin", "latin-ext"], weight: ["500", "700"] });
// latin-ext carries Š (U+0160) for the signature.
const script = Caveat({ variable: "--font-script", subsets: ["latin", "latin-ext"], weight: ["500"] });

export const metadata: Metadata = {
  title: { default: "F1 HUB", template: "%s · F1 HUB" },
  description: "Race weekend hub and prediction league for friends.",
  applicationName: "F1 HUB",
  appleWebApp: { capable: true, title: "F1 HUB", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  other: { "mobile-web-app-capable": "yes" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable} ${script.variable} h-full antialiased`}
    >
      <body className="carbon flex min-h-full flex-col">
        <TimezoneProvider>
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:bg-surface focus:px-3 focus:py-2">
            Skip to content
          </a>
          <SiteHeader />
          <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-10 pt-4 sm:px-6">
            {children}
          </main>
          <InstallHint />
          <Signature />
          <LightsOut />
          <SwRegister />
        </TimezoneProvider>
      </body>
    </html>
  );
}
