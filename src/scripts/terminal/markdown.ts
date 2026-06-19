// 아주 작은 마크다운 → HTML 렌더러. 터미널 인앱 상세(viewPage)와 (원하면) astro 상세 페이지가
// 같은 .md 한 소스를 렌더하도록 의도. 출력은 전부 인라인 스타일이라 외부 CSS 없이도 동일하게 보임.
//
// 지원 문법 (프로젝트 .md 가 쓰는 것만):
//   ## 제목 / ### 소제목        섹션 헤딩 (# 프리픽스)
//   본문 단락                    빈 줄로 구분, **굵게** `코드` [링크](url) 인라인
//   - 항목 / * 항목              › 불릿 리스트
//   ![alt](/images/x.png)       이미지
//   ::youtube VIDEOID 제목...     유튜브 임베드(iframe)
//   > 인용                       blockquote

const escHtml = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c]));

// 인라인: **bold** · `code` · [text](url)  (escape 후 토큰 치환)
const inline = (s: string): string =>
  escHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#e0def4;font-weight:700">$1</strong>')
    .replace(/`([^`]+)`/g, '<code style="font-family:\'D2Coding\',\'JetBrains Mono\',monospace;font-size:12.5px;background:#21202e;border:1px solid #26233a;color:#ebbcba;padding:.1rem .42rem;border-radius:4px">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, u) => `<a href="${u}" target="_blank" rel="noopener" style="color:#9ccfd8;text-decoration:underline;text-underline-offset:3px;text-decoration-color:#403d52">${t}</a>`);

const ytEmbed = (id: string, title: string): string =>
  `<div style="position:relative;width:100%;padding-bottom:56.25%;margin:24px 0;border-radius:8px;overflow:hidden;border:1px solid #26233a;background:#1f1d2e">` +
  `<iframe src="https://www.youtube-nocookie.com/embed/${escHtml(id)}" title="${escHtml(title || '영상')}" frameborder="0" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="position:absolute;top:0;left:0;width:100%;height:100%"></iframe>` +
  `</div>`;

const HEAD2 = 'font-size:clamp(1rem,2.4vw,1.2rem);color:#9ccfd8;letter-spacing:.04em;font-weight:700;margin:42px 0 14px;line-height:1.4';
const HEAD3 = 'font-size:13.5px;color:#c4a7e7;letter-spacing:.02em;font-weight:700;margin:28px 0 10px;line-height:1.4';
const PARA = 'font-size:14px;color:#cdc9de;line-height:2.0;margin:0 0 16px;max-width:68ch';
const LI = 'font-size:13.5px;color:#cdc9de;line-height:1.85;padding-left:1.4rem;position:relative;margin-bottom:.55rem;max-width:68ch';
const IMG = 'display:block;width:100%;border-radius:9px;border:1px solid #26233a;margin:26px 0';

export function renderMd(src: string): string {
  const lines = (src || '').replace(/\r/g, '').split('\n');
  const out: string[] = [];
  let para: string[] = [];
  const flush = (): void => { if (para.length) { out.push(`<p style="${PARA}">${inline(para.join(' '))}</p>`); para = []; } };

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const t = raw.trim();
    if (!t) { flush(); i++; continue; }

    let m: RegExpMatchArray | null;
    if ((m = t.match(/^(#{2,3})\s+(.*)$/))) {
      flush();
      out.push(`<div style="${m[1].length === 2 ? HEAD2 : HEAD3}"><span style="color:#c4a7e7">#</span> ${inline(m[2])}</div>`);
      i++; continue;
    }
    if ((m = t.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/))) {
      flush();
      out.push(`<img src="${escHtml(m[2])}" alt="${escHtml(m[1])}" loading="lazy" onerror="this.style.display='none'" style="${IMG}" />`);
      i++; continue;
    }
    if ((m = t.match(/^::youtube\s+(\S+)\s*(.*)$/))) {
      flush();
      out.push(ytEmbed(m[1], m[2]));
      i++; continue;
    }
    if (/^[-*]\s+/.test(t)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^[-*]\s+/, '')); i++; }
      out.push(`<ul style="list-style:none;padding:0;margin:0 0 24px">${items.map((it) => `<li style="${LI}"><span style="position:absolute;left:.2rem;color:#c4a7e7">-</span>${inline(it)}</li>`).join('')}</ul>`);
      continue;
    }
    if (/^>\s+/.test(t)) {
      flush();
      out.push(`<blockquote style="margin:0 0 16px;padding:6px 0 6px 14px;border-left:2px solid #403d52;color:#908caa;font-size:13.5px;line-height:1.85">${inline(t.replace(/^>\s+/, ''))}</blockquote>`);
      i++; continue;
    }
    para.push(t); i++;
  }
  flush();
  return out.join('\n');
}
