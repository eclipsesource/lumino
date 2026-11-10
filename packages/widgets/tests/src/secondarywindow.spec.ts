// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
import { expect } from 'chai';

import { CommandRegistry } from '@lumino/commands';

import { MessageLoop } from '@lumino/messaging';

import { ContextMenu, Menu, MenuBar, Widget } from '@lumino/widgets';

import {
  createSecondaryDocument,
  ISecondaryDocument
} from './secondarydocument';

const bubbles = true;

/**
 * The size of the secondary document viewport.
 */
const WIDTH = 300;
const HEIGHT = 200;

/**
 * Tolerance for subpixel positioning.
 */
const EPSILON = 0.5;

class EventLogMenu extends Menu {
  events: string[] = [];

  handleEvent(event: Event): void {
    super.handleEvent(event);
    this.events.push(event.type);
  }
}

class EventLogMenuBar extends MenuBar {
  events: string[] = [];

  handleEvent(event: Event): void {
    super.handleEvent(event);
    this.events.push(event.type);
  }
}

function pointerDown(target: EventTarget, clientX: number, clientY: number) {
  target.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles,
      cancelable: true,
      clientX,
      clientY
    })
  );
}

function keyDown(target: EventTarget, keyCode: number) {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { bubbles, cancelable: true, keyCode })
  );
}

function contextMenu(target: EventTarget, clientX: number, clientY: number) {
  target.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles,
      cancelable: true,
      clientX,
      clientY
    })
  );
}

/**
 * Count the viewport measurements of the main document while running `fn`.
 *
 * Opening a menu in a secondary document should not force a layout of the
 * main document.
 */
function countMainDocumentMeasurements(fn: () => void): number {
  const element = document.documentElement;
  const descriptor = Object.getOwnPropertyDescriptor(
    Element.prototype,
    'clientWidth'
  )!;
  let count = 0;
  Object.defineProperty(element, 'clientWidth', {
    configurable: true,
    get() {
      count++;
      return descriptor.get!.call(this);
    }
  });
  try {
    fn();
  } finally {
    delete (element as any).clientWidth;
  }
  return count;
}

