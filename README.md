# REXONDEX Archive

HTML, CSS, JavaScript만 사용하는 정적 개인 일기장입니다.

별도 프레임워크, 패키지 설치, 서버 코드와 사용자 정의 GitHub Actions가 없습니다. `main` 브랜치의 루트 디렉터리를 GitHub Pages로 게시하면 동작합니다. 일반 일기 화면은 브라우저에서 `database.js`와 `database/YYMMDD.md`를 읽어 구성하며, 실행에 사전 빌드는 필요하지 않습니다.

## 검색엔진 기본 설정

기존 화면과 GitHub Pages의 `main` / `/(root)` 배포 방식을 유지합니다.

일반 방문자가 보는 일기·사진·달력·프로필·설정 화면과 일기 8개씩 불러오는 동작은 유지됩니다. 검색 결과용 설명과 링크 공유 미리보기, 브라우저·홈 화면 아이콘 정보가 추가되었습니다. 일기의 `날짜 · 링크`를 일반 클릭하면 기존처럼 앱 안에서 이동하지만, 링크 주소 복사나 새 탭 열기는 `archive.html#daily-YYMMDD`를 사용하므로 정적 전체 일기 페이지로 연결됩니다.

- `index.html`: 설명, 대표 URL(canonical), 검색 허용, Open Graph·Twitter 공유 정보, WebSite·Person JSON-LD, 최근 8개 일기의 정적 HTML을 포함합니다.
- `archive.html`: JavaScript 실행 없이 전체 일기와 참고 링크를 읽을 수 있는 정적 페이지입니다. 앱의 일기 링크도 이 페이지를 가리키며, 일반 클릭은 기존처럼 앱 안에서 이동합니다. 정적 스냅샷은 문단과 줄바꿈을 보존하는 텍스트 형태이며, 앱에서는 기존 Markdown 렌더링을 유지합니다.
- `robots.txt`: 모든 크롤러의 접근을 허용하고 사이트맵 위치를 안내합니다.
- `sitemap.xml`: 실제 HTML 페이지 두 개만 등록합니다. `#daily-…`는 페이지 내 위치이므로 별도 검색 문서로 등록하지 않습니다.
- `favicon.svg`, `favicon.ico`, `favicon-96x96.png`, `apple-touch-icon.png`: 기존 로고의 SVG, 브라우저 호환용 ICO·PNG, 애플 홈 화면 아이콘입니다. SVG 로고를 바꾸면 래스터 아이콘도 함께 갱신해야 합니다.

SEO 작업으로 추가된 관리 작업은 정적 스냅샷 갱신입니다. 새 `.md` 파일과 `database.js`만 게시해도 JavaScript로 동작하는 일반 일기 화면에는 반영됩니다. 다만 `index.html`의 초기 본문과 `archive.html`은 생성 당시 내용이므로, 일기 추가·수정 후 아래 명령을 실행하고 생성 파일도 함께 게시해야 해당 정적 내용까지 최신 상태가 됩니다. 갱신하지 않으면 정적 페이지에는 이전 내용이 남고, 새 일기의 정적 링크에는 해당 위치가 없을 수 있습니다.

이 명령은 로컬에서 수동 실행합니다. 앱 실행이나 GitHub Pages 배포 시 자동 실행되지 않으며, 패키지 설치도 필요 없습니다. `index.html`의 메타 태그를 수정했을 때도 다시 실행하면 `archive.html`에 반영됩니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/update-seo.ps1
git add index.html archive.html sitemap.xml
```

`ExecutionPolicy Bypass`는 위 명령의 PowerShell 프로세스에만 적용되며 시스템 정책을 변경하지 않습니다. 스크립트는 `database.js`에 등록된 일기만 포함하고, 원본 파일이 없거나 날짜가 잘못되면 실패합니다.

대표 주소는 `https://rexondex.github.io/`입니다. 사용자 지정 도메인으로 변경할 경우 `index.html`의 canonical·공유 URL·JSON-LD, `robots.txt`, `scripts/update-seo.ps1`의 사이트맵 URL을 바꾸고 스냅샷을 다시 생성합니다.

배포 후 필요하면 Google Search Console과 네이버 서치어드바이저에서 사이트 소유권을 확인하고 `https://rexondex.github.io/sitemap.xml`을 제출할 수 있습니다. 소유권 확인용 값은 계정별로 발급받아야 하므로 포함하지 않았습니다. 검색엔진의 실제 수집·색인·노출 여부는 각 검색엔진이 결정합니다.

## 파일 구조

```text
rexondex.github.io/
├─ index.html                         페이지 진입점, 메타 태그, 최근 일기 정적 스냅샷
├─ archive.html                       전체 일기 정적 스냅샷
├─ app.js                             전체 화면과 일기 로직
├─ database.js                        표시할 일기 날짜 ID 목록(.md 제외)
├─ database/                          Markdown 원본 일기
│  ├─ 260606.md
│  ├─ 260607.md
│  └─ ...
├─ pictures.js                        사진 섹터·파일 목록
├─ picture/                           섹터별 사진 원본
├─ theme.css                          밝은·어두운 테마 색상
├─ style.css                          전체 UI 스타일
├─ rexondex.jpg                       프로필 이미지
├─ favicon.svg                        SVG 사이트 아이콘
├─ favicon.ico                        ICO 사이트 아이콘
├─ favicon-96x96.png                   PNG 사이트 아이콘
├─ apple-touch-icon.png                애플 홈 화면 아이콘
├─ robots.txt                         크롤러 접근 및 사이트맵 안내
├─ sitemap.xml                        검색엔진용 HTML 페이지 목록
├─ scripts/update-seo.ps1              일기 정적 스냅샷·사이트맵 갱신
└─ README.md
```

