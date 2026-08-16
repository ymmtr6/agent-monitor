#!/usr/bin/env node
// Removes only AgentMonitor's hook forwarders from ~/.claude/settings.json.
// Other hooks and Claude Code settings are preserved. A preview and confirmation
// are shown before writing, and the previous file is backed up.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");

// Match the exact command shape produced by install-claude-hooks.mjs, while
// accepting any port that may have been selected with its --port option.
const AGENT_MONITOR_COMMAND =
  /^curl -s -X POST http:\/\/127\.0\.0\.1:\d+\/api\/hooks -H "Content-Type: application\/json" -d @-$/;

function isAgentMonitorHook(hook) {
  return (
    hook?.type === "command" &&
    typeof hook.command === "string" &&
    AGENT_MONITOR_COMMAND.test(hook.command)
  );
}

export function removeAgentMonitorHooks(settings) {
  if (!settings.hooks || typeof settings.hooks !== "object" || Array.isArray(settings.hooks)) {
    return [];
  }

  const changed = [];

  for (const [event, groups] of Object.entries(settings.hooks)) {
    if (!Array.isArray(groups)) continue;

    let removed = 0;
    const remainingGroups = [];

    for (const group of groups) {
      if (!group || !Array.isArray(group.hooks)) {
        remainingGroups.push(group);
        continue;
      }

      const hooks = group.hooks.filter((hook) => {
        if (!isAgentMonitorHook(hook)) return true;
        removed += 1;
        return false;
      });

      // An empty group has no effect and was created solely for AgentMonitor.
      if (hooks.length > 0) remainingGroups.push({ ...group, hooks });
    }

    if (removed > 0) {
      changed.push({ event, count: removed });
      if (remainingGroups.length > 0) settings.hooks[event] = remainingGroups;
      else delete settings.hooks[event];
    }
  }

  // Avoid leaving an empty object behind when hooks only contained AgentMonitor.
  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;

  return changed;
}

function main() {
  console.log(`設定ファイル: ${SETTINGS_PATH}\n`);

  if (!fs.existsSync(SETTINGS_PATH)) {
    console.log("設定ファイルが存在しません。変更はありません。");
    return;
  }

  const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
  const changed = removeAgentMonitorHooks(settings);

  if (changed.length === 0) {
    console.log("AgentMonitor の hooks は設定されていません。変更はありません。");
    return;
  }

  console.log("削除される hooks:");
  for (const { event, count } of changed) {
    console.log(`  - ${event}${count > 1 ? ` (${count}件)` : ""}`);
  }
  console.log("\n他の hooks と Claude Code の設定はそのまま残ります。\n");

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

    const backupPath = `${SETTINGS_PATH}.bak-${Date.now()}`;
    fs.copyFileSync(SETTINGS_PATH, backupPath);
    console.log(`バックアップを作成しました: ${backupPath}`);

    fs.writeFileSync(SETTINGS_PATH, `${JSON.stringify(settings, null, 2)}\n`);
    console.log("完了しました。Claude Code を再起動すると変更が反映されます。");
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
