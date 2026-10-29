# REXONDEX Archive

HTML, CSS, JavaScript만 사용하는 GitHub Pages용 정적 일기장입니다. 사용자 정의 GitHub Actions, 패키지 설치, 서버가 필요하지 않습니다. 로컬 Git 커밋 훅이 완성된 정적 파일을 자동으로 준비합니다.

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

새 일기는 본문만 작성해도 됩니다. 파일명 `261030.html`에서 날짜를 정하고, 첫 커밋 때 완성된 정적 HTML 문서로 자동 구성합니다. 기존 일기는 `.post-content` 안의 본문만 수정합니다. 제목·날짜·canonical·공유 메타 정보·구조화 데이터·전후 일기 링크는 자동 갱신되므로 직접 수정할 필요가 없습니다. 작성한 본문과 참고 링크는 보존합니다. 첫 문단이 날짜만 적힌 `<p>26.01.01</p>`이면 그 날짜도 파일명에 맞춰 갱신합니다.

```html
<p>오늘 작성한 일기입니다.</p>
<p>다음 문단입니다.<br>같은 문단의 줄바꿈입니다.</p>
```

참고 링크를 함께 작성할 때는 아래처럼 본문과 구분합니다.

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

## 커밋 시 SEO 자동 처리

현재 로컬 저장소에는 설치되어 있습니다. 새 컴퓨터에서 clone한 경우 한 번만 실행합니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/install-hooks.ps1
```

그다음 평소처럼 작성·등록·커밋·푸시하면 됩니다.

```powershell
git add database/261030.html database.js
git commit -m "261030 일기 추가"
git push origin main
```

커밋 시 `.githooks/pre-commit`이 다음을 자동으로 생성하고 **같은 커밋에 포함**합니다.

- 파일명에 맞는 날짜·제목·canonical·공유 정보·BlogPosting JSON-LD
- 본문에서 추출한 설명, 개별 페이지의 정적 본문과 전후 일기 링크
- 홈의 최근 8개 정적 본문, 전체 일기 정적 본문, 사진 정적 갤러리
- HTML 페이지와 지원 이미지 주소가 포함된 사이트맵

자동화는 커밋에 올린 내용만 사용합니다. 부분적으로 스테이징한 파일의 나머지 수정과 다른 미커밋 작업은 덮어쓰거나 커밋에 끌어오지 않습니다. 원본 HTML이 잘못되었거나 등록된 원본이 없으면 해당 커밋을 중단하고 이유를 표시합니다. `git add`에 새 원본과 목록을 함께 포함합니다.

**로컬 Git 훅이므로 GitHub 웹 편집, 훅을 설치하지 않은 다른 컴퓨터, `git commit --no-verify`에서는 자동 실행되지 않습니다.** GitHub Pages 자체는 계속 완성된 파일을 그대로 게시합니다. 모든 작성 환경에서 서버 측으로 자동 처리하는 기능은 없습니다.

수동 실행도 가능합니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/update-seo.ps1
```

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
| HTML·메타 정보·스냅샷·사이트맵 갱신 | `scripts/update-seo.ps1` |
| 로컬 커밋 자동화 / 최초 설치 | `.githooks/pre-commit`, `scripts/seo-pre-commit.ps1` / `scripts/install-hooks.ps1` |
| 선택적인 정적 링크 검사 | `scripts/test-seo.ps1` |

로컬에서는 정적 HTTP 서버로 열면 됩니다. HTML 파일을 더블클릭하면 브라우저 보안 정책 때문에 피드의 `fetch`가 제한될 수 있습니다.