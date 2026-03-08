# Logeach (ロジーク) 開発プロジェクト

**「論理 (Logical) を説く (Teach)」**
ゼミや報告会の本番前に、指導教官や先輩の「癖」を再現したAIと対話し、論理の穴を徹底的に潰すためのシミュレーターです。

---

## 開発ロードマップ (1週間)

1. **Phase 1: 土台構築 (Day 1-2)**
* 認証・DB接続・ページルーティングの確立（リーダー担当）。
* 各コンポーネントのモックアップ作成（メンバー担当）。


2. **Phase 2: 機能連携 (Day 3-5)**
* Gemini API を利用した対話エンジンの実装（開発環境）。
* スライド表示とAIフィードバックの同期。


3. **Phase 3: 最終調整 (Day 6-7)**
* 本番用 AI (Qwen) への切り替え検証。
* 自前サーバー (Ubuntu) へのデプロイ。



---

## チーム・タスク割り当て (MVP)

コンフリクトを避けるため、各自の担当ディレクトリを厳守してください。

| 担当 | 開発領域 | 担当ファイル/ディレクトリ |
| --- | --- | --- |
| **リーダー (Aさん)** | **インフラ・DB・全体統括** | `src/app/practice/[id]`, `src/lib/supabase.ts`, `src/app/api` 全般。 |
| **メンバー1** | **スライド管理 (左上)** | `src/components/practice/SlideViewer.tsx`。 |
| **メンバー2** | **AI対話インターフェース (右上)** | `src/components/practice/ChatInterface.tsx`。 |
| **メンバー3** | **人物設定・前提知識 (右下)** | `src/components/setup/PersonaConfig.tsx`。 |
| **メンバー4** | **認証・ホーム画面 (Portal)** | `src/app/page.tsx`, `src/components/auth/`。 |

---

## セットアップ手順

開発未経験のメンバーは、まず以下の手順でローカル環境を構築してください。

1. **クローン & インストール**:
```bash
git clone <repository-url>
cd logeach
npm install

```


2. **環境変数の設定**:
`.env.example` をコピーして `.env.local` を作成し、リーダーから共有された API キーを入力してください。
```bash
cp .env.example .env.local

```


3. **開発サーバー起動**:
```bash
npm run dev

```



---

## 開発ルール

* **ブランチ運用**: 必ず `dev` ブランチから自分の作業ブランチ（例: `feat/chat-ui`）を切ってください。
* **プルリクエスト (PR)**: 作業完了後は `dev` に対して PR を作成してください。
* **AIツールの活用**: **Cursor**、**v0.dev**、**ChatGPT** を積極的に活用して実装を加速させてください。
* **相談**: ロジックやDB設計に迷ったときは、すぐにリーダーに相談してください。

---