// DOMPurify needs a DOM. Expose only window/document from jsdom - not location -
// so tests that stub globalThis.location (refine.test.ts) keep working.
import { JSDOM } from "jsdom";

const dom = new JSDOM("");
(globalThis as { window?: unknown }).window = dom.window;
(globalThis as { document?: unknown }).document = dom.window.document;
