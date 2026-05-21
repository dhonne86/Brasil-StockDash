const { chromium } = require("C:/Users/Dhonne/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const password = process.argv[2];
const target = process.argv[3] || "README.md";
const base = "https://vscode-4d619a65-3928-45f8-a405-a337b1af7783.preview.emergentagent.com";

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("download") || url.includes("file") || url.includes("app-export") || url.includes("README")) {
      console.log("REQ", request.method(), url);
    }
  });
  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("download") || url.includes("file") || url.includes("app-export") || url.includes("README")) {
      console.log("RES", response.status(), url);
    }
  });

  await page.goto(`${base}/?folder=/app`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(
    () => document.querySelector("input[type=password]") || document.querySelector(".monaco-list-row"),
    null,
    { timeout: 120000 },
  );
  if ((await page.locator("input[type=password]").count()) > 0) {
    await page.locator("input[type=password]").fill(password);
    await Promise.all([
      page.waitForLoadState("domcontentloaded", { timeout: 60000 }).catch(() => {}),
      page.locator("input[type=submit]").click(),
    ]);
  }
  await page.waitForSelector(".monaco-list-row", { timeout: 120000 });
  await page.waitForTimeout(10000);

  const item = page.locator(`.monaco-list-row[aria-label="${target}"]`);
  await item.waitFor({ state: "visible", timeout: 60000 });
  await item.click({ button: "right", timeout: 10000 });
  await page.waitForSelector(".context-view.monaco-menu-container", { timeout: 10000 });
  const downloadPromise = page.waitForEvent("download", { timeout: 30000 }).catch((error) => {
    console.log("DOWNLOAD_TIMEOUT", error.message);
    return null;
  });
  await page.locator(".context-view.monaco-menu-container .action-label").filter({ hasText: "Download..." }).click();
  const download = await downloadPromise;
  if (download) console.log("DOWNLOAD", download.suggestedFilename(), await download.path().catch((e) => e.message));
  await page.waitForTimeout(10000);
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
