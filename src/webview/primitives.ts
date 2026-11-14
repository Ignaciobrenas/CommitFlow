/**
 * Native zero-dependency Webview UI primitives for CommitFlow.
 * Built strictly on VS Code CSS variables (--vscode-*) and @vscode/codicons.
 * Replaces deprecated @vscode/webview-ui-toolkit with accessible, theme-aware components.
 */

export interface CfButtonOptions {
  id?: string;
  label?: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'icon' | 'sm';
  title?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  onClick?: (e: MouseEvent) => void;
}

export interface CfBadgeOptions {
  text: string;
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'info' | 'purple' | 'subtle';
  icon?: string;
  title?: string;
  tabular?: boolean;
  className?: string;
}

export interface CfDrawerOptions {
  id: string;
  title: string;
  onClose?: () => void;
}

export interface CfTabItem {
  id: string;
  label: string;
  icon?: string;
  badge?: number;
  title?: string;
}

export interface CfTabsOptions {
  tabs: CfTabItem[];
  activeTabId?: string;
  onSelect?: (tabId: string) => void;
}

export interface CfSkeletonOptions {
  rows?: number;
  variant?: 'graph' | 'card' | 'drawer';
}

export function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function CfButton(options: CfButtonOptions): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  if (options.id) btn.id = options.id;
  const variant = options.variant || 'secondary';
  btn.className = `cf-btn cf-btn-${variant}${options.className ? ` ${options.className}` : ''}`;

  if (options.title) btn.title = options.title;
  if (options.ariaLabel || options.title || options.label) {
    btn.setAttribute('aria-label', options.ariaLabel || options.title || options.label || '');
  }
  if (options.disabled) btn.disabled = true;

  if (options.icon) {
    const iconEl = document.createElement('i');
    iconEl.className = `codicon codicon-${options.icon}`;
    iconEl.setAttribute('aria-hidden', 'true');
    btn.appendChild(iconEl);
  }

  if (options.label) {
    const span = document.createElement('span');
    span.textContent = options.label;
    btn.appendChild(span);
  }

  if (options.onClick) {
    btn.addEventListener('click', options.onClick);
  }

  return btn;
}

export function CfBadge(options: CfBadgeOptions): HTMLSpanElement {
  const badge = document.createElement('span');
  const variant = options.variant || 'default';
  badge.className = `cf-badge cf-badge-${variant}${options.tabular ? ' tabular-nums' : ''}${
    options.className ? ` ${options.className}` : ''
  }`;
  if (options.title) badge.title = options.title;

  if (options.icon) {
    const iconEl = document.createElement('i');
    iconEl.className = `codicon codicon-${options.icon}`;
    iconEl.setAttribute('aria-hidden', 'true');
    badge.appendChild(iconEl);
  }

  const textSpan = document.createElement('span');
  textSpan.textContent = options.text;
  badge.appendChild(textSpan);

  return badge;
}

export function CfDrawer(options: CfDrawerOptions): {
  element: HTMLElement;
  body: HTMLElement;
  open: () => void;
  close: () => void;
} {
  const el = document.createElement('aside');
  el.id = options.id;
  el.className = 'cf-drawer';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', options.title);

  const header = document.createElement('div');
  header.className = 'cf-drawer-header';

  const titleEl = document.createElement('span');
  titleEl.className = 'cf-drawer-title';
  titleEl.textContent = options.title;

  const closeBtn = CfButton({
    icon: 'close',
    variant: 'icon',
    ariaLabel: `Close ${options.title}`,
    title: 'Close',
    onClick: () => {
      el.classList.remove('open');
      options.onClose?.();
    },
  });

  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'cf-drawer-body';

  el.appendChild(header);
  el.appendChild(body);

  return {
    element: el,
    body,
    open: () => el.classList.add('open'),
    close: () => {
      el.classList.remove('open');
      options.onClose?.();
    },
  };
}

export function CfTabs(options: CfTabsOptions): HTMLElement {
  const nav = document.createElement('div');
  nav.className = 'cf-tabs';
  nav.setAttribute('role', 'tablist');

  let activeId = options.activeTabId || options.tabs[0]?.id || '';

  const buttons: HTMLButtonElement[] = [];

  for (const tab of options.tabs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `cf-tab-btn${tab.id === activeId ? ' active' : ''}`;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', tab.id === activeId ? 'true' : 'false');
    btn.dataset.tabId = tab.id;
    if (tab.title) btn.title = tab.title;

    if (tab.icon) {
      const iconEl = document.createElement('i');
      iconEl.className = `codicon codicon-${tab.icon}`;
      iconEl.setAttribute('aria-hidden', 'true');
      btn.appendChild(iconEl);
    }

    const labelSpan = document.createElement('span');
    labelSpan.textContent = tab.label;
    btn.appendChild(labelSpan);

    if (typeof tab.badge === 'number') {
      const badge = document.createElement('span');
      badge.className = 'tab-badge tabular-nums';
      badge.textContent = String(tab.badge);
      btn.appendChild(badge);
    }

    btn.addEventListener('click', () => {
      activeId = tab.id;
      for (const b of buttons) {
        const isSelected = b.dataset.tabId === activeId;
        b.classList.toggle('active', isSelected);
        b.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      }
      options.onSelect?.(tab.id);
    });

    buttons.push(btn);
    nav.appendChild(btn);
  }

  return nav;
}

