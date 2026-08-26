# infer-action workflow authoring

Read this reference when creating or updating a GitHub Actions workflow that
runs the OpenTask/Infer agent (`inference-gateway/infer-action`).

## Read in this order

1. **The infer-action examples** in
   [`inference-gateway/infer-action/examples/`](https://github.com/inference-gateway/infer-action/tree/main/examples) -
   they are the canonical usage patterns for infer-action. Fetch the ones
   matching the task:

   | Example                    | Demonstrates                                                                  |
   | -------------------------- | ----------------------------------------------------------------------------- |
   | `issue-agent.yml`          | The default flow: trigger phrase on an issue/comment → branch + PR            |
   | `comment-only-advisor.yml` | Advisory mode (`enable-git-operations: false`)                                |
   | `go-project.yml`           | Go project: `languages: go` + an allow-list derived from the repo's Taskfile  |
   | `rust-project.yml`         | Rust project: `languages: rust`, `apt:` native deps, optional pre-build step  |
   | `typescript-project.yml`   | TypeScript project: `languages: typescript` + package.json-derived allow-list |
   | `with-skills.yml`          | Installing skills and appending `custom-instructions`                         |
   | `with-agents.yml`          | Spinning up A2A agents (the `agents` input)                                   |
   | `with-plugins.yml`         | Pre-installing infer-action plugins                                           |
   | `with-inline-review.yml`   | Inline PR review comments (`review-inline`)                                   |
   | `with-memory.yml`          | Persistent cross-run agent memory                                             |

2. **The existing workflow in the target repository**, if there is one
   (usually `.github/workflows/tasks.yml`, sometimes `infer.yml`, or any
   workflow that uses `inference-gateway/infer-action`). Read it completely
   before changing anything.

3. **The repository itself**: its languages, and its CI workflow
   (`.github/workflows/ci.yml` or similar) for the conventions the repo
   already follows - setup steps, action version style, GitHub App token
   usage, package managers.

Only then make changes.

## Adapt to the repository: languages and least-privilege bash

The workflow you author decides two things about the agent's runtime: which
toolchains are installed, and which shell commands the agent is allowed to
run. Both must be **derived from the repository itself**, not guessed.

### Detect the languages

Look for the manifest files:

| Manifest                                                | Language / toolchain |
| ------------------------------------------------------- | -------------------- |
| `go.mod`                                                | Go                   |
| `Cargo.toml`                                            | Rust                 |
| `package.json` + `bun.lock`                             | Bun                  |
| `package.json` (+ `pnpm-lock.yaml`/`package-lock.json`) | Node / TypeScript    |
| `pyproject.toml` / `requirements.txt`                   | Python               |

Wire them through the action's own `languages:` input (`go`, `rust`, `node`
(alias `typescript`), `python` - newline- or space-separated for multiple).
It respects version files (`go.mod`, `.nvmrc`, `.python-version`) and is the
simplest correct setup, so prefer it.

Add explicit setup steps **before** the infer-action step only when the input
is not enough:

- A pre-build the agent should not have to repeat (e.g. a Tauri app's
  `bun install --frozen-lockfile && bun run build` before the Rust build
  works - see `rust-project.yml`).
- A task runner the repo's scripts assume (`arduino/setup-task` for
  `Taskfile.yml`).
- A pinned or cached toolchain the repo's CI already uses - mirror its setup
  actions, and prefer the version-file inputs (`node-version-file: .nvmrc`,
  `bun-version-file: package.json`, `go-version-file: go.mod`) over hardcoded
  versions so the workflow follows the repo's own pin.
- Native libraries: use the action's `apt:` input rather than a `run: apt-get`
  step (it caches the packages across runs).

### Derive the bash allow-list from the repo's own scripts

`bash-allow-append` is the security boundary of an autonomous agent run: the
CLI's baseline allows only reads, and everything you append the agent can
execute unattended. So the right list is exactly the deterministic commands
the repository already runs - nothing broader.

Read the repo's task-runner files to find them: `Taskfile.yml`,
`package.json` `scripts`, `Makefile`, `justfile`, and the CI workflow's `run:`
steps. Those name the build/test/lint/format commands the project considers
canonical (`task test`, `cargo clippy`, `bun run lint`, `make build`, ...).
Allow the runner itself plus the underlying toolchain commands those scripts
invoke, per language:

