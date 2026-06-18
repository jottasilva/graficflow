import fs from "node:fs";
import path from "node:path";

const scanRoots = ["src", "backend", "docs", "scripts"];
const rootFiles = ["package.json", "next.config.ts", "tsconfig.json", "eslint.config.mjs"];
const ignoredDirs = new Set([
  ".git",
  ".next",
  "artifacts",
  "coverage",
  "dist",
  "node_modules",
  "out",
]);
const textExtensions = new Set([
  ".css",
  ".cjs",
  ".env",
  ".example",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".sql",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const cp1252 = new Map([
  [0x80, 0x20ac],
  [0x82, 0x201a],
  [0x83, 0x0192],
  [0x84, 0x201e],
  [0x85, 0x2026],
  [0x86, 0x2020],
  [0x87, 0x2021],
  [0x88, 0x02c6],
  [0x89, 0x2030],
  [0x8a, 0x0160],
  [0x8b, 0x2039],
  [0x8c, 0x0152],
  [0x8e, 0x017d],
  [0x91, 0x2018],
  [0x92, 0x2019],
  [0x93, 0x201c],
  [0x94, 0x201d],
  [0x95, 0x2022],
  [0x96, 0x2013],
  [0x97, 0x2014],
  [0x98, 0x02dc],
  [0x99, 0x2122],
  [0x9a, 0x0161],
  [0x9b, 0x203a],
  [0x9c, 0x0153],
  [0x9e, 0x017e],
  [0x9f, 0x0178],
]);

const targetCodePoints = [
  0x00c1, 0x00c0, 0x00c2, 0x00c3, 0x00c7, 0x00c9, 0x00ca, 0x00cd,
  0x00d3, 0x00d4, 0x00d5, 0x00da, 0x00dc, 0x00e1, 0x00e0, 0x00e2,
  0x00e3, 0x00e4, 0x00e7, 0x00e9, 0x00ea, 0x00ed, 0x00f3, 0x00f4,
  0x00f5, 0x00fa, 0x00fc, 0x00ba, 0x00aa, 0x00b2, 0x00b3, 0x00b0,
  0x00b7, 0x2022, 0x2013, 0x2014, 0x201c, 0x201d, 0x2018, 0x2019,
  0x2026, 0x2122, 0x20ac, 0x1f44b,
];

function cp1252Char(byte) {
  return String.fromCodePoint(cp1252.get(byte) ?? byte);
}

function mojibake(value) {
  return [...Buffer.from(value, "utf8")].map(cp1252Char).join("");
}

function buildSuspiciousTokens() {
  const tokens = new Set([String.fromCodePoint(0xfffd)]);

  for (const codePoint of targetCodePoints) {
    const value = String.fromCodePoint(codePoint);
    const once = mojibake(value);
    const twice = mojibake(once);

    if (once !== value) tokens.add(once);
    if (twice !== value) tokens.add(twice);
  }

  tokens.add(String.fromCodePoint(0x00c2, 0x00a0));
  return [...tokens].sort((a, b) => b.length - a.length);
}

function isTextFile(filePath) {
  const basename = path.basename(filePath);
  const ext = path.extname(filePath);
  return textExtensions.has(ext) || basename.endsWith(".env.example");
}

function listFiles(root) {
  if (!fs.existsSync(root)) return [];

  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      return ignoredDirs.has(entry.name) ? [] : listFiles(fullPath);
    }

    return isTextFile(fullPath) ? [fullPath] : [];
  });
}

function locationFor(text, index) {
  const before = text.slice(0, index);
  const lines = before.split(/\r?\n/u);
  return {
    line: lines.length,
    column: lines.at(-1).length + 1,
  };
}

function compactSnippet(text, index, length) {
  return text
    .slice(Math.max(0, index - 32), index + length + 32)
    .replace(/\s+/gu, " ")
    .trim();
}

const suspiciousTokens = buildSuspiciousTokens();
const findings = [];
const files = [
  ...rootFiles.filter((filePath) => fs.existsSync(filePath) && isTextFile(filePath)),
  ...scanRoots.flatMap(listFiles),
];

for (const filePath of files) {
  const text = fs.readFileSync(filePath, "utf8");

  for (const token of suspiciousTokens) {
    const index = text.indexOf(token);
    if (index === -1) continue;

    const location = locationFor(text, index);
    findings.push({
      filePath,
      token,
      ...location,
      snippet: compactSnippet(text, index, token.length),
    });
    break;
  }
}

if (findings.length) {
  console.error("Mojibake detectado. Salve os arquivos como UTF-8 e corrija os textos abaixo:");
  for (const finding of findings) {
    console.error(
      `- ${finding.filePath}:${finding.line}:${finding.column} -> ${JSON.stringify(finding.snippet)}`,
    );
  }
  process.exit(1);
}

console.log("Nenhum mojibake detectado.");
