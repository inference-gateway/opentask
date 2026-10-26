// textarea-caret ships no types; this is its full surface.
declare module "textarea-caret" {
  export default function getCaretCoordinates(
    element: HTMLTextAreaElement | HTMLInputElement,
    position: number,
    options?: { debug?: boolean }
  ): { top: number; left: number; height: number };
}
