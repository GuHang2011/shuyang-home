async page => {
  await page.getByRole('textbox', { name: '姓名', exact: true }).fill('验收老乡');
  await page.getByRole('textbox', { name: '手机号', exact: true }).fill('13800009991');
  await page.getByRole('textbox', { name: '家乡乡镇', exact: true }).fill('沭阳 · 沭城街道');
  await page.getByRole('textbox', { name: '现居地区', exact: true }).fill('苏州 · 吴中区');
  await page.getByRole('textbox', { name: '行业 / 职业', exact: true }).fill('浏览器验收');
  await page.getByRole('textbox', { name: '设置密码', exact: true }).fill('BrowserMember2026');
  await page.getByRole('checkbox', { name: '我已阅读并同意隐私说明及自愿参与约定' }).check();
  await page.getByRole('button', { name: '提交入会申请', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: '我的会员中心', exact: true }).click();
  await page.getByText('待审核 · 会员', { exact: true }).waitFor();
  await page.screenshot({ path: '../output/playwright/member-pending.png', fullPage: true });
  console.log('Registration and pending membership card: PASS');
}
