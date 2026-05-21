const path = require("node:path");
const fs = require("node:fs/promises");
const { chromium } = require("C:/Users/Dhonne/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const password = process.argv[2];
const outDir = process.argv[3] || "emergent-app-local";
const base = "https://vscode-4d619a65-3928-45f8-a405-a337b1af7783.preview.emergentagent.com";

async function login(page) {
  await page.goto(`${base}/?folder=/app`, { waitUntil: "domcontentloaded", timeout: 60000 });
  if ((await page.locator("input[type=password]").count()) > 0) {
    await page.locator("input[type=password]").fill(password);
    await Promise.all([
      page.waitForLoadState("domcontentloaded", { timeout: 60000 }).catch(() => {}),
      page.locator("input[type=submit]").click(),
    ]);
  }
}

async function main() {
  if (!password) throw new Error("Missing password argument");
  await fs.mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    acceptDownloads: true,
  });
  const page = await context.newPage();

  await login(page);
  try {
    await page.waitForSelector(".monaco-list-row", { timeout: 120000 });
  } catch (error) {
    await page.screenshot({ path: path.join(outDir, "vscode-load-failed.png"), fullPage: false });
    console.log(
      JSON.stringify({
        loadFailed: true,
        title: await page.title(),
        url: page.url(),
        body: (await page.locator("body").innerText({ timeout: 5000 }).catch((e) => e.message)).slice(0, 2000),
      }),
    );
    throw error;
  }
  await page.waitForTimeout(15000);

  const rows = await page.locator(".monaco-list-row").evaluateAll((els) =>
    els.slice(0, 40).map((e, i) => ({
      i,
      text: e.textContent,
      label: e.getAttribute("aria-label"),
      role: e.getAttribute("role"),
      level: e.getAttribute("aria-level"),
    })),
  );
  console.log(JSON.stringify({ title: await page.title(), url: page.url(), rows }, null, 2));

  const downloadsDir = path.join(outDir, "_downloads");
  await fs.mkdir(downloadsDir, { recursive: true });

  async function downloadItem(label) {
    const item = page.locator(`.monaco-list-row[aria-label="${label}"]`);
    await item.click({ button: "right", timeout: 10000 });
    await page.waitForSelector(".context-view.monaco-menu-container", { timeout: 10000 });
    const downloadPromise = page.waitForEvent("download", { timeout: 120000 });
    await page.locator(".context-view.monaco-menu-container .action-label").filter({ hasText: "Download..." }).click();
    const download = await downloadPromise;
    const suggested = download.suggestedFilename();
    const destination = path.join(downloadsDir, suggested);
    await download.saveAs(destination);
    console.log(JSON.stringify({ downloaded: label, suggested, destination }));
  }

  for (const row of rows) {
    if (!row.label) continue;
    await downloadItem(row.label);
  }

  await page.screenshot({ path: path.join(outDir, "vscode-screenshot.png"), fullPage: false });
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
