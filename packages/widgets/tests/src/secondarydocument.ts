// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

/**
 * A second document driven by the main window, like a secondary window.
 */
export interface ISecondaryDocument {
  /**
   * The iframe hosting the document.
   */
  readonly iframe: HTMLIFrameElement;

  /**
   * The window of the document.
   */
  readonly window: Window;

  /**
   * The secondary document.
   */
  readonly document: Document;

  /**
   * Resize the viewport of the document.
   */
  resize(width: number, height: number): void;

  /**
   * Remove the iframe and its document.
   */
  dispose(): void;
}

/**
 * Create a same-origin iframe which acts as a secondary window.
 *
 * Widgets are created in the main document and attached to the iframe
 * document, which is how applications render widgets in secondary windows.
 * The styles of the main document are copied into the iframe document.
 */
export function createSecondaryDocument(
  options: { width?: number; height?: number } = {}
): ISecondaryDocument {
  const { width = 300, height = 200 } = options;
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '0';
  iframe.style.left = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(
    '<!DOCTYPE html><html><head></head>' +
      '<body style="margin: 0"></body></html>'
  );
  doc.close();
  doc.documentElement.style.overflow = 'hidden';
  for (const node of Array.from(
    document.head.querySelectorAll('style, link[rel="stylesheet"]')
  )) {
    doc.head.appendChild(doc.importNode(node, true));
  }

  const resize = (w: number, h: number) => {
    iframe.style.width = `${w}px`;
    iframe.style.height = `${h}px`;
  };
  resize(width, height);

  return {
    iframe,
    window: iframe.contentWindow!,
    document: doc,
    resize,
    dispose: () => iframe.remove()
  };
}
