import { stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import sharp from "sharp";

const images = [
  "entrance-sketch.png",
  "room-sketch.png",
  "hero-reference.png",
  "notes-reference.png",
  "github-reference.png",
  "projects-reference.png",
];

const imageDir = join("public", "images");

async function isFresh(source, target) {
  try {
    const [sourceStat, targetStat] = await Promise.all([stat(source), stat(target)]);
    return targetStat.mtimeMs >= sourceStat.mtimeMs && targetStat.size > 0;
  } catch {
    return false;
  }
}

function webpPath(source) {
  const dir = dirname(source);
  const name = basename(source, ".png");
  return join(dir, `${name}.webp`);
}

for (const image of images) {
  const source = join(imageDir, image);
  const target = webpPath(source);

  if (await isFresh(source, target)) {
    console.log(`Skipped ${target}`);
    continue;
  }

  await sharp(source)
    .webp({
      quality: 78,
      effort: 6,
      smartSubsample: true,
    })
    .toFile(target);

  const [sourceStat, targetStat] = await Promise.all([stat(source), stat(target)]);
  const saved = Math.round((1 - targetStat.size / sourceStat.size) * 100);

  console.log(`Optimized ${target} (${saved}% smaller)`);
}
