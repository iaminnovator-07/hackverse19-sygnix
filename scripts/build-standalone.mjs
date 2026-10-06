import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Script } from "node:vm";

const root = process.cwd();
const dist = path.join(root, "dist");
let html = await readFile(path.join(dist, "index.html"), "utf8");
const jsMatch = html.match(/<script[^>]+src="([^"]+\.js)"[^>]*><\/script>/);
const cssMatch = html.match(/<link[^>]+href="([^"]+\.css)"[^>]*>/);
if (!jsMatch || !cssMatch) throw new Error("Could not find the built JavaScript and CSS assets in dist/index.html");

const jsPath = path.join(dist, jsMatch[1].replace(/^\//, ""));
const cssPath = path.join(dist, cssMatch[1].replace(/^\//, ""));
const [js, css] = await Promise.all([readFile(jsPath, "utf8"), readFile(cssPath, "utf8")]);
if (/<\/script/i.test(js)) throw new Error("JavaScript contains a closing script tag and cannot be safely inlined");
new Script(js, { filename: "VORTHYX_Dashboard.inline.js" });

html = html.replace(jsMatch[0], `<script>${js}</script>`).replace(cssMatch[0], `<style>${css}</style>`);
const output = path.join(root, "VORTHYX_Dashboard.html");
await writeFile(output, html, "utf8");
console.log(`Standalone dashboard created: ${output}`);
