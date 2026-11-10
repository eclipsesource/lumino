// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
import { expect } from 'chai';

import {
  BasicMouseHandler,
  BasicSelectionModel,
  CellEditor,
  DataGrid,
  DataModel,
  OptionCellEditor
} from '@lumino/datagrid';

import { Widget } from '@lumino/widgets';

/**
 * A small data model with multi select option cells.
 */
class OptionModel extends DataModel {
  rowCount(region: DataModel.RowRegion): number {
    return region === 'body' ? 10 : 1;
  }

  columnCount(region: DataModel.ColumnRegion): number {
    return region === 'body' ? 10 : 1;
  }

  data(region: DataModel.CellRegion, row: number, column: number): any {
    return region === 'body' ? ['a'] : '';
  }

  metadata(
    region: DataModel.CellRegion,
    row: number,
    column: number
  ): DataModel.Metadata {
    return region === 'body'
      ? { type: 'array', constraint: { enum: ['a', 'b'] } }
      : {};
  }
}

/**
 * A data grid which records the events it handles.
 */
class LogGrid extends DataGrid {
  events: string[] = [];

  handleEvent(event: Event): void {
    this.events.push(event.type);
    super.handleEvent(event);
  }
}

/**
 * Assert that two values are identical.
 *
 * The test runner hangs when it serializes nodes of another window for a
 * failed `expect(actual).to.equal(expected)` assertion.
 */
function expectSame(actual: unknown, expected: unknown, what: string): void {
  expect(actual === expected, `unexpected ${what}`).to.equal(true);
}

function mouse(target: EventTarget, type: string, x: number, y: number) {
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      button: 0
    })
  );
}

describe('@lumino/datagrid', () => {
  describe('secondary window support', () => {
    let iframe: HTMLIFrameElement;
    let doc: Document;
    let grid: LogGrid;

    beforeEach(() => {
      iframe = document.createElement('iframe');
      iframe.style.width = '400px';
      iframe.style.height = '300px';
      document.body.appendChild(iframe);
      doc = iframe.contentDocument!;
      doc.open();
      doc.write('<!DOCTYPE html><html><head></head><body></body></html>');
      doc.close();
      doc.body.style.margin = '0';
      grid = new LogGrid();
      grid.dataModel = new OptionModel();
      grid.node.style.position = 'absolute';
      grid.node.style.width = '400px';
      grid.node.style.height = '300px';
      Widget.attach(grid, doc.body);
    });

    afterEach(() => {
      grid.dispose();
      iframe.remove();
    });

    it('should listen for resize on the window of its document', () => {
      grid.events = [];
      window.dispatchEvent(new Event('resize'));
      expect(grid.events).to.not.contain('resize');
      iframe.contentWindow!.dispatchEvent(new Event('resize'));
      expect(grid.events).to.contain('resize');
      Widget.detach(grid);
      grid.events = [];
      iframe.contentWindow!.dispatchEvent(new Event('resize'));
      expect(grid.events).to.not.contain('resize');
    });

    it('should capture mouse drags in its document', () => {
      grid.mouseHandler = new BasicMouseHandler();
      grid.selectionModel = new BasicSelectionModel({
        dataModel: grid.dataModel!
      });
      mouse(grid.viewport.node, 'mousedown', 200, 150);
      expect(doc.querySelector('.lm-cursor-backdrop')).to.not.equal(null);
      expect(document.querySelector('.lm-cursor-backdrop')).to.equal(null);
      grid.events = [];
      mouse(document, 'mousemove', 210, 150);
      expect(grid.events).to.not.contain('mousemove');
      mouse(doc, 'mousemove', 210, 150);
      expect(grid.events).to.contain('mousemove');
      mouse(doc, 'mouseup', 210, 150);
      expect(doc.querySelector('.lm-cursor-backdrop')).to.equal(null);
      grid.events = [];
      mouse(doc, 'mousemove', 220, 150);
      expect(grid.events).to.not.contain('mousemove');
    });

    it('should confirm large copies in the window of its document', () => {
      const model = new BasicSelectionModel({ dataModel: grid.dataModel! });
      model.select({
        r1: 0,
        c1: 0,
        r2: 1,
        c2: 1,
        cursorRow: 0,
        cursorColumn: 0,
        clear: 'all'
      });
      grid.selectionModel = model;
      grid.copyConfig = { ...grid.copyConfig, warningThreshold: 1 };
      const messages: string[] = [];
      iframe.contentWindow!.confirm = (message?: string) => {
        messages.push(message ?? '');
        return false;
      };
      grid.copyToClipboard();
      expect(messages).to.have.length(1);
    });

    it('should open multi select option editors in its document', () => {
      const editor = new OptionCellEditor();
      editor.edit({ grid, row: 0, column: 0 });
      const select = doc.querySelector('select.lm-DataGrid-cellEditorWidget');
      expect(select).to.not.equal(null);
      expectSame(select!.parentNode, doc.body, 'select parent');
      editor.cancel();
      expect(select!.isConnected).to.equal(false);
    });

    it('should attach notifications to the document of the target', () => {
      const target = doc.createElement('div');
      doc.body.appendChild(target);
      const notification = new CellEditor.Notification({
        target,
        message: 'Invalid input!'
      });
      expectSame(notification.node.parentNode, doc.body, 'notification parent');
      notification.dispose();
    });
  });
});
