import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  RECORD_CAP_DEFAULT,
  RECORD_CAP_MAX,
  RECORD_CAP_MIN,
  RECORD_BITRATE_MAX,
  RECORD_BITRATE_MIN,
  RECORD_MAX_BYTES,
  captureFailureMessage,
  createRecordingBox,
  formatElapsed,
  frameToolsCommand,
  frameToolsReleaseCommand,
  frameToolsSizeCommand,
  isFrameToolStale,
  normalizeRecordCap,
  paintRecordingOverlay,
  recordingBitrate,
  recordingFilename,
  recordingFooter,
  recordingLine,
  recordingMime,
  supportsTabCapture,
} from "../src/shared/recording";

describe("normalizeRecordCap", () => {
  test("falls back to the default on non-numeric input", () => {
    expect(normalizeRecordCap(undefined)).toBe(RECORD_CAP_DEFAULT);
    expect(normalizeRecordCap("abc")).toBe(RECORD_CAP_DEFAULT);
  });

  test("clamps to the enforced bounds", () => {
    expect(normalizeRecordCap(1)).toBe(RECORD_CAP_MIN);
    expect(normalizeRecordCap(10_000)).toBe(RECORD_CAP_MAX);
    expect(normalizeRecordCap(90)).toBe(90);
  });

  test("rounds fractional seconds", () => {
    expect(normalizeRecordCap(60.6)).toBe(61);
  });
});

describe("recordingMime", () => {
  test("prefers mp4 and falls back to webm", () => {
    expect(recordingMime(() => true)).toBe("video/mp4");
    expect(recordingMime((m) => m === "video/webm")).toBe("video/webm");
  });
});

describe("recordingBitrate", () => {
  test("a default-cap recording stays under the GitHub attachment limit", () => {
    const bytes = (recordingBitrate(RECORD_CAP_DEFAULT) / 8) * RECORD_CAP_DEFAULT;
    expect(bytes).toBeLessThanOrEqual(RECORD_MAX_BYTES);
  });

  test("is clamped for extreme caps", () => {
    expect(recordingBitrate(1)).toBe(RECORD_BITRATE_MAX);
    expect(recordingBitrate(60 * 60)).toBe(RECORD_BITRATE_MIN);
  });
});

describe("recordingFilename", () => {
  test("names the recording with a timestamp and the container extension", () => {
    const ts = new Date(2026, 8, 26, 13, 45, 5).getTime();
    expect(recordingFilename(ts)).toBe("opentask-recording-20260926-134505.mp4");
    expect(recordingFilename(ts, "webm")).toBe("opentask-recording-20260926-134505.webm");
  });
});

describe("formatElapsed", () => {
  test("renders m:ss", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(67_000)).toBe("1:07");
    expect(formatElapsed(-5)).toBe("0:00");
  });
});

describe("supportsTabCapture", () => {
  test("is false without the chrome APIs (bun/jsdom test env)", () => {
    expect(supportsTabCapture()).toBe(false);
  });
});

describe("captureFailureMessage", () => {
  test("names the toolbar icon when Chrome refuses a tab the extension was not invoked on", () => {
    const refusal =
      "Extension has not been invoked for the current page (see activeTab permission). Chrome pages cannot be captured.";
    expect(captureFailureMessage(new Error(refusal))).toContain("toolbar icon");
  });

  test("passes another failure through unchanged", () => {
    expect(captureFailureMessage("Cannot capture this page.")).toBe("Cannot capture this page.");
  });
});

describe("paintRecordingOverlay", () => {
  test("outlines the tab once and clears on false", () => {
    document.body.innerHTML = "";
    paintRecordingOverlay(true);
    paintRecordingOverlay(true);
    expect(document.body.children.length).toBe(1);
    const overlay = document.body.firstElementChild as HTMLElement;
    expect(overlay.style.position).toBe("fixed");
    expect(overlay.getAttribute("aria-hidden")).toBe("true");
    paintRecordingOverlay(false);
    expect(document.body.children.length).toBe(0);
  });
});

describe("createRecordingBox", () => {
  const recording = { filename: "opentask-recording.mp4", mime_type: "video/mp4", data: "AAAA" };

  test("hands a held capture over once", () => {
    const box = createRecordingBox();
    expect(box.take()).toBeUndefined();
    box.hold(recording);
    expect(box.take()).toEqual(recording);
    expect(box.take()).toBeUndefined();
  });
});

