// 터미널 포트폴리오 엔진 — claude.ai/design "Pulppixel LazyGit" (.dc.html) 의 바닐라 포팅.
// 원본은 support.js(React 런타임) 기반. 여기선 React 의존 제거 + innerHTML 렌더 + 이벤트 위임.
// 셸 입력은 키 입력마다 전체 리렌더하면 포커스가 날아가므로, 표시 span/입력 element 만 직접 갱신.

import { DATA, BOOT, C, type Panel, type ProjectItem, type JobItem, type SkillItem, type ContactItem } from './data';
import { renderMd } from './markdown';

// 프로젝트 상세 본문(.md) — 빌드 시 raw 문자열로 번들. astro 상세 페이지의 본문과 같은 소스.
const PROJECT_MD = import.meta.glob('../../content/projects/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const MD_BY_SLUG: Record<string, string> = {};
for (const k in PROJECT_MD) { const slug = (k.split('/').pop() || '').replace(/\.md$/, ''); MD_BY_SLUG[slug] = PROJECT_MD[k]; }

type Token = { t: string; c: string };
type Block =
  | { isNeofetch: true }
  | { isCmd: true; text: string }
  | { isRows: true; rows: Token[][] };

interface Sys {
  os: string; host: string; kernel: string; uptime: string; packages: string; shell: string;
  res: string; wm: string; term: string; cpu: string; gpu: string; mem: string; locale: string; arch: string;
}
const SYS0: Sys = { os: 'Linux', host: 'host', kernel: '—', uptime: '—', packages: '—', shell: 'sh', res: '—', wm: 'Compositor', term: 'Browser', cpu: '—', gpu: '—', mem: '—', locale: '—', arch: '' };
interface State {
  phase: 'shell' | 'boot' | 'tui' | 'page';
  bootLines: { t: string; m: string; c: string }[];
  focus: number; sels: number[]; isMobile: boolean;
  input: string; blocks: Block[]; page: ProjectItem | null; sys: Sys;
}

const NEOFETCH_ART = `       _,met$$$$$gg.
    ,g$$$$$$$$$$$$$$$P.
  ,g$$P"        """Y$$.".
 ,$$P'              \`$$$.
',$$P       ,ggs.     \`$$b:
\`d$$'     ,$P"'   .    $$$
 $$P      d$'     ,    $$P
 $$:      $$.   -    ,d$$'
 $$;      Y$b._   _,d$P'
 Y$$.    \`.\`"Y$$$$P"'
 \`$$b      "-.__
  \`Y$$
   \`Y$$.
     \`$$b.
       \`Y$$b.
          \`"Y$b._
              \`"""`;

const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]));

const tk = (t: string, c?: string): Token => ({ t, c: c || C.fg });
const rows = (r: Token[][]): Block => ({ isRows: true, rows: r });
const pad = (s: string, n: number) => (s + '                              ').slice(0, n);

export class Terminal {
  private root: HTMLElement;
  private state: State;
  private history: string[] = [];
  private histIdx = 0;
  private bootTimers: number[] = [];
  private demoTimers: number[] = [];
  private demoOn = false;
  private inputEl: HTMLInputElement | null = null;
  private dispEl: HTMLElement | null = null;
  private shellEl: HTMLElement | null = null;
  private lastPhase: State['phase'] | null = null;
  private lastFocus = -1;
  private anim = false;
  private keyHandler!: (e: KeyboardEvent) => void;
  private resizeHandler!: () => void;

  constructor(root: HTMLElement) {
    this.root = root;
    this.state = {
      phase: 'shell', bootLines: [], focus: 0, sels: [0, 0, 0, 0, 0],
      isMobile: typeof window !== 'undefined' && window.innerWidth < 760,
      input: '', blocks: [], page: null,
      sys: { ...SYS0 },
    };
  }

