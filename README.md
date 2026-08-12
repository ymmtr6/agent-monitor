# AgentMonitor

ローカルPC上で動いている ClaudeCode / Codex のセッション（サブエージェント含む）をブラウザでリアルタイム可視化するダッシュボード。Grafana風のダークテーマ、カンバン形式でステータス変化をアニメーション表示します。

画面は管制コンソール風の3ペイン構成:

- 左 — エージェント（セッション）一覧、トークン使用量、CPU/メモリのシステム状態
- 中央 — KPIカード（本日の完了セッション / 本日の稼働時間 / 処理イベント数 / 消費トークン）、ステータス別カンバン、処理スループットのライブチャート
- 右 — ステータス遷移とツール実行を秒単位で流すライブアクティビティフィード

エージェントのカーソルは固定オーバーレイ（`CursorLayer`）で描画され、担当カードの位置を追従する。ステータスが変わってカードが別の列へ移ると、カーソルもスプリングで飛んでいく。

## トークン集計

`backend/src/store/tokenUsage.ts` が両CLIの差異を吸収する。

| | 取得元 | 性質 | `input_tokens` |
|---|---|---|---|
| ClaudeCode | assistant行の `message.usage` | メッセージ単位の増分 | キャッシュ分を含まない |
| Codex | `event_msg` の `token_count` → `info.total_token_usage` | セッション累積 | `cached_input_tokens` を含む |

内部では `{ input, output, cacheRead, cacheWrite, total }` に正規化する（Codexの `input_tokens` からはキャッシュ分を差し引く）。合計はバックエンド起動以降の累積で、起動時に各セッションの直近300行を読み直すぶんも含む。ただし `STARTUP_LOOKBACK_MS`（6時間）より古いログファイルは読み直さず、末尾にシークするだけなので集計に入らない。

## 構成

- `backend/` — Fastify製のNode.jsバックエンド。`~/.claude/projects/<project>/*.jsonl`（depth 1）と `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`（depth 3）を監視し、WebSocketで状態をブロードキャストする
- `frontend/` — Vite + React + framer-motionのダッシュボード
- `scripts/install-claude-hooks.mjs` — ClaudeCodeのhooksをAgentMonitorに接続する任意のセットアップスクリプト（`~/.claude/settings.json`を安全に追記する）

## Quick Start

### 前提条件

- **Node.js** v20 以上（奇数リリース）
- **npm** または互換パッケージマネージャ
- **ClaudeCode** または **Codex** がインストールされていること

### インストールと起動

```bash
git clone https://github.com/ymmtr6/agent-monitor.git
cd agent-monitor
npm install
npm run dev
```

ブラウザで **http://localhost:5173** を開くと、管制コンソール風ダッシュボードが表示されます。

- **左ペイン** — エージェント（セッション）一覧、トークン使用量、CPU/メモリ
- **中央** — KPIカード、ステータス別カンバン（要対応/実行中/サブエージェント/入力待ち/終了）、スループットグラフ
- **右ペイン** — ステータス遷移とツール実行を秒単位で流すライブアクティビティフィード

バックエンドは **http://127.0.0.1:4317** で待ち受け、自動的に `~/.claude/projects` と `~/.codex/sessions` を監視します。

### ステータスの監視対象

| 対象 | 監視場所 | 検知方法 |
|---|---|---|
| **ClaudeCode** | `~/.claude/projects/<project>/*.jsonl` | ファイル監視 + hooks（推奨） |
| **Codex** | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` | ファイル監視のみ |

### より正確なステータス検知（推奨）

ClaudeCode側は、ファイル監視だけでも動くが、hooksを繋ぐとより低遅延・高精度にステータスを検知できる。

```bash
node scripts/install-claude-hooks.mjs --dry-run   # まず変更内容を確認
node scripts/install-claude-hooks.mjs             # 確認後、実際に反映(バックアップ付き)
```

既存の `~/.claude/settings.json` の hooks（他ツール用のものを含む）は壊さず、配列に追記するだけ。設定後はClaudeCodeを再起動すると反映される。

**バックグラウンド起動のサブエージェント（`run_in_background: true`）には hooks が必須。** 通常のサブエージェントは `Task`/`Agent` ツールの `tool_use` と `tool_result` の対で開始・終了を判定できるが、バックグラウンド起動の場合 `tool_result` は「起動しました」という応答として即座に返るため、ファイル監視だけでは完了時刻が分からない。`SubagentStop` フックが唯一の完了シグナルになる。フックがない場合は `SUBAGENT_STALE_MS`（30分）で強制終了扱いにする。

`SubagentStop` は `agent_type`（`"Explore"` など）でエージェントを識別する。AgentMonitor 側の登録キーは `tool_use` の id なので直接は突き合わせられず、同じ `subagent_type` で稼働中のもののうち最も古いものを終了させる。

Codexにはhooks機構がないため、常にファイル監視のみでステータスを推定する（ClaudeCodeより即時性・精度は落ちる）。

## ステータス

| ステータス | 意味 |
|---|---|
| 要対応 | エラー・通知・確認待ち |
| 実行中 | ツール実行中・応答生成中 |
| サブエージェント | Task/Agentツールでサブエージェントが動作中 |
| 入力待ち | ターン終了、ユーザーの入力待ち |
| 終了 | セッション終了(数秒後にボードから消える) |

## 既知の制約

- Codexのステータスはファイル監視ベースの近似で、ClaudeCode hooksほど正確ではない
- バックエンドは永続DBを持たず、再起動時はログファイルとプロセス生存確認から状態を再構築する
- 認証なし・`127.0.0.1`限定バインドのみ(ローカル利用前提)
