async page => {
  await page.getByText('我的', { exact: true }).click();
  await page.getByText('我的论坛话题', { exact: true }).click();
  await page.getByText('参与讨论 →', { exact: true }).click();
  await page.locator('.reply-item .content-text').filter({ hasText: '小程序共用页面的回帖验收，期待与老乡相聚。' }).waitFor();
  await page.screenshot({ path: '../output/playwright/forum-mobile.png', fullPage: true, animations: 'disabled' });
  await page.getByText('我的', { exact: true }).click();
  await page.getByText('我的资源与交换', { exact: true }).click();
  await page.getByText('我的交换', { exact: true }).click();
  await page.getByText('双方已确认完成', { exact: true }).waitFor();
  return { mobileExchangeBilateralCompletion: 'passed', mobileForumReply: 'passed' };
}
