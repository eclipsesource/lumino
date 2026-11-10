// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { CommandRegistry } from '@lumino/commands';
import {
  ContextMenu,
  Menu,
  MenuBar,
  PanelLayout,
  Widget
} from '@lumino/widgets';

import '../style/index.css';

/**
 * Wrapper widget containing the example application.
 */
class Application extends Widget {
  constructor() {
    super({ tag: 'main' });
  }
}

/**
 * Skip link to jump to the main content.
 */
class SkipLink extends Widget {
  /**
   * Create a HTMLElement that statically links to "#content".
   */
  static createNode(): HTMLElement {
    const node = document.createElement('a');
    node.setAttribute('href', '#content');
    node.innerHTML = 'Skip to the main content';
    node.classList.add('lm-example-skip-link');
    return node;
  }

  constructor() {
    super({ node: SkipLink.createNode() });
  }
}

/**
 * A Widget containing some content to provide context example.
 */
class Article extends Widget {
  /**
   * Create the content structure.
   */
  static createNode(title: string, buttons: HTMLElement[]): HTMLElement {
    const node = document.createElement('div');
    node.setAttribute('id', 'content');
    node.setAttribute('tabindex', '-1');
    const h1 = document.createElement('h1');
    h1.innerHTML = title;
    node.appendChild(h1);
    for (const button of buttons) {
      node.appendChild(button);
    }
    const area = document.createElement('div');
    area.classList.add('lm-example-context-area');
    area.innerHTML = 'Right click here to open a context menu';
    node.appendChild(area);
    return node;
  }

  constructor(title: string, buttons: HTMLElement[] = []) {
    super({ node: Article.createNode(title, buttons) });
  }
}

/**
 * Helper Function to add commands.
 */
function addCommand(
  commands: CommandRegistry,
  command: string,
  label: string,
  log: string,
  shortcut?: string
): void {
  commands.addCommand(command, {
    label: label,
    execute: () => {
      console.log(log);
    }
  });

  if (shortcut) {
    commands.addKeyBinding({
      command,
      keys: [shortcut],
      selector: 'body'
    });
  }
}

/**
 * Create the command registry shared by all windows.
 */
function createCommands(): CommandRegistry {
  const commands = new CommandRegistry();
  addCommand(commands, 'new', 'New', 'File > New', 'Accel N');
  addCommand(commands, 'open', 'Open', 'File > Open', 'Accel O');
  addCommand(commands, 'save', 'Save', 'File > Save', 'Accel S');
  addCommand(
    commands,
    'recent1',
    'notes.txt',
    'File > Open Recent > notes.txt'
  );
  addCommand(commands, 'recent2', 'todo.md', 'File > Open Recent > todo.md');
  addCommand(commands, 'cut', 'Cut', 'Edit > Cut');
  addCommand(commands, 'copy', 'Copy', 'Edit > Copy');
  addCommand(commands, 'paste', 'Paste', 'Edit > Paste');
  addCommand(
    commands,
    'runThis',
    'Run this cell',
    'Run > Run this cell',
    'Shift Enter'
  );
  addCommand(
    commands,
    'runAll',
    'Run all cells',
    'Run > Run all cells',
    'Accel Shift Enter'
  );
  return commands;
}

/**
 * Helper Function to create a menu.
 */
function createMenu(
  commands: CommandRegistry,
  label: string,
  items: (string | Menu)[]
): Menu {
  const menu = new Menu({ commands });
  menu.title.label = label;
  for (const item of items) {
    if (typeof item === 'string') {
      menu.addItem({ type: 'command', command: item });
    } else {
      menu.addItem({ type: 'submenu', submenu: item });
    }
  }
  return menu;
}

/**
 * Create a menu bar. Each window needs its own menu bar.
 */
function createMenuBar(commands: CommandRegistry): MenuBar {
  const menubar = new MenuBar();
  const recentMenu = createMenu(commands, 'Open Recent', [
    'recent1',
    'recent2'
  ]);
  menubar.addMenu(
    createMenu(commands, 'File', ['new', 'open', recentMenu, 'save'])
  );
  menubar.addMenu(createMenu(commands, 'Edit', ['cut', 'copy', 'paste']));
  menubar.addMenu(createMenu(commands, 'Run', ['runThis', 'runAll']));
  return menubar;
}

/**
 * Create a context menu which is shared by all windows.
 */
function createContextMenu(commands: CommandRegistry): ContextMenu {
  const contextMenu = new ContextMenu({ commands });
  for (const command of ['cut', 'copy', 'paste']) {
    contextMenu.addItem({ command, selector: '.lm-example-context-area' });
  }
  return contextMenu;
}

/**
 * Create the application widget for a window.
 */
function createApplication(
  commands: CommandRegistry,
  article: Article
): Application {
  const app = new Application();
  const appLayout = new PanelLayout();
  app.layout = appLayout;
  appLayout.addWidget(new SkipLink());
  appLayout.addWidget(createMenuBar(commands));
  appLayout.addWidget(article);
  return app;
}

/**
 * Open the context menu for `'contextmenu'` events of a document.
 */
function installContextMenu(doc: Document, contextMenu: ContextMenu): void {
  doc.addEventListener('contextmenu', (event: MouseEvent) => {
    if (contextMenu.open(event)) {
      event.preventDefault();
    }
  });
}

/**
 * The currently open secondary window.
 */
let secondaryWindow: Window | null = null;

/**
 * Open a secondary window.
 *
 * The widgets are created and controlled by the main window and only
 * rendered into the document of the secondary window.
 */
function openSecondaryWindow(
  commands: CommandRegistry,
  contextMenu: ContextMenu
): void {
  if (secondaryWindow && !secondaryWindow.closed) {
    secondaryWindow.focus();
    return;
  }
  const win = window.open('', '', 'popup,width=520,height=360');
  if (!win) {
    console.warn('The secondary window was blocked by the browser.');
    return;
  }
  secondaryWindow = win;

  // Initialize the document in standards mode. The initial `about:blank`
  // document is in quirks mode, which breaks class name lookups of nodes
  // adopted from the main document in Chromium.
  const doc = win.document;
  doc.open();
  doc.write('<!DOCTYPE html><html><head></head><body></body></html>');
  doc.close();
  doc.title = 'MenuBar Example: Secondary Window';

  // Copy the styles of the main window.
  for (const node of Array.from(
    document.head.querySelectorAll('style, link[rel="stylesheet"]')
  )) {
    doc.head.appendChild(doc.importNode(node, true));
  }

  const app = createApplication(commands, new Article('Secondary Window', []));
  Widget.attach(app, doc.body);
  installContextMenu(doc, contextMenu);

  // Dispose the widgets when the secondary window is closed.
  win.addEventListener('pagehide', () => {
    app.dispose();
    secondaryWindow = null;
  });
}

/**
 * Create the MenuBar example application.
 */
function main(): void {
  const commands = createCommands();
  const contextMenu = createContextMenu(commands);

  const button = document.createElement('button');
  button.innerHTML = 'A button you can tab to out of the menubar';

  const secondaryButton = document.createElement('button');
  secondaryButton.innerHTML = 'Open a secondary window';
  secondaryButton.addEventListener('click', () => {
    openSecondaryWindow(commands, contextMenu);
  });

  const article = new Article('MenuBar Example', [button, secondaryButton]);
  const app = createApplication(commands, article);
  Widget.attach(app, document.body);
  installContextMenu(document, contextMenu);

  // Close the secondary window together with the main window.
  window.addEventListener('pagehide', () => secondaryWindow?.close());
}

window.onload = main;
