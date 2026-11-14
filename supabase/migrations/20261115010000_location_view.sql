-- キャンプ場の種類に「展望」を追加（夜景・景色の眺めが売りのキャンプ場）
alter type public.location_type add value if not exists 'view';