describe("recordingLine", () => {
  test("names the capture, the bundled extractor, and asks before proposing a skill", () => {
    expect(recordingLine("opentask-recording-20260926-134505.mp4")).toBe(
      "[recording: opentask-recording-20260926-134505.mp4 - a capture of the flow. Extract frames with the bundled ~/.infer/bin/tools/ffmpeg (no installs, no other video tooling), inspect them, then ask whether to save this flow as a skill.]",
    );
  });
});

describe("recordingFooter", () => {
  const recording = { filename: "opentask-recording-20260926-134505.mp4", mime_type: "video/mp4", data: "AAAA" };

  test("adds the line for a capture whose prompt the composer never showed", () => {
    expect(recordingFooter("can you look at this?", recording)).toBe(recordingLine(recording.filename));
  });

  test("stays quiet when the pre-filled composer already carries it", () => {
    expect(recordingFooter(recordingLine(recording.filename), recording)).toBe("");
  });

  test("adds nothing without a capture", () => {
    expect(recordingFooter("hello", undefined)).toBe("");
  });
});

const INSTALLER_URL = "https://raw.githubusercontent.com/inference-gateway/binaries/main/install.sh";

// Runs a frame-tools command against a throwaway HOME with a stub curl that serves a
// fake installer logging how it was invoked, so a test sees what the host would fetch
// and run without touching the network. A failing stub exits like `curl -f` does.
function runFrameTools(command: string, opts: { installed?: boolean; curlFails?: boolean } = {}) {
  const root = mkdtempSync("/tmp/ot-frame-tools-");
  const home = join(root, "home");
  const stubs = join(root, "stubs");
  const log = join(root, "calls.log");
  mkdirSync(join(home, ".infer/bin/tools"), { recursive: true });
  mkdirSync(stubs, { recursive: true });
  writeFileSync(log, "");
  writeFileSync(
    join(stubs, "curl"),
    `#!/bin/sh
for arg; do url="$arg"; done
echo "curl $url" >> "$LOG"
${opts.curlFails ? "exit 22" : `echo 'echo "installer $0 $*" >> "$LOG"'`}
`,
  );
  chmodSync(join(stubs, "curl"), 0o755);
  if (opts.installed) writeFileSync(join(home, ".infer/bin/tools/ffmpeg"), "binary");
  const result = spawnSync("sh", ["-c", command], {
    encoding: "utf8",
    env: { ...process.env, HOME: home, PATH: `${stubs}:${process.env.PATH}`, LOG: log },
  });
  const calls = readFileSync(log, "utf8").split("\n").filter(Boolean);
  rmSync(root, { recursive: true, force: true });
  return { status: result.status, stdout: result.stdout, calls };
}

describe("frameToolsSizeCommand", () => {
  test("prints the installed ffmpeg's byte size", () => {
    const { status, stdout } = runFrameTools(frameToolsSizeCommand(), { installed: true });
    expect(status).toBe(0);
    expect(stdout.trim().split(/\s+/)[0]).toBe(String("binary".length));
  });

  test("fails when ffmpeg is missing", () => {
    expect(runFrameTools(frameToolsSizeCommand()).status).not.toBe(0);
  });
});

