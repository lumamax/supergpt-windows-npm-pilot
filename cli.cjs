#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { readFile, rename, unlink, writeFile } = require('node:fs/promises');
const { release } = require('node:os');
const { join, resolve } = require('node:path');
const { version } = require('./package.json');

const nativeSchema = 'luma.windows.npm-native-install.v1';
const hostErrorSchema = 'luma.windows.npm-host-error.v1';
const reportSchema = 'luma.windows.npm-install-report.v1';
const outputLimit = 64 * 1024;
const guidance = new Map([
  ['ORIGINAL_PACKAGE_MISSING', 'Install the official ChatGPT app from https://chatgpt.com/download/ in this Windows profile, then run this command again.'],
  ['INSTALL_AS_INVOKER_REQUIRED', 'Run this command from a regular PowerShell window in the Windows profile where you use ChatGPT.'],
  ['INSTALL_CLOSE_ORIGINAL_APP_REQUIRED', 'Quit ChatGPT and Codex in this Windows profile, then run this command again.'],
  ['INSTALL_CLOSE_OWN_COMPONENTS_REQUIRED', 'Quit SuperGPT from the tray, then run this command again.'],
  ['INSTALL_GENERATION_CHANGED_RETRY', 'This command needs a fresh SuperGPT profile. For an existing installation, use the SuperGPT tray updater.'],
  ['INSTALL_CODE_ALREADY_PRESENT', 'SuperGPT files already exist in this profile. Use the existing installation or its repair flow.'],
  ['ORIGINAL_PACKAGE_VOLUME_REFUSED', 'Windows could not verify the Microsoft Store volume for ChatGPT. Check that the drive is available.'],
]);

function failure(code) {
  return Object.assign(new Error(code), { reportCode: code });
}

async function modulePin() {
  const pinPath = join(__dirname, 'native', 'module.json');
  const pin = JSON.parse(await readFile(pinPath, 'utf8'));
  if (pin.version !== version || !/^[a-f0-9]{64}$/.test(pin.sha256)
      || !Number.isSafeInteger(pin.bytes) || pin.bytes <= 0
      || !/^[a-f0-9]{40}$/.test(pin.sourceCommit)) {
    throw failure('INSTALL_MODULE_METADATA_INVALID');
  }
  return { version, sha256: pin.sha256, bytes: pin.bytes, sourceCommit: pin.sourceCommit };
}

function runNative(pin, launch) {
  const windowsRoot = process.env.SystemRoot;
  if (!windowsRoot || !/^[a-z]:\\/i.test(windowsRoot)) {
    throw failure('WINDOWS_SYSTEMROOT_UNAVAILABLE');
  }
  const executable = join(windowsRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const args = [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'RemoteSigned',
    '-File', join(__dirname, 'Run-NativeInstall.ps1'),
    '-ModulePath', join(__dirname, 'native', 'SuperGPT.Installation.module'),
    '-Sha256', pin.sha256, '-Bytes', String(pin.bytes),
  ];
  if (launch) args.push('-Launch');

  return new Promise((resolveRun, reject) => {
    const child = spawn(executable, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const output = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    child.stdout.on('data', (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes <= outputLimit) output.push(chunk);
    });
    child.stderr.on('data', (chunk) => { stderrBytes += chunk.length; });
    child.once('error', reject);
    child.once('close', (exitCode, signal) => {
      resolveRun({ stdoutBytes, stderrBytes, exitCode, signal, output });
    });
  });
}

function parseNative(result) {
  if (result.stdoutBytes > outputLimit) throw failure('INSTALL_OUTPUT_LIMIT');
  let native;
  try {
    native = JSON.parse(Buffer.concat(result.output).toString('utf8'));
  } catch {
    throw failure('INSTALL_NATIVE_REPORT_UNAVAILABLE');
  }
  if (native?.schema === hostErrorSchema && result.exitCode === 1) return native;
  if (native?.schema !== nativeSchema || result.exitCode !== 0) {
    throw failure('INSTALL_NATIVE_REPORT_INVALID');
  }
  if (native.version !== null && native.version !== version) {
    throw failure('INSTALL_NATIVE_VERSION_MISMATCH');
  }
  return native;
}

function serialize(report) {
  return JSON.stringify(report, null, 2) + '\n';
}

async function saveResult(path, report) {
  const pending = path + '.tmp';
  await writeFile(pending, serialize(report), { flag: 'wx', mode: 0o600 });
  try {
    await rename(pending, path);
  } catch (error) {
    await unlink(pending).catch(() => {});
    throw error;
  }
}

async function install(launch) {
  const startedAt = new Date().toISOString();
  const reportPath = resolve(`supergpt-install-${startedAt.replace(/[:.]/g, '-')}-${randomUUID()}.json`);
  const report = {
    schema: reportSchema,
    version,
    startedAt,
    platform: process.platform,
    arch: process.arch,
    osRelease: release(),
    nodeVersion: process.versions.node,
    launchRequested: launch,
    status: 'running',
  };
  await writeFile(reportPath, serialize(report), { flag: 'wx', mode: 0o600 });
  process.stdout.write(`SuperGPT installation report: ${reportPath}\n`);

  try {
    if (process.platform !== 'win32' || process.arch !== 'x64') {
      throw failure('WINDOWS_X64_REQUIRED');
    }
    if (Number(process.versions.node.split('.')[0]) < 22) throw failure('NODE_22_REQUIRED');
    report.module = await modulePin();
    const { output, ...host } = await runNative(report.module, launch);
    report.host = host;
    report.native = parseNative({ ...host, output });
    const native = report.native;
    if (native.install?.status === 'OWN_CODE_AND_BINDINGS_INSTALLED_PENDING_NATIVE') {
      report.status = 'installed';
      if (native.failure || native.launch?.reason) {
        report.status = 'installed_launch_failed';
        report.code = native.failure?.reason || native.launch?.reason || 'INSTALL_LAUNCH_UNKNOWN';
      }
    } else {
      report.status = 'failed';
      report.code = native.install?.reason || native.failure?.reason
        || (native.schema === hostErrorSchema ? 'INSTALL_NATIVE_HOST_FAILED' : 'INSTALL_NATIVE_REFUSED');
    }
  } catch (error) {
    report.status = 'failed';
    report.code = error.reportCode || error.code || 'INSTALL_NPM_FAILED';
  }
  report.finishedAt = new Date().toISOString();
  await saveResult(reportPath, report);
  process.stdout.write(`SuperGPT ${version}: ${report.status}${report.code ? ' (' + report.code + ')' : ''}\n`);
  const next = guidance.get(report.code);
  if (next) process.stdout.write(next + '\n');
  if (report.status !== 'installed') process.exitCode = 1;
}

async function main(args) {
  if (args.length === 0 || args.length === 1 && ['--help', '-h'].includes(args[0])) {
    process.stdout.write('Usage: supergpt install [--no-launch]\n');
    return;
  }
  if (args[0] !== 'install' || args.length > 2 || args.length === 2 && args[1] !== '--no-launch') {
    process.stderr.write('Usage: supergpt install [--no-launch]\n');
    process.exitCode = 2;
    return;
  }
  await install(args[1] !== '--no-launch');
}

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`SuperGPT report write failed (${error.code || 'UNKNOWN'}).\n`);
  process.exitCode = 1;
});
