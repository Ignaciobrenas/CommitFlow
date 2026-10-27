import * as crypto from 'crypto';

export class AvatarService {
  private static instance: AvatarService;
  private readonly cache = new Map<string, string>();

  // Curated modern gradient palette for fallback avatars
  private static readonly GRADIENTS: [string, string][] = [
    ['#38bdf8', '#1e40af'], // Cyan to Deep Blue
    ['#10b981', '#065f46'], // Emerald to Forest
    ['#f59e0b', '#b45309'], // Amber to Orange
    ['#ec4899', '#9d174d'], // Pink to Maroon
    ['#8b5cf6', '#5b21b6'], // Violet to Indigo
    ['#06b6d4', '#0e7490'], // Cyan to Teal
    ['#f43f5e', '#9f1239'], // Rose to Wine
  ];

  public static getInstance(): AvatarService {
    if (!AvatarService.instance) {
      AvatarService.instance = new AvatarService();
    }
    return AvatarService.instance;
  }

  /**
   * Resolves author avatar URL with multi-tiered resolution:
   * 1. Detect GitHub noreply email -> github avatar
   * 2. Gravatar MD5 hash with identicon fallback
   * 3. Fallback SVG initials data URI
   */
  public getAvatarUrl(name: string, email: string): string {
    const key = `${name.trim()}__${email.trim().toLowerCase()}`;
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Check for GitHub noreply email (e.g. 123456+user@users.noreply.github.com)
    const githubMatch = cleanEmail.match(/(?:[0-9]+\+)?([a-zA-Z0-9_-]+)@users\.noreply\.github\.com/i);
    if (githubMatch && githubMatch[1]) {
      const username = githubMatch[1];
      const url = `https://avatars.githubusercontent.com/${username}`;
      this.cache.set(key, url);
      return url;
    }

    // 2. Gravatar with retro/identicon fallback
    if (cleanEmail && cleanEmail.includes('@')) {
      const hash = crypto.createHash('md5').update(cleanEmail).digest('hex');
      const url = `https://www.gravatar.com/avatar/${hash}?s=80&d=identicon`;
      this.cache.set(key, url);
      return url;
    }

    // 3. Fallback SVG initials
    const fallbackUrl = this.generateInitialsSvg(name);
    this.cache.set(key, fallbackUrl);
    return fallbackUrl;
  }

  /**
   * Generates a modern SVG data URI with initials and gradient background
   */
  public generateInitialsSvg(name: string): string {
    const initials = this.getInitials(name);
    const gradient = this.getGradientForString(name);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${gradient[0]}" />
          <stop offset="100%" stop-color="${gradient[1]}" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="32" fill="url(#grad)" />
      <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
        fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-size="22" font-weight="600" letter-spacing="1">
        ${initials}
      </text>
    </svg>`;

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  private getInitials(name: string): string {
    const clean = name.trim();
    if (!clean) {
      return '?';
    }
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  }

  private getGradientForString(str: string): [string, string] {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const index = Math.abs(hash) % AvatarService.GRADIENTS.length;
    return AvatarService.GRADIENTS[index];
  }
}
