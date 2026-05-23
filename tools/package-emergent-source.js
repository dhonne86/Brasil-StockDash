const path = require("node:path");
const fs = require("node:fs/promises");
const { chromium } = require("C:/Users/Dhonne/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const password = process.argv[2];
const outDir = process.argv[3] || "aplicações007";
const base = "https://vscode-4d619a65-3928-45f8-a405-a337b1af7783.preview.emergentagent.com";

async function login(page) {
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
  await page.waitForTimeout(8000);
}

async function runTerminalCommand(page, command) {
  await page.keyboard.press("Control+Shift+`");
  await page.waitForSelector(".xterm-helper-textarea", { timeout: 60000 });
  await page.locator(".xterm-helper-textarea").click();
  await page.keyboard.press("Control+C").catch(() => {});
  await page.keyboard.type(command, { delay: 1 });
  await page.keyboard.press("Enter");
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

  const command = [
    "rm -f /app/source-export.tar.gz /tmp/source-export.tar.gz",
    "tar --exclude='./node_modules' --exclude='./frontend/node_modules' --exclude='./backend/.venv' --exclude='./.git' --exclude='./.pytest_cache' --exclude='./.ruff_cache' --exclude='./__pycache__' --exclude='./app-export.tar.gz' --exclude='./source-export.tar.gz' -czf /tmp/source-export.tar.gz -C /app .",
    "mv /tmp/source-export.tar.gz /app/source-export.tar.gz",
    "ls -lh /app/source-export.tar.gz",
  ].join(" && ");
  await runTerminalCommand(page, command);
  await page.waitForTimeout(45000);
  await page.screenshot({ path: path.join(outDir, "terminal-source-package.png"), fullPage: false });

  await page.keyboard.press("Control+Shift+E");
  await page.waitForSelector(".monaco-list-row", { timeout: 60000 });
  await page.keyboard.press("F5").catch(() => {});
  await page.waitForTimeout(8000);

  const archive = page.locator('.monaco-list-row[aria-label="source-export.tar.gz"]');
  await archive.waitFor({ state: "visible", timeout: 90000 });
  await archive.click({ button: "right", timeout: 10000 });
  await page.waitForSelector(".context-view.monaco-menu-container", { timeout: 10000 });
  const downloadPromise = page.waitForEvent("download", { timeout: 180000 });
  await page.locator(".context-view.monaco-menu-container .action-label").filter({ hasText: "Download..." }).click();
  const download = await downloadPromise;
  const destination = path.join(outDir, download.suggestedFilename());
  await download.saveAs(destination);
  console.log(JSON.stringify({ downloaded: destination }));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
