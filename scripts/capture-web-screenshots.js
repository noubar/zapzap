const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const { chromium } = require('playwright');

const rootDir = path.resolve(__dirname, '..');
const outputDir = path.join(rootDir, 'docs', 'images');
const port = Number(process.env.SCREENSHOT_PORT || 8081);
const baseUrl = `http://127.0.0.1:${port}`;
const viewport = { width: 614, height: 1000 };

function npxCommand(args) {
  if (process.platform !== 'win32') {
    return { command: 'npx', args };
  }

  return {
    command: 'cmd.exe',
    args: ['/d', '/s', '/c', `npx ${args.join(' ')}`],
  };
}

const captures = [
  {
    file: 'main1.png',
    path: '/',
  },
  {
    file: 'main2.png',
    path: '/',
    prepare: async (page) => {
      await page.getByText('2 Fingers', { exact: true }).click();
    },
  },
  {
    file: 'single1.png',
    path: '/OneFingerSinglePlayerGame',
  },
  {
    file: 'single2.png',
    path: '/TwoFingerSinglePlayerGame',
  },
  {
    file: 'two1.png',
    path: '/OneFingerTwoPlayerGame',
  },
  {
    file: 'two2.png',
    path: '/TwoFingerTwoPlayerGame',
  },
];

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    const reason = result.error ? `: ${result.error.message}` : '';
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}${reason}`);
  }
}

function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const tryRequest = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on('error', () => {
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }

        setTimeout(tryRequest, 500);
      });

      request.setTimeout(2_000, () => {
        request.destroy();
      });
    };

    tryRequest();
  });
}

function stopProcessTree(childProcess) {
  if (!childProcess.pid || childProcess.killed) {
    return;
  }

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(childProcess.pid), '/T', '/F'], {
      stdio: 'ignore',
    });
    return;
  }

  childProcess.kill('SIGTERM');
}

async function captureScreenshots() {
  fs.mkdirSync(outputDir, { recursive: true });

  console.log('Building Expo web export...');
  const exportCommand = npxCommand(['expo', 'export', '-p', 'web']);
  run(exportCommand.command, exportCommand.args);

  console.log(`Serving exported web app on ${baseUrl}...`);
  const serveCommand = npxCommand(['expo', 'serve', '--port', String(port)]);
  const server = spawn(serveCommand.command, serveCommand.args, {
    cwd: rootDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  server.stdout.on('data', (data) => process.stdout.write(data));
  server.stderr.on('data', (data) => process.stderr.write(data));

  try {
    await waitForServer(baseUrl);

    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });

    for (const capture of captures) {
      const url = `${baseUrl}${capture.path}`;
      const outputPath = path.join(outputDir, capture.file);

      console.log(`Capturing ${capture.file} from ${url}`);
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);

      if (capture.prepare) {
        await capture.prepare(page);
        await page.waitForTimeout(300);
      }

      await page.screenshot({ path: outputPath, fullPage: false });
    }

    await browser.close();
  } finally {
    stopProcessTree(server);
  }

  console.log(`Updated screenshots in ${path.relative(rootDir, outputDir)}`);
}

captureScreenshots().catch((error) => {
  console.error(error);
  process.exit(1);
});
