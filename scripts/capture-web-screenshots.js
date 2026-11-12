/* global __dirname */
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { chromium } = require("playwright");

const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, "docs", "images");
const viewport = { width: 614, height: 1000 };

function testPort(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(null));
    probe.listen(port, "127.0.0.1", () => {
      const address = probe.address();
      const availablePort =
        typeof address === "object" && address ? address.port : null;
      probe.close(() => resolve(availablePort));
    });
  });
}

async function selectPort() {
  if (process.env.SCREENSHOT_PORT) {
    const requestedPort = Number(process.env.SCREENSHOT_PORT);
    const availablePort = await testPort(requestedPort);
    if (availablePort === null)
      throw new Error(`SCREENSHOT_PORT ${requestedPort} is already in use.`);
    return availablePort;
  }

  return testPort(0);
}

function npxCommand(args) {
  if (process.platform !== "win32") {
    return { command: "npx", args };
  }

  return {
    command: "cmd.exe",
    args: ["/d", "/s", "/c", `npx ${args.join(" ")}`],
  };
}

const captures = [
  {
    file: "main1.png",
    path: "/",
  },
  {
    file: "main2.png",
    path: "/",
    prepare: async (page) => {
      await page
        .getByRole("radio", { name: "2 finger mode", exact: true })
        .evaluate((control) => control.click());
      await page
        .getByRole("button", {
          name: "Single Player. Two-finger target challenge",
          exact: true,
        })
        .waitFor({ state: "visible" });
      await page.evaluate(
        () =>
          new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(resolve));
          }),
      );
    },
  },
  {
    file: "options.png",
    path: "/options",
  },
  {
    file: "single1.png",
    path: "/OneFingerSinglePlayerGame",
  },
  {
    file: "single2.png",
    path: "/TwoFingerSinglePlayerGame",
  },
  {
    file: "two1.png",
    path: "/OneFingerTwoPlayerGame",
  },
  {
    file: "two2.png",
    path: "/TwoFingerTwoPlayerGame",
  },
];

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    const reason = result.error ? `: ${result.error.message}` : "";
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${result.status}${reason}`,
    );
  }
}

function startStaticServer(port) {
  const distDir = path.join(rootDir, "dist");
  const contentTypes = {
    ".css": "text/css",
    ".html": "text/html",
    ".ico": "image/x-icon",
    ".js": "text/javascript",
    ".png": "image/png",
    ".ttf": "font/ttf",
    ".wav": "audio/wav",
  };
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(
      new URL(request.url || "/", "http://localhost").pathname,
    );
    const relativePath =
      pathname === "/"
        ? "index.html"
        : path.extname(pathname)
          ? pathname.slice(1)
          : `${pathname.slice(1)}.html`;
    const filePath = path.resolve(distDir, relativePath);
    if (
      !filePath.startsWith(`${distDir}${path.sep}`) &&
      filePath !== path.join(distDir, "index.html")
    ) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    fs.readFile(filePath, (error, contents) => {
      if (error) {
        response
          .writeHead(error.code === "ENOENT" ? 404 : 500)
          .end("Not found");
        return;
      }
      response.writeHead(200, {
        "Content-Type":
          contentTypes[path.extname(filePath)] || "application/octet-stream",
      });
      response.end(contents);
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function closeServer(server) {
  return new Promise((resolve) => server.close(resolve));
}

async function captureScreenshots() {
  fs.mkdirSync(outputDir, { recursive: true });
  const port = await selectPort();
  if (port === null)
    throw new Error("Unable to allocate a screenshot server port.");
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log("Building Expo web export...");
  const exportCommand = npxCommand(["expo", "export", "-p", "web"]);
  run(exportCommand.command, exportCommand.args);

  console.log(`Serving exported web app on ${baseUrl}...`);
  const server = await startStaticServer(port);

  try {
    const browser = await chromium.launch();
    const failures = [];

    for (const capture of captures) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
      const url = `${baseUrl}${capture.path}`;
      const outputPath = path.join(outputDir, capture.file);

      try {
        console.log(`Capturing ${capture.file} from ${url}`);
        const response = await page.goto(url, { waitUntil: "networkidle" });
        if (!response?.ok()) {
          throw new Error(
            `Navigation returned HTTP ${response?.status() ?? "unknown"}`,
          );
        }
        await page.waitForTimeout(500);

        if (capture.prepare) {
          await capture.prepare(page);
          await page.waitForTimeout(300);
        }

        await page.screenshot({ path: outputPath, fullPage: false });
      } catch (error) {
        failures.push(
          `${capture.file}: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        await page.close();
      }
    }

    await browser.close();
    if (failures.length > 0) {
      throw new Error(`Screenshot capture failures:\n${failures.join("\n")}`);
    }
  } finally {
    await closeServer(server);
  }

  console.log(`Updated screenshots in ${path.relative(rootDir, outputDir)}`);
}

captureScreenshots().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
