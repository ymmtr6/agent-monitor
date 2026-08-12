#!/usr/bin/env node
// Adds AgentMonitor's hook forwarders to ~/.claude/settings.json without touching any
// existing hooks (e.g. voicevox-cli). Always prints a preview and asks for confirmation
// before writing, and keeps a timestamped backup of the previous file.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const portArgIndex = args.indexOf("--port");
const port = portArgIndex !== -1 ? Number(args[portArgIndex + 1]) : 4317;

const SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");
const CURL_CMD = `curl -s -X POST http://127.0.0.1:${port}/api/hooks -H "Content-Type: application/json" -d @-`;

// PreToolUse/PostToolUse entries carry a `matcher`; the rest are unmatched arrays of hook groups.
const MATCHED_EVENTS = ["PreToolUse", "PostToolUse"];
const UNMATCHED_EVENTS = [
  "SessionStart",
  "SessionEnd",
  "UserPromptSubmit",
  "Stop",
  "SubagentStop",
  "Notification",
  "PreCompact",
];

function readSettings() {
  if (!fs.existsSync(SETTINGS_PATH)) return {};
  return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
}

function hasAgentMonitorHook(hookGroup) {
  return (hookGroup.hooks ?? []).some((h) => h.type === "command" && h.command === CURL_CMD);
}

function ensureUnmatched(settings, event) {
  settings.hooks[event] ??= [];
  const list = settings.hooks[event];
  if (list.some(hasAgentMonitorHook)) return false;
  list.push({ hooks: [{ type: "command", command: CURL_CMD }] });
  return true;
}

function ensureMatched(settings, event) {
  settings.hooks[event] ??= [];
  const list = settings.hooks[event];
  if (list.some((group) => !group.matcher && hasAgentMonitorHook(group))) return false;
  list.push({ hooks: [{ type: "command", command: CURL_CMD }] });
  return true;
}

function main() {
  const settings = readSettings();
  settings.hooks ??= {};

  const changed = [];
  const unchanged = [];

  for (const event of UNMATCHED_EVENTS) {
    (ensureUnmatched(settings, event) ? changed : unchanged).push(event);
  }
  for (const event of MATCHED_EVENTS) {
    (ensureMatched(settings, event) ? changed : unchanged).push(event);
  }

  console.log(`設定ファイル: ${SETTINGS_PATH}`);
  console.log(`転送先: http://127.0.0.1:${port}/api/hooks\n`);

  if (changed.length === 0) {
    console.log("すべてのhooksは既に設定済みです。変更はありません。");
    return;
  }

  console.log("追加されるhooks:");
  for (const event of changed) console.log(`  + ${event}`);
  if (unchanged.length > 0) {
    console.log("\n既に設定済み(変更なし):");
    for (const event of unchanged) console.log(`  = ${event}`);
  }
  console.log(`\n追加されるコマンド:\n  ${CURL_CMD}\n`);
  console.log("既存のhooks(voicevox-cliなど)はそのまま残ります。配列に追記するだけです。\n");

  if (dryRun) {
    console.log("--dry-run のため書き込みは行いません。");
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question("この内容で ~/.claude/settings.json を更新しますか？ [y/N] ", (answer) => {
    rl.close();
    if (answer.trim().toLowerCase() !== "y") {
      console.log("キャンセルしました。");
      return;
    }

    if (fs.existsSync(SETTINGS_PATH)) {
      const backupPath = `${SETTINGS_PATH}.bak-${Date.now()}`;
      fs.copyFileSync(SETTINGS_PATH, backupPath);
      console.log(`バックアップを作成しました: ${backupPath}`);
    }

    fs.writeFileSync(SETTINGS_PATH, `${JSON.stringify(settings, null, 2)}\n`);
    console.log("完了しました。ClaudeCodeを再起動すると新しいhooksが有効になります。");
  });
}

main();
