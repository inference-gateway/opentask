import type { AgentManifest } from "./agents";
import type { CatalogSkill } from "./skills";

export type Skill = { name: string };

export type SkillsRequest = { type: "skills"; owner: string; repo: string };

export type SkillsResponse = { items: Skill[] } | { error: string };

export type CheckInstallRequest = { type: "check-install"; owner: string; repo: string };
export type CheckInstallResponse = { installed: boolean; url?: string } | { error: string };

export type InstallRequest = { type: "install"; owner: string; repo: string; model: string; context?: string };
export type InstallResponse = { prUrl: string } | { error: string };

export type CreateTaskRequest = { type: "create-task"; owner: string; repo: string; prompt: string };
export type CreateTaskResponse = { url: string } | { error: string };

// Run a free-text task without opening an issue: dispatch the installed workflow, which
// passes the prompt to infer-action's direct-prompt input.
export type DispatchTaskRequest = { type: "dispatch-task"; owner: string; repo: string; model: string; prompt: string };
export type DispatchTaskResponse = { url: string } | { error: string };

// Refine one existing issue: dispatch the workflow with a refine prompt for issue #N. Uses
// the first configured model as default (no model picker at the call sites).
export type RefineIssueRequest = { type: "refine-issue"; owner: string; repo: string; issue: number };
export type RefineIssueResponse = { url: string } | { error: string };

// Scaffold a repo: dispatch the installed workflow to generate AGENTS.md (+ optional
// githooks/symlinks per the global "init" config) and open a PR.
export type InitProjectRequest = { type: "init-project"; owner: string; repo: string };
export type InitProjectResponse = { url: string } | { error: string };

// Skills registry: the full catalog, the names already installed in the repo's
// .agents/skills/, and the repo's top languages (for suggestion ordering).
export type SkillsCatalogRequest = { type: "skills-catalog"; owner: string; repo: string };
export type SkillsCatalogResponse =
  | { catalog: CatalogSkill[]; installed: string[]; languages: string[] }
  | { error: string };

export type ApplySkillsRequest = { type: "apply-skills"; owner: string; repo: string; add: string[]; remove: string[] };
export type ApplySkillsResponse = { prUrl: string } | { error: string };

export type AgentsCatalogRequest = { type: "agents-catalog" };
export type AgentsCatalogResponse =
  | { catalog: AgentManifest[] }
  | { error: string };

// --- RunPod GPU provisioning ---

export type GpuState = {
  endpointUrl?: string;
  status: "idle" | "provisioning" | "running" | "failed";
  createdAt?: number;
  podId?: string;
  modelId?: string;
  hf?: string; // the served "repo:quant" ref; the gateway registers it as llamacpp/<hf>
  apiKey?: string;
};

// A llama.cpp -hf ref: "owner/repo" with an optional ":quant" (e.g. bartowski/foo-GGUF:Q4_K_M).
export const isValidHf = (hf: string) => /^[\w.-]+\/[\w.-]+(:[\w.]+)?$/.test(hf.trim());

// GitHub error bodies carry the actual reason - {"message":"Invalid tree info"} or a
// "message" plus an "errors" array. A bare "GitHub 422" tells the user nothing and hides
// which call failed, so always fold the body into the message we surface.
export function githubError(status: number, body: string): string {
  let detail = body.trim();
  try {
    const json = JSON.parse(body) as { message?: string; errors?: { message?: string; field?: string; code?: string }[] };
    const errors = (json.errors ?? [])
      .map((e) => e.message ?? [e.field, e.code].filter(Boolean).join(" "))
      .filter(Boolean)
      .join("; ");
    detail = [json.message, errors].filter(Boolean).join(" - ");
  } catch { /* not JSON - fall back to the raw text */ }
  return detail ? `GitHub ${status}: ${detail.slice(0, 300)}` : `GitHub ${status}`;
}

