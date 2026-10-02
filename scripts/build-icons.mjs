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
