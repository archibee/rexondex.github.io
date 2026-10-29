# REXONDEX Archive

HTML, CSS, JavaScript만 사용하는 정적 개인 일기장입니다.

별도 프레임워크, 패키지 설치, 서버 코드와 사용자 정의 GitHub Actions가 없습니다. `main` 브랜치의 루트 디렉터리를 GitHub Pages로 게시하면 동작합니다. 일반 일기 화면은 브라우저에서 `database.js`와 `database/YYMMDD.md`를 읽어 구성하며, 실행에 사전 빌드는 필요하지 않습니다.

## 검색엔진 설정과 주소

GitHub Pages의 `main` / `/(root)` 배포와 기존 피드·달력·사진·테마 디자인을 유지합니다. 홈 피드는 기존처럼 Markdown 일기를 최신순으로 8개씩 불러옵니다.

- `index.html`: 최근 8개 일기 본문과 개별 일기 링크를 정적 HTML로 제공합니다.
- `diary/YYMMDD.html`: 날짜별 독립 주소입니다. 같은 앱 디자인으로 해당 일기 하나를 표시하고, 전후 일기·전체 일기·메인으로 연결합니다. 초기 HTML에 본문, 날짜별 제목·요약, 자기 자신을 가리키는 canonical, Open Graph·Twitter 정보와 BlogPosting JSON-LD가 있습니다. JavaScript로 canonical을 바꾸지 않습니다.
- `archive.html`: JavaScript 없이 전체 일기와 개별 일기 링크를 읽을 수 있습니다. 더 보기 버튼을 누르지 않는 크롤러도 모든 일기를 찾을 수 있도록 앱에서도 이 페이지로 연결합니다.
- `pictures.html`: 첫 사진 섹터의 정적 갤러리입니다. 추가 섹터는 `pictures/sector-ID.html` 주소를 사용합니다. 원본 링크가 있는 `<img>` 목록을 제공하며, JavaScript가 있으면 기존 모달로 확대합니다.
- `sitemap.xml`: 홈·전체 일기·모든 개별 일기·사진 갤러리의 실제 주소와 지원되는 이미지 URL을 등록합니다. 이미지 검색에서 지원하지 않는 HEIC는 이미지 사이트맵에서 제외하지만 갤러리와 원본 링크는 유지합니다.
- `robots.txt`: 크롤러 접근을 허용하고 사이트맵을 안내합니다.
- `legacy-links.js`: `/#daily-261025`, `/index.html#daily-…`, `/archive.html#daily-…`처럼 **`#daily-`로 시작하는 예전 링크는 날짜·뒤 문자열과 관계없이 메인 `/`로 이동**합니다. 예전 일기 위치는 복원하지 않습니다. 해시는 서버로 전송되지 않으므로 HTTP 301이 아닌 브라우저의 `location.replace`로 처리합니다. JavaScript를 끈 환경에서는 해당 HTML 페이지가 열립니다.

새로 공유할 일기 주소는 `https://rexondex.github.io/diary/261025.html` 형식입니다. 피드의 날짜 링크와 달력의 기록도 실제 개별 주소를 가리킵니다. 새 탭 열기·주소 복사·뒤로 가기를 브라우저 기본 방식으로 지원합니다. 달력의 연도·월 선택과 참고 링크 표시 로직은 유지합니다.

사진 설명은 `pictures.js`의 섹터별 `descriptions`에 실제 사진을 보고 작성합니다. 파일명이나 추정 내용으로 대체 텍스트를 꾸며내지 않습니다. 입력한 설명은 썸네일과 모달의 `alt`, 링크 이름에 반영됩니다.

```js
"descriptions": {
  "실제-사진파일.jpg": "사진에 실제로 보이는 장소와 장면 설명"
}
```

### 일기·사진을 변경한 후

원본과 목록 수정 후 아래 명령으로 검색용 HTML을 다시 생성하고, 생성 파일도 함께 게시합니다. 패키지 설치나 서버 빌드는 필요 없습니다. PowerShell 5.1 또는 7에서 실행할 수 있습니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/update-seo.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/test-seo.ps1
git add index.html archive.html diary pictures.html sitemap.xml
```

두 번째 사진 섹터부터는 `pictures/` 폴더도 생성되므로 함께 커밋합니다. `ExecutionPolicy Bypass`는 해당 명령의 PowerShell 프로세스에만 적용됩니다. 이 갱신은 GitHub Pages가 자동 실행하지 않습니다. 특히 개별 일기 링크는 실제 HTML 파일이 필요하므로 **게시 전에 반드시 생성**해야 합니다. 생성 파일의 직접 편집 대신 원본을 수정하고 다시 생성합니다.

정적 일기 본문은 문단·줄바꿈을 보존한 텍스트이며 앱에서는 기존 marked Markdown 렌더링을 사용합니다. marked는 버전을 고정했습니다. 사이트에 없는 글이나 사진 설명은 SEO를 위해 추가하지 않습니다.

대표 주소를 바꾸면 `index.html`의 canonical·공유 URL·WebSite/Person JSON-LD와 `robots.txt`를 수정하고 다시 생성합니다. 개별 페이지 주소와 사이트맵은 홈 canonical을 기준으로 생성합니다.

배포 후 Google Search Console에서 소유권을 확인하고 `https://rexondex.github.io/sitemap.xml`을 제출합니다. 소유권 확인 값은 계정별 발급이 필요하며 저장소에는 포함하지 않았습니다. 실제 수집·색인·순위는 검색엔진이 결정합니다.

## 파일 구조

```text
rexondex.github.io/
├─ index.html                         페이지 진입점, 메타 태그, 최근 일기 정적 스냅샷
├─ archive.html                       전체 일기 정적 스냅샷
├─ diary/                             날짜별 독립 HTML 페이지
├─ pictures.html                      사진 정적 갤러리
├─ legacy-links.js                    예전 해시 링크를 메인으로 연결
├─ theme-init.js                      첫 화면 테마 설정
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
├─ scripts/update-seo.ps1              일기·사진 정적 HTML·사이트맵 갱신
├─ scripts/test-seo.ps1                메타 정보·사이트맵·내부 링크 검사
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
git add database/260807.md database.js index.html archive.html diary pictures.html sitemap.xml
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

달력의 기록을 누르면 같은 디자인의 개별 일기 주소로 이동합니다. 앱 실행 중에는 `.md` 원본을 요청하며 정적 스냅샷 갱신 스크립트를 실행하지 않습니다.

JavaScript가 꺼져 있으면 `index.html`의 정적 본문이 유지되며, 전체 일기 링크를 통해 `archive.html`을 읽을 수 있습니다. 이 경우 정적 사진 갤러리와 원본 링크도 사용할 수 있지만 달력·모달·테마 설정 등 앱 기능은 실행되지 않습니다.
