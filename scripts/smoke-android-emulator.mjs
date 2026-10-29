import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const appId = "io.github.zhangzqs.composesit";
const output = join(
  process.env.RUNNER_TEMP ?? process.cwd(),
  "compose-sit-emulator",
);
mkdirSync(output, { recursive: true });

function adb(...args) {
  return execFileSync("adb", args, {
    encoding: "utf8",
    timeout: 30_000,
  }).trim();
}

async function waitFor(label, probe, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await probe();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }
  throw new Error(`${label} timed out: ${lastError ?? "condition not met"}`);
}

async function evaluate(url, expression) {
  const socket = new WebSocket(url);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("WebView evaluation timed out"));
    }, 10_000);
    socket.addEventListener("open", () => {
      socket.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: { expression, returnByValue: true },
        }),
      );
    });
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id !== 1) return;
      clearTimeout(timer);
      socket.close();
      if (message.error || message.result?.exceptionDetails)
        reject(
          new Error(
            JSON.stringify(message.error ?? message.result.exceptionDetails),
          ),
        );
      else resolve(message.result?.result?.value);
    });
    socket.addEventListener("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

const inspectExpression = `(() => {
  const replay = window.__composeSitReplay?.();
  return {
    url: location.href,
    statusPresent: Boolean(document.querySelector("#status")),
    canvasCount: document.querySelectorAll("canvas").length,
    rulesVersion: replay?.rulesVersion,
    inputCount: replay?.inputs.length,
    tick: replay?.endTick,
  };
})()`;

try {
  const apk = join(
    process.cwd(),
    "apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk",
  );
  console.log(adb("install", "-r", apk));
  adb("shell", "svc", "wifi", "disable");
  console.log(
    adb("shell", "am", "start", "-W", "-n", `${appId}/.MainActivity`),
  );
  const pid = await waitFor(
    "app process",
    () => adb("shell", "pidof", appId).split(/\s+/)[0],
  );
  adb("forward", "tcp:9222", `localabstract:webview_devtools_remote_${pid}`);
  const target = await waitFor("WebView DevTools target", async () => {
    const response = await fetch("http://127.0.0.1:9222/json/list");
    if (!response.ok) return undefined;
    const pages = await response.json();
    return pages.find(
      (page) => page.type === "page" && page.webSocketDebuggerUrl,
    );
  });
  const ready = await waitFor("game load", async () => {
    const state = await evaluate(
      target.webSocketDebuggerUrl,
      inspectExpression,
    );
    return !state.statusPresent &&
      state.canvasCount === 1 &&
      state.rulesVersion === 2
      ? state
      : undefined;
  });
  const size = adb("shell", "wm", "size").match(/(\d+)x(\d+)/);
  if (!size) throw new Error("Could not read emulator display size");
  adb(
    "shell",
    "input",
    "tap",
    String(Math.floor(Number(size[1]) / 2)),
    String(Math.floor(Number(size[2]) / 2)),
  );
  const played = await waitFor("touch drop", async () => {
    const state = await evaluate(
      target.webSocketDebuggerUrl,
      inspectExpression,
    );
    return state.inputCount === 1 && state.tick > ready.tick
      ? state
      : undefined;
  });
  const report = {
    device: adb("shell", "getprop", "ro.product.model"),
    android: adb("shell", "getprop", "ro.build.version.release"),
    ready,
    played,
    offline: true,
  };
  writeFileSync(join(output, "result.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `Android emulator: local game loaded and one touch drop recorded on ${report.device} (Android ${report.android}).\n`,
    );
} finally {
  try {
    writeFileSync(
      join(output, "screen.png"),
      execFileSync("adb", ["exec-out", "screencap", "-p"], {
        maxBuffer: 16 * 1024 * 1024,
        timeout: 30_000,
      }),
    );
  } catch (error) {
    console.warn("Screenshot unavailable:", error);
  }
  try {
    writeFileSync(join(output, "logcat.txt"), adb("logcat", "-d", "-t", "400"));
  } catch (error) {
    console.warn("Logcat unavailable:", error);
  }
}
