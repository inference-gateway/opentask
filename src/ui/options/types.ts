import type { BotConfig } from "../../shared/models";

// One editable account = an owner plus its bot config, backed by the owner-keyed
// "bots" storage list. GitHub auth itself lives with the infer CLI's gh login.
export type Account = { owner: string; bot: BotConfig };
