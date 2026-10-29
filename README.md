# REXONDEX Archive

HTML, CSS, JavaScript만 사용하는 GitHub Pages용 정적 일기장입니다. 사용자 정의 GitHub Actions, 패키지 설치, 서버, 배포 전 빌드가 필요하지 않습니다.

## 일기 등록

1. `database/YYMMDD.html`에 일기를 작성합니다.
2. `database.js`에 **확장자를 포함한 파일명**을 등록합니다.
3. HTML 원본과 목록을 함께 커밋하고 `main`에 푸시합니다.

```js
window.DIARY_FILES = [
  '261025.html',
  '261029.html',
];
```

등록된 HTML은 일기 원본이면서 직접 열 수 있는 검색용 페이지입니다. 예: `https://rexondex.github.io/database/261029.html`. 피드와 달력도 같은 파일을 사용합니다. 목록 순서와 관계없이 최신 날짜순으로 표시하고 홈에서는 기존처럼 8개씩 불러옵니다. 전체 일기 화면도 목록에서 최신 내용을 읽습니다.

새 일기는 기존 HTML 하나를 복사해서 작성하는 것이 편합니다. 파일명과 함께 다음 값을 해당 날짜에 맞게 수정합니다.

- `<title>`, description, canonical, Open Graph·Twitter 제목·설명·주소
- JSON-LD의 글 주소·제목·작성일과 `mainEntityOfPage`
- `<body data-diary-id="261030">`의 날짜 ID
- 정적 본문의 날짜·`datetime`, 해당 글 링크와 전후 일기 링크
- `.post-content` 안의 실제 일기 본문

중첩 폴더의 HTML은 `<base href="../">`를 유지합니다. 개별 HTML에는 글 하나의 본문이 이미 들어 있으므로 JavaScript 없이도 읽을 수 있습니다. 앱은 그 HTML의 `.post-content`와 `.post-references`를 읽어 기존 피드 디자인으로 표시합니다.

본문은 Markdown 대신 HTML로 작성합니다.

```html
<div class="post-content">
  <p>26.10.30</p>
  <p>오늘의 일기입니다.<br>같은 문단의 다음 줄입니다.</p>
  <p>새 문단입니다.</p>
</div>
```

참고 링크가 있으면 본문 바깥에 추가합니다. 없으면 이 블록은 생략합니다.

```html
<div class="post-references" aria-label="참고 링크">
  <a class="post-reference" href="https://example.com">관련 자료</a>
</div>
```

## 사진 등록

사진 원본을 `picture/sector-1/` 등에 넣고 `pictures.js`의 해당 섹터 `files`에 파일명을 직접 추가합니다. 기존 방식과 같습니다. 설명은 선택 사항이며 입력하면 썸네일과 모달의 대체 텍스트에 사용합니다.

```js
window.PICTURE_SECTORS = [
  {
    id: 'sector-1',
    files: ['photo.jpg', 'another.webp'],
    descriptions: { 'photo.jpg': '사진에 실제로 보이는 장면 설명' },
  },
];
```

일기·사진 목록에는 작은따옴표·큰따옴표, 주석, 마지막 쉼표를 사용할 수 있습니다. 함수나 동적 표현식 없이 배열 데이터로 작성합니다.

## SEO와 정적 페이지

- `database/YYMMDD.html`: 실제 일기 본문·날짜별 메타 정보·canonical·공유 정보·BlogPosting JSON-LD를 가진 독립 페이지입니다. 원본과 검색용 페이지를 따로 만들지 않습니다.
- `index.html`, `archive.html`, `pictures.html`: 초기 HTML에도 본문이 포함되어 있고, 앱 실행 시 목록에서 최신 내용을 읽습니다.
- `sitemap.xml`, `robots.txt`: 검색엔진의 페이지·이미지 발견을 돕습니다.
- `legacy-links.js`: `#daily-`로 시작하는 예전 링크는 특정 일기를 선택하지 않고 메인으로 이동합니다.
- `.nojekyll`: GitHub Pages에서 파일을 그대로 게시합니다.

새 HTML을 작성해 목록에 등록하는 것만으로 실제 페이지·피드·달력에 반영됩니다. 메인·전체 일기·사진의 **JavaScript 실행 전 스냅샷과 사이트맵까지 갱신하고 싶을 때만** 아래 선택 명령을 실행하고 변경된 파일을 함께 커밋합니다. 이 명령은 작성한 개별 일기 HTML을 수정하지 않습니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/update-seo.ps1
```

스냅샷을 갱신하지 않아도 새 HTML 주소는 즉시 열리고 앱의 링크를 통해 접근할 수 있습니다. 검색엔진에는 새 파일의 canonical과 본문이 제공됩니다. 다만 기존 스냅샷과 사이트맵에는 이전 목록이 남으므로 주기적인 갱신을 권장합니다.

## GitHub Pages 설정

저장소의 `Settings` → `Pages`에서 설정합니다.

1. `Source`: **Deploy from a branch**
2. `Branch`: **main**
3. 폴더: **/(root)**
4. `Save`

이후 원본 HTML·목록을 푸시하면 정적 배포됩니다. 이전에 배포 소스를 변경했다면 위 설정으로 되돌립니다. 저장소의 사용자 정의 Actions 워크플로와 아티팩트 패키징 코드는 제거했습니다. GitHub가 자체 관리하는 Pages 배포 작업은 Actions 화면에 표시될 수 있습니다.

## 주요 파일

| 내용 | 위치 |
|---|---|
| 일기 HTML 원본·개별 페이지 | `database/YYMMDD.html` |
| 일기 파일명 목록 | `database.js` |
| 사진 목록·설명 / 사진 원본 | `pictures.js` / `picture/` |
| 피드·달력·사진·설정 로직 | `app.js` |
| 화면 디자인·색상 | `style.css`, `theme.css` |
| 선택적인 스냅샷·사이트맵 갱신 | `scripts/update-seo.ps1` |
| 선택적인 정적 링크 검사 | `scripts/test-seo.ps1` |

로컬에서는 정적 HTTP 서버로 열면 됩니다. HTML 파일을 더블클릭하면 브라우저 보안 정책 때문에 피드의 `fetch`가 제한될 수 있습니다.