// Parses `gh api --include` output (status line + headers + body) into the HTTP
// status and body. gh follows redirects and can print one header block per hop,
// so the LAST status line wins. Throws when no status line is found (gh missing
// or not authenticated on the CLI host).
export function parseGhHttp(output: string, toolError?: string): { status: number; body: string } {
  const matches = [...output.matchAll(/^HTTP\/[\d.]+ (\d{3})[^\n]*$/gm)];
  const last = matches[matches.length - 1];
  if (!last) throw new Error(toolError || "gh api returned no response - is gh installed and authenticated on the CLI host?");
  const rest = output.slice(last.index! + last[0].length);
  const blank = rest.search(/\r?\n\r?\n/);
  const body = blank < 0 ? "" : rest.slice(blank).replace(/^\r?\n\r?\n/, "");
  return { status: Number(last[1]), body };
}

// RunPod's REST API has no GPU-types list endpoint; the ids below are the enum
// values it accepts for gpuTypeIds. Enough spread to fit a 7-14B GGUF at Q4.
// ponytail: static list, revisit if RunPod ships a catalog endpoint.
export type GpuType = { id: string; label: string };
export const GPU_TYPES: GpuType[] = [
  { id: "NVIDIA GeForce RTX 4090", label: "RTX 4090 (24 GB)" },
  { id: "NVIDIA RTX A5000", label: "RTX A5000 (24 GB)" },
  { id: "NVIDIA RTX A6000", label: "RTX A6000 (48 GB)" },
  { id: "NVIDIA L40S", label: "L40S (48 GB)" },
  { id: "NVIDIA A100 80GB PCIe", label: "A100 (80 GB)" },
];

// Popular GGUF models deployable via llama.cpp's -hf flag ("repo:quant").
export type LlamaModel = { id: string; label: string; hf: string };
export const LLAMA_MODELS: LlamaModel[] = [
  { id: "ornith-9b", label: "Ornith 1.0 9B (agentic)", hf: "deepreinforce-ai/Ornith-1.0-9B-GGUF:Q4_K_M" },
  { id: "llama-3.1-8b", label: "Llama 3.1 8B Instruct", hf: "bartowski/Meta-Llama-3.1-8B-Instruct-GGUF:Q4_K_M" },
  { id: "qwen-2.5-7b", label: "Qwen 2.5 7B Instruct", hf: "bartowski/Qwen2.5-7B-Instruct-GGUF:Q4_K_M" },
  { id: "mistral-7b", label: "Mistral 7B Instruct v0.3", hf: "bartowski/Mistral-7B-Instruct-v0.3-GGUF:Q4_K_M" },
  { id: "phi-4", label: "Phi-4 14B", hf: "bartowski/phi-4-GGUF:Q4_K_M" },
  { id: "gemma-2-9b", label: "Gemma 2 9B Instruct", hf: "bartowski/gemma-2-9b-it-GGUF:Q4_K_M" },
];

// Pod create body for RunPod's REST API, running llama.cpp server with the chosen model.
// apiKey secures the endpoint (llama.cpp --api-key); the gateway forwards it as a bearer.
export function podRequestBody(gpuTypeId: string, model: LlamaModel, apiKey: string, cloudType?: string) {
  return {
    name: `opentask-${model.id}`,
    imageName: "ghcr.io/ggml-org/llama.cpp:server-cuda",
    dockerStartCmd: ["-hf", model.hf, "--host", "0.0.0.0", "--port", "8080", "-ngl", "99", "--jinja", "--api-key", apiKey],
    gpuTypeIds: [gpuTypeId],
    allowedCudaVersions: ["12.8", "12.9", "13.0"],
    cloudType: cloudType ?? "SECURE",
    ports: ["8080/http"],
    containerDiskInGb: 50,
    volumeInGb: 0,
  };
}

export type ProvisionGPURequest = { type: "provision-gpu"; gpuTypeId: string; modelId: string; hf: string; cloudType?: string };
export type ProvisionGPUResponse = { state: GpuState } | { error: string };

export type DeprovisionGPURequest = { type: "deprovision-gpu" };
export type DeprovisionGPUResponse = { state: GpuState } | { error: string };

export type GPUStatusRequest = { type: "gpu-status" };
export type GPUStatusResponse = { state: GpuState } | { error: string };
