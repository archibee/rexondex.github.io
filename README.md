# REXONDEX Archive

GitHub Pages용 정적 일기·사진 아카이브입니다. 파일을 추가한 뒤 아래 명령을 복사해서 실행하고, 변경된 파일을 직접 커밋·푸시합니다. Git 훅과 사용자 정의 GitHub Actions를 사용하지 않습니다.

## 매번 복붙해서 실행할 명령

프로젝트 루트 폴더에서 PowerShell로 실행합니다. 일기와 사진을 한 번에 처리합니다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/update-seo.ps1
```

이 명령은 Git 명령을 실행하지 않습니다. 스테이징·커밋·푸시는 직접 합니다. `ExecutionPolicy Bypass`는 이 PowerShell 프로세스에만 적용됩니다. 별도 패키지나 설치 단계는 없습니다.

## 평소 작업 순서

1. 일기는 `database/YYMMDD.html`에 추가하거나 본문을 수정합니다.
2. 사진은 `picture/sector-1/` 등 섹터 폴더에 추가합니다.
3. 위 명령을 한 번 실행합니다.
4. 변경 내용을 확인하고 원본과 갱신된 파일을 함께 커밋·푸시합니다.

**`database.js`와 `pictures.js`의 파일 목록은 직접 수정하지 않습니다.** 실행 시 실제 폴더에서 목록을 다시 만듭니다. 목록을 따로 수정하는 두 번째 작업이 없어, 원본과 목록이 어긋나는 일을 줄일 수 있습니다.

## 일기 작성

예를 들어 `database/261030.html`을 만들고 본문만 작성하면 됩니다.

```html
<p>오늘의 일기입니다.</p>
<p>다음 문단입니다.<br>같은 문단의 줄바꿈입니다.</p>
```

명령을 실행하면 파일명에서 날짜를 정하고, 해당 파일을 같은 디자인의 완성된 HTML 페이지로 구성합니다. 직접 열 수 있는 주소는 `https://rexondex.github.io/database/261030.html`입니다. 이후 수정할 때는 그 파일의 `.post-content` 안의 본문만 편집합니다. 제목·메타 정보 등을 따로 관리하지 않아도 됩니다.

참고 링크가 있다면 본문과 구분합니다.

```html
<div class="post-references" aria-label="참고 링크">
  <a class="post-reference" href="https://example.com">관련 자료</a>
</div>
<div class="post-content">
  <p>오늘의 일기입니다.</p>
</div>
```

본문에 URL을 바로 링크로 만들려면 `[[https://example.com]]`처럼 작성합니다. 표식을 본문 어디에 두어도 스크립트가 이를 본문 위의 참고 링크 버튼으로 옮깁니다. 표시 문구를 따로 쓰려면 `[[링크|주소|표시문구]]` 형식을 사용할 수 있습니다.

```text
[[https://www.threads.com/share/GVr822nNv/]]

본문내용
```

이 표기는 `.post-content` 안이나 본문 조각의 단독 줄에 작성할 수 있습니다. 기존 HTML `<a href="...">...</a>` 방식도 그대로 쓸 수 있습니다.

HTML 태그 없이 일반 텍스트로 일기를 작성하면 빈 줄은 문단 구분으로, 한 줄 바꿈은 문단 안 줄바꿈으로 변환됩니다. `<p>` 등 HTML 태그를 직접 작성한 본문은 입력한 HTML 구조를 유지합니다.

- 등록 대상은 `database/` 바로 아래의 **숫자 6자리 + `.html`** 파일입니다. 날짜는 실제 존재해야 합니다.
- 해당 형식의 파일은 모두 등록됩니다. 미공개 초안은 다른 폴더에 두거나 `draft-261030.html`처럼 다른 이름을 사용합니다.
- 날짜·제목·canonical·공유 정보·구조화 데이터·전후 일기 링크는 자동 구성합니다.
- 첫 문단이 날짜만 적힌 `<p>26.01.01</p>`이면 파일명에 맞춰 갱신합니다. 본문 속 다른 날짜와 내용은 그대로 둡니다.
- 기존 피드의 최신순 표시, 8개씩 추가 로딩, 달력과 테마 디자인은 유지합니다.

