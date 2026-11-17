/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

export namespace Utils {
  /**
   * Clamp a dimension value to an integer >= 0.
   */
  export function clampDimension(value: number): number {
    return Math.max(0, Math.floor(value));
  }

  /**
   * Adopt a node into the document of a parent node.
   *
   * Inserting a node into a parent of another document adopts it anyway.
   * Adopting it before the `'before-attach'` message is sent lets handlers
   * rely on `node.ownerDocument`, for example in secondary windows.
   */
  export function adoptNode(node: Node, parent: Node): void {
    const doc = parent.ownerDocument;
    if (doc && node.ownerDocument !== doc) {
      doc.adoptNode(node);
    }
  }

  /**
   * Whether a pointer event came from touch input.
   */
  export function isTouchEvent(event: PointerEvent | MouseEvent): boolean {
    return 'pointerType' in event && event.pointerType === 'touch';
  }
}

export default Utils;
