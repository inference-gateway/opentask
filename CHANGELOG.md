# Changelog

All notable changes to this project will be documented in this file.

## [1.9.0](https://github.com/inference-gateway/opentask/compare/v1.8.2...v1.9.0) (2026-08-10)

### ✨ Features

* **options:** add per-section restore-defaults buttons for prompts ([#135](https://github.com/inference-gateway/opentask/issues/135)) ([6d4849d](https://github.com/inference-gateway/opentask/commit/6d4849d5ccf672dce299d23af8b980ab7d981a44))

## [1.8.2](https://github.com/inference-gateway/opentask/compare/v1.8.1...v1.8.2) (2026-08-10)

### 🐛 Bug Fixes

* **infer:** fix board lifecycle in template models.ts - set QA after PR opened, not Done ([#134](https://github.com/inference-gateway/opentask/issues/134)) ([aae050e](https://github.com/inference-gateway/opentask/commit/aae050e3e40d0b3af4aaed7b7e0a8290d2b52bad))
* **infer:** set board status to QA after PR opened, not Done ([#133](https://github.com/inference-gateway/opentask/issues/133)) ([55476a7](https://github.com/inference-gateway/opentask/commit/55476a7883b5a2e120cee8da6d8ca9e8df747fd1))

## [1.8.1](https://github.com/inference-gateway/opentask/compare/v1.8.0...v1.8.1) (2026-08-08)

### 🐛 Bug Fixes

* **install:** wire reviewInline toggle into generated workflow template ([#130](https://github.com/inference-gateway/opentask/issues/130)) ([9a4a260](https://github.com/inference-gateway/opentask/commit/9a4a26065f916c61ab6624b7c93d25f3ed66d46d))

### 🔧 Miscellaneous

* **deps:** bump infer-action to v0.46.2 ([#131](https://github.com/inference-gateway/opentask/issues/131)) ([b95b43e](https://github.com/inference-gateway/opentask/commit/b95b43e392a85f0bbbcc9a3c574a3bcba7b4218e))

## [1.8.0](https://github.com/inference-gateway/opentask/compare/v1.7.1...v1.8.0) (2026-08-08)

### ✨ Features

* **deps:** add rustup to Rust allow list for cargo miri support ([#128](https://github.com/inference-gateway/opentask/issues/128)) ([b8f2b4a](https://github.com/inference-gateway/opentask/commit/b8f2b4a121eb58189a5dceb24e853d1d32f657f8)), closes [#127](https://github.com/inference-gateway/opentask/issues/127)
* **options:** move Install models from Prompts tab to new Models tab ([#126](https://github.com/inference-gateway/opentask/issues/126)) ([77f3b69](https://github.com/inference-gateway/opentask/commit/77f3b69f34c74330ded9ed9a2fbf07ea1c4354a3))
* **workflow:** add review-inline toggle for inline PR review comments ([#125](https://github.com/inference-gateway/opentask/issues/125)) ([8365e96](https://github.com/inference-gateway/opentask/commit/8365e96050cf11b27a589f80b0805592c358b1c4))

## [1.7.1](https://github.com/inference-gateway/opentask/compare/v1.7.0...v1.7.1) (2026-08-07)

### 🔧 Miscellaneous

* **deps:** bump infer-action to v0.46.1 ([#122](https://github.com/inference-gateway/opentask/issues/122)) ([a14a0d7](https://github.com/inference-gateway/opentask/commit/a14a0d7929c8a2c85b1cd0e556ec8611d86dd9cd))

## [1.7.0](https://github.com/inference-gateway/opentask/compare/v1.6.4...v1.7.0) (2026-08-07)

### ✨ Features

* add opentask skill at .agents/skills/opentask/ ([#121](https://github.com/inference-gateway/opentask/issues/121)) ([acec02d](https://github.com/inference-gateway/opentask/commit/acec02d9cfa1c62952be261f6ff24ecc6eee8584))

### 🔧 Miscellaneous

* rename ollama_cloud/deepseek-v4-flash to ollama_cloud/deepseek-v4-flash:preview ([3d67cff](https://github.com/inference-gateway/opentask/commit/3d67cff3dd1058f01d308611f7de58d8f0388fc9))

## [1.6.4](https://github.com/inference-gateway/opentask/compare/v1.6.3...v1.6.4) (2026-08-05)

### 🐛 Bug Fixes

* **workflow:** grant bash allowlist entries for enabled language dependencies ([#119](https://github.com/inference-gateway/opentask/issues/119)) ([9f2f852](https://github.com/inference-gateway/opentask/commit/9f2f852186eb8efa3851300aca6543b06da6f850))

## [1.6.3](https://github.com/inference-gateway/opentask/compare/v1.6.2...v1.6.3) (2026-08-05)

### 🐛 Bug Fixes

* **ui:** close tasks popover on successful submission ([#118](https://github.com/inference-gateway/opentask/issues/118)) ([7fe4734](https://github.com/inference-gateway/opentask/commit/7fe47344e026ef0107a00301fa191f38e99b5314))

### 🔧 Miscellaneous

* **deps:** bump infer-action from v0.44.4 to v0.45.0 ([#117](https://github.com/inference-gateway/opentask/issues/117)) ([e87ddf3](https://github.com/inference-gateway/opentask/commit/e87ddf3a8d76d1e314a09cd1fc1a9f36df103b60))

## [1.6.2](https://github.com/inference-gateway/opentask/compare/v1.6.1...v1.6.2) (2026-08-05)

### 🐛 Bug Fixes

* rename infer to opentask ([f13d32c](https://github.com/inference-gateway/opentask/commit/f13d32c53d82b659ba63c161c436ab9fe6aca24f))

### 👷 CI

* add arduino/setup-task@v3.0.0 with repo-token to CI workflow ([#114](https://github.com/inference-gateway/opentask/issues/114)) ([41a04fe](https://github.com/inference-gateway/opentask/commit/41a04feab1c9a2c2c6d319924d9e2c782f3ebe9a))
* sync OpenTask Agent workflow ([#115](https://github.com/inference-gateway/opentask/issues/115)) ([6f032b9](https://github.com/inference-gateway/opentask/commit/6f032b92aef47d4365ca10e69a24145bb4fc2c11))

## [1.6.1](https://github.com/inference-gateway/opentask/compare/v1.6.0...v1.6.1) (2026-08-05)

### 🐛 Bug Fixes

* debug value in generated workflow is a string, should be a boolean ([#112](https://github.com/inference-gateway/opentask/issues/112)) ([542e50a](https://github.com/inference-gateway/opentask/commit/542e50a3c5766f9c864934f50a85830021e59562))

### 🔧 Miscellaneous

* rename infer job to opentask and fix ci.yml permissions ([#111](https://github.com/inference-gateway/opentask/issues/111)) ([f16a1d4](https://github.com/inference-gateway/opentask/commit/f16a1d4c1422f5c3a1613c40615dfa4d408deb4c))

## [1.6.0](https://github.com/inference-gateway/opentask/compare/v1.5.1...v1.6.0) (2026-08-05)

### ✨ Features

* bump infer-action to v0.44.4 and add agents workflow_dispatch input ([#108](https://github.com/inference-gateway/opentask/issues/108)) ([d90dff6](https://github.com/inference-gateway/opentask/commit/d90dff670e5616249f140880c7fc6502fd4cb204))

### 🐛 Bug Fixes

* **ci:** update release.yml ([026bf60](https://github.com/inference-gateway/opentask/commit/026bf60487e9160e01ccba1120a8eea85ab8460f))

## [1.5.1](https://github.com/inference-gateway/opentask/compare/v1.5.0...v1.5.1) (2026-08-04)

### 🔧 Miscellaneous

* **deps:** bump infer-action from v0.44.0 to v0.44.2 ([#107](https://github.com/inference-gateway/opentask/issues/107)) ([cbe3643](https://github.com/inference-gateway/opentask/commit/cbe3643af41b6b50a4f5b2d5fd9b25283a84af51))

## [1.5.0](https://github.com/inference-gateway/opentask/compare/v1.4.6...v1.5.0) (2026-08-04)

### ✨ Features

* bump infer-action to v0.43.1, expose vision/image models, group llamacpp keys with providers ([#101](https://github.com/inference-gateway/opentask/issues/101)) ([91f0cb3](https://github.com/inference-gateway/opentask/commit/91f0cb3e31e0fecae9245dff665a9297fada4412))

### ♻️ Improvements

* **models:** move debug to top of with: block in workflowYaml template ([#102](https://github.com/inference-gateway/opentask/issues/102)) ([80dcd3b](https://github.com/inference-gateway/opentask/commit/80dcd3be92532746769518a80f95f837ad162ab7))

### 👷 CI

* sync OpenTask Agent workflow ([#105](https://github.com/inference-gateway/opentask/issues/105)) ([7cfe6d6](https://github.com/inference-gateway/opentask/commit/7cfe6d6383de164b2701b1acbe6e6c0ceaec51c3))
* sync OpenTask Agent workflow ([#106](https://github.com/inference-gateway/opentask/issues/106)) ([e6ec950](https://github.com/inference-gateway/opentask/commit/e6ec9506642a6f2a02a49b2b5eccb7cd914c1b66))
* upgrade infer-action version and modify inputs ([0ee5d4c](https://github.com/inference-gateway/opentask/commit/0ee5d4ca000d02ee9140538530ab55d5d0090159))

### 🔧 Miscellaneous

* change debug value to string in tasks.yml ([e503831](https://github.com/inference-gateway/opentask/commit/e5038312bd11898e66890b0a3421c2a8e484780d))
* **deps:** bump infer-action template from v0.43.1 to v0.44.0 ([#104](https://github.com/inference-gateway/opentask/issues/104)) ([5408788](https://github.com/inference-gateway/opentask/commit/5408788bd152b4c0b4916528fac5512454fc2825))
* **deps:** bump the npm group with 4 updates ([#100](https://github.com/inference-gateway/opentask/issues/100)) ([287a9c2](https://github.com/inference-gateway/opentask/commit/287a9c23e194a1c5a3b736b0bdcbee9e72ae8977))
* enable debug mode in inference-gateway action ([6f13d1d](https://github.com/inference-gateway/opentask/commit/6f13d1d7ef4957793e267182d326fa3fcd60bfcb))
* group dependabot updates to reduce PR noise ([#99](https://github.com/inference-gateway/opentask/issues/99)) ([c89901b](https://github.com/inference-gateway/opentask/commit/c89901bca738cb24d9a00c058b2615fb428f8521))

## [1.4.6](https://github.com/inference-gateway/opentask/compare/v1.4.5...v1.4.6) (2026-08-02)

### 🐛 Bug Fixes

* **caret:** remove incorrect scroll subtraction in caretPosition ([#97](https://github.com/inference-gateway/opentask/issues/97)) ([ce38fb1](https://github.com/inference-gateway/opentask/commit/ce38fb15d8e196675a9e7d04af0853be9607d568))
* **models:** remove 'body refined' from board Done condition ([#98](https://github.com/inference-gateway/opentask/issues/98)) ([8ee9e84](https://github.com/inference-gateway/opentask/commit/8ee9e844b0ddbdfc6d15b26475edb311417a6d7f))

## [1.4.5](https://github.com/inference-gateway/opentask/compare/v1.4.4...v1.4.5) (2026-08-02)

### 🐛 Bug Fixes

* render secret-name client id as a secrets reference ([#94](https://github.com/inference-gateway/opentask/issues/94)) ([ab82480](https://github.com/inference-gateway/opentask/commit/ab824809e3ae35cd08234e08c37c173157dc4477))

## [1.4.4](https://github.com/inference-gateway/opentask/compare/v1.4.3...v1.4.4) (2026-08-02)

### 🐛 Bug Fixes

* install on empty repos and surface GitHub's error reason ([#93](https://github.com/inference-gateway/opentask/issues/93)) ([7e43977](https://github.com/inference-gateway/opentask/commit/7e439777ecb1ecd67c9f90c2cc917570ded1f950)), closes [#91](https://github.com/inference-gateway/opentask/issues/91)

## [1.4.3](https://github.com/inference-gateway/opentask/compare/v1.4.2...v1.4.3) (2026-08-02)

### 🐛 Bug Fixes

* guard against crash on empty repos with no commits ([#91](https://github.com/inference-gateway/opentask/issues/91)) ([f3638db](https://github.com/inference-gateway/opentask/commit/f3638db342d51e011899c196c1516ec6022d5072))

### 🔧 Miscellaneous

* **deps:** bump infer-action from v0.39.0/v0.42.1 to v0.42.2 ([#92](https://github.com/inference-gateway/opentask/issues/92)) ([d6263b4](https://github.com/inference-gateway/opentask/commit/d6263b49f14e55874d4106f12191b95d54490181))

## [1.4.2](https://github.com/inference-gateway/opentask/compare/v1.4.1...v1.4.2) (2026-08-01)

### 🔧 Miscellaneous

* bump infer-action to v0.39.0 ([#88](https://github.com/inference-gateway/opentask/issues/88)) ([55411ee](https://github.com/inference-gateway/opentask/commit/55411eed5a12ca8c86958604eb3317c82a0c6acf))
* **deps:** bump infer-action in templates from v0.38.0 to v0.42.1 ([#89](https://github.com/inference-gateway/opentask/issues/89)) ([a7f2081](https://github.com/inference-gateway/opentask/commit/a7f2081d8607abde379d46fda4bf39007075fbfc))

## [1.4.1](https://github.com/inference-gateway/opentask/compare/v1.4.0...v1.4.1) (2026-07-28)

### 🐛 Bug Fixes

* **ci:** update maintainer app ID to client ID in workflows and documentation ([137fa0f](https://github.com/inference-gateway/opentask/commit/137fa0fc994edc88889d69fe01dfc428ae8d093f))

### 🔧 Miscellaneous

* **deps:** bump infer-action from v0.37.1 to v0.38.0 ([#86](https://github.com/inference-gateway/opentask/issues/86)) ([75ba6bd](https://github.com/inference-gateway/opentask/commit/75ba6bdf64bb6b6ba10daa3eeac8bb8113406e0d))
* **deps:** bump inference-gateway/infer-action from v0.36.0 to v0.37.1 ([#85](https://github.com/inference-gateway/opentask/issues/85)) ([b35f790](https://github.com/inference-gateway/opentask/commit/b35f790760b35b22046ffec2578769fccbffe172))

## [1.4.0](https://github.com/inference-gateway/opentask/compare/v1.3.0...v1.4.0) (2026-07-26)

### ✨ Features

* dedicated refine system prompt, editable refine prompt, debug toggle ([#76](https://github.com/inference-gateway/opentask/issues/76)) ([97b7832](https://github.com/inference-gateway/opentask/commit/97b78323498138d3f86408ce243ff9f00cb41dc6))
* **popup:** on-demand RunPod GPU provisioning with llama.cpp model deploy ([#81](https://github.com/inference-gateway/opentask/issues/81)) ([155922f](https://github.com/inference-gateway/opentask/commit/155922faa12d56ae356e95b8daabe6ca964f2231))

### ♻️ Improvements

* **options:** move Agents tab from frontend popover to options page ([#80](https://github.com/inference-gateway/opentask/issues/80)) ([d3b4c60](https://github.com/inference-gateway/opentask/commit/d3b4c6071bae01c6c0bd692b852ec70b501d2cb6))
* **options:** rename Agent tab to Orchestrator ([#78](https://github.com/inference-gateway/opentask/issues/78)) ([04222e5](https://github.com/inference-gateway/opentask/commit/04222e541dc3fca2859319086ba7a81ce66a22a4))

### 👷 CI

* sync OpenTask Agent workflow ([#74](https://github.com/inference-gateway/opentask/issues/74)) ([534176c](https://github.com/inference-gateway/opentask/commit/534176c364f8c45625f8b1419f43bcab0c7ea7a7))
* sync OpenTask Agent workflow ([#75](https://github.com/inference-gateway/opentask/issues/75)) ([b1728b8](https://github.com/inference-gateway/opentask/commit/b1728b8c258f8cf3f2385410d0aea91d7564807d))
* sync OpenTask Agent workflow ([#82](https://github.com/inference-gateway/opentask/issues/82)) ([8619a9f](https://github.com/inference-gateway/opentask/commit/8619a9f7a2e96257a09b01d1ad61645792307bc1))
* sync OpenTask Agent workflow ([#83](https://github.com/inference-gateway/opentask/issues/83)) ([4c209cb](https://github.com/inference-gateway/opentask/commit/4c209cbf4c3e1134ffe16c62e9ea174c055dcf6a))

## [1.3.0](https://github.com/inference-gateway/opentask/compare/v1.2.1...v1.3.0) (2026-07-26)

### ✨ Features

* add Dependencies tab for common CI tool/runtime setup ([#71](https://github.com/inference-gateway/opentask/issues/71)) ([3a975e6](https://github.com/inference-gateway/opentask/commit/3a975e60a85282a804f53049fc7812fa8e05fca7))
* make workflow system-instructions prompt editable ([#69](https://github.com/inference-gateway/opentask/issues/69)) ([e4fcdcd](https://github.com/inference-gateway/opentask/commit/e4fcdcdf5b4a5577ee8fece7669271823fe89d99))
* rebuild options and popup UI on shadcn components ([#67](https://github.com/inference-gateway/opentask/issues/67)) ([6acc3a8](https://github.com/inference-gateway/opentask/commit/6acc3a8293ec32ddc513c9c28c99f1032ca4e4dc))

### ♻️ Improvements

* correct punctuation in comments and text across multiple files ([ac11383](https://github.com/inference-gateway/opentask/commit/ac113833a0af6b4bed23fd10bf4cd355bc357462))

### 🔧 Miscellaneous

* sync OpenTask Agent workflow ([#68](https://github.com/inference-gateway/opentask/issues/68)) ([0edbc6a](https://github.com/inference-gateway/opentask/commit/0edbc6a0f943963b0b268496c6393d062660ac50))

## [1.2.1](https://github.com/inference-gateway/opentask/compare/v1.2.0...v1.2.1) (2026-07-26)

### ♻️ Improvements

* improve owner selection in options ([8a28a89](https://github.com/inference-gateway/opentask/commit/8a28a899c6bc9985fcf40b6929b6462daeeae2a6))
* simplify caching logic in getSkills ([7577d53](https://github.com/inference-gateway/opentask/commit/7577d53674bd981587b4d50e642094f902e00d8e))

### 📚 Documentation

* update README to reflect current codebase state ([#66](https://github.com/inference-gateway/opentask/issues/66)) ([34b380e](https://github.com/inference-gateway/opentask/commit/34b380ef82bea3d2bd9cdcce097016329b651774))

### 🔧 Miscellaneous

* bump infer-action to v0.35.2 ([#65](https://github.com/inference-gateway/opentask/issues/65)) ([9ce8b44](https://github.com/inference-gateway/opentask/commit/9ce8b44ff2e458b946f2f625dfa05b716bd70f4d))

## [1.2.0](https://github.com/inference-gateway/opentask/compare/v1.1.0...v1.2.0) (2026-07-26)

### ✨ Features

* add configurable workflow job timeout ([66365bc](https://github.com/inference-gateway/opentask/commit/66365bce511489600a7b4530bbe5b26c98b58f55))
* add per-owner bot configuration ([52aceaa](https://github.com/inference-gateway/opentask/commit/52aceaa353dbebd07ceeb5a5a770fb392fa0d655))
* add project initialization scaffold ([d6bb78b](https://github.com/inference-gateway/opentask/commit/d6bb78bcbd63d65a9a73683f586b954a6ac62fac))
* anchor palette to caret position ([379294c](https://github.com/inference-gateway/opentask/commit/379294c28c6b8d2dc361e8a402cc43f35fa3a08b))
* **options:** add Create GitHub App button and toggle-style checkboxes ([4f57cf3](https://github.com/inference-gateway/opentask/commit/4f57cf37315db6054e87f82f32c1d37f8c96ee6c))
* **options:** add Create token button prefilling fine-grained PAT ([cd6c0a9](https://github.com/inference-gateway/opentask/commit/cd6c0a905cf9f94f6e02bf3010d4a9fd20cf2de7))
* support per-owner personal access tokens ([17b9e31](https://github.com/inference-gateway/opentask/commit/17b9e3188ab467d3f204848ff6c5622348779c54))
* **ui:** add dark theme support for options page and toolbar popup ([#61](https://github.com/inference-gateway/opentask/issues/61)) ([f2899b7](https://github.com/inference-gateway/opentask/commit/f2899b738cb535c22b15f091c06fbb165c552f36))

### ♻️ Improvements

* rename Infer Agent to OpenTask Agent ([0e30b87](https://github.com/inference-gateway/opentask/commit/0e30b876656e63dba5054e3397f4de10fcf350f5))
* rename Infer references to OpenTask ([67bea00](https://github.com/inference-gateway/opentask/commit/67bea00140227bd9bd13261b24c5d4441bcf7232))
* update directive references from [@infer](https://github.com/infer) to [@opentask](https://github.com/opentask) across documentation and code ([eded6c6](https://github.com/inference-gateway/opentask/commit/eded6c6f1ffec8dc3f9ba3ac27c73750d201defd))

### 🐛 Bug Fixes

* **docs:** standardize punctuation in Safari listing and background documentation ([c8563dd](https://github.com/inference-gateway/opentask/commit/c8563dd16fe760c560142f18f1df711753fb7e7c))
* **task:** allow refine to also update issue title ([#60](https://github.com/inference-gateway/opentask/issues/60)) ([0cc8aae](https://github.com/inference-gateway/opentask/commit/0cc8aae5b2bbd3a34416a9df42af37c18227690e))
* **ui:** apply light theme background when light theme is selected and saved ([#62](https://github.com/inference-gateway/opentask/issues/62)) ([34ee3d1](https://github.com/inference-gateway/opentask/commit/34ee3d1c845cf1070700773d72cc6caf26ac0448))
* **ui:** apply light theme to page background, not just inputs ([529be23](https://github.com/inference-gateway/opentask/commit/529be23ea2d3226ca8bc8a9b0a7148320c093f2a))

### 🔧 Miscellaneous

* bump infer-action to v0.35.1 ([#64](https://github.com/inference-gateway/opentask/issues/64)) ([4ace8a6](https://github.com/inference-gateway/opentask/commit/4ace8a6228bde2c35f45c78755d74a9d9cfde2b0))
* **deps:** bump infer-action from v0.34.6 to v0.35.0 ([#58](https://github.com/inference-gateway/opentask/issues/58)) ([d86f4c8](https://github.com/inference-gateway/opentask/commit/d86f4c8af7f120ef30813b0a38267657d47382f0))
* **options:** rename 'GitHub Comment Helper' to 'OpenTask settings' ([#63](https://github.com/inference-gateway/opentask/issues/63)) ([a113d3e](https://github.com/inference-gateway/opentask/commit/a113d3e65fd1091af4303e5b43a9ea0561eb907a))

## [1.1.0](https://github.com/inference-gateway/opentask/compare/v1.0.2...v1.1.0) (2026-07-25)

### ✨ Features

* add agents section to the extension backend ([#55](https://github.com/inference-gateway/opentask/issues/55)) ([6db0a74](https://github.com/inference-gateway/opentask/commit/6db0a746eb935cc37436c4884d7cdeae9e29a555))
* add Infer Agent workflow ([#49](https://github.com/inference-gateway/opentask/issues/49)) ([eac5eed](https://github.com/inference-gateway/opentask/commit/eac5eeda1e5268aad52257965a136ce1114b0c6a))
* add Infer Agent workflow ([#52](https://github.com/inference-gateway/opentask/issues/52)) ([a6ff533](https://github.com/inference-gateway/opentask/commit/a6ff533471a40da5ffd917bd4df202c6a8782426))
* track issues on their project board via installed workflow ([#48](https://github.com/inference-gateway/opentask/issues/48)) ([d3768ca](https://github.com/inference-gateway/opentask/commit/d3768cab6b7ef3653ab1b7f248f559f887b3a6c6)), closes [#42](https://github.com/inference-gateway/opentask/issues/42)

### 🐛 Bug Fixes

* disable plugins by default and correct plugin repos ([#50](https://github.com/inference-gateway/opentask/issues/50)) ([#51](https://github.com/inference-gateway/opentask/issues/51)) ([97655b7](https://github.com/inference-gateway/opentask/commit/97655b743a07e1fd507f34a046ce68245d42eba2))
* include enabled plugin skills in ! auto-complete menu ([#54](https://github.com/inference-gateway/opentask/issues/54)) ([4bf720f](https://github.com/inference-gateway/opentask/commit/4bf720fa105de79cf25e56f19be1902ac6d013de))
* namespace plugin skills as <plugin>:<skill> in autocomplete ([5291f15](https://github.com/inference-gateway/opentask/commit/5291f1543cda38e819afef33308e733717f4fa5a))

## [1.0.2](https://github.com/inference-gateway/opentask/compare/v1.0.1...v1.0.2) (2026-07-25)

### ♻️ Improvements

* rename extension from 'Inference Gateway for GitHub' to 'OpenTask for GitHub' ([#47](https://github.com/inference-gateway/opentask/issues/47)) ([42c2a4e](https://github.com/inference-gateway/opentask/commit/42c2a4e133f71000324fa343a8aad4742d5dd714))

## [1.0.1](https://github.com/inference-gateway/opentask/compare/v1.0.0...v1.0.1) (2026-07-25)

### 🐛 Bug Fixes

* **refine:** prevent multiple refine clicks, show permanent success state ([#45](https://github.com/inference-gateway/opentask/issues/45)) ([cc11d54](https://github.com/inference-gateway/opentask/commit/cc11d54882b556d3db6f4a6b057296fe7bd49ac2))

## 1.0.0 (2026-07-25)

### ✨ Features

* add infer-action plugins support to generated workflow ([#43](https://github.com/inference-gateway/opentask/issues/43)) ([4fba8fb](https://github.com/inference-gateway/opentask/commit/4fba8fb9897ba865a6e0c7c74cbce9bd10e2090f))

### 🔧 Miscellaneous

* first commit ([6b568b8](https://github.com/inference-gateway/opentask/commit/6b568b81c01782e62a80f62770228044ec2f2aef))

## [0.4.0](https://github.com/inference-gateway/opentask/compare/v0.3.0...v0.4.0) (2026-07-25)

### ✨ Features

* add Infer Agent workflow ([#35](https://github.com/inference-gateway/opentask/issues/35)) ([74ad7e5](https://github.com/inference-gateway/opentask/commit/74ad7e5af6c9a093cf42522c06b4d1dc69ab500f))
* add mergePrompts and new default prompt ([5b738f9](https://github.com/inference-gateway/opentask/commit/5b738f960bb1648b2dc0d09ab66a672049b9a43f))
* **edge:** publish to Microsoft Edge Add-ons ([#30](https://github.com/inference-gateway/opentask/issues/30)) ([25a7675](https://github.com/inference-gateway/opentask/commit/25a7675eea83ee3ad245e47a49d67d2ab7f6a6e1))
* **firefox:** add Firefox-compatible build with shared manifest overrides ([#32](https://github.com/inference-gateway/opentask/issues/32)) ([4ca737d](https://github.com/inference-gateway/opentask/commit/4ca737d6b071707427a2a260e1b69823351b3e6c))
* **safari:** add Safari Web Extension packaging and release docs ([#33](https://github.com/inference-gateway/opentask/issues/33)) ([9e6a80f](https://github.com/inference-gateway/opentask/commit/9e6a80f7e03d68f4817fbdd7aaad39d160c4c334))

### 🐛 Bug Fixes

* **workflow:** attribute generated-workflow commits to the App bot ([#34](https://github.com/inference-gateway/opentask/issues/34)) ([301ffd4](https://github.com/inference-gateway/opentask/commit/301ffd49a6ae29a26e135a3cae889fc263160df4))

### 👷 CI

* **tasks:** install task CLI in tasks.yml workflow ([#31](https://github.com/inference-gateway/opentask/issues/31)) ([970e628](https://github.com/inference-gateway/opentask/commit/970e628b22850a90636af5ab02ce0dc74c4fe094))

### 🔧 Miscellaneous

* update repository URL in .releaserc.yaml ([80ee5eb](https://github.com/inference-gateway/opentask/commit/80ee5eb86c4b46effb8ef2a2b9e113ee17b0db52))

## [0.3.0](https://github.com/inference-gateway/browser-extension/compare/v0.2.0...v0.3.0) (2026-07-24)

### ✨ Features

* add Infer Agent workflow ([#22](https://github.com/inference-gateway/browser-extension/issues/22)) ([cbff7ff](https://github.com/inference-gateway/browser-extension/commit/cbff7ff78109564ec8bb5d5a2e99cbc7cd70ddc1))
* add Infer Agent workflow ([#24](https://github.com/inference-gateway/browser-extension/issues/24)) ([759b677](https://github.com/inference-gateway/browser-extension/commit/759b677963c612dc96b25817d0dff1c5b584343e))
* add Infer Agent workflow ([#25](https://github.com/inference-gateway/browser-extension/issues/25)) ([baeb539](https://github.com/inference-gateway/browser-extension/commit/baeb5398667de26b3706e399b3b2d8e1d33e2fa4))
* add Infer Agent workflow ([#27](https://github.com/inference-gateway/browser-extension/issues/27)) ([3619140](https://github.com/inference-gateway/browser-extension/commit/3619140c45f518dd8249f05f2c72683bec13bc48))
* add permissions management for Infer Agent and update workflow generation ([5d23370](https://github.com/inference-gateway/browser-extension/commit/5d233703a13230ca10de0b20ada24d1287e1e478))
* add skills registry and task management ([f652da6](https://github.com/inference-gateway/browser-extension/commit/f652da68b829ca7eabc5c5de4282618a5c871ff6))
* **popup:** add toolbar popup with one-click Infer Agent install ([#19](https://github.com/inference-gateway/browser-extension/issues/19)) ([93b4634](https://github.com/inference-gateway/browser-extension/commit/93b46345d68f3dbc8f50b9493a4ee8467baa1cae))
* **edge:** publish to Microsoft Edge Add-ons ([#8](https://github.com/inference-gateway/browser-extension/issues/8))

### 🐛 Bug Fixes

* handle empty path in ghFetch URL ([1dd57d9](https://github.com/inference-gateway/browser-extension/commit/1dd57d9c830229e8ff7657fd17967e96b2ac3fbf))

### 🔧 Miscellaneous

* delete .github/workflows/infer.yml ([f97fe01](https://github.com/inference-gateway/browser-extension/commit/f97fe01657c83046d51d9c18795675def9d7da20))

## [0.2.0](https://github.com/inference-gateway/browser-extension/compare/v0.1.0...v0.2.0) (2026-07-24)

### ✨ Features

* add deterministic marketplace packaging and GitHub Release artifacts ([#15](https://github.com/inference-gateway/browser-extension/issues/15)) ([5500226](https://github.com/inference-gateway/browser-extension/commit/5500226aee216d41b100f47681104b06f296c1f1))
* add privacy docs and harden GitHub token management ([#14](https://github.com/inference-gateway/browser-extension/issues/14)) ([2e14581](https://github.com/inference-gateway/browser-extension/commit/2e145810d21592567733e4a7500f1a3830dc3ed5))
* prepare Chrome Web Store listing assets ([#16](https://github.com/inference-gateway/browser-extension/issues/16)) ([290797e](https://github.com/inference-gateway/browser-extension/commit/290797ecdbe7b791e14ff29e8160700ca736a7c5))

### 📚 Documentation

* update package description ([96b650b](https://github.com/inference-gateway/browser-extension/commit/96b650b295a528a6f3227f4c14dc5ba0304d9e7a))
