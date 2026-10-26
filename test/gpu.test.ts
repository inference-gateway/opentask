import { describe, expect, test } from "bun:test";
import { LLAMA_MODELS, isValidHf, podRequestBody } from "../src/shared/messages";

describe("isValidHf", () => {
  test("accepts owner/repo with optional quant", () => {
    expect(isValidHf("bartowski/phi-4-GGUF:Q4_K_M")).toBe(true);
    expect(isValidHf("deepreinforce-ai/Ornith-1.0-9B-GGUF")).toBe(true);
  });
  test("rejects junk and provider-prefixed refs", () => {
    expect(isValidHf("phi-4")).toBe(false);
    expect(isValidHf("llamacpp/owner/repo:Q4")).toBe(false);
    expect(isValidHf("")).toBe(false);
  });
});

describe("LLAMA_MODELS", () => {
  test("ids are unique", () => {
    const ids = LLAMA_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("hf refs match repo/name:quant shape", () => {
    for (const m of LLAMA_MODELS) {
      expect(m.hf).toMatch(/^[\w.-]+\/[\w.-]+:[\w]+$/);
    }
  });
});

describe("podRequestBody", () => {
  test("runs llama.cpp server with the chosen model and api key", () => {
    const body = podRequestBody("NVIDIA GeForce RTX 4090", LLAMA_MODELS[0], "sekret");
    expect(body.imageName).toBe("ghcr.io/ggml-org/llama.cpp:server-cuda");
    expect(body.gpuTypeIds).toEqual(["NVIDIA GeForce RTX 4090"]);
    expect(body.allowedCudaVersions).toEqual(["12.8", "12.9", "13.0"]);
    expect(body.cloudType).toBe("SECURE");
    expect(body.ports).toEqual(["8080/http"]);
    expect(body.dockerStartCmd).toEqual([
      "-hf",
      LLAMA_MODELS[0].hf,
      "--host",
      "0.0.0.0",
      "--port",
      "8080",
      "-ngl",
      "99",
      "--jinja",
      "--api-key",
      "sekret",
    ]);
  });

  test("honors cloudType override", () => {
    expect(podRequestBody("gpu", LLAMA_MODELS[0], "k", "COMMUNITY").cloudType).toBe("COMMUNITY");
  });
});
