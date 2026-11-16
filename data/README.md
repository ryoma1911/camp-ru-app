# キャンプ場データの入れ方

`campsites_template.csv` をコピーして1行に1キャンプ場を書き、Supabase の Table Editor → `campsites` → Insert → **Import data from CSV** で取り込みます。

情報は各キャンプ場の**公式サイト**から集めてください。予約サイトなど他サービスのデータを丸ごと写すのは避けます。

| 列 | 書き方 | 例 |
| --- | --- | --- |
| slug | URLに使う英小文字・数字・ハイフン。重複不可。`new` は使えない（キャンプ場登録のページの URL のため） | `example-camp` |
| name | キャンプ場名 | 〇〇キャンプ場 |
| prefecture | 都道府県 | 山梨県 |
| address | 住所 | 山梨県〇〇市〇〇1-2-3 |
| lat, lng | 緯度・経度（Googleマップで右クリックするとコピーできる）。空欄可 | `35.1234`, `138.5678` |
| location_type | `forest`（林間）/ `river`（河原）/ `lake`（湖畔）/ `highland`（高原）/ `sea`（海沿い）/ `meadow`（草原）/ `view`（展望）。**1つだけ**書く。複数当てはまるときは一番の特徴を選ぶ | `highland` |
| site_style | `sectioned`（区画サイト）/ `free`（フリーサイト）/ `both`（両方）。車の乗り入れは car_access で別に書く | `free` |
| car_access | サイトに車を乗り入れできるか `true` / `false` | `true` |
| has_hot_water | 炊事場でお湯が出るか `true` / `false` | `false` |
| has_shower | シャワーがあるか `true` / `false` | `true` |
| has_bath | 風呂があるか `true` / `false` | `true` |
| fire_rule | `open_fire_ok`（直火OK）/ `stand_required`（焚き火台が必要）/ `prohibited`（禁止） | `stand_required` |
| official_url | 公式サイトのURL | `https://...` |
| has_kitchen | 炊事場があるか `true` / `false`。わからなければ空欄 | `true` |
| garbage | ゴミ：`paid`（有料）/ `free`（無料）/ `take_home`（持ち帰り）。複数は `"{paid,take_home}"` のように書く。空欄可 | `"{paid,take_home}"` |
| ac_power | AC電源：`extra_fee`（設置サイトあり・別料金）/ `included`（設置サイトあり・料金に含む）/ `none`（なし）。`none` はほかと一緒に書けない。空欄可 | `{extra_fee}` |
| has_shop | 売店があるか `true` / `false`。空欄可 | `true` |
| shop_items | 売店で買えるもの：`gas` / `firewood`（薪）/ `charcoal`（炭）/ `towel` / `meal_kit` / `toothbrush` / `other`。has_shop が `true` のときだけ。空欄可 | `"{gas,firewood,charcoal}"` |
| has_wifi | Wi-Fi があるか `true` / `false`。空欄可 | `false` |
| payment_methods | 決済方法：`cash`（現金）/ `card`（カード）。空欄可 | `"{cash,card}"` |
| google_place_id | Googleマップの Place ID。入れると地図リンクが施設名で開く。Googleマップに登録がなければ空欄（座標で開く） | `ChIJN1t_tDeuEmsRUsoyG83frY4` |
| winter_closed_from / winter_closed_to | 冬季閉鎖の期間（毎年同じ月日、`MM-DD`）。年をまたいでよい。閉鎖なしなら両方空欄 | `12-01` / `03-31` |
| winter_closure_note | 冬季閉鎖の補足（100文字まで）。空欄可 | `積雪により変わることがあります` |

has_kitchen から payment_methods までの7列は、あとから足した設備の列です。空欄にすると「未入力」になり、キャンプ場ページでは空欄で表示されます。古いテンプレート（この7列や google_place_id・冬季閉鎖の列がない CSV）もそのまま取り込めます。Place ID は Google の「Place ID Finder」で調べられます。複数の値を書くときは、`,` を含むので `"{paid,take_home}"` のようにダブルクォートで囲みます。取り込んだあとは、運営用の管理画面（`/admin` → キャンプ場の「設備・地図」）でも直せます。

例の値は書き方の説明用です。実際の値は必ず公式サイトで確認してください。

`true` / `false` と英語の値はすべて小文字で書きます。日本語（「可」「焚き火台必須」など）はDBが受け付けません。

取り込む前に次のコマンドで値をチェックできます（問題がなければ「OK」と出ます）。

```bash
node data/check-campsites.mjs data/campsites.csv
```

## キャンプ場の写真

写真は CSV ではなく、運営用の管理画面（`/admin`）で登録します。

- 使える写真は「自分で撮った写真」と「投稿者が許可したソト活の写真」だけです。公式サイト・予約サイト・SNS の写真は使いません。
- 1キャンプ場につき10枚まで。一番上がカバー写真になります。
- 管理画面を使うには、Supabase の Table Editor → `admins` に自分の `user_id`（Authentication → Users に出ている ID）を1行足します。
- ソト活から採用した写真は、投稿者が投稿を消す・許可を外す・写真を外すと自動で外れ、残りの写真が繰り上がります（なければ種類の色の表示に戻ります）。

## ユーザーからのキャンプ場登録の申請

ユーザーはメニューの「キャンプ場登録」（`/campsites/new`）から申請できます。運営は管理画面の「キャンプ場登録の申請」（`/admin/submissions`）で、公式サイトを見て内容を直し、緯度経度を入れて「承認して公開」します。slug は自動で作られます（都道府県のローマ字＋ランダムな6文字。例：`nagano-k3f9a2`）。CSV を使わずにそのまま `campsites` に追加されます。

- 申請者には結果を知らせません（今後の通知機能で、公開されたときだけ知らせる予定）。
- 見送るときは理由（登録済み／キャンプ場ではない／情報が足りない）を選びます。理由は運営のメモとして残るだけです。

## ソト活のテストデータ

表示や検索を確かめるためのテストデータを、Supabase の SQL エディタで入れられます（`supabase/seed/`。マイグレーションではないので自動では流れません）。

| ファイル | 中身 |
| --- | --- |
| `supabase/seed/test_checkins.sql` | テストユーザー10人（`test01〜test10@sotoasobi.test`、ニックネーム「テスト01〜10」）と、ソト活 約160件（キャンプ場25か所に3〜10件ずつ、過去12か月）を作る。前回のテストデータを消してから作るので、何回実行しても重複しない |
| `supabase/seed/delete_test_data.sql` | テストユーザーと、そのプロフィール・ソト活をまとめて消す。本物のユーザーの投稿には触れない |

- テストユーザーではログインできません（ログインは Google だけのため）。
- 写真は入りません。
- SQL で直接入れた分は、集計のキャッシュが切れるまで画面に出ません。入れたあとは開発サーバーを再起動してください。
- **公開前に必ず `delete_test_data.sql` を実行して消してください。**
