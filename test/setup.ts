// DOMPurify needs a DOM. Expose only window/document from jsdom - not location -
// so tests that stub globalThis.location (refine.test.ts) keep working.
import { JSDOM } from "jsdom";

const dom = new JSDOM("");
(globalThis as { window?: unknown }).window = dom.window;
(globalThis as { document?: unknown }).document = dom.window.document;
// jsdom's dispatchEvent rejects events built with Bun's native constructors.
(globalThis as { Event?: unknown }).Event = dom.window.Event;
(globalThis as { KeyboardEvent?: unknown }).KeyboardEvent = dom.window.KeyboardEvent;