## 사진 추가

아래처럼 **`picture/섹터폴더/파일명`** 구조로 추가합니다.

```text
picture/
├─ sector-1/
│  ├─ photo.jpg
│  └─ another.webp
└─ sector-2/
   └─ new-photo.png
```

명령 실행 시 새 사진과 새 섹터를 자동으로 찾아 `pictures.js`와 정적 사진 갤러리에 반영합니다. 폴더 이름은 영문·숫자·하이픈을 사용합니다. 사진은 섹터 폴더 바로 안에 넣습니다. `picture/` 바로 아래에 사진을 넣으면 올바른 위치를 안내하며 중단합니다.

지원 확장자는 JPG, JPEG, PNG, WebP, GIF, AVIF, HEIC입니다. HEIC 원본 링크는 유지하지만 Google 이미지 사이트맵에는 제외합니다.

사진 설명을 넣고 싶을 때만 `pictures.js`의 해당 섹터 `descriptions`를 편집합니다. **기존 파일에 작성한 설명은 명령을 다시 실행해도 보존합니다.** 예를 들어 다음과 같습니다.

```js
"descriptions": {
  "photo.jpg": "사진에 실제로 보이는 장면 설명"
}
```

## 명령이 자동 처리하는 것

- `database/`의 실제 HTML 파일로 `database.js` 목록 갱신
- `picture/`의 섹터·사진 파일로 `pictures.js` 목록 갱신
- 일기별 날짜·제목·본문 요약·canonical·공유 정보·BlogPosting JSON-LD
- 개별 일기 HTML과 전후 일기 링크
- 홈의 최근 8개와 전체 일기의 초기 정적 본문
- 섹터별 정적 사진 갤러리와 페이지·이미지 사이트맵

파일 추가뿐 아니라 수정·삭제·이름 변경도 반영합니다. 삭제한 파일은 목록과 사이트맵에서 빠집니다. 작성한 HTML 본문과 남아 있는 사진의 설명은 보존합니다. 자동 생성하는 제목·메타 정보·페이지 틀은 매번 다시 구성합니다.

목록이나 생성 파일을 수동으로 바꿔도 다음 실행 시 실제 폴더 기준으로 갱신됩니다. 원본과 갱신 결과를 함께 게시해야 검색엔진과 JavaScript 없는 환경에도 최신 내용이 제공됩니다.

## GitHub Pages 설정

`Settings` → `Pages`에서 다음과 같이 설정합니다.

- `Source`: **Deploy from a branch**
- `Branch`: **main**
- 폴더: **/(root)**

`.nojekyll`을 유지하며 완성된 정적 파일을 게시합니다. 이 프로젝트의 커스텀 Actions 워크플로와 Git 훅은 없습니다. GitHub가 자체 관리하는 Pages 배포 작업은 Actions 화면에 표시될 수 있습니다.

예전 `#daily-…` 링크는 기존 호환 처리대로 특정 글을 선택하지 않고 메인으로 이동합니다.

## 주요 파일

| 내용 | 위치 |
|---|---|
| 일기 HTML 원본·개별 페이지 | `database/YYMMDD.html` |
| 사진 원본 | `picture/섹터폴더/` |
| 자동 생성 파일 목록 | `database.js`, `pictures.js` |
| 피드·달력·사진·설정 로직 | `app.js` |
| 화면 디자인·색상 | `style.css`, `theme.css` |
| 파일 탐색·목록·SEO 갱신 명령 | `scripts/update-seo.ps1` |
| 선택적인 정적 링크 검사 | `scripts/test-seo.ps1` |
