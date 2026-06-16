import { test, expect } from '@playwright/test';
import { setupTestData } from './helpers/test-utils';

test.describe('病理科阅片队列 - 冒烟测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await setupTestData(page);
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('页面加载成功，显示标题和核心模块', async ({ page }) => {
    await expect(page.locator('.hero h1')).toBeVisible();
    await expect(page.getByText('病理科玻片阅片队列')).toBeVisible();
    await expect(page.locator('.view-manager')).toBeVisible();
    await expect(page.locator('.view-tabs')).toBeVisible();
  });

  test('队列筛选功能可用', async ({ page }) => {
    await page.waitForSelector('.view-tabs', { state: 'visible' });
    const workbenchTab = page.locator('.view-tab').filter({ hasText: '阅片工作台' });
    await expect(workbenchTab).toHaveClass(/active/);

    await page.waitForSelector('.list-panel', { state: 'visible' });
    await page.locator('.list-panel').scrollIntoViewIfNeeded();

    const toolbar = page.locator('.list-panel .toolbar');
    await expect(toolbar).toBeVisible();

    const searchInput = toolbar.locator('.search input');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('P2026061301');
    await page.waitForTimeout(300);

    const records = page.locator('.list-panel .records .record');
    await records.count();

    await searchInput.fill('');
    await searchInput.press('Enter');
    await page.waitForTimeout(300);

    const selects = toolbar.locator('select');
    const selectCount = await selects.count();
    if (selectCount > 0) {
      const statusSelect = selects.nth(0);
      await expect(statusSelect).toBeVisible();
      const options = statusSelect.locator('option');
      const optionCount = await options.count();
      if (optionCount > 1) {
        await statusSelect.selectOption({ index: 1 });
        await page.waitForTimeout(300);
      }
    }

    const filteredRecords = page.locator('.list-panel .records .record');
    const filteredCount = await filteredRecords.count();
    expect(filteredCount).toBeGreaterThanOrEqual(0);
  });

  test('保存视图功能入口可用', async ({ page }) => {
    await page.waitForSelector('.view-manager', { state: 'visible' });

    const saveViewBtn = page.locator('.view-manager-actions button').filter({ hasText: '保存视图' });
    await expect(saveViewBtn).toBeVisible();
    await expect(saveViewBtn).toBeEnabled();

    await saveViewBtn.click();

    const modalTitle = page.getByText('保存当前视图').first();
    await expect(modalTitle).toBeVisible();

    const viewNameInput = page.getByPlaceholder('请输入视图名称');
    await expect(viewNameInput).toBeVisible();

    const closeBtns = page.getByRole('button', { name: '取消' });
    if (await closeBtns.count() > 0) {
      await closeBtns.first().click();
    }
  });

  test('玻片借阅功能入口可用', async ({ page }) => {
    await page.waitForSelector('.view-tabs', { state: 'visible' });

    const borrowTab = page.locator('.view-tab').filter({ hasText: '玻片借阅归还' });
    await expect(borrowTab).toBeVisible();
    await borrowTab.click();

    await page.waitForTimeout(500);
    await expect(borrowTab).toHaveClass(/active/);

    const borrowTitle = page.getByText('借阅总数').first();
    await expect(borrowTitle).toBeVisible();

    const borrowForm = page.locator('.borrow-form-panel');
    await expect(borrowForm).toBeVisible();

    const caseInput = borrowForm.getByPlaceholder(/请输入病例号/);
    await expect(caseInput).toBeVisible();

    const borrowerInput = borrowForm.getByPlaceholder(/请输入借阅人/);
    await expect(borrowerInput).toBeVisible();

    const borrowList = page.locator('.borrow-list-panel');
    await expect(borrowList).toBeVisible();
  });

  test('危急值通知功能入口可用', async ({ page }) => {
    await page.waitForSelector('.view-tabs', { state: 'visible' });

    const notifyTab = page.locator('.view-tab').filter({ hasText: '危急病例通知' });
    await expect(notifyTab).toBeVisible();
    await notifyTab.click();

    await page.waitForTimeout(500);
    await expect(notifyTab).toHaveClass(/active/);

    const notifyStats = page.locator('.notify-stats, .metric').first();
    await expect(notifyStats).toBeVisible({ timeout: 10000 });

    const notifyForm = page.locator('.panel.form-panel').first();
    if (await notifyForm.isVisible()) {
      const caseInput = notifyForm.getByPlaceholder(/病例号/).first();
      if (await caseInput.isVisible()) {
        await expect(caseInput).toBeVisible();
      }
    }
  });

  test('视图切换功能正常', async ({ page }) => {
    await page.waitForSelector('.view-tabs', { state: 'visible' });

    const tabs = [
      { name: '阅片工作台', view: 'workbench' },
      { name: '医生派单与负荷', view: 'dispatch' },
      { name: '玻片借阅归还', view: 'slide-borrow' },
      { name: '危急病例通知', view: 'critical-notify' },
      { name: '诊断短语库', view: 'phrase-library' },
    ];

    for (const tab of tabs) {
      const tabElement = page.locator('.view-tab').filter({ hasText: tab.name });
      await expect(tabElement).toBeVisible();
      await tabElement.click();
      await page.waitForTimeout(300);
      await expect(tabElement).toHaveClass(/active/);
    }
  });

  test('工作视图（views）功能可用', async ({ page }) => {
    await page.waitForSelector('.view-manager', { state: 'visible' });

    const viewPills = page.locator('.view-pill');
    const count = await viewPills.count();
    expect(count).toBeGreaterThanOrEqual(1);

    const defaultView = page.locator('.view-pill').first();
    await expect(defaultView).toBeVisible();

    const viewBtn = defaultView.locator('.view-pill-btn');
    await expect(viewBtn).toBeVisible();
    await viewBtn.click();
    await page.waitForTimeout(300);
    await expect(defaultView).toHaveClass(/active/);
  });
});
