const fs = require('node:fs');

const [installerPath, installerPidRaw, logPath] = process.argv.slice(2);
const installerPid = Number(installerPidRaw);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function appendLog(message) {
  try {
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    // Cleanup logging must never keep an update from completing.
  }
}

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

async function cleanup() {
  appendLog(`Cleanup gestartet fuer PID ${installerPid}`);
  while (processExists(installerPid)) await sleep(1500);
  await sleep(2500);

  let removed = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      fs.rmSync(installerPath, { force: true });
    } catch {
      // The installer may still hold its executable briefly after exiting.
    }
    if (!fs.existsSync(installerPath)) {
      removed = true;
      break;
    }
    await sleep(1000);
  }

  appendLog(removed
    ? `Installer entfernt: ${installerPath}`
    : `Installer konnte nicht entfernt werden: ${installerPath}`);
  try {
    fs.rmSync(__filename, { force: true });
  } catch {
    // A stale helper is removed during the next normal app start.
  }
}

cleanup().catch(error => appendLog(`Cleanup fehlgeschlagen: ${error?.message || String(error)}`));
