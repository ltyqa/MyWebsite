import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const distDir = resolve("dist");

await rm(distDir, { force: true, recursive: true });

console.log(`Removed ${distDir}`);
