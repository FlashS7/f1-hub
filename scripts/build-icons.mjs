// Generates PWA icons from an original SVG mark. Run: node scripts/build-icons.mjs
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const mark = (s) => `
  <g transform="translate(${256 - 200 * s} ${256 - 120 * s}) scale(${10 * s})">
    <path d="M10 2h28l-6 6H4z" fill="#e10600"/>
    <path d="M8 10h20l-6 6H2z" fill="#f3f3f6" opacity=".92"/>
    <path d="M6 18h10l-6 6H0z" fill="#f3f3f6" opacity=".55"/>
  </g>`;
const svg = (s, rounded) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" ${rounded ? 'rx="96"' : ""} fill="#0a0a0d"/>
  ${mark(s)}
</svg>`;

const any = svg(0.95, false);
const maskable = svg(0.62, false); // keeps the mark inside the 80% safe zone
writeFileSync("public/icons/icon.svg", svg(0.95, true));
await sharp(Buffer.from(any)).resize(192).png().toFile("public/icons/icon-192.png");
await sharp(Buffer.from(any)).resize(512).png().toFile("public/icons/icon-512.png");
await sharp(Buffer.from(maskable)).resize(512).png().toFile("public/icons/maskable-512.png");
await sharp(Buffer.from(maskable)).resize(192).png().toFile("public/icons/maskable-192.png");
await sharp(Buffer.from(svg(0.8, false))).resize(180).png().toFile("public/icons/apple-touch-icon.png");
console.log("icons ok");

// Social share card (1200x630) used for link previews and search results.
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <pattern id="cf" width="20" height="20" patternUnits="userSpaceOnUse">
      <rect width="20" height="20" fill="#0a0a0d"/><rect width="10" height="10" fill="#101014"/><rect x="10" y="10" width="10" height="10" fill="#101014"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#cf)"/>
  <rect x="0" y="0" width="1200" height="8" fill="#e10600"/>
  <g transform="translate(90 150) scale(4.2)">
    <path d="M10 2h28l-6 6H4z" fill="#e10600"/>
    <path d="M8 10h20l-6 6H2z" fill="#f3f3f6" opacity=".92"/>
    <path d="M6 18h10l-6 6H0z" fill="#f3f3f6" opacity=".55"/>
  </g>
  <text x="90" y="370" font-family="Arial Black, Arial, sans-serif" font-style="italic" font-weight="900" font-size="150" fill="#f3f3f6">F1<tspan fill="#e10600">/</tspan>HUB</text>
  <text x="94" y="445" font-family="Arial, sans-serif" font-weight="700" font-size="40" fill="#a0a0ad" letter-spacing="2">RACE WEEKEND HUB + PREDICTION LEAGUE</text>
  <text x="94" y="520" font-family="Arial, sans-serif" font-size="32" fill="#8b8b98">Live countdown · Schedule in your time · Predict the top 10 with friends</text>
  <rect x="0" y="600" width="1200" height="2" fill="#2b2b35"/>
</svg>`;
await sharp(Buffer.from(og)).png().toFile("src/app/opengraph-image.png");
writeFileSync("src/app/opengraph-image.alt.txt", "F1 HUB: race weekend hub and F1 prediction league for friends");
console.log("og ok");