describe("frameToolsReleaseCommand", () => {
  test("is a single read-only gh release query, as the CLI's allowlist requires", () => {
    expect(frameToolsReleaseCommand()).toMatch(/^gh release view -R inference-gateway\/binaries /);
    expect(frameToolsReleaseCommand()).not.toMatch(/\n|\$\(|&&|;/);
  });
});

describe("isFrameToolStale", () => {
  const release = "9724000\n41981928\n34108336\n14383616\n";

  test("is current when the installed size matches a latest build", () => {
    expect(isFrameToolStale(" 9724000 /Users/me/.infer/bin/tools/ffmpeg\n", release)).toBe(false);
  });

  test("is stale when the installed size matches no latest build", () => {
    expect(isFrameToolStale(" 2875456 /Users/me/.infer/bin/tools/ffmpeg\n", release)).toBe(true);
  });

  test("counts unreadable output on either side as current", () => {
    expect(isFrameToolStale("", release)).toBe(false);
    expect(isFrameToolStale("wc: ffmpeg: No such file", release)).toBe(false);
    expect(isFrameToolStale(" 2875456 ffmpeg", "")).toBe(false);
    expect(isFrameToolStale(" 2875456 ffmpeg", "HTTP 404: Not Found")).toBe(false);
  });
});

describe("frameToolsCommand", () => {
  test("runs the binaries installer for ffmpeg", () => {
    const { status, calls } = runFrameTools(frameToolsCommand());
    expect(status).toBe(0);
    expect(calls).toEqual([`curl ${INSTALLER_URL}`, "installer install.sh ffmpeg"]);
  });

  test("opens with a comment telling the approver what it downloads and why", () => {
    expect(frameToolsCommand().split("\n")[0]).toMatch(/^# opentask: download the latest ffmpeg .* extract frames from your recording$/);
  });

  test("fails when the installer cannot be fetched", () => {
    const { status, calls } = runFrameTools(frameToolsCommand(), { curlFails: true });
    expect(status).not.toBe(0);
    expect(calls).toEqual([`curl ${INSTALLER_URL}`]);
  });
});

type OffscreenListener = (msg: Record<string, unknown>, sender: unknown, respond: (resp: unknown) => void) => unknown;

// MediaRecorder and FileReader do not exist outside a browser; the fakes keep the
// two behaviours the recorder leans on: stop() fires its events in a later task,
// and the data URL carries the bytes the chunks held.
class FakeMediaRecorder {
  static isTypeSupported(): boolean {
    return true;
  }

  state: "inactive" | "recording" = "inactive";
  ondataavailable?: (event: { data: Blob }) => void;
  onstop?: () => void;
  private readonly stops: (() => void)[] = [];

  constructor(readonly stream: { getTracks: () => { stop: () => void }[] }) {}

  addEventListener(type: string, listener: () => void): void {
    if (type === "stop") this.stops.push(listener);
  }

  start(): void {
    this.state = "recording";
  }

  stop(): void {
    this.state = "inactive";
    setTimeout(() => {
      this.ondataavailable?.({ data: new Blob(["frames"]) });
      this.onstop?.();
      this.stops.forEach((listener) => listener());
    }, 0);
  }
}

class FakeFileReader {
  result = "";
  onload?: () => void;
  onerror?: () => void;

  readAsDataURL(blob: Blob): void {
    void blob.text().then((text) => {
      this.result = `data:${blob.type};base64,${btoa(text)}`;
      this.onload?.();
    });
  }
}

function asked(listener: OffscreenListener, msg: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve) => void listener(msg, {}, resolve));
}

describe("offscreen recorder", () => {
  test("answers a stop with the muxed capture, not an empty one", async () => {
    const globals = globalThis as Record<string, unknown>;
    const listeners: OffscreenListener[] = [];
    const saved = { chrome: globals.chrome, MediaRecorder: globals.MediaRecorder, FileReader: globals.FileReader };
    globals.chrome = {
      runtime: {
        onMessage: { addListener: (fn: OffscreenListener) => listeners.push(fn) },
        sendMessage: async () => {},
      },
    };
    globals.MediaRecorder = FakeMediaRecorder;
    globals.FileReader = FakeFileReader;
    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      value: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => {} }] }) },
      configurable: true,
    });

    try {
      await import("../src/offscreen");
      const offscreen = listeners[0];
      await asked(offscreen, { target: "offscreen", type: "start-recording", streamId: "stream-1", capSeconds: 60 });
      const stopped = (await asked(offscreen, { target: "offscreen", type: "stop-recording" })) as {
        status: string;
        recording?: { filename: string; mime_type: string; data: string };
      };
      expect(stopped.status).toBe("idle");
      expect(stopped.recording?.mime_type).toBe("video/mp4");
      expect(atob(stopped.recording?.data ?? "")).toBe("frames");
    } finally {
      for (const key of Object.keys(saved)) {
        const prior = saved[key as keyof typeof saved];
        if (prior === undefined) delete globals[key];
        else globals[key] = prior;
      }
      delete (globalThis.navigator as { mediaDevices?: unknown }).mediaDevices;
    }
  });

  test("sticks to chrome.runtime - offscreen documents get no other chrome API", async () => {
    const source = await Bun.file(new URL("../src/offscreen.ts", import.meta.url)).text();
    const used = new Set([...source.matchAll(/chrome\.\w+/g)].map((m) => m[0]));
    expect(used).toEqual(new Set(["chrome.runtime"]));
  });

  test("hands the capture to the panel rather than downloading it", async () => {
    const sources = await Promise.all(
      ["../src/offscreen.ts", "../src/background.ts"].map((path) => Bun.file(new URL(path, import.meta.url)).text()),
    );
    for (const source of sources) expect(source).not.toContain("chrome.downloads");
    const manifest = (await Bun.file(new URL("../manifest.json", import.meta.url)).json()) as { permissions: string[] };
    expect(manifest.permissions).not.toContain("downloads");
  });
});