function center(node: Element): { x: number; y: number } {
  const rect = node.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

describe('@lumino/widgets', () => {
  describe('secondary window support', () => {
    let commands: CommandRegistry;
    let executed: string[];
    let secondary: ISecondaryDocument;
    let widgets: Widget[];

    /**
     * Dispose the widget after the test.
     */
    function track<T extends Widget>(widget: T): T {
      widgets.push(widget);
      return widget;
    }

    function createMenu(
      ids: string[] = ['one', 'two', 'three'],
      menu: Menu = new Menu({ commands })
    ): Menu {
      for (const id of ids) {
        menu.addItem({ command: 'test', args: { id } });
      }
      return track(menu);
    }

    beforeEach(() => {
      commands = new CommandRegistry();
      executed = [];
      commands.addCommand('test', {
        label: args => `Menu item ${args.id}`,
        execute: args => {
          executed.push(args.id as string);
        }
      });
      widgets = [];
      secondary = createSecondaryDocument({ width: WIDTH, height: HEIGHT });
    });

    afterEach(() => {
      for (const widget of widgets) {
        widget.dispose();
      }
      secondary.dispose();
    });

    describe('Menu', () => {
      it('should attach to the host document', () => {
        const menu = createMenu();
        menu.open(10, 10, { host: secondary.document.body });
        expect(menu.isAttached).to.equal(true);
        expect(menu.node.ownerDocument).to.equal(secondary.document);
        expect(menu.node.parentNode).to.equal(secondary.document.body);
      });

      it('should close on pointerdown outside the menu in the host document', () => {
        const menu = createMenu();
        menu.open(10, 10, { host: secondary.document.body });
        pointerDown(secondary.document.body, WIDTH - 5, HEIGHT - 5);
        expect(menu.isAttached).to.equal(false);
      });

      it('should not close on pointerdown inside the menu', () => {
        const menu = createMenu();
        menu.open(10, 10, { host: secondary.document.body });
        const { x, y } = center(menu.contentNode.children[0]);
        pointerDown(menu.contentNode.children[0], x, y);
        expect(menu.isAttached).to.equal(true);
      });

      it('should not listen on the main document', () => {
        const menu = createMenu();
        menu.open(10, 10, { host: secondary.document.body });
        pointerDown(document.body, -10, -10);
        expect(menu.isAttached).to.equal(true);
      });

      it('should remove the host document listener on close', () => {
        const menu = createMenu([], new EventLogMenu({ commands }));
        menu.addItem({ command: 'test', args: { id: 'one' } });
        menu.open(10, 10, { host: secondary.document.body });
        menu.close();
        (menu as EventLogMenu).events = [];
        pointerDown(secondary.document.body, WIDTH - 5, HEIGHT - 5);
        expect((menu as EventLogMenu).events).to.not.contain('pointerdown');
      });

      it('should keep the menu within the host viewport', () => {
        const menu = createMenu();
        menu.open(WIDTH - 10, HEIGHT - 10, { host: secondary.document.body });
        const rect = menu.node.getBoundingClientRect();
        expect(rect.right).to.be.at.most(WIDTH + EPSILON);
        expect(rect.bottom).to.be.at.most(HEIGHT + EPSILON);
      });

      it('should use the text direction of the host document', () => {
        secondary.document.documentElement.dir = 'rtl';
        const menu = createMenu();
        menu.open(250, 10, { host: secondary.document.body });
        const rect = menu.node.getBoundingClientRect();
        expect(rect.right).to.be.closeTo(250, 1);
      });

      it('should open submenus in the parent menu document', () => {
        const submenu = createMenu();
        const menu = createMenu();
        menu.addItem({ type: 'submenu', submenu });
        menu.open(10, 10, { host: secondary.document.body });
        menu.activeIndex = menu.items.length - 1;
        menu.triggerActiveItem();
        expect(menu.childMenu).to.equal(submenu);
        expect(submenu.node.ownerDocument).to.equal(secondary.document);
        expect(submenu.node.parentNode).to.equal(secondary.document.body);
      });

      it('should not measure the main document', () => {
        const submenu = createMenu();
        const menu = createMenu();
        menu.addItem({ type: 'submenu', submenu });
        const count = countMainDocumentMeasurements(() => {
          menu.open(10, 10, { host: secondary.document.body });
          menu.activeIndex = menu.items.length - 1;
          menu.triggerActiveItem();
        });
        expect(submenu.isAttached).to.equal(true);
        expect(count).to.equal(0);
      });

      it('should keep submenus within the parent menu viewport', () => {
        const submenu = createMenu();
        const menu = createMenu();
        menu.addItem({ type: 'submenu', submenu });
        menu.open(WIDTH, 10, { host: secondary.document.body });
        menu.activeIndex = menu.items.length - 1;
        menu.triggerActiveItem();
        const rect = submenu.node.getBoundingClientRect();
        expect(rect.right).to.be.at.most(WIDTH + EPSILON);
      });

      it('should close submenus with the root menu', () => {
        const submenu = createMenu();
        const menu = createMenu();
        menu.addItem({ type: 'submenu', submenu });
        menu.open(10, 10, { host: secondary.document.body });
        menu.activeIndex = menu.items.length - 1;
        menu.triggerActiveItem();
        pointerDown(secondary.document.body, WIDTH - 5, HEIGHT - 5);
        expect(menu.isAttached).to.equal(false);
        expect(submenu.isAttached).to.equal(false);
      });

      it('should reopen in the main document', () => {
        const menu = createMenu();
        menu.open(10, 10, { host: secondary.document.body });
        menu.close();
        menu.open(10, 10);
        expect(menu.node.ownerDocument).to.equal(document);
        expect(menu.node.parentNode).to.equal(document.body);
        pointerDown(secondary.document.body, WIDTH - 5, HEIGHT - 5);
        expect(menu.isAttached).to.equal(true);
        pointerDown(document.body, -10, -10);
        expect(menu.isAttached).to.equal(false);
      });

      it('should not use window data saved for another document', () => {
        const menu = createMenu();
        Menu.saveWindowData();
        menu.open(WIDTH - 10, HEIGHT - 10, { host: secondary.document.body });
        const rect = menu.node.getBoundingClientRect();
        expect(rect.right).to.be.at.most(WIDTH + EPSILON);
        expect(rect.bottom).to.be.at.most(HEIGHT + EPSILON);
      });

      it('should use window data saved for the host document', () => {
        const menu = createMenu();
        Menu.saveWindowData(secondary.document);
        // The cached viewport is still WIDTH wide, so the menu is not moved.
        secondary.resize(50, HEIGHT);
        menu.open(10, 10, { host: secondary.document.body });
        expect(menu.node.getBoundingClientRect().left).to.be.closeTo(10, 1);
      });
    });

    describe('MenuBar', () => {
      let bar: EventLogMenuBar;
      let menu: Menu;

      beforeEach(() => {
        bar = track(new EventLogMenuBar());
        menu = createMenu();
        menu.title.label = 'File';
        bar.addMenu(menu);
        Widget.attach(bar, secondary.document.body);
        MessageLoop.sendMessage(bar, Widget.Msg.UpdateRequest);
      });

      it('should open menus in the menu bar document', () => {
        bar.activeIndex = 0;
        bar.openActiveMenu();
        expect(menu.isAttached).to.equal(true);
        expect(menu.node.ownerDocument).to.equal(secondary.document);
        expect(menu.node.parentNode).to.equal(secondary.document.body);
      });

      it('should not measure the main document', () => {
        const item = bar.contentNode.children[0];
        const { x, y } = center(item);
        const count = countMainDocumentMeasurements(() => {
          pointerDown(item, x, y);
        });
        expect(menu.isAttached).to.equal(true);
        expect(count).to.equal(0);
      });

      it('should keep an explicit host from `forceItemsPosition`', () => {
        const host = secondary.document.createElement('div');
        secondary.document.body.appendChild(host);
        const hostedBar = track(
          new MenuBar({ forceItemsPosition: { forceX: true, host } })
        );
        const hostedMenu = createMenu();
        hostedMenu.title.label = 'Edit';
        hostedBar.addMenu(hostedMenu);
        Widget.attach(hostedBar, secondary.document.body);
        hostedBar.activeIndex = 0;
        hostedBar.openActiveMenu();
        expect(hostedMenu.node.parentNode).to.equal(host);
      });

      it('should toggle the menu on pointerdown on the menu bar item', () => {
        const item = bar.contentNode.children[0];
        const { x, y } = center(item);
        pointerDown(item, x, y);
        expect(menu.isAttached).to.equal(true);
        pointerDown(item, x, y);
        expect(menu.isAttached).to.equal(false);
      });

      it('should close the menu on pointerdown outside in the menu bar document', () => {
        bar.activeIndex = 0;
        bar.openActiveMenu();
        pointerDown(secondary.document.body, WIDTH - 5, HEIGHT - 5);
        expect(menu.isAttached).to.equal(false);
        expect(bar.childMenu).to.equal(null);
      });

      it('should remove the menu bar document listener on close', () => {
        bar.activeIndex = 0;
        bar.openActiveMenu();
        menu.close();
        bar.events = [];
        pointerDown(secondary.document.body, WIDTH - 5, HEIGHT - 5);
        expect(bar.events).to.not.contain('pointerdown');
      });
    });

    describe('ContextMenu', () => {
      let contextMenuWidget: ContextMenu;
      let target: HTMLElement;

      beforeEach(() => {
        contextMenuWidget = new ContextMenu({ commands });
        track(contextMenuWidget.menu);
        contextMenuWidget.addItem({
          command: 'test',
          args: { id: 'context' },
          selector: '.lm-test-target'
        });
        target = secondary.document.createElement('div');
        target.className = 'lm-test-target';
        target.style.position = 'absolute';
        target.style.left = '50px';
        target.style.top = '50px';
        target.style.width = '50px';
        target.style.height = '50px';
        secondary.document.body.appendChild(target);
      });

      it('should open in the document of the event target', () => {
        const opened = contextMenuWidget.open({
          target,
          currentTarget: secondary.document.body,
          clientX: 60,
          clientY: 60
        } as any);
        expect(opened).to.equal(true);
        const node = contextMenuWidget.menu.node;
        expect(node.ownerDocument).to.equal(secondary.document);
        expect(node.parentNode).to.equal(secondary.document.body);
      });

      it('should not measure the main document', () => {
        const count = countMainDocumentMeasurements(() => {
          contextMenuWidget.open({
            target,
            currentTarget: secondary.document.body,
            clientX: 60,
            clientY: 60
          } as any);
        });
        expect(contextMenuWidget.menu.isAttached).to.equal(true);
        expect(count).to.equal(0);
      });

      it('should resolve a detached target in the current target document', () => {
        const detached = secondary.document.createElement('div');
        const opened = contextMenuWidget.open({
          target: detached,
          currentTarget: secondary.document.body,
          clientX: 75,
          clientY: 75
        } as any);
        expect(opened).to.equal(true);
      });

      it('should fall back to the main document without an event target', () => {
        const opened = contextMenuWidget.open({
          target: null,
          currentTarget: null,
          clientX: 10,
          clientY: 10
        } as any);
        expect(opened).to.equal(false);
      });
    });

    describe('smoke tests', () => {
      it('should support a menu bar workflow with submenus and keyboard', () => {
        const recent = createMenu(['recent']);
        recent.title.label = 'Open Recent';
        const file = createMenu(['open']);
        file.title.label = 'File';
        file.addItem({ type: 'submenu', submenu: recent });
        const bar = track(new MenuBar());
        bar.addMenu(file);
        Widget.attach(bar, secondary.document.body);
        MessageLoop.sendMessage(bar, Widget.Msg.UpdateRequest);

        // Open the menu with the pointer.
        const item = bar.contentNode.children[0];
        const { x, y } = center(item);
        pointerDown(item, x, y);
        expect(file.node.parentNode).to.equal(secondary.document.body);

        // Navigate into the submenu with the keyboard.
        keyDown(file.node, 40); // Down arrow
        keyDown(file.node, 40); // Down arrow
        keyDown(file.node, 39); // Right arrow
        expect(recent.node.parentNode).to.equal(secondary.document.body);
        const rect = recent.node.getBoundingClientRect();
        expect(rect.right).to.be.at.most(WIDTH + EPSILON);

        // Trigger the submenu item.
        keyDown(recent.node, 13); // Enter
        expect(executed).to.deep.equal(['recent']);
        expect(file.isAttached).to.equal(false);
        expect(recent.isAttached).to.equal(false);
        expect(bar.childMenu).to.equal(null);

        // Interacting with the document afterwards is a no-op.
        pointerDown(secondary.document.body, WIDTH - 5, HEIGHT - 5);
        expect(executed).to.deep.equal(['recent']);
      });

      it('should support a context menu used in both documents', () => {
        const contextMenuWidget = new ContextMenu({ commands });
        track(contextMenuWidget.menu);
        contextMenuWidget.addItem({
          command: 'test',
          args: { id: 'context' },
          selector: '.lm-test-target'
        });
        const listener = (event: MouseEvent) => {
          if (contextMenuWidget.open(event)) {
            event.preventDefault();
          }
        };
        const mainTarget = document.createElement('div');
        mainTarget.className = 'lm-test-target';
        document.body.appendChild(mainTarget);
        const secondaryTarget = secondary.document.createElement('div');
        secondaryTarget.className = 'lm-test-target';
        secondary.document.body.appendChild(secondaryTarget);
        document.addEventListener('contextmenu', listener);
        secondary.document.addEventListener('contextmenu', listener);
        const menu = contextMenuWidget.menu;

        try {
          // Open in the secondary document and trigger an item.
          contextMenu(secondaryTarget, 10, 10);
          expect(menu.node.parentNode).to.equal(secondary.document.body);
          keyDown(menu.node, 40); // Down arrow
          keyDown(menu.node, 13); // Enter
          expect(executed).to.deep.equal(['context']);
          expect(menu.isAttached).to.equal(false);

          // Open in the main document and dismiss it.
          contextMenu(mainTarget, 10, 10);
          expect(menu.node.parentNode).to.equal(document.body);
          pointerDown(secondary.document.body, WIDTH - 5, HEIGHT - 5);
          expect(menu.isAttached).to.equal(true);
          pointerDown(document.body, -10, -10);
          expect(menu.isAttached).to.equal(false);

          // Open in the secondary document again and dismiss it.
          contextMenu(secondaryTarget, 10, 10);
          expect(menu.node.parentNode).to.equal(secondary.document.body);
          pointerDown(secondary.document.body, WIDTH - 5, HEIGHT - 5);
          expect(menu.isAttached).to.equal(false);
        } finally {
          document.removeEventListener('contextmenu', listener);
          secondary.document.removeEventListener('contextmenu', listener);
          mainTarget.remove();
        }
      });
    });
  });
});
