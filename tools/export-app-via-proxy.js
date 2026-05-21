const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("C:/Users/Dhonne/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const password = process.argv[2];
const outDir = process.argv[3] || "emergent-app-local";
const base = "https://vscode-4d619a65-3928-45f8-a405-a337b1af7783.preview.emergentagent.com";

async function waitForReady(page) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await page.goto(`${base}/?folder=/app`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
    const ready = await page
      .waitForFunction(
        () =>
          document.querySelector("input[type=password]") ||
          document.querySelector(".monaco-list-row") ||
          document.body?.innerText?.includes("Starting IDE") ||
          document.body?.innerText?.includes("preview environment is not responding"),
        null,
        { timeout: 90000 },
      )
      .then(() => true)
      .catch(() => false);
    const body = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
    console.log(JSON.stringify({ attempt, title: await page.title(), url: page.url(), body: body.slice(0, 120) }));
    if (await page.locator("input[type=password]").count()) return "login";
    if (await page.locator(".monaco-list-row").count()) return "workbench";
    await page.waitForTimeout(30000);
    if (!ready) await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  }
  throw new Error("Preview did not reach login or workbench");
}

async function login(page) {
  const state = await waitForReady(page);
  if (state === "login") {
    await page.locator("input[type=password]").fill(password);
    await Promise.all([
      page.waitForLoadState("domcontentloaded", { timeout: 60000 }).catch(() => {}),
      page.locator("input[type=submit]").click(),
    ]);
  }
  await page.waitForSelector(".monaco-list-row", { timeout: 180000 });
  await page.waitForTimeout(10000);
}

async function openTerminal(page) {
  await page.keyboard.press("Control+Shift+`").catch(() => {});
  if ((await page.locator(".xterm-helper-textarea").count()) === 0) {
    await page.keyboard.press("Control+Shift+P");
    await page.waitForSelector(".quick-input-widget input", { timeout: 30000 });
    await page.keyboard.type("Terminal: Create New Terminal", { delay: 1 });
    await page.keyboard.press("Enter");
  }
  await page.waitForSelector(".xterm-helper-textarea", { timeout: 90000 });
  await page.locator(".xterm-helper-textarea").click();
}

async function runTerminalCommand(page, command, waitMs) {
  await page.keyboard.press("Control+C").catch(() => {});
  await page.keyboard.type(command, { delay: 1 });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(waitMs);
}

async function main() {
  if (!password) throw new Error("Missing password argument");
  await fs.mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  await login(page);
  await openTerminal(page);
  await runTerminalCommand(
    page,
    "rm -f /app/app-export.tar.gz /tmp/app-export.tar.gz; tar --exclude=app-export.tar.gz -czf /tmp/app-export.tar.gz -C /app . && mv /tmp/app-export.tar.gz /app/app-export.tar.gz && ls -lh /app/app-export.tar.gz",
    120000,
  );
  await page.screenshot({ path: path.join(outDir, "export-via-proxy-terminal.png"), fullPage: false });
  await runTerminalCommand(
    page,
    "cd /app; (python3 -m http.server 8765 >/tmp/app-http.log 2>&1 &); sleep 2; cat /tmp/app-http.log; echo READY_HTTP_8765",
    5000,
  );

  const cookies = await context.cookies(base);
  const cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
  const response = await page.request.get(`${base}/proxy/8765/app-export.tar.gz`, {
    headers: { cookie: cookieHeader },
    timeout: 300000,
  });
  console.log(JSON.stringify({ proxyStatus: response.status(), proxyUrl: response.url() }));
  if (!response.ok()) {
    console.log((await response.text()).slice(0, 500));
    throw new Error(`Proxy download failed: ${response.status()}`);
  }
  const body = await response.body();
  const destination = path.join(outDir, "app-export.tar.gz");
  await fs.writeFile(destination, body);
  console.log(JSON.stringify({ downloaded: destination, bytes: body.length }));
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
