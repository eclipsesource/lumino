/*
 * Copyright (c) Jupyter Development Team.
 * Distributed under the terms of the Modified BSD License.
 */

import { expect, Page, test } from '@playwright/test';

const URL = `file://${process.cwd()}/index.html`;

async function openSecondaryWindow(page: Page): Promise<Page> {
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Open a secondary window' }).click()
  ]);
  await expect(
    popup.getByRole('heading', { name: 'Secondary Window' })
  ).toBeVisible();
  return popup;
}

test.describe('secondary window', () => {
  let logs: string[];

  test.beforeEach(async ({ page }) => {
    logs = [];
    page.on('console', msg => {
      if (msg.type() === 'log') {
        logs.push(msg.text());
      }
    });
    await page.goto(URL);
  });

  test('should open menu bar menus and submenus in the secondary window', async ({
    page
  }) => {
    const popup = await openSecondaryWindow(page);
    const menus = popup.locator('.lm-Menu');

    await popup.locator('.lm-MenuBar-item', { hasText: 'File' }).click();
    await expect(menus).toHaveCount(1);
    await expect(page.locator('.lm-Menu')).toHaveCount(0);

    await popup.locator('.lm-Menu-item', { hasText: 'Open Recent' }).hover();
    await expect(menus).toHaveCount(2);
    const box = (await menus.nth(1).boundingBox())!;
    const viewportWidth = await popup.evaluate(
      () => document.documentElement.clientWidth
    );
    expect(box.x + box.width).toBeLessThanOrEqual(viewportWidth);

    await popup.locator('.lm-Menu-item', { hasText: 'todo.md' }).click();
    await expect(menus).toHaveCount(0);
    expect(logs).toContain('File > Open Recent > todo.md');
  });

  test('should close menus on click outside in the secondary window', async ({
    page
  }) => {
    const popup = await openSecondaryWindow(page);

    await popup.locator('.lm-MenuBar-item', { hasText: 'Edit' }).click();
    await expect(popup.locator('.lm-Menu')).toHaveCount(1);

    await popup.getByRole('heading', { name: 'Secondary Window' }).click();
    await expect(popup.locator('.lm-Menu')).toHaveCount(0);
  });

  test('should share a context menu between the windows', async ({ page }) => {
    const popup = await openSecondaryWindow(page);

    await popup.locator('.lm-example-context-area').click({ button: 'right' });
    await expect(popup.locator('.lm-Menu')).toHaveCount(1);
    await expect(page.locator('.lm-Menu')).toHaveCount(0);
    await popup.locator('.lm-Menu-item', { hasText: 'Copy' }).click();
    await expect(popup.locator('.lm-Menu')).toHaveCount(0);
    expect(logs).toContain('Edit > Copy');

    await page.locator('.lm-example-context-area').click({ button: 'right' });
    await expect(page.locator('.lm-Menu')).toHaveCount(1);
    await expect(popup.locator('.lm-Menu')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('.lm-Menu')).toHaveCount(0);
  });
});
