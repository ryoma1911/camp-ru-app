# キャンプ場データの入れ方

`campsites_template.csv` をコピーして1行に1キャンプ場を書き、Supabase の Table Editor → `campsites` → Insert → **Import data from CSV** で取り込みます。

情報は各キャンプ場の**公式サイト**から集めてください。予約サイトなど他サービスのデータを丸ごと写すのは避けます。

| 列 | 書き方 | 例 |
| --- | --- | --- |
| slug | URLに使う英小文字・数字・ハイフン。重複不可 | `example-camp` |
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

例の値は書き方の説明用です。実際の値は必ず公式サイトで確認してください。

`true` / `false` と英語の値はすべて小文字で書きます。日本語（「可」「焚き火台必須」など）はDBが受け付けません。

取り込む前に次のコマンドで値をチェックできます（問題がなければ「OK」と出ます）。

```bash
node data/check-campsites.mjs data/campsites.csv
```
