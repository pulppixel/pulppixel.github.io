# pulppixel.github.io

백환기 — Unity Client Engineer 포트폴리오

## 로컬 실행

```bash
npm install
npm run dev        # localhost:4321
```

## 배포

`main` 브랜치에 push하면 GitHub Actions가 자동으로 빌드 → GitHub Pages 배포합니다.

### 최초 설정 (1회)

1. 이 repo의 **Settings → Pages** 이동
2. **Source**를 `GitHub Actions`로 변경 (기본값이 "Deploy from a branch"일 수 있음)
3. `main`에 push하면 끝

## 프로젝트 추가 방법

`src/pages/projects/` 에 `.astro` 파일을 추가하면 `/projects/파일명/` 경로로 자동 생성됩니다.

## 미디어 추가 방법

1. 이미지/GIF → `public/images/프로젝트명/` 에 저장
2. 각 프로젝트 페이지의 `media-placeholder` 를 `<img>` 태그로 교체

```html
<!-- Before -->
<div class="media-placeholder">📸 스크린샷 (추가 예정)</div>

<!-- After -->
<img src="/images/eterna/main-screen.png" alt="아고라 메인 화면" />
```

## 구조

```
src/
├── components/     Nav, Hero, ProjectCard, Footer
├── layouts/        BaseLayout, ProjectLayout
├── pages/
│   ├── index.astro            메인 페이지
│   └── projects/
│       ├── eterna.astro
│       ├── reiw.astro
│       ├── iw-zombie.astro
│       ├── stelsi-wallet.astro
│       ├── haul.astro
│       └── nomads-planet.astro
├── styles/         global.css (디자인 시스템)
public/             정적 파일 (이미지, 파비콘 등)
.github/workflows/  GitHub Actions 배포
```
