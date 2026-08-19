# 프로필 사진

계정별 아바타. **파일명 = 핸들에서 `@`를 뗀 것**이고, 그게 유일한 연결 규칙이다
(`@meme_bot99` → `meme_bot99.svg`). 플레이어는 `me.svg`.
`data/npcs.js`에는 경로를 적지 않는다 — `js/ui.js`의 `pfp()`가 핸들에서 만들어 쓴다.

## 출처

[DiceBear](https://dicebear.com) v9의 **open-peeps** 스타일로 생성했다.
원본 아트워크는 Pablo Stanley의 [Open Peeps](https://openpeeps.com), **CC0 1.0**(퍼블릭 도메인)이라
출처 표기 의무가 없다. 그래도 남겨둔다.

런타임에 DiceBear를 호출하지 않고 **받아서 저장소에 넣어 쓴다.** 이유:

- 이 프로젝트는 외부 의존성 없이 `index.html`을 바로 여는 게 규칙이다(CLAUDE.md).
- 외부 URL을 쓰면 오프라인에서 전부 깨지고, 서비스가 사라지면 되돌릴 수 없다.
- `<img src>`는 상대경로면 `file://`에서도 잘 뜬다. (`fetch`는 CORS로 막히지만 이미지는 아니다)

## 계정을 추가할 때

`data/npcs.js`에 항목을 넣고, 같은 이름의 svg를 여기에 만든다. `seed`를 핸들로 두면
언제 다시 받아도 같은 얼굴이 나온다. `backgroundColor`는 계정마다 다르게 줘서
얼굴이 비슷해도 배경색으로 구분되게 한다.

```sh
h=new_handle; bg=ffe0a3   # bg는 다른 계정과 겹치지 않는 값으로
curl -sfL "https://api.dicebear.com/9.x/open-peeps/svg?seed=$h&backgroundColor=$bg&size=96" \
  -o "assets/avatars/$h.svg"
```

svg를 빠뜨리면 그 계정만 아바타가 깨진다(회귀 테스트가 잡는다 — `test/check-assets.js`).

## 현재 배경색

겹치지 않게 관리할 것.

| 핸들 | 배경 | 핸들 | 배경 |
|---|---|---|---|
| me | `#cfe8ff` | dawn_feels | `#d5f2ea` |
| meme_bot99 | `#ffe0a3` | sat_review | `#f9d5c0` |
| info_hunter | `#b6e3f4` | tl_weather | `#cfe8ff` |
| fire_starter | `#ffd5dc` | spoiler_free | `#e8d5f9` |
| night_owl_kr | `#c0aede` | cat_daily | `#ffe8cf` |
| mutuals_only | `#c4f0c5` | ad_detector | `#f9c0c0` |
| numbers_guy | `#d1d4f9` | rookie_writer | `#e0f0d5` |
| lurker_9 | `#e6e6e6` | old_records | `#d8d0c0` |
| anime_burn | `#ffd9e8` | otaku_wallet | `#cfe3d4` |
| sakuga_note | `#e0dcf5` | | |
