# Pocket Vivarium — こもれびの村

住人の暮らしを眺める箱庭の試作品。現在は、ある朝の2時間を収めたJSONを再生するプレイヤーです。

## 起動

```sh
python3 -m http.server 8000 --directory dist
```

http://localhost:8000 を開きます。JSON取得のためHTTPサーバーが必要です。ビルド・追加依存関係はありません。

## 再生

- 初期速度は×30。2時間分を4分で確認できます。
- ×1（実時間）・×30・×120、一時停止、±5分、最初から、再生位置スライダーに対応。
- ブラウザを開くと0分から開始します。現実の日時との連動・localStorage保存はありません。
- タブを非表示にしている間は再生時間を進めません。
- 120分で再生を終了します。「もう一度」または「最初から」で再開できます。終了後も住人の見た目の動きは続きます。
- 5分刻みの状態の間も、住人は活動場所の周囲を歩いたり立ち止まったりします。
- 巻き戻すと数値・行動・手帳をその時点へ戻し、表示用座標もリセットします。

## 状態JSON

`dist/state.json` は `schemaVersion: 2`、`mode: "relative"` のサンプルデータです。

- `durationMinutes: 120`、`stepMinutes: 5`
- `frames`：`minute` が0, 5, …, 115の24時点。各 `state` に村と住人の状態を格納。
- `endState`：120分経過時の状態。最後の表示と、将来の次バッチへの引き継ぎを想定。
- `hour` は村の中の時刻。現実のUNIX時刻や日付ではありません。

今は手作りのサンプルで、状態を生成するバックエンドはありません。画面はJSON内の記録を選択し、描画だけを行います。読み込んだ状態を変更せず、歩行用座標は別に管理します。JSONは起動時に一度読み込み、再生中は再取得しません。

## 今後の方向性

将来は1日12回（2時間ごと）シミュレーションを実行し、5分刻みの24時点をまとめて生成する構想です。現実の適用開始日時と再生位置を結ぶ機能を後から加え、描画は共用します。現在、スケジュール・自動生成・現実時刻モード・過去バッチの履歴保存は未実装です。

住人を逐一操作せず、性格・欲求・経験から生まれる行動を見守る体験を目指します。生成AIは使用していません。

## 検証

```sh
node tests/player.cjs
```

時点の境界、速度、シーク、巻き戻し、終了・再生、非表示時の停止と元データを変更しないことを確認します。

## 公開サイト

https://little-village-observatory.pirakansa.chatgpt.site

GitHubへの保存とSites公開は別の操作です。

## GitHub Pagesへの公開

`.github/workflows/deploy-pages.yml` が `main` へのpushと手動実行（Actions → Deploy to GitHub Pages → Run workflow）で動きます。Node.js 22で既存の再生テストを実行し、成功した場合だけ `dist/` を公開します。ビルドは不要です。

初回はリポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に設定してください。その後、Actionsから手動実行するかmainへpushします。公開先URLは成功したデプロイのEnvironmentに表示されます。

非公開リポジトリのPages利用には、対応するGitHubプランが必要です。通常の個人リポジトリのPagesは、ソースが非公開でもサイトは公開されます。`dist/` のHTML・JS・JSONが公開対象です。

このワークフローは公開専用で、2時間ごとのスケジュールや状態JSONの生成はまだ含めません。将来、自動生成したJSONを `GITHUB_TOKEN` でコミットする場合、そのpushでは別ワークフローが起動しないため、生成と公開を同じワークフローに組み込む等の接続が必要です。

既存のSitesには変更を加えません。PagesとSitesは別の公開先です。

公式手順: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
