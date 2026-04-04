// Warp menu + HUD labels
import type { ProjectData } from '../core/data';
import { COMPANIES, PROJECTS, PLATFORMS } from '../core/data';

// --- Warp ---

export interface Warp {
  visit(index: number): void;
  visited: Set<number>;
}

export function createWarp(onTeleport: (x: number, z: number, h: number) => void): Warp {
  const visited = new Set<number>();
  const ql = document.getElementById('quest-list')!;
  const qf = document.getElementById('quest-fill')!;
  const qc = document.getElementById('quest-count')!;

  function updateProgress(): void {
    qf.style.width = (visited.size / PROJECTS.length * 100) + '%';
    qc.textContent = `${visited.size} / ${PROJECTS.length}`;
  }

  // Zone warp buttons
  ql.innerHTML = '';
  COMPANIES.forEach(co => {
    const d = document.createElement('div');
    d.className = 'warp-item';
    d.innerHTML = `<span class="warp-dot" style="background:#${co.color.toString(16).padStart(6, '0')};"></span>${co.name}`;
    d.addEventListener('click', () => {
      let h = 0;
      for (const p of PLATFORMS) {
        if (Math.abs(p.x - co.position.x) < 1 && Math.abs(p.z - co.position.z) < 1) { h = p.h; break; }
      }
      onTeleport(co.position.x, co.position.z, h);
    });
    ql.appendChild(d);
  });
  updateProgress();

  document.getElementById('quest-reset')!.onclick = () => { visited.clear(); updateProgress(); };

  let collapsed = false;
  document.getElementById('quest-toggle')!.onclick = () => {
    collapsed = !collapsed;
    ql.style.display = collapsed ? 'none' : 'block';
    document.getElementById('quest-toggle')!.textContent = collapsed ? '\u25B6' : '\u25BC';
  };

  return {
    visit(index: number) { if (!visited.has(index)) { visited.add(index); updateProgress(); } },
    visited,
  };
}

// --- HUD ---

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
      let lb = `${p.title} - ${p.sub}`;
      if (p.badge) {
        lb += ` <span class="lbl-badge" style="background:${p.bc}22;color:${p.bc};border:1px solid ${p.bc}44;">${p.badge}</span>`;
      }

      if (p.minigame) {
        lb += ` <span class="lbl-badge" style="background:#fbbf2422;color:#fbbf24;border:1px solid #fbbf2444;">PLAY</span>`;
      }

      lb += `<div class="lbl-period">${p.period}</div>`;
      projectLabel.innerHTML = lb;
      projectLabel.style.display = 'block';
      interactHint.classList.add('show');
      mobileInteract.classList.add('show');
    },

    hideProjectHint(): void {
      projectLabel.style.display = 'none';
      interactHint.classList.remove('show');
      mobileInteract.classList.remove('show');
    },
  };
}
