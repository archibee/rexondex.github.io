# REXONDEX Archive

HTML, CSS, JavaScript만 사용하는 정적 개인 일기장입니다.

별도 프레임워크, 패키지 설치, 실행 서버가 없는 GitHub Pages용 정적 사이트입니다. `database.js`와 `pictures.js`에 파일명을 직접 등록하고 원본과 함께 `main`에 올리면 GitHub Actions가 검색용 HTML과 사이트맵을 생성·검사한 뒤 GitHub Pages에 배포합니다. 방문자는 완성된 정적 파일만 받습니다.

## 검색엔진 설정과 주소

GitHub Pages 호스팅과 기존 피드·달력·사진·테마 디자인을 유지합니다. 자동 생성·배포는 `main` 브랜치를 대상으로 합니다. 홈 피드는 기존처럼 Markdown 일기를 최신순으로 8개씩 불러옵니다.

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

1. `database/`에 일기 원본을 넣고 `database.js`에 `'261030.md'`처럼 파일명을 등록합니다. 확장자 없는 기존 `'261030'`도 계속 지원합니다.
2. 사진은 `picture/sector-1/` 등에 원본을 넣고 `pictures.js`의 해당 섹터 `files` 배열에 `'photo.jpg'`처럼 파일명을 추가합니다. `descriptions`는 선택 사항입니다.
3. 수정한 원본·목록을 `main`에 커밋하고 푸시합니다. HTML을 직접 만들거나 생성 명령을 매번 실행할 필요가 없습니다.

`.github/workflows/pages.yml`이 정적 HTML과 사이트맵을 생성하고 내부 링크를 검사한 뒤, 공개 파일만 `_site`에 묶어 GitHub Pages에 배포합니다. 생성 결과는 배포 아티팩트에 포함되며 저장소에 자동 커밋하지 않습니다. 한 번의 GitHub Pages 설정은 아래를 참고합니다.

로컬에서 생성 결과를 확인하거나 기존 `Deploy from a branch` 배포 방식을 유지하고 싶으면 수동으로도 실행할 수 있습니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/update-seo.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/test-seo.ps1
```

수동 브랜치 배포에서는 원본·목록과 함께 생성된 `index.html`, `archive.html`, `diary/`, `pictures.html`, `sitemap.xml` 및 추가 섹터의 `pictures/`도 커밋해야 합니다. 자동 Actions 배포에서는 생성 파일을 직접 관리하지 않아도 됩니다. `ExecutionPolicy Bypass`는 해당 명령의 PowerShell 프로세스에만 적용됩니다.

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
├─ database.js                        표시할 날짜 또는 일기 파일명 목록
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
├─ scripts/manifest.ps1                수동 일기·사진 목록 파싱
├─ scripts/prepare-pages.ps1           정적 배포 파일 묶음 생성
├─ .github/workflows/pages.yml         목록 변경 후 자동 생성·배포
└─ README.md
```

## 새 일기 추가

### 1. 원본 파일 작성

`database` 폴더에 `YYMMDD.md` 형식의 Markdown 파일을 만듭니다. 목록에 적은 파일명을 기준으로 원본을 읽습니다. 확장자 없는 날짜를 등록하면 `.md`를 붙입니다. 실제 원본 파일에는 `.md` 확장자가 필요합니다.

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

`database.js`의 `window.DIARY_FILES`에 원본 파일명을 직접 적습니다. 기존 날짜 ID 표기와 확장자를 포함한 표기를 섞어도 됩니다. 같은 날짜는 하나만 표시합니다.

```js
window.DIARY_FILES = [
  '260802',       // 기존 표기도 지원
  '260806.md',    // 확장자를 포함한 파일명
  "260807.md",   // 큰따옴표도 지원
];
```

일기·사진 목록은 작은따옴표·큰따옴표, 주석, 마지막 쉼표를 지원합니다. 사진 객체의 키도 기존 큰따옴표 표기와 일반 JavaScript 키 표기를 모두 지원합니다. 목록은 함수나 동적 표현식 없이 배열 데이터로 작성합니다.

```js
window.PICTURE_SECTORS = [
  {
    id: 'sector-1',
    files: ['photo.jpg', 'another.webp'],
  },
];
```

### 3. GitHub에 게시

자동 배포를 설정한 뒤에는 원본과 목록을 커밋하고 푸시하면 됩니다. 아래 예시에서는 GitHub Actions가 개별 HTML과 사이트맵을 생성합니다.

```powershell
git add database/260807.md database.js
git commit -m "260807 일기 추가"
git push origin main
```

사진도 `pictures.js`와 추가한 `picture/` 파일을 함께 올리면 같습니다. `Actions`에서 생성·검사·배포 성공 여부를 확인합니다.

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

자동 생성·배포를 사용하려면 저장소에서 한 번 설정합니다.

1. `Settings` → `Pages` → `Build and deployment`
2. `Source`: **GitHub Actions**
3. `main`에 푸시하거나 `Actions` → `Build and deploy static GitHub Pages` → `Run workflow`를 실행합니다.

이 워크플로는 실행 서버나 외부 호스팅을 추가하지 않습니다. GitHub의 빌드 환경에서 정적 HTML을 만든 뒤 GitHub Pages에 올립니다. 게시되는 파일에는 서버 프로그램·개발 도구가 포함되지 않습니다. 설정을 바꾸기 전에는 자동 배포가 활성화되지 않습니다.

[GitHub 공식 정적 Pages 워크플로 안내](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

기존 `Deploy from a branch` / `main` / `/(root)` 설정도 지원합니다. 그 경우에는 위 수동 생성 명령을 실행하고 생성 HTML까지 함께 커밋합니다. 목록만 수정하는 자동 관리 방식은 GitHub Actions 설정을 사용합니다.

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
  ├─ database.js에서 날짜·파일명, pictures.js에서 사진 목록 확인
  ├─ app.js가 초기 본문을 앱 화면으로 교체
  ├─ database/YYMMDD.md에서 최신 일기 8개 요청
  ├─ 더 보기 클릭 시 다음 8개 요청
  └─ 달력에서 연도·월별 기록 탐색
```

달력의 기록을 누르면 같은 디자인의 개별 일기 주소로 이동합니다. 앱 실행 중에는 `.md` 원본을 요청하며 정적 스냅샷 갱신 스크립트를 실행하지 않습니다.

JavaScript가 꺼져 있으면 `index.html`의 정적 본문이 유지되며, 전체 일기 링크를 통해 `archive.html`을 읽을 수 있습니다. 이 경우 정적 사진 갤러리와 원본 링크도 사용할 수 있지만 달력·모달·테마 설정 등 앱 기능은 실행되지 않습니다.