  // ---- lifecycle ----
  mount(): void {
    this.detectSys();
    this.resizeHandler = () => {
      const m = window.innerWidth < 760;
      if (m !== this.state.isMobile) { this.state.isMobile = m; if (this.state.phase === 'tui') this.render(); }
    };
    window.addEventListener('resize', this.resizeHandler);

    this.keyHandler = (e: KeyboardEvent) => {
      const ph = this.state.phase;
      if (ph === 'page') { if (e.key === 'Escape' || e.key === 'q') this.back(); return; }
      if (ph !== 'tui') return;
      if (e.key === 'q' || e.key === 'Escape') { this.reset(); return; }
      if (e.key >= '1' && e.key <= '5') { this.focusPanel(+e.key - 1); return; }
      if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); this.move(1); }
      else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); this.move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); this.openCurrent(); }
    };
    window.addEventListener('keydown', this.keyHandler);

    this.root.addEventListener('click', (e) => this.onDelegatedClick(e));
    this.render();
    setTimeout(() => this.focusInput(), 30);
    this.startDemo();
  }

  unmount(): void {
    window.removeEventListener('keydown', this.keyHandler);
    window.removeEventListener('resize', this.resizeHandler);
    this.bootTimers.forEach(clearTimeout); this.demoTimers.forEach(clearTimeout);
  }

  private setState(patch: Partial<State>, cb?: () => void): void {
    Object.assign(this.state, patch);
    this.render();
    cb && cb();
  }

  // ---- demo auto-type ----
  private startDemo(): void {
    this.demoOn = true; this.demoTimers = [];
    const txt = 'pulppixel'; let i = 0;
    const tick = () => {
      if (!this.demoOn) return;
      i++; this.state.input = txt.slice(0, i); this.syncInput();
      if (i < txt.length) this.demoTimers.push(window.setTimeout(tick, 90));
    };
    this.demoTimers.push(window.setTimeout(tick, 950));
  }
  private cancelDemo(): void { if (this.demoOn) { this.demoOn = false; this.demoTimers.forEach(clearTimeout); } }

  // ---- system detection (neofetch) — 실제 방문자 정보 ----
  // 읽을 수 있는 건 진짜로: OS+버전 · GPU(WebGL) · 아키텍처 · 코어 · 해상도 · 로케일 · 브라우저.
  // 브라우저 샌드박스라 못 읽는 건(커널빌드·패키지수·업타임·RAM총량·셸) OS에 맞춘 flavor 로 채움.
  private cleanGpu(raw: string): string {
    if (!raw) return '';
    let s = raw.trim();
    const ang = s.match(/^ANGLE \((.+)\)$/);          // ANGLE (vendor, RENDERER, version)
    if (ang) { const parts = ang[1].split(','); s = (parts[1] || parts[0]).trim(); }
    s = s.replace(/^ANGLE\s+\w*\s*Renderer:\s*/i, ''); // "ANGLE Metal Renderer: X" → "X"
    s = s.replace(/\s+Direct3D\d+.*$/i, '').replace(/\s+vs_\d+_\d+.*$/i, '').replace(/\s+OpenGL.*$/i, '');
    s = s.replace(/\s*\((?:0x)?[0-9A-Fa-f]{3,}\)/g, '');
    return s.trim();
  }
  private osProfile(family: string, ver: string, model: string): Partial<Sys> {
    const v = ver ? ' ' + ver : '';
    switch (family) {
      case 'macOS': return { os: 'macOS' + v, kernel: 'Darwin (XNU)', packages: '147 (brew), 36 (cask)', shell: 'zsh 5.9', wm: 'Quartz Compositor', host: model || 'Mac' };
      case 'Windows': return { os: 'Windows ' + (ver || '11'), kernel: 'Windows NT 10.0', packages: '218 (winget)', shell: 'pwsh 7.4', wm: 'DWM', host: model || 'PC' };
      case 'iOS': return { os: 'iOS' + v, kernel: 'Darwin (XNU)', packages: 'n/a', shell: 'zsh', wm: 'SpringBoard', host: model || (/iPad/.test(navigator.userAgent) ? 'iPad' : 'iPhone') };
      case 'Android': return { os: 'Android' + v, kernel: 'Linux (Android)', packages: 'n/a', shell: 'mksh', wm: 'SurfaceFlinger', host: model || 'Android' };
      case 'Linux': return { os: 'Linux' + v, kernel: '6.1.0', packages: '1872 (dpkg)', shell: 'bash 5.2', wm: 'Wayland', host: model || 'linux' };
      default: return { os: (family || 'Unknown') + v, kernel: '—', packages: 'n/a', shell: 'sh', wm: 'Compositor', host: model || 'host' };
    }
  }
  private uaOS(ua: string): { family: string; ver: string } {
    let m: RegExpMatchArray | null;
    if (/iPhone|iPad|iPod/.test(ua)) { m = ua.match(/OS (\d+[_.]\d+)/); return { family: 'iOS', ver: m ? m[1].replace(/_/g, '.') : '' }; }
    if (/Android/.test(ua)) { m = ua.match(/Android (\d+(?:\.\d+)?)/); return { family: 'Android', ver: m ? m[1] : '' }; }
    if (/Mac OS X/.test(ua)) { m = ua.match(/Mac OS X (\d+[_.]\d+)/); return { family: 'macOS', ver: m ? m[1].replace(/_/g, '.') : '' }; }
    if (/Windows NT/.test(ua)) { m = ua.match(/Windows NT (\d+\.\d+)/); return { family: 'Windows', ver: m && m[1] === '10.0' ? '10/11' : (m ? m[1] : '') }; }
    if (/Linux|X11|CrOS/.test(ua)) return { family: 'Linux', ver: '' };
    return { family: 'Unknown', ver: '' };
  }
  private archLabel(a: string, bits: string): string {
    if (a === 'arm') return bits === '64' || !bits ? 'arm64' : 'arm';
    if (a === 'x86') return bits === '32' ? 'x86' : 'x86_64';
    return a || '';
  }

  private detectSys(): void {
    const sys: Sys = { ...SYS0 };
    try {
      const ua = navigator.userAgent || '';
      let term = 'Browser';
      if (/Firefox\//.test(ua)) term = 'Firefox'; else if (/Edg\//.test(ua)) term = 'Edge';
      else if (/OPR\//.test(ua)) term = 'Opera'; else if (/Chrome\/|CriOS\//.test(ua)) term = 'Chrome'; else if (/Safari\//.test(ua)) term = 'Safari';
      const cores = navigator.hardwareConcurrency || 8;
      const dm = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
      const total = dm ? dm * 1024 : 16384;
      const dpr = window.devicePixelRatio || 1;
      const mm = new Date().getHours() * 60 + new Date().getMinutes();

      // GPU (WebGL) — 실제 렌더러
      let gpu = '—';
      try {
        const cv = document.createElement('canvas');
        const gl = (cv.getContext('webgl') || cv.getContext('experimental-webgl')) as WebGLRenderingContext | null;
        if (gl) {
          const dbg = gl.getExtension('WEBGL_debug_renderer_info');
          gpu = this.cleanGpu(dbg ? String(gl.getParameter((dbg as WEBGL_debug_renderer_info).UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER))) || '—';
        }
      } catch { /* noop */ }

      const { family, ver } = this.uaOS(ua);
      Object.assign(sys, this.osProfile(family, ver, ''));
      sys.term = term;
      sys.gpu = gpu;
      sys.uptime = Math.floor(mm / 60) + ' hours, ' + (mm % 60) + ' mins';
      sys.res = Math.round(screen.width * dpr) + 'x' + Math.round(screen.height * dpr);
      sys.cpu = (sys.arch ? sys.arch + ' · ' : '') + cores + ' threads';
      sys.mem = Math.floor(total * 0.41) + 'MiB / ' + total + 'MiB';
      sys.locale = (navigator.language || 'en-US') + ' · ' + (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    } catch { /* noop */ }

    const d = new Date();
    const today = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' ' + d.toTimeString().slice(0, 5);
    const motd = this.state.isMobile
      ? rows([[tk('Welcome to ', C.dim), tk('pulppixel', C.foam), tk('.  아래 ', C.dim), tk('실행 버튼', C.rose), tk('으로 GUI를 시작하세요.', C.dim)]])
      : rows([[tk('Welcome to ', C.dim), tk('pulppixel', C.foam), tk('.  ', C.dim), tk("'help'", C.iris), tk('로 명령어를 보거나, ', C.dim), tk('Enter', C.rose), tk('를 눌러 GUI를 실행하세요.', C.dim)]]);
    this.state.sys = sys;
    this.state.blocks = [rows([[tk('Last login: ' + today + ' on ttys006', C.dim)]]), { isNeofetch: true }, motd];

    // 고정밀 정보(Chromium): 실제 OS 버전 · 기기 모델 · 아키텍처 — 비동기 보강
    const uad = (navigator as Navigator & { userAgentData?: { getHighEntropyValues?: (h: string[]) => Promise<Record<string, string>> } }).userAgentData;
    if (uad && uad.getHighEntropyValues) {
      uad.getHighEntropyValues(['platform', 'platformVersion', 'architecture', 'bitness', 'model']).then((hv) => {
        const plat = hv.platform || '';
        const family = plat === 'macOS' || plat === 'Windows' || plat === 'Android' || plat === 'Linux' ? plat : (plat === 'Chrome OS' ? 'Linux' : plat);
        let ver = hv.platformVersion || '';
        if (family === 'Windows') ver = parseInt(ver) >= 13 ? '11' : '10';
        else if (family === 'macOS') ver = ver.split('.').slice(0, 2).join('.');
        const arch = this.archLabel(hv.architecture || '', hv.bitness || '');
        const cores = navigator.hardwareConcurrency || 8;
        this.state.sys = { ...this.state.sys, ...this.osProfile(family, ver, hv.model || ''), arch, cpu: (arch ? arch + ' · ' : '') + cores + ' threads' };
        if (this.state.phase === 'shell') this.render();
      }).catch(() => { /* noop */ });
    }
  }

  // ---- shell input ----
  private focusInput(): void { this.inputEl?.focus(); }
  private syncInput(): void {
    if (this.dispEl) this.dispEl.textContent = this.state.input;
    if (this.inputEl && this.inputEl.value !== this.state.input) this.inputEl.value = this.state.input;
  }
  private onInput = (e: Event): void => { this.cancelDemo(); this.state.input = (e.target as HTMLInputElement).value; if (this.dispEl) this.dispEl.textContent = this.state.input; };
  private onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') { this.cancelDemo(); e.preventDefault(); this.exec(this.state.input); }
    else if (e.key === 'ArrowUp') { this.cancelDemo(); e.preventDefault(); if (this.history.length) { this.histIdx = Math.max(0, this.histIdx - 1); this.state.input = this.history[this.histIdx] || ''; this.syncInput(); } }
    else if (e.key === 'ArrowDown') { this.cancelDemo(); e.preventDefault(); if (this.history.length) { this.histIdx = Math.min(this.history.length, this.histIdx + 1); this.state.input = this.history[this.histIdx] || ''; this.syncInput(); } }
    else if (e.key === 'Tab') { this.cancelDemo(); e.preventDefault(); this.complete(); }
    else if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); this.setState({ blocks: [], input: '' }, () => this.focusInput()); }
    else if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) { this.cancelDemo(); e.preventDefault(); this.setState({ blocks: this.state.blocks.concat([{ isCmd: true, text: this.state.input + '^C' }]), input: '' }, () => this.focusInput()); }
    else { this.cancelDemo(); }
  };
  private complete(): void {
    const cmds = ['help', 'neofetch', 'ls', 'cat', 'open', 'projects', 'experience', 'skills', 'about', 'contact', 'explore', 'clear', 'pulppixel', 'whoami', 'pwd', 'date', 'uname', 'git'];
    const cur = this.state.input.trim(); if (!cur || cur.indexOf(' ') >= 0) return;
    const m = cmds.filter((x) => x.indexOf(cur) === 0); if (m.length === 1) { this.state.input = m[0] + ' '; this.syncInput(); }
  }

  private exec(raw: string): void {
    this.cancelDemo();
    const text = (raw || '').trim();
    if (!text) { this.setState({ input: '' }, () => this.launch()); return; }
    const blocks = this.state.blocks.concat([{ isCmd: true, text: raw }]);
    this.history.push(text); this.histIdx = this.history.length;
    const parts = text.split(/\s+/); const c = parts[0].toLowerCase(); const arg = (parts[1] || '').toLowerCase();
    if (c === 'clear') { this.setState({ blocks: [], input: '' }, () => this.focusInput()); return; }
    if (c === 'explore' || c === '3d') { this.setState({ blocks: blocks.concat([rows([[tk('opening 3d world ', C.dim), tk('~/explore', C.foam)]])]), input: '' }); window.location.href = '/explore/'; return; }
    const doLaunch = ['pulppixel', 'lazygit', 'gui', 'start', 'run'].indexOf(c) >= 0;
    if (!doLaunch) { const out = this.command(c, arg, parts); if (out) blocks.push(out); }
    this.setState({ blocks, input: '' }, () => { if (doLaunch) this.launch(); else this.focusInput(); });
  }

  private command(c: string, arg: string, parts: string[]): Block | null {
    const P = DATA[1].items as ProjectItem[], J = DATA[2].items as JobItem[], S = DATA[3].items as SkillItem[], K = DATA[4].items as ContactItem[];
    switch (c) {
      case 'help': return rows([
        [tk('Available commands', C.foam)], [tk(' ')],
        [tk('  help        ', C.iris), tk('show this help', C.dim)],
        [tk('  neofetch    ', C.iris), tk('print system information', C.dim)],
        [tk('  ls [dir]    ', C.iris), tk('list directory contents', C.dim)],
        [tk('  cat <proj>  ', C.iris), tk('show project details', C.dim)],
        [tk('  open <name> ', C.iris), tk('open a project page or link', C.dim)],
        [tk('  projects    ', C.iris), tk('list all projects', C.dim)],
        [tk('  experience  ', C.iris), tk('work history', C.dim)],
        [tk('  git log     ', C.iris), tk('career as a commit history', C.dim)],
        [tk('  skills      ', C.iris), tk('tech stack', C.dim)],
        [tk('  about       ', C.iris), tk('about me', C.dim)],
        [tk('  contact     ', C.iris), tk('contact channels', C.dim)],
        [tk('  explore     ', C.iris), tk('launch the 3d world', C.dim)],
        [tk('  clear       ', C.iris), tk('clear the screen  (ctrl+l)', C.dim)],
        [tk(' ')],
        [tk('  pulppixel   ', C.foam), tk('launch the lazygit-style GUI  (or press Enter)', C.rose)],
      ]);
      case 'ls': {
        if (arg === 'projects' || arg === 'projects/') return this.cmdProjects();
        return rows([[tk('about.md  ', C.white), tk('resume.pdf  ', C.rose), tk('contact/  ', C.foam), tk('experience/  ', C.foam), tk('projects/  ', C.foam), tk('skills/  ', C.foam), tk('explore/', C.foam)]]);
      }
      case 'projects': case 'project': return this.cmdProjects();
      case 'cat': {
        if (!arg) return rows([[tk('usage: cat <project>   e.g. cat eterna', C.dim)]]);
        const p = P.filter((x) => x.label === arg || x.label.indexOf(arg) === 0)[0];
        if (!p) return rows([[tk('cat: ' + arg + ': No such file or directory', C.love)]]);
        return rows(([
          [tk(p.name, C.white), tk('   [' + p.badge + ']', p.badgeColor)],
          [tk(p.sub, C.iris)], [tk(p.period, C.dim)], [tk(' ')],
          [tk(p.desc, C.fg)], [tk(' ')],
          [tk('stack:  ', C.foam), tk(p.stack.join(', '), C.dim)], [tk(' ')],
        ] as Token[][]).concat(p.points.map((pt) => [tk('  + ', C.iris), tk(pt, C.fg)])).concat([
          [tk(' ')], [tk('open page:  ', C.dim), tk('open ' + p.label, C.foam)],
        ]));
      }
      case 'open': return this.cmdOpen(arg);
      case 'experience': case 'work': case 'exp': {
        const r: Token[][] = [[tk('experience/', C.foam)], [tk(' ')]];
        J.forEach((j) => { r.push([tk('  ' + pad(j.company, 18), C.white), tk(j.period + '  ', C.dim), tk(j.dur, C.faint)]); r.push([tk('   ' + j.role, C.iris)]); r.push([tk(' ')]); });
        return rows(r);
      }
      case 'git': {
        if (!arg || arg === 'log') return this.cmdGitLog();
        if (arg === 'status') return rows([[tk('On branch ', C.dim), tk('main', C.love)], [tk('nothing to commit — shipping only.', C.dim)]]);
        return rows([[tk("git: '" + arg + "' is not a git command. See ", C.love), tk("'git log'", C.foam), tk('.', C.love)]]);
      }
      case 'skills': case 'stack': {
        const r: Token[][] = [[tk('skills/', C.foam)], [tk(' ')]];
        S.forEach((s) => { r.push([tk('  ' + s.title, C.iris)]); r.push([tk('    ' + s.rows.map((x) => x.k).join(' · '), C.dim)]); r.push([tk(' ')]); });
        return rows(r);
      }
      case 'about': return rows([
        [tk('백환기 ', C.white), tk('/ Hwankee Baik', C.dim)],
        [tk('Software Engineer · ', C.iris), tk('Dongle Lab', C.rose)], [tk(' ')],
        [tk('게임 클라이언트를 중심으로 모바일·웹·실시간 네트워크까지 폭넓게 다룹니다.', C.fg)],
        [tk('지금은 신생아 작명 서비스와 WebAR 갤러리 플랫폼을 직접 만들어 운영하며,', C.fg)],
        [tk('아이디어를 제품으로 완성해 끝까지 책임지는 일에 집중합니다.', C.fg)],
      ]);
      case 'whoami': return rows([[tk('hwankee', C.foam)]]);
      case 'contact': {
        const r: Token[][] = [[tk('contact/', C.foam)], [tk(' ')]];
        K.forEach((k) => r.push([tk('  ' + pad(k.label, 10), C.iris), tk(k.value, C.dim)]));
        r.push([tk(' ')]); r.push([tk('open with: ', C.dim), tk('open github', C.foam), tk('  ·  ', C.faint), tk('open email', C.foam)]);
        return rows(r);
      }
      case 'neofetch': case 'fetch': return { isNeofetch: true };
      case 'vim': case 'vi': case 'nano': case 'emacs': {
        const f = arg || 'resume.pdf';
        return rows([
          [tk('"' + f + '" [readonly]', C.dim)],
          [tk('~', C.faint)], [tk('~', C.faint)],
          [tk('~     이력서는 PDF로 정중히 전해 드리겠습니다.', C.faint)],
          [tk('~     그리고 ' + c + '에서 빠져나가는 일은 또 다른 도전입니다.', C.faint)],
          [tk('~', C.faint)], [tk('~', C.faint)],
          [tk("-- INSERT --   (':q'를 입력해도 나갈 수 없습니다)", C.gold)],
          [tk(' ')],
          [tk('jk — ', C.dim), tk('무사히 나오셨습니다.', C.foam), tk('  연락은 ', C.dim), tk('open email', C.foam), tk('로 부탁드립니다.', C.dim)],
        ]);
      }
      case ':q': case ':q!': case ':wq': case ':x': case ':qa': case ':qa!': return rows([[tk('vim에서 살아 돌아오셨습니다. 존경합니다.', C.gold)]]);
      case 'echo': return rows([[tk(parts.slice(1).join(' ') || ' ', C.fg)]]);
      case 'pwd': return rows([[tk('/home/hwankee/portfolio', C.fg)]]);
      case 'date': return rows([[tk(new Date().toString(), C.fg)]]);
      case 'uname': return rows([[tk('Linux pulppixel 6.1.0-18-amd64 #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux', C.fg)]]);
      case 'sudo': return rows([[tk('hwankee is not in the sudoers file. This incident will be reported.', C.love)]]);
      case 'rm': return rows([[tk("rm: cannot remove 'portfolio': Permission denied", C.love), tk('  (nice try)', C.gold)]]);
      case 'exit': case 'logout': return rows([[tk('There is no exit — only ', C.dim), tk('pulppixel', C.foam), tk('.', C.dim)]]);
      case 'man': return rows([[tk('What manual page do you want? Try ', C.dim), tk("'help'", C.foam), tk('.', C.dim)]]);
      default: return rows([[tk('zsh: command not found: ' + c, C.love)], [tk('type ', C.dim), tk("'help'", C.foam), tk(' for a list of commands', C.dim)]]);
    }
  }

  private cmdProjects(): Block {
    const P = DATA[1].items as ProjectItem[];
    const r: Token[][] = [[tk('projects/', C.foam)], [tk(' ')]];
    P.forEach((p) => r.push([tk('  ' + pad(p.label, 16), C.foam), tk(pad(p.badge, 13), p.badgeColor), tk(p.period, C.dim)]));
    r.push([tk(' ')]); r.push([tk('details: ', C.dim), tk('cat eterna', C.foam), tk('   ·   open: ', C.dim), tk('open eterna', C.foam)]);
    return rows(r);
  }

  private cmdGitLog(): Block {
    const J = DATA[2].items as JobItem[];
    const h = ['a3f91c2', '7d2e0bb', 'c14ff90', '19ab6de', 'f08c5a1'];
    const r: Token[][] = [];
    J.forEach((j, i) => {
      r.push([tk('commit ' + (h[i] || 'b2d4e6f') + (h[i] || 'b2d4e6f'), C.gold), tk(i === 0 ? '  (HEAD -> main, origin/main)' : '', C.foam)]);
      r.push([tk('Author: ', C.dim), tk('Hwankee Baik <devenvy100@gmail.com>', C.fg)]);
      r.push([tk('Date:   ', C.dim), tk(j.period, C.fg)]);
      r.push([tk(' ')]);
      r.push([tk('    ' + j.company + ' · ' + j.role, C.white)]);
      r.push([tk('    ' + j.points.join(' · '), C.dim)]);
      r.push([tk(' ')]);
    });
    return rows(r);
  }

  private cmdOpen(arg: string): Block | null {
    if (!arg) return rows([[tk('usage: open <name>   (eterna, github, email, linkedin)', C.dim)]]);
    const P = DATA[1].items as ProjectItem[], K = DATA[4].items as ContactItem[];
    const proj = P.filter((x) => x.label === arg || x.label.indexOf(arg) === 0)[0];
    if (proj) { this.openPage(proj); return null; }
    const k = K.filter((x) => x.label === arg)[0];
    if (k && k.url) { window.open(k.url, '_blank', 'noopener'); return rows([[tk('opening ', C.dim), tk(arg, C.foam)]]); }
    return rows([[tk('open: ' + arg + ': not found', C.love)], [tk('try: ', C.dim), tk('eterna, ieum, peekar, github, linkedin, email', C.dim)]]);
  }

  // ---- navigation ----
  private pageFrom: State['phase'] = 'tui';
  private openPage(p: ProjectItem): void { this.pageFrom = this.state.phase; this.setState({ phase: 'page', page: p }); }
  private back(): void { const from = this.pageFrom || 'tui'; this.setState({ phase: from }); if (from === 'shell') setTimeout(() => this.focusInput(), 30); }
  private launch(): void {
    if (this.state.phase !== 'shell') return;
    this.setState({ phase: 'boot', bootLines: [] });
    this.bootTimers = [];
    BOOT.forEach((l, i) => this.bootTimers.push(window.setTimeout(() => { this.state.bootLines = [...this.state.bootLines, l]; this.render(); }, 120 + i * 180)));
    this.bootTimers.push(window.setTimeout(() => this.setState({ phase: 'tui' }), 120 + BOOT.length * 180 + 350));
  }
  private reset(): void { this.bootTimers.forEach(clearTimeout); this.setState({ phase: 'shell', focus: 0, sels: [0, 0, 0, 0, 0] }); setTimeout(() => this.focusInput(), 30); }
  private focusPanel(pi: number): void { this.setState({ focus: pi }); }
  private move(d: number): void {
    const s = this.state; const n = DATA[s.focus].items.length; const sels = s.sels.slice();
    sels[s.focus] = Math.max(0, Math.min(n - 1, sels[s.focus] + d)); this.setState({ sels });
  }
  private select(pi: number, ii: number): void { const sels = this.state.sels.slice(); sels[pi] = ii; this.setState({ focus: pi, sels }); }
  private openCurrent(): void {
    const panel = DATA[this.state.focus]; const it = panel.items[this.state.sels[this.state.focus]];
    if (!it) return;
    if (panel.kind === 'project') { this.openPage(it as ProjectItem); return; }
    const url = (it as ContactItem).url;
    if (url) window.open(url, '_blank', 'noopener');
  }

  // ---- click delegation ----
  private onDelegatedClick(e: MouseEvent): void {
    const el = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!el) { if (this.state.phase === 'shell') this.focusInput(); return; }
    const act = el.dataset.act!;
    const pi = el.dataset.pi ? +el.dataset.pi : 0;
    const ii = el.dataset.ii ? +el.dataset.ii : 0;
    if (act === 'launch') { this.cancelDemo(); this.exec(''); }
    else if (act === 'focus') this.focusPanel(pi);
    else if (act === 'select') this.select(pi, ii);
    else if (act === 'openMain') { const p = DATA[this.state.focus]; const it = p.items[this.state.sels[this.state.focus]]; if (p.kind === 'project') this.openPage(it as ProjectItem); }
    else if (act === 'back') this.back();
    else if (act === 'focusInput') this.focusInput();
  }

  // ================= VIEW =================
  private render(): void {
    const s = this.state;
    // 진입 애니메이션(pop)은 페이즈가 바뀔 때만. 같은 페이즈 내 탐색(j/k 등)에선 재생 X → 깜빡임 제거.
    this.anim = s.phase !== this.lastPhase;
    this.lastPhase = s.phase;

    let body = '';
    if (s.phase === 'shell') body = this.viewShell();
    else if (s.phase === 'boot') body = this.viewBoot();
    else if (s.phase === 'tui') body = this.viewTui();
    else if (s.phase === 'page') body = this.viewPage();

    // 창 컨테이너는 한 번만 만들고 내부만 교체 — 매 렌더 재생성 시 화면이 번쩍이던 문제 제거.
    // 재질은 ProjectLayout .frame 과 동일한 불투명 배경 (backdrop-filter 는 Chromium 페인트 버그로 미사용).
    if (!this.shellEl) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:relative;width:min(1340px,100%);height:min(900px,100%);display:flex;flex-direction:column;background:#1a1826;border:1px solid #524f67;border-radius:12px;box-shadow:0 40px 120px -30px rgba(0,0,0,.85), 0 0 0 1px rgba(196,167,231,.06);overflow:hidden';
      this.root.appendChild(wrap);
      this.shellEl = wrap;
    }

    // innerHTML 통째 교체는 스크롤 컨테이너를 새로 만들어 scroll 위치가 초기화된다.
    // [data-keepscroll] 요소의 위치를 교체 전에 저장 → 교체 후 복원. 단, 상위 패널(focus)이
    // 바뀌면 항목 목록 자체가 달라지므로 항목 행은 복원하지 않고 초기화한다.
    const focusChanged = s.focus !== this.lastFocus;
    this.lastFocus = s.focus;
    const scrollSave: Record<string, [number, number]> = {};
    this.shellEl.querySelectorAll<HTMLElement>('[data-keepscroll]').forEach((el) => {
      if (el.id) scrollSave[el.id] = [el.scrollLeft, el.scrollTop];
    });

    this.shellEl.innerHTML = this.viewTitleBar() + body;

    for (const id in scrollSave) {
      if (id === 't-mobile-items' && focusChanged) continue;
      const el = this.shellEl.querySelector<HTMLElement>('#' + id);
      if (el) { el.scrollLeft = scrollSave[id][0]; el.scrollTop = scrollSave[id][1]; }
    }

    // shell: 입력 element 직접 바인딩 + 포커스/스크롤
    this.inputEl = this.shellEl.querySelector('#t-input');
    this.dispEl = this.shellEl.querySelector('#t-input-disp');
    if (this.inputEl) {
      this.inputEl.addEventListener('input', this.onInput);
      this.inputEl.addEventListener('keydown', this.onKey);
      this.inputEl.value = s.input;
    }
    if (s.phase === 'shell') {
      const term = this.shellEl.querySelector('#t-term') as HTMLElement | null;
      if (term) term.scrollTop = term.scrollHeight;
    }
  }

  private viewTitleBar(): string {
    const m = this.state.isMobile;
    // 모바일은 폭이 좁아 호스트명을 빼고 경로만 — 가운데 탭이 잘리지 않게.
    const tab = m
      ? `<span style="color:#9ccfd8">~/portfolio</span>`
      : `<span style="color:#e0def4">hwankee@pulppixel</span><span style="color:#6e6a86">:</span><span style="color:#9ccfd8">~/portfolio</span>`;
    // 3d-world 링크: 모바일은 아이콘만(공간 확보), 데스크탑은 라벨 포함.
    const worldLink = m
      ? `<a href="/explore/" aria-label="3D 월드" style="flex:none;font-size:13px;color:#9ccfd8;white-space:nowrap;border:1px solid #403d52;border-radius:6px;padding:4px 10px" title="3D 월드">❯</a>`
      : `<a href="/explore/" style="flex:none;font-size:11px;color:#908caa;letter-spacing:.04em;white-space:nowrap;border:1px solid #403d52;border-radius:6px;padding:4px 10px" title="3D 월드"><span style="color:#9ccfd8">❯</span> 3d-world</a>`;
    return `<div style="flex:none;display:flex;align-items:center;gap:14px;padding:0 16px;height:42px;background:#1f1d2e;border-bottom:1px solid #16141f">
      <div style="display:flex;gap:8px;flex:none">
        <span style="width:12px;height:12px;border-radius:50%;background:#eb6f92"></span>
        <span style="width:12px;height:12px;border-radius:50%;background:#f6c177"></span>
        <span style="width:12px;height:12px;border-radius:50%;background:#9ccfd8"></span>
      </div>
      <div style="flex:1;display:flex;justify-content:center;min-width:0">
        <div style="display:flex;align-items:center;background:#191724;border:1px solid #403d52;border-radius:6px;padding:5px 16px;font-size:12px;color:#908caa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${tab}
        </div>
      </div>
      ${worldLink}
    </div>`;
  }

  private rowTokens(toks: Token[]): string {
    return toks.map((t) => `<span style="color:${t.c}">${esc(t.t)}</span>`).join('');
  }

  private viewNeofetch(): string {
    const sys = this.state.sys;
    const sw = (hex: string) => `<span style="width:15px;height:15px;background:${hex}"></span>`;
    const line = (k: string, v: string) => `<div><span style="color:#c4a7e7;font-weight:700">${k}</span>: ${esc(v)}</div>`;
    return `<div style="margin:6px 0 12px;display:flex;gap:clamp(16px,4vw,44px);flex-wrap:wrap;align-items:flex-start">
      <pre style="margin:0;white-space:pre;color:#eb6f92;font-size:clamp(7.5px,1.05vw,10.5px);line-height:1.16;flex:none;text-shadow:0 0 14px rgba(235,111,146,.28)">${esc(NEOFETCH_ART)}</pre>
      <div style="font-size:13px;line-height:1.7;min-width:0;color:#cdc9de;white-space:nowrap">
        <div><span style="color:#9ccfd8;font-weight:700">hwankee</span><span style="color:#6e6a86">@</span><span style="color:#9ccfd8;font-weight:700">pulppixel</span></div>
        <div style="color:#403d52">-----------------------------</div>
        ${line('OS', sys.os + (sys.arch ? ' ' + sys.arch : ''))}
        ${line('Host', sys.host)}
        ${line('Kernel', sys.kernel)}
        ${line('Uptime', sys.uptime)}
        ${line('Packages', sys.packages)}
        ${line('Shell', sys.shell)}
        ${line('Resolution', sys.res)}
        ${line('WM', sys.wm)}
        ${line('Terminal', sys.term)}
        ${line('CPU', sys.cpu)}
        ${line('GPU', sys.gpu)}
        ${line('Memory', sys.mem)}
        ${line('Locale', sys.locale)}
        <div style="display:flex;gap:4px;margin-top:12px">${['#26233a', '#eb6f92', '#9ccfd8', '#f6c177', '#c4a7e7', '#ebbcba', '#31748f', '#e0def4'].map(sw).join('')}</div>
        <div style="display:flex;gap:4px;margin-top:4px">${['#403d52', '#f2718f', '#a6d8e0', '#f8cd8a', '#cfb4ec', '#f0c8c6', '#3c87a3', '#ffffff'].map(sw).join('')}</div>
      </div>
    </div>`;
  }

  private viewShell(): string {
    const blocksHtml = this.state.blocks.map((b) => {
      if ('isNeofetch' in b) return this.viewNeofetch();
      if ('isCmd' in b) return `<div style="margin:12px 0 4px;white-space:pre-wrap;word-break:break-word"><span style="color:#9ccfd8">hwankee@pulppixel</span><span style="color:#6e6a86">:</span><span style="color:#c4a7e7">~/portfolio</span> <span style="color:#c4a7e7">❯</span> <span style="color:#e0def4">${esc(b.text)}</span></div>`;
      return `<div style="margin-bottom:8px">${b.rows.map((row) => `<div style="white-space:pre-wrap;word-break:break-word">${this.rowTokens(row)}</div>`).join('')}</div>`;
    }).join('');

    return `<div id="t-term" data-act="focusInput" style="flex:1;min-height:0;overflow-y:auto;padding:clamp(18px,4vw,40px) clamp(20px,5vw,60px);font-size:13px;line-height:1.7;cursor:text">
      ${blocksHtml}
      <div style="margin-top:12px;display:flex;align-items:center;gap:8px;white-space:nowrap;font-size:13px"><span style="color:#9ccfd8">hwankee@pulppixel</span><span style="color:#6e6a86">:</span><span style="color:#c4a7e7">~/portfolio</span><span style="color:#f6c177">git:(</span><span style="color:#eb6f92">main</span><span style="color:#f6c177">)</span></div>
      <div style="margin-top:4px;display:flex;align-items:flex-start;position:relative;font-size:13px">
        <span style="color:#c4a7e7;flex:none">❯&nbsp;</span>
        <div style="flex:1;min-width:0;position:relative;word-break:break-all">
          <span id="t-input-disp" style="color:#e0def4;white-space:pre-wrap">${esc(this.state.input)}</span><span class="cur"></span>
          <input id="t-input" autocomplete="off" autocapitalize="off" spellcheck="false" style="position:absolute;top:0;left:0;width:100%;height:100%;background:transparent;border:none;outline:none;color:transparent;caret-color:transparent;font:inherit;padding:0;margin:0" />
        </div>
      </div>
      ${this.state.isMobile ? `<div data-act="launch" style="margin-top:16px;display:inline-flex;align-items:center;gap:8px;padding:12px 20px;border-radius:8px;background:#c4a7e7;color:#191724;font-size:13px;font-weight:700;letter-spacing:.04em;cursor:pointer;-webkit-tap-highlight-color:transparent">❯ 탭하여 GUI 실행</div>
      <div style="margin-top:8px;font-size:11px;color:#6e6a86">…또는 위 입력창을 탭해 명령어를 직접 입력할 수 있습니다.</div>` : ''}
    </div>`;
  }

  private viewBoot(): string {
    return `<div style="flex:1;min-height:0;padding:clamp(28px,7vw,90px);font-size:13px;line-height:2;color:#908caa">
      ${this.state.bootLines.map((l, i) => `<div style="display:flex;gap:12px;${i === this.state.bootLines.length - 1 ? 'animation:rise .16s ease both' : ''}"><span style="color:#524f67;flex:none">${esc(l.t)}</span><span style="color:${l.c}">${esc(l.m)}</span></div>`).join('')}
      <div class="cur" style="margin-top:2px"></div>
    </div>`;
  }

  private viewTui(): string {
    const s = this.state; const focus = s.focus; const sels = s.sels;
    const desktopPanels = DATA.map((p, pi) => {
      const focused = pi === focus;
      const titleColor = focused ? '#c4a7e7' : '#6e6a86', keyColor = focused ? '#c4a7e7' : '#524f67', border = focused ? '#c4a7e7' : '#403d52';
      const items = p.items.map((it, ii) => {
        const sel = sels[pi] === ii; const activeSel = focused && sel;
        const bar = activeSel ? '▌' : ' ';
        const rowBg = activeSel ? 'rgba(156,207,216,.13)' : (sel ? 'rgba(110,106,134,.12)' : 'transparent');
        const fg = activeSel ? '#e0def4' : (sel ? '#cdc9de' : '#908caa');
        const metaColor = activeSel ? '#9ccfd8' : '#524f67';
        const icon = (it as { icon?: string }).icon || '';
        const meta = (it as { meta?: string }).meta || '';
        const label = (it as { label: string }).label;
        return `<div data-act="select" data-pi="${pi}" data-ii="${ii}" style="display:flex;align-items:center;gap:8px;padding:4px 12px;cursor:pointer;background:${rowBg}">
          <span style="flex:none;width:7px;color:#9ccfd8">${bar}</span>
          <span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${fg};font-weight:${activeSel ? '700' : '400'};font-size:13px">${icon ? esc(icon) + ' ' : ''}${esc(label)}</span>
          <span style="flex:none;white-space:nowrap;font-size:11px;color:${metaColor}">${esc(meta)}</span>
        </div>`;
      }).join('');
      return `<div style="position:relative;flex:none;border:1px solid ${border};border-radius:8px;padding:16px 0 8px">
        <div style="position:absolute;top:-8px;left:12px;background:#191724;padding:0 8px;font-size:11px;letter-spacing:.02em;white-space:nowrap;color:${titleColor}"><span style="color:${keyColor}">[${p.key}]</span> ${esc(p.title)}</div>
        ${items}
      </div>`;
    }).join('');

    const leftDesktop = `<div id="t-left" data-keepscroll style="flex:1 1 270px;min-width:240px;max-width:340px;display:flex;flex-direction:column;gap:12px;overflow-y:auto;min-height:0;padding-top:12px">
      ${desktopPanels}
      <div style="flex:none;font-size:11px;color:#524f67;padding:2px 6px;line-height:1.7">j k &nbsp;이동<br>1–5 &nbsp;패널 · enter 열기 · q 셸</div>
    </div>`;

    const mobileSel = `<div id="t-mobile-panels" data-keepscroll style="flex:none;display:flex;gap:8px;padding:12px 12px 0;overflow-x:auto;-webkit-overflow-scrolling:touch">
        ${DATA.map((p, pi) => { const f = pi === focus; return `<div data-act="focus" data-pi="${pi}" style="flex:none;white-space:nowrap;border:1px solid ${f ? '#c4a7e7' : '#403d52'};border-radius:6px;padding:10px 14px;font-size:12px;color:${f ? '#c4a7e7' : '#6e6a86'};-webkit-tap-highlight-color:transparent"><span style="opacity:.6">${p.key}</span> ${esc(p.title)}</div>`; }).join('')}
      </div>
      <div id="t-mobile-items" data-keepscroll style="flex:none;display:flex;gap:8px;padding:12px;overflow-x:auto;-webkit-overflow-scrolling:touch;border-bottom:1px solid #26233a">
        ${DATA[focus].items.map((it, ii) => { const sel = sels[focus] === ii; const label = (it as { label: string }).label; return `<div data-act="select" data-pi="${focus}" data-ii="${ii}" style="flex:none;white-space:nowrap;border:1px solid ${sel ? '#c4a7e7' : '#403d52'};background:${sel ? '#c4a7e7' : '#1f1d2e'};border-radius:6px;padding:10px 14px;font-size:13px;color:${sel ? '#191724' : '#908caa'};font-weight:${sel ? '700' : '400'};-webkit-tap-highlight-color:transparent">${esc(label)}</div>`; }).join('')}
      </div>`;

    return `<div style="flex:1;min-height:0;display:flex;flex-direction:column;animation:${this.anim ? 'pop .32s ease both' : 'none'}">
      ${s.isMobile ? mobileSel : ''}
      <div style="flex:1;min-height:0;display:flex;gap:12px;padding:12px">
        ${s.isMobile ? '' : leftDesktop}
        <div style="flex:3 1 440px;min-width:0;position:relative;border:1px solid #524f67;border-radius:8px;display:flex;flex-direction:column;min-height:0">
          ${this.viewMain()}
        </div>
      </div>
      ${this.viewStatusBar()}
    </div>`;
  }

  private viewMain(): string {
    const s = this.state; const panel = DATA[s.focus]; const it = panel.items[s.sels[s.focus]]; const kind = panel.kind;
    const viewTitle = kind === 'profile' ? 'README'
      : kind === 'project' ? (it as ProjectItem).label + '.md'
      : kind === 'job' ? (it as JobItem).company
      : kind === 'skill' ? (it as SkillItem).label + '.toml'
      : (it as ContactItem).label;
    const path = kind === 'profile' ? '~/portfolio' : '~/portfolio/' + panel.title.toLowerCase() + '/' + (it as { label: string }).label;

    let inner = '';
    if (kind === 'profile') inner = this.viewProfile();
    else if (kind === 'project') inner = this.viewMainProject(it as ProjectItem);
    else if (kind === 'job') inner = this.viewMainJob(it as JobItem);
    else if (kind === 'skill') inner = this.viewMainSkill(it as SkillItem);
    else if (kind === 'contact') inner = this.viewMainContact(it as ContactItem);

    return `<div style="position:absolute;top:-8px;left:12px;background:#191724;padding:0 8px;font-size:11px;color:#9ccfd8">${esc(viewTitle)}</div>
      <div style="flex:1;min-height:0;overflow-y:auto;padding:24px clamp(18px,3vw,34px)">
        <div style="font-size:11px;color:#6e6a86;margin-bottom:20px">${esc(path)}</div>
        ${inner}
      </div>`;
  }

  private viewProfile(): string {
    const chip = (t: string, c: string) => `<span style="border:1px solid #26233a;border-radius:6px;padding:4px 12px;color:${c}">${t}</span>`;
    return `<div style="font-size:11px;color:#9ccfd8;letter-spacing:.14em;margin-bottom:14px">$ whoami</div>
      <h1 style="font-size:clamp(1.7rem,4vw,2.7rem);color:#e0def4;line-height:1.08;letter-spacing:-.01em">백환기 <span style="color:#6e6a86;font-weight:400;font-size:.55em">/ Hwankee Baik</span></h1>
      <div style="margin-top:8px;color:#c4a7e7;font-size:13px">Software Engineer · 1인 스튜디오 <span style="color:#ebbcba">Dongle Lab</span> 운영</div>
      <p style="margin-top:20px;max-width:60ch;color:#cdc9de;line-height:1.9;font-size:14px">게임 클라이언트를 중심으로 모바일·웹·실시간 네트워크까지 폭넓게 다룹니다. 지금은 신생아 작명 서비스와 WebAR 갤러리 플랫폼을 직접 만들어 운영하며, 아이디어를 제품으로 완성해 끝까지 책임지는 일에 집중합니다.</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:24px;font-size:12px">
        ${chip('Unity', '#9ccfd8')}${chip('Unreal 5', '#c4a7e7')}${chip('Godot 4', '#ebbcba')}${chip('Flutter', '#f6c177')}${chip('Next.js', '#9ccfd8')}${chip('WebAR', '#eb6f92')}
      </div>
      <div style="margin-top:32px;padding-top:16px;border-top:1px dashed #26233a;font-size:12px;color:#6e6a86;line-height:1.9">
        ${this.state.isMobile
          ? `<div><span style="color:#9ccfd8">-</span> 위쪽 <span style="color:#e0def4">탭</span>으로 패널을 고르고, 항목을 <span style="color:#e0def4">탭</span>해서 봅니다.</div>
        <div><span style="color:#9ccfd8">-</span> <a href="/explore/" style="color:#9ccfd8;text-decoration:underline;text-underline-offset:3px;text-decoration-color:#403d52">3D 월드</a>는 우상단 <span style="color:#e0def4">❯</span> 링크로 열 수 있습니다.</div>`
          : `<div><span style="color:#9ccfd8">-</span> 좌측 패널을 <span style="color:#e0def4">j k</span>로 탐색하고 <span style="color:#e0def4">enter</span>로 엽니다.</div>
        <div><span style="color:#9ccfd8">-</span> <a href="/explore/" style="color:#9ccfd8;text-decoration:underline;text-underline-offset:3px;text-decoration-color:#403d52">3D 월드</a>는 우상단 링크 또는 <span style="color:#e0def4">explore</span> 명령으로 열 수 있습니다.</div>
        <div><span style="color:#9ccfd8">-</span> <span style="color:#e0def4">q</span>를 누르면 셸로 돌아갑니다.</div>`}
      </div>`;
  }

  private viewMainProject(it: ProjectItem): string {
    return `<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <h1 style="font-size:clamp(1.5rem,3.4vw,2.3rem);color:#e0def4;line-height:1.1">${esc(it.name)}</h1>
        <span style="white-space:nowrap;border:1px solid ${it.badgeColor};color:${it.badgeColor};padding:3px 10px;border-radius:6px;font-size:11px;letter-spacing:.06em">${esc(it.badge)}</span>
      </div>
      <div style="margin-top:8px;color:#c4a7e7;font-size:14px">${esc(it.sub)}</div>
      <div style="margin-top:4px;font-size:12px;color:#6e6a86">${esc(it.period)}</div>
      <p style="margin-top:24px;max-width:64ch;color:#cdc9de;line-height:1.9;font-size:14px">${esc(it.desc)}</p>
      <div style="margin-top:28px;font-size:11px;color:#9ccfd8;letter-spacing:.14em">STACK</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;font-size:12px">
        ${it.stack.map((x) => `<span style="border:1px solid #26233a;border-radius:6px;padding:4px 12px;color:#908caa">${esc(x)}</span>`).join('')}
      </div>
      <div style="margin-top:28px;font-size:11px;color:#9ccfd8;letter-spacing:.14em">HIGHLIGHTS</div>
      <div style="margin-top:12px;font-size:13px;color:#cdc9de;line-height:1.7">
        ${it.points.map((p) => `<div style="display:flex;gap:10px;margin-bottom:8px"><span style="color:#c4a7e7;flex:none">+</span><span>${esc(p)}</span></div>`).join('')}
      </div>
      <div data-act="openMain" style="cursor:pointer;display:inline-flex;align-items:center;gap:8px;white-space:nowrap;margin-top:28px;background:#c4a7e7;color:#191724;padding:10px 18px;border-radius:8px;font-size:12px;letter-spacing:.04em;font-weight:700">상세 보기</div>`;
  }

  private viewMainJob(it: JobItem): string {
    return `<h1 style="font-size:clamp(1.5rem,3.4vw,2.3rem);color:#e0def4;line-height:1.1">${esc(it.company)}</h1>
      <div style="margin-top:8px;color:#c4a7e7;font-size:14px">${esc(it.role)}</div>
      <div style="margin-top:4px;font-size:12px;color:#6e6a86">${esc(it.period)} · ${esc(it.dur)}</div>
      <p style="margin-top:24px;max-width:64ch;color:#cdc9de;line-height:1.9;font-size:14px">${esc(it.desc)}</p>
      <div style="margin-top:28px;font-size:11px;color:#9ccfd8;letter-spacing:.14em">PROJECTS</div>
      <div style="margin-top:12px;font-size:13px;color:#cdc9de;line-height:1.7">
        ${it.points.map((p) => `<div style="display:flex;gap:10px;margin-bottom:8px"><span style="color:#f6c177;flex:none">-</span><span>${esc(p)}</span></div>`).join('')}
      </div>`;
  }

  private viewMainSkill(it: SkillItem): string {
    return `<h1 style="font-size:clamp(1.4rem,3vw,2rem);color:#e0def4;line-height:1.1">${esc(it.title)}</h1>
      <div style="margin-top:24px;display:flex;flex-direction:column;gap:0;border:1px solid #26233a;border-radius:8px;overflow:hidden">
        ${it.rows.map((r) => `<div style="display:flex;justify-content:space-between;gap:16px;padding:12px 16px;border-bottom:1px solid #26233a;font-size:13px"><span style="color:#e0def4">${esc(r.k)}</span><span style="color:#6e6a86;white-space:nowrap">${esc(r.v)}</span></div>`).join('')}
      </div>`;
  }

  private viewMainContact(it: ContactItem): string {
    return `<h1 style="font-size:clamp(1.5rem,3.4vw,2.3rem);color:#e0def4;line-height:1.1">${esc(it.label)}</h1>
      <div style="margin-top:12px;font-size:14px;color:#9ccfd8;word-break:break-all">${esc(it.value)}</div>
      <p style="margin-top:16px;max-width:54ch;color:#cdc9de;line-height:1.9;font-size:14px">${esc(it.note)}</p>
      <a href="${esc(it.url)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;white-space:nowrap;margin-top:28px;background:#9ccfd8;color:#191724;padding:10px 18px;border-radius:8px;font-size:12px;letter-spacing:.04em;font-weight:700">${esc(it.cta)}</a>`;
  }

  private viewStatusBar(): string {
    const hints = this.state.isMobile
      ? ''
      : `<span><span style="color:#908caa">jk</span> 이동</span><span><span style="color:#908caa">enter</span> 열기</span><span><span style="color:#908caa">q</span> 셸</span>`;
    return `<div style="flex:none;display:flex;align-items:center;gap:0;height:30px;background:#1f1d2e;border-top:1px solid #16141f;font-size:12px;overflow:hidden">
      <span style="background:#c4a7e7;color:#191724;height:100%;display:flex;align-items:center;padding:0 12px;font-weight:700;white-space:nowrap"> main</span>
      <span style="color:#6e6a86;padding:0 12px;display:flex;align-items:center;gap:12px;white-space:nowrap"><span>13 projects</span><span>6y</span></span>
      <span style="flex:1"></span>
      <span style="color:#524f67;padding:0 12px;display:flex;align-items:center;gap:12px;white-space:nowrap">
        ${hints}
      </span>
    </div>`;
  }

  private viewPage(): string {
    const pg = this.state.page; if (!pg) return '';
    const slug = (pg.url || '').match(/\/projects\/([^/]+)\/?$/)?.[1] || '';
    const md = MD_BY_SLUG[slug] || '';
    const L = pg.long;
    const hasLong = !!L;
    const overview = L ? L.overview : pg.desc;
    const stack = L ? L.stack : pg.stack;
    const role = L ? L.role : '';
    const playUrl = L ? L.play : pg.play;
    const imageEl = L && L.image ? `<img src="${esc(L.image)}" alt="preview" style="margin-top:20px;width:100%;border-radius:8px;border:1px solid #26233a;display:block" onerror="this.style.display='none'" />` : '';

    const sections = L ? L.sections.map((sec) => `<div style="margin-top:32px;font-size:12px;color:#9ccfd8;letter-spacing:.14em"># ${esc(sec.title)}</div>
      <div style="margin-top:14px;font-size:14px;color:#cdc9de;line-height:1.7">
        ${sec.items.map((i) => `<div style="display:flex;gap:12px;margin-bottom:12px"><span style="color:#c4a7e7;flex:none">-</span><span>${esc(i)}</span></div>`).join('')}
      </div>`).join('') : '';

    const progress = L ? `<div style="margin-top:32px;font-size:12px;color:#9ccfd8;letter-spacing:.14em"># PROGRESS</div>
      <div style="margin-top:14px;font-size:14px;color:#cdc9de;line-height:1.7">
        ${L.progress.map((p) => { const col = p.done ? '#9ccfd8' : '#524f67'; const ic = p.done ? '[x]' : '[ ]'; return `<div style="display:flex;gap:12px;margin-bottom:8px"><span style="flex:none;color:${col}">${ic}</span><span style="color:${col}">${esc(p.t)}</span></div>`; }).join('')}
      </div>` : '';

    const highlights = !hasLong ? `<div style="margin-top:32px;font-size:12px;color:#9ccfd8;letter-spacing:.14em"># HIGHLIGHTS</div>
      <div style="margin-top:14px;font-size:14px;color:#cdc9de;line-height:1.7">
        ${pg.points.map((p) => `<div style="display:flex;gap:12px;margin-bottom:12px"><span style="color:#c4a7e7;flex:none">-</span><span>${esc(p)}</span></div>`).join('')}
      </div>` : '';

    const roleChip = role ? `<span style="font-size:12px;color:#908caa;border:1px solid #26233a;border-radius:6px;padding:6px 12px"><span style="color:#9ccfd8">역할</span> · ${esc(role)}</span>` : '';
    const siteChip = (pg.url && /^https?:/.test(pg.url)) ? `<a href="${esc(pg.url)}" target="_blank" rel="noopener" style="font-size:12px;white-space:nowrap;background:#c4a7e7;color:#191724;border-radius:6px;padding:7px 14px;font-weight:700">사이트 방문</a>` : '';
    const playChip = playUrl ? `<a href="${esc(playUrl)}" target="_blank" rel="noopener" style="font-size:12px;white-space:nowrap;background:#9ccfd8;color:#191724;border-radius:6px;padding:7px 14px;font-weight:700">미니게임 하러 가기</a>` : '';
    const metaRow = (roleChip || siteChip || playChip) ? `<div style="margin-top:20px;display:flex;flex-wrap:wrap;gap:10px;align-items:center">${roleChip}${siteChip}${playChip}</div>` : '';

    const stackBlock = `<div style="margin-top:32px;font-size:12px;color:#9ccfd8;letter-spacing:.14em"># STACK</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;font-size:12px">
            ${stack.map((sx) => `<span style="border:1px solid #26233a;border-radius:6px;padding:6px 12px;color:#908caa">${esc(sx)}</span>`).join('')}
          </div>`;

    // 상세 .md 가 있으면 그 본문(글·이미지·영상)을 렌더, 없으면(이음/PEEKAR 등) 기존 요약 뷰.
    const bodyHtml = md
      ? `${stackBlock}<div style="margin-top:40px">${renderMd(md)}</div>`
      : `<div style="margin-top:32px;font-size:12px;color:#9ccfd8;letter-spacing:.14em"># OVERVIEW</div>
          <p style="margin-top:14px;color:#cdc9de;line-height:1.9;font-size:15px">${esc(overview)}</p>
          ${imageEl}
          ${sections}
          ${stackBlock}
          ${progress}
          ${highlights}`;

    return `<div style="flex:1;min-height:0;display:flex;flex-direction:column;animation:${this.anim ? 'pop .3s ease both' : 'none'}">
      <div style="flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 16px;background:#1f1d2e;border-bottom:1px solid #16141f;font-size:12px">
        <div style="color:#6e6a86;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span style="color:#9ccfd8">cat</span> ~/portfolio/projects/${esc(pg.label)}.md</div>
        <div data-act="back" style="flex:none;cursor:pointer;border:1px solid #403d52;color:#908caa;padding:6px 12px;border-radius:6px;white-space:nowrap">뒤로 (esc)</div>
      </div>
      <div style="flex:1;min-height:0;overflow-y:auto">
        <div style="max-width:760px;margin:0 auto;padding:clamp(28px,5vw,56px) clamp(20px,5vw,40px) 80px">
          <div style="font-size:11px;color:#9ccfd8;letter-spacing:.14em">PROJECT</div>
          <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:16px">
            <h1 style="font-size:clamp(2rem,5vw,3rem);color:#e0def4;line-height:1.06;letter-spacing:-.01em">${esc(pg.name)}</h1>
            <span style="white-space:nowrap;border:1px solid ${pg.badgeColor};color:${pg.badgeColor};padding:4px 12px;border-radius:6px;font-size:12px;letter-spacing:.06em">${esc(pg.badge)}</span>
          </div>
          <div style="margin-top:14px;color:#c4a7e7;font-size:15px">${esc(pg.sub)}</div>
          <div style="margin-top:6px;color:#6e6a86;font-size:13px">${esc(pg.period)}</div>
          ${metaRow}
          <div style="margin-top:32px;height:1px;background:#26233a"></div>
          ${bodyHtml}
          <div style="margin-top:48px;display:flex;gap:12px;flex-wrap:wrap">
            <div data-act="back" style="cursor:pointer;display:inline-flex;align-items:center;gap:8px;white-space:nowrap;border:1px solid #403d52;color:#908caa;padding:10px 20px;border-radius:8px;font-size:12px">GUI로 돌아가기</div>
          </div>
        </div>
      </div>
    </div>`;
  }
}
