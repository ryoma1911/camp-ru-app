-- キャンプ場の種類に「草原」を追加し、サイト形式を「区画／フリー」に変える
-- （車の乗り入れは campsites.car_access で別に持っているため、サイト形式から「オート」の意味を外す）

alter type public.location_type add value if not exists 'meadow';     -- 草原
alter type public.site_style rename value 'auto' to 'sectioned';       -- 区画（旧: オート）
