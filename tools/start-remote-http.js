const { chromium } = require("C:/Users/Dhonne/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const password = process.argv[2];
const base = "https://vscode-4d619a65-3928-45f8-a405-a337b1af7783.preview.emergentagent.com";

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
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
  await page.keyboard.press("Control+Shift+P");
  await page.waitForSelector(".quick-input-widget input", { timeout: 30000 });
  await page.keyboard.type("Terminal: Create New Terminal", { delay: 1 });
  await page.keyboard.press("Enter");
  try {
    await page.waitForSelector(".xterm-helper-textarea", { timeout: 60000 });
  } catch (error) {
    await page.screenshot({ path: "emergent-app-local/start-http-failed.png", fullPage: false });
    console.log(await page.locator("body").innerText({ timeout: 5000 }).catch((e) => e.message));
    throw error;
  }
  await page.locator(".xterm-helper-textarea").click();
  await page.keyboard.press("Control+C").catch(() => {});
  const command =
    "cd /app; (python3 -m http.server 8765 >/tmp/app-http.log 2>&1 &); sleep 1; ls -lh /app/app-export.tar.gz; cat /tmp/app-http.log";
  await page.keyboard.type(command, { delay: 1 });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(5000);
  console.log("started");
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
