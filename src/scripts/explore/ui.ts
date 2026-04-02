// ─── 패널 · 퀘스트 로그 · UI ───
import type { ProjectData } from './data';
import { PROJECTS } from './data';

// ═══════════════════════════════════════
// ── Panel ──
// ═══════════════════════════════════════
export interface Panel {
  open(project: ProjectData, index: number): void;
  close(): void;
  isOpen(): boolean;
}

export function createPanel(isMobile: boolean, onVisit: (index: number) => void): Panel {
  const panel = document.getElementById('panel')!;
  const pc = document.getElementById('panel-content')!;
  const canvas = document.querySelector('canvas')!;

  function close(): void {
    panel.classList.remove('open');
    if (!isMobile) setTimeout(() => canvas.requestPointerLock(), 100);
  }

  function open(p: ProjectData, index: number): void {
    const ac = p.coHex || '#6ee7b7';
    const bc = p.bc || ac;
    let h = `<div class="p-header">`;
    h += `<div class="p-header-bg" style="background:linear-gradient(135deg, ${ac}12, transparent 60%);"></div>`;
    h += `<div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,${ac},${ac}44,transparent);"></div>`;
    if (p.badge) h += `<div class="p-badge" style="background:${bc}15;color:${bc};border:1px solid ${bc}30;">${p.badge}</div>`;
    h += `<div class="p-period">${p.period}</div>`;
    h += `<div class="p-title">${p.title}<span class="p-sub">${p.sub}</span></div></div>`;
    h += `<div class="p-body">`;
    h += `<div class="p-info"><div class="p-info-item"><span class="p-info-label">역할</span><span class="p-info-value">${p.role}</span></div>`;
    h += `<div class="p-info-item"><span class="p-info-label">소속</span><span class="p-info-value" style="color:${ac}">${p.co}</span></div></div>`;
    h += `<div class="p-desc">${p.desc}</div>`;
    h += `<div class="p-sec">기술 스택</div>`;
    h += `<div class="p-tags">${p.tags.map((t, idx) => {
      const style = idx === 0 ? `style="border-color:${ac}30;color:${ac};background:${ac}08"` : '';
      return `<span ${style}>${t}</span>`;
    }).join('')}</div>`;
    h += `<div class="p-sec">주요 작업</div>`;
    h += `<ul class="p-list">${p.details.map((d, idx) => `<li><span style="color:${ac};opacity:0.4;font-size:9px;margin-right:6px;">0${idx + 1}</span>${d}</li>`).join('')}</ul>`;
    h += `<div class="p-links"><a href="${p.link}" class="p-link p-link-primary" style="border-color:${ac}33;color:${ac};">상세 보기 ↗</a>`;
    h += `<a href="https://github.com/pulppixel" target="_blank" class="p-link">GitHub ↗</a></div></div>`;
    pc.innerHTML = h;
    panel.classList.add('open');
    if (!isMobile) document.exitPointerLock();
    onVisit(index);
  }

  document.getElementById('panel-close')!.onclick = close;
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  return { open, close, isOpen: () => panel.classList.contains('open') };
}

// ═══════════════════════════════════════
// ── Quest Log ──
// ═══════════════════════════════════════
export interface Quest {
  visit(index: number): void;
  visited: Set<number>;
}

export function createQuest(): Quest {
  const visited = new Set<number>();
  const ql = document.getElementById('quest-list')!;
  const qf = document.getElementById('quest-fill')!;
  const qc = document.getElementById('quest-count')!;

  function updQ(): void {
    PROJECTS.forEach((_, i) => {
      const e = document.getElementById('q' + i);
      if (e) e.className = visited.has(i) ? 'quest-item visited' : 'quest-item';
    });
    qf.style.width = (visited.size / PROJECTS.length * 100) + '%';
    qc.textContent = `${visited.size} / ${PROJECTS.length}`;
  }

  // Init list
  ql.innerHTML = '';
  PROJECTS.forEach((p, i) => {
    const d = document.createElement('div');
    d.className = 'quest-item'; d.id = 'q' + i;
    d.innerHTML = `<span class="check"></span>${p.title}`;
    ql.appendChild(d);
  });
  updQ();

  // Reset
  document.getElementById('quest-reset')!.onclick = () => { visited.clear(); updQ(); };

  // Toggle collapse
  let collapsed = false;
  document.getElementById('quest-toggle')!.onclick = () => {
    collapsed = !collapsed;
    ql.style.display = collapsed ? 'none' : 'block';
    document.getElementById('quest-toggle')!.textContent = collapsed ? '▶' : '▼';
  };

  function visit(index: number): void {
    if (!visited.has(index)) { visited.add(index); updQ(); }
  }

  return { visit, visited };
}

// ═══════════════════════════════════════
// ── HUD Labels ──
// ═══════════════════════════════════════
export interface HUD {
  heroLabel: HTMLElement;
  interactHint: HTMLElement;
  projectLabel: HTMLElement;
  mobileInteract: HTMLElement;

  showProjectHint(project: ProjectData): void;
  hideProjectHint(): void;
}

export function createHUD(): HUD {
  const heroLabel = document.getElementById('hero-label')!;
  const interactHint = document.getElementById('interact-hint')!;
  const projectLabel = document.getElementById('project-label')!;
  const mobileInteract = document.getElementById('mobile-interact')!;

  return {
    heroLabel, interactHint, projectLabel, mobileInteract,
    showProjectHint(p: ProjectData): void {
      let lb = `${p.title} — ${p.sub}`;
      if (p.badge) lb += ` <span class="lbl-badge" style="background:${p.bc}22;color:${p.bc};border:1px solid ${p.bc}44;">${p.badge}</span>`;
      lb += `<div class="lbl-period">${p.period}</div>`;
      projectLabel.innerHTML = lb; projectLabel.style.display = 'block';
      interactHint.classList.add('show'); mobileInteract.classList.add('show');
    },
    hideProjectHint(): void {
      projectLabel.style.display = 'none';
      interactHint.classList.remove('show'); mobileInteract.classList.remove('show');
    },
  };
}
