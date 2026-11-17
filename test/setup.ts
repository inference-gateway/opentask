import { JSDOM } from "jsdom";

const dom = new JSDOM("");
(globalThis as { window?: unknown }).window = dom.window;
(globalThis as { document?: unknown }).document = dom.window.document;
(globalThis as { Event?: unknown }).Event = dom.window.Event;
(globalThis as { KeyboardEvent?: unknown }).KeyboardEvent = dom.window.KeyboardEvent;
