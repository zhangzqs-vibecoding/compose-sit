import { cp, mkdir } from "node:fs/promises";

const target = new URL("../apps/wechat/dist/", import.meta.url);
await mkdir(target, { recursive: true });
for (const name of ["game.json", "project.config.json"])
  await cp(
    new URL(`../apps/wechat/${name}`, import.meta.url),
    new URL(name, target),
  );
for (const name of ["schools", "font", "audio"])
  await cp(
    new URL(`../assets/${name}`, import.meta.url),
    new URL(`assets/${name}`, target),
    { recursive: true },
  );