export class CfToast {
  private static container: HTMLElement | null = null;

  private static ensureContainer(): HTMLElement {
    if (this.container && document.body.contains(this.container)) {
      return this.container;
    }
    const existing = document.getElementById('cf-toast-container');
    if (existing) {
      this.container = existing;
      return existing;
    }
    const el = document.createElement('div');
    el.id = 'cf-toast-container';
    el.className = 'cf-toast-container';
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'false');
    document.body.appendChild(el);
    this.container = el;
    return el;
  }

  public static showToast(
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    durationMs: number = 3500
  ): HTMLElement {
    const container = this.ensureContainer();
    const toast = document.createElement('div');
    toast.className = `cf-toast cf-toast-${type}`;
    toast.setAttribute('role', 'status');

    const iconName =
      type === 'success'
        ? 'pass'
        : type === 'warning'
        ? 'warning'
        : type === 'error'
        ? 'error'
        : 'info';

    const iconEl = document.createElement('i');
    iconEl.className = `codicon codicon-${iconName}`;
    iconEl.setAttribute('aria-hidden', 'true');

    const msgEl = document.createElement('span');
    msgEl.className = 'cf-toast-message';
    msgEl.textContent = message;

    const closeBtn = CfButton({
      icon: 'close',
      variant: 'icon',
      ariaLabel: 'Dismiss notification',
      onClick: () => toast.remove(),
    });

    toast.appendChild(iconEl);
    toast.appendChild(msgEl);
    toast.appendChild(closeBtn);
    container.appendChild(toast);

    if (durationMs > 0) {
      setTimeout(() => {
        toast.classList.add('cf-toast-leaving');
        setTimeout(() => toast.remove(), 180);
      }, durationMs);
    }

    return toast;
  }
}

export function CfSkeleton(options: CfSkeletonOptions = {}): HTMLElement {
  const rows = Math.max(1, options.rows ?? 8);
  const variant = options.variant || 'graph';
  const wrapper = document.createElement('div');
  wrapper.className = `cf-skeleton cf-skeleton-${variant}`;
  wrapper.setAttribute('role', 'status');
  wrapper.setAttribute('aria-busy', 'true');
  wrapper.setAttribute('aria-label', 'Loading content');

  for (let i = 0; i < rows; i++) {
    const row = document.createElement('div');
    row.className = 'cf-skeleton-row';
    const dot = document.createElement('span');
    dot.className = 'cf-skeleton-dot';
    const barPrimary = document.createElement('span');
    barPrimary.className = 'cf-skeleton-bar';
    barPrimary.style.width = `${55 + ((i * 13) % 30)}%`;
    const barMeta = document.createElement('span');
    barMeta.className = 'cf-skeleton-bar cf-skeleton-bar-short';
    row.appendChild(dot);
    row.appendChild(barPrimary);
    row.appendChild(barMeta);
    wrapper.appendChild(row);
  }

  return wrapper;
}

export interface RectLike {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

export function computeClampedPosition(
  anchorRect: RectLike,
  popoverWidth: number,
  popoverHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  padding: number = 8
): { top: number; left: number; maxWidth: number } {
  const maxWidth = Math.max(160, Math.min(popoverWidth, viewportWidth - padding * 2));
  let top = anchorRect.bottom + 4;
  if (top + popoverHeight > viewportHeight - padding) {
    top = Math.max(padding, anchorRect.top - popoverHeight - 4);
  }

  let left = anchorRect.left + 24;
  if (left + maxWidth > viewportWidth - padding) {
    left = Math.max(padding, viewportWidth - maxWidth - padding);
  }
  if (left < padding) {
    left = padding;
  }

  return {
    top: Math.round(top),
    left: Math.round(left),
    maxWidth: Math.round(maxWidth),
  };
}

export function clampPopoverToViewport(
  popover: HTMLElement,
  anchorRect: RectLike,
  padding: number = 8
): void {
  const measuredWidth = popover.offsetWidth || 300;
  const measuredHeight = popover.offsetHeight || 130;
  const pos = computeClampedPosition(
    anchorRect,
    measuredWidth,
    measuredHeight,
    window.innerWidth,
    window.innerHeight,
    padding
  );
  popover.style.top = `${pos.top}px`;
  popover.style.left = `${pos.left}px`;
  popover.style.maxWidth = `${pos.maxWidth}px`;
}
