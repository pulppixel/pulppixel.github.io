// ─── 워프 · HUD ───
// 퀘스트 로그 → 워프 메뉴, 패널 제거
import type { ProjectData } from './data';
import { COMPANIES, PROJECTS, PLATFORMS } from './data';

// ═══════════════════════════════════════
// ── Warp (퀘스트 대체) ──
// ═══════════════════════════════════════

export interface Warp {
  visit(index: number): void;
  visited: Set<number>;
}

export function createWarp(onTeleport: (x: number, z: number, h: number) => void): Warp {
  const visited = new Set<number>();
  const ql = document.getElementById('quest-list')!;
  const qf = document.getElementById('quest-fill')!;
  const qc = document.getElementById('quest-count')!;

  function updQ(): void {
    qf.style.width = (visited.size / PROJECTS.length * 100) + '%';
    qc.textContent = `${visited.size} / ${PROJECTS.length}`;
  }

  // 존 워프 버튼 생성
  ql.innerHTML = '';
  COMPANIES.forEach((co, i) => {
    const d = document.createElement('div');
    d.className = 'warp-item';
    d.innerHTML = `<span class="warp-dot" style="background:#${co.color.toString(16).padStart(6,'0')};"></span>${co.name}`;
    d.addEventListener('click', () => {
      // 존 플랫폼 높이 조회
      let h = 0;
      for (const p of PLATFORMS) {
        if (Math.abs(p.x - co.position.x) < 1 && Math.abs(p.z - co.position.z) < 1) { h = p.h; break; }
      }
      onTeleport(co.position.x, co.position.z, h);
    });
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
      // 미니게임 여부에 따라 힌트 변경
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