## 새 일기 추가

### 1. 원본 파일 작성

`database` 폴더에 `YYMMDD.md` 형식의 Markdown 파일을 만듭니다. 현재 `app.js`는 `fetch('./database/' + id + '.md')` 형태로 읽으므로 `.md` 확장자가 필요합니다. 확장자 없는 파일을 자동으로 찾아 읽는 동작은 없습니다.

```text
database/260807.md
```

확장자를 제외한 날짜 ID는 정확히 숫자 6자리이며 실제 존재하는 날짜여야 합니다. 앞의 두 자리는 2000년대 연도로 해석합니다.

```text
26 = 2026년
08 = 8월
07 = 7일
```

파일 안에는 일반 텍스트나 Markdown을 작성합니다.

```text
오늘 작성한 일기 내용
```

### 2. 목록 등록

`database.js`의 `window.DIARY_FILES`에 `.md`를 제외한 날짜 ID를 추가합니다. 예를 들어 `database/260807.md`는 `'260807'`로 등록합니다. 앱은 유효한 날짜만 사용하고, 중복을 제거해 날짜순으로 정렬한 뒤 최신순으로 표시합니다.

```js
window.DIARY_FILES = [
  '260802',
  '260806',
  '260807',
];
```

마지막 항목 뒤의 쉼표는 있어도 됩니다. 정적 스냅샷 갱신 스크립트도 읽을 수 있도록 위 예시처럼 작은따옴표로 감싼 날짜 ID를 한 줄에 하나씩 작성합니다.

### 3. 정적 스냅샷 갱신 및 GitHub에 게시

일기 화면 자체를 위한 빌드는 필요하지 않습니다. 아래 첫 명령은 검색엔진과 JavaScript 없는 환경에 제공할 정적 HTML을 갱신합니다. 이후 원본 일기·목록·생성 파일을 함께 커밋합니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/update-seo.ps1
git add database/260807.md database.js index.html archive.html sitemap.xml
git commit -m "260807 일기 추가"
git push origin main
```

## 참고 링크

일기 첫 줄 전체에 링크를 작성하면 피드에서 참고 링크 카드로 분리됩니다.

```md
[https://example.com]

이 줄부터 일기 본문입니다.
```

표시 이름을 지정할 수도 있습니다.

```md
[관련 자료](https://example.com)
```

여러 링크를 표시하려면 첫 줄에 대괄호 링크를 이어서 작성합니다. 각 링크는 피드에서 별도의 링크 배지로 표시됩니다.

```md
[https://example.com][https://github.com/rexondex][https://rexondex.tistory.com]

둘째 줄부터 일기 본문입니다.
```

이름을 붙인 Markdown 링크도 연속해서 사용할 수 있습니다.

```md
[관련 자료](https://example.com)[오늘의 커밋](https://github.com/rexondex)
```

## 로컬에서 확인

일기 파일을 `fetch`로 읽으므로 `index.html`을 더블클릭하지 않고 간단한 정적 서버를 사용합니다.

```powershell
python -m http.server 8000
```

브라우저에서 다음 주소를 엽니다.

```text
http://localhost:8000
```

## GitHub Pages 설정

저장소에서 한 번만 설정합니다.

1. `Settings` → `Pages`
2. `Source`: `Deploy from a branch`
3. `Branch`: `main`
4. 폴더: `/(root)`
5. `Save`

이후에는 `main`에 푸시할 때마다 자동으로 게시됩니다. Actions 화면에 GitHub가 내부적으로 실행하는 `pages build and deployment`가 나타날 수 있지만, 이 저장소가 직접 관리하는 Actions 워크플로는 아닙니다.

## 코드 수정 위치

| 변경할 내용 | 파일 |
|---|---|
| 화면 구조, 피드, 달력, 프로필, 설정 동작 | `app.js` |
| 표시할 일기 날짜 | `database.js` |
| 일기 내용 | `database/YYMMDD.md` |
| 사진 목록·원본 | `pictures.js`, `picture/` |
| 색상과 테마 | `theme.css` |
| 크기, 간격, 반응형 디자인 | `style.css` |
| 프로필 이미지 | `rexondex.jpg` |
| 검색·공유 메타 태그 | `index.html`(수정 후 정적 스냅샷 갱신) |
| 정적 HTML 갱신 로직 | `scripts/update-seo.ps1` |
| 크롤러 접근 설정 | `robots.txt` |
| 브라우저·홈 화면 아이콘 | `favicon.svg`, `favicon.ico`, `favicon-96x96.png`, `apple-touch-icon.png` |

## 실행 흐름

```text
index.html
  ├─ 초기 HTML에 최근 일기 정적 스냅샷 포함
  ├─ database.js에서 날짜 ID, pictures.js에서 사진 목록 확인
  ├─ app.js가 초기 본문을 앱 화면으로 교체
  ├─ database/YYMMDD.md에서 최신 일기 8개 요청
  ├─ 더 보기 클릭 시 다음 8개 요청
  └─ 달력에서 연도·월별 기록 탐색
```

달력의 과거 기록을 누르면 해당 기록이 포함된 묶음까지 자동으로 불러옵니다. 앱 실행 중에는 `.md` 원본을 요청하며 정적 스냅샷 갱신 스크립트를 실행하지 않습니다.

JavaScript가 꺼져 있으면 `index.html`의 정적 본문이 유지되며, 전체 일기 링크를 통해 `archive.html`을 읽을 수 있습니다. 이 경우 달력·사진 갤러리·테마 설정 등 앱 기능은 실행되지 않습니다.