| Language        | Typical append entries                                                                    |
| --------------- | ----------------------------------------------------------------------------------------- |
| any with runner | `task( .*)?` / `make( .*)?` / `just( .*)?` - only the runner the repo actually has        |
| Go              | `go( .*)?,gofmt( .*)?,golangci-lint( .*)?`                                                |
| Rust            | `cargo( .*)?,rustc( .*)?,rustfmt( .*)?,rustup( .*)?`                                      |
| Node/TypeScript | `node( .*)?,npm( .*)?,pnpm( .*)?,npx( .*)?`                                               |
| Bun             | `bun install( .*)?,bun add( .*)?,bun run( .*)?,bun test( .*)?,bun build( .*)?,bunx( .*)?` |
| Python          | `python( .*)?,python3( .*)?,uv( .*)?`                                                     |

Trim the table to what the repo uses (a pnpm-only repo does not need `npm`;
a repo with no Makefile gets no `make`). Each entry is a Go regex anchored to
the whole command, so include arguments explicitly - `cargo` alone matches
only the bare word; write `cargo( .*)?`. The list splits on `,` and newlines.

## Updating an existing workflow

The file you are editing was usually customized for its repository: extra
build/setup steps, a GitHub App token, `languages`/`apt` settings, plugins,
agents, extended `bash-allow-append` entries, `debug`/`review-inline` flags,
custom instructions. Those customizations are the most valuable part of the
file - a "sync" that regenerates the workflow from a generic template destroys
them and breaks the repo's agent runs.

So apply **only** additive, infer-action-related changes:

- Bump `inference-gateway/infer-action` to the latest release.
- Add `workflow_dispatch` inputs and `with:` attributes the current file is
  missing (compare against the examples - e.g. `prompt`, `system_prompt`,
  model picker, `enable_git`, `agents`).
- Adapt to the repository's languages when the current file misses them
  (see "Adapt to the repository" above): add `languages:`/`apt:` values,
  setup steps, and the allow-list entries the repo's own scripts show are
  needed. Add - never replace the existing `bash-allow-append` entries.
- Never remove or rewrite anything repo-specific. When unsure whether a line
  is repo-specific, keep it.

## Creating a new workflow

Create `.github/workflows/tasks.yml` modeled on the examples, tailored to the
repository:

- Triggers: `issues` (opened, edited), `issue_comment` (created),
  `pull_request_review_comment` (created), plus `workflow_dispatch` with
  `model`, `prompt`, `system_prompt`, `enable_git`, and `agents` inputs.
- `trigger-phrase: "@opentask"` unless the repo already uses another phrase.
- `permissions`: `issues: write`, `contents: write`, `pull-requests: write`.
- Pass every provider API key secret through to the action (every example carries
  the full block, plus
  `llamacpp-api-url`/`llamacpp-api-key` for self-hosted endpoints), and
  default the model from `${{ inputs.model || vars.DEFAULT_MODEL || '<default>' }}`.
- Add `languages:` and setup steps matching the repository's actual languages
  and derive `bash-allow-append` from the repo's own scripts, per "Adapt to
  the repository" above (see `go-project.yml`, `rust-project.yml`,
  `typescript-project.yml`).
- Use a GitHub App token step (`actions/create-github-app-token`) when the
  repo's other workflows do, feeding its token to checkout and `github-token`.
- Write clean YAML with no comments - the file is configuration, not
  documentation.

## Rules for both

- Pin every action to its latest release with an explicit
  `v<major>.<minor>.<patch>` tag (e.g. `actions/checkout@v7.0.1`). Floating
  majors like `@v4` change under the repo without review; unpinned `@main` is
  worse. Match or exceed the versions the repo's own CI already uses.
- No "generated by" or AI-attribution footers in the workflow, commits, or PR.
- When the change lands as a pull request, give it a Conventional Commit title
  (`ci: ...`) and a body that states exactly what changed in the workflow and
  why - a reader should not need the diff to understand the change.
