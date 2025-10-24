import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from '../database/DatabaseService';

interface CookieConsentOptions {
  cookieName?: string;
  consentDomains?: string[];
  cookieCategories?: {
    necessary: boolean;
    functional: boolean;
    analytics: boolean;
    marketing: boolean;
    preferences: boolean;
  };
  consentExpiryDays?: number;
}

export interface CookieConsentData {
  necessary: boolean;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
  version: string;
  grantedAt: string;
  updatedAt: string;
}

export class CookieConsentService {
  private db: DatabaseService;
  private options: CookieConsentOptions;

  constructor(db: DatabaseService, options: CookieConsentOptions = {}) {
    this.db = db;
    this.options = {
      cookieName: 'cookie_consent',
      consentDomains: process.env.CONSENT_DOMAINS?.split(',') || [],
      cookieCategories: {
        necessary: true,  // Always required
        functional: false,
        analytics: false,
        marketing: false,
        preferences: false
      },
      consentExpiryDays: 365,
      ...options
    };
  }

  /**
   * Middleware to check and handle cookie consent
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip for API requests
      if (req.path.startsWith('/api/')) {
        return next();
      }

      // Check if user has already given consent
      const existingConsent = this.getConsentFromRequest(req);

      if (existingConsent) {
        // Attach consent to request
        req.cookieConsent = existingConsent;
        return next();
      }

      // No consent yet - serve consent management UI
      if (this.requiresConsentUI(req.path)) {
        return this.serveConsentUI(req, res);
      }

      next();
    };
  }

  /**
   * Middleware to enforce analytics consent
   */
  requireAnalyticsConsent() {
    return (req: Request, res: Response, next: NextFunction) => {
      const consent = req.cookieConsent || this.getConsentFromRequest(req);

      if (consent?.analytics) {
        return next();
      }

      // Block analytics tracking if no consent
      res.status(403).json({
        success: false,
        error: 'Analytics consent required',
        requiresConsent: true
      });
    };
  }

  /**
   * Middleware to enforce marketing consent
   */
  requireMarketingConsent() {
    return (req: Request, res: Response, next: NextFunction) => {
      const consent = req.cookieConsent || this.getConsentFromRequest(req);

      if (consent?.marketing) {
        return next();
      }

      // Block marketing features if no consent
      res.status(403).json({
        success: false,
        error: 'Marketing consent required',
        requiresConsent: true
      });
    };
  }

  /**
   * Record cookie consent
   */
  async recordConsent(
    consent: Partial<CookieConsentData>,
    userId?: string,
    sessionId?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<CookieConsentData> {
    const fullConsent: CookieConsentData = {
      necessary: true,
      functional: consent.functional || false,
      analytics: consent.analytics || false,
      marketing: consent.marketing || false,
      preferences: consent.preferences || false,
      version: await this.getCurrentConsentVersion(),
      grantedAt: consent.grantedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Store in database
    await this.db.query(`
      INSERT INTO cookie_consents (
        user_id, session_id, consent_json, ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id) DO UPDATE SET
        consent_json = EXCLUDED.consent_json,
        updated_at = NOW()
      ON CONFLICT (session_id) DO UPDATE SET
        consent_json = EXCLUDED.consent_json,
        updated_at = NOW()
    `, [
      userId,
      sessionId,
      JSON.stringify(fullConsent),
      ipAddress,
      userAgent
    ]);

    return fullConsent;
  }

  /**
   * Update cookie consent
   */
  async updateConsent(
    updates: Partial<CookieConsentData>,
    userId?: string,
    sessionId?: string
  ): Promise<CookieConsentData | null> {
    let whereClause = '';
    let params: any[] = [];

    if (userId) {
      whereClause = 'user_id = $1';
      params.push(userId);
    } else if (sessionId) {
      whereClause = 'session_id = $1';
      params.push(sessionId);
    } else {
      return null;
    }

    // Get existing consent
    const result = await this.db.query(`
      SELECT consent_json FROM cookie_consents
      WHERE ${whereClause}
      ORDER BY updated_at DESC
      LIMIT 1
    `, params);

    if (!result.rows.length) {
      return null;
    }

    const existingConsent = JSON.parse(result.rows[0].consent_json) as CookieConsentData;

    // Merge updates
    const updatedConsent: CookieConsentData = {
      ...existingConsent,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // Update in database
    params.push(JSON.stringify(updatedConsent));
    await this.db.query(`
      UPDATE cookie_consents
      SET consent_json = $${params.length}, updated_at = NOW()
      WHERE ${whereClause}
    `, params);

    return updatedConsent;
  }

  /**
   * Get user's cookie consent
   */
  async getUserConsent(userId: string): Promise<CookieConsentData | null> {
    const result = await this.db.query(`
      SELECT consent_json FROM cookie_consents
      WHERE user_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
    `, [userId]);

    if (!result.rows.length) {
      return null;
    }

    return JSON.parse(result.rows[0].consent_json) as CookieConsentData;
  }

  /**
   * Get session's cookie consent
   */
  async getSessionConsent(sessionId: string): Promise<CookieConsentData | null> {
    const result = await this.db.query(`
      SELECT consent_json FROM cookie_consents
      WHERE session_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
    `, [sessionId]);

    if (!result.rows.length) {
      return null;
    }

    return JSON.parse(result.rows[0].consent_json) as CookieConsentData;
  }

  /**
   * Set consent cookie
   */
  setConsentCookie(res: Response, consent: CookieConsentData): void {
    const cookieValue = Buffer.from(JSON.stringify(consent)).toString('base64');

    const cookieOptions = {
      maxAge: this.options.consentExpiryDays * 24 * 60 * 60 * 1000,
      httpOnly: false, // Allow JavaScript access
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      domain: this.options.consentDomains[0] || undefined
    };

    res.cookie(this.options.cookieName!, cookieValue, cookieOptions);
  }

  /**
   * Clear consent cookie
   */
  clearConsentCookie(res: Response): void {
    res.clearCookie(this.options.cookieName!, {
      domain: this.options.consentDomains[0] || undefined
    });
  }

  /**
   * Get consent from request cookies
   */
  private getConsentFromRequest(req: Request): CookieConsentData | null {
    const cookieValue = req.cookies?.[this.options.cookieName!];

    if (!cookieValue) {
      return null;
    }

    try {
      return JSON.parse(Buffer.from(cookieValue, 'base64').toString()) as CookieConsentData;
    } catch {
      return null;
    }
  }

  /**
   * Check if path requires consent UI
   */
  private requiresConsentUI(path: string): boolean {
    // Skip certain paths that don't need consent UI
    const skipPaths = [
      '/consent',
      '/privacy',
      '/terms',
      '/health',
      '/api',
      '/static',
      '/assets'
    ];

    return !skipPaths.some(skipPath => path.startsWith(skipPath));
  }

  /**
   * Serve consent UI HTML
   */
  private serveConsentUI(req: Request, res: Response): void {
    const html = this.generateConsentHTML();
    res.status(200).set('Content-Type', 'text/html').send(html);
  }

  /**
   * Generate consent management UI HTML
   */
  private generateConsentHTML(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cookie Consent Required</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 40px 20px;
            background: #f5f5f5;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
        }
        .consent-container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            max-width: 600px;
            width: 100%;
        }
        .consent-header {
            text-align: center;
            margin-bottom: 30px;
        }
        .consent-header h1 {
            margin: 0;
            color: #333;
            font-size: 28px;
        }
        .consent-description {
            margin-bottom: 30px;
            line-height: 1.6;
            color: #666;
        }
        .consent-categories {
            margin-bottom: 30px;
        }
        .consent-category {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 0;
            border-bottom: 1px solid #eee;
        }
        .consent-category:last-child {
            border-bottom: none;
        }
        .consent-category label {
            flex: 1;
            display: flex;
            flex-direction: column;
        }
        .category-name {
            font-weight: 600;
            color: #333;
        }
        .category-description {
            font-size: 14px;
            color: #666;
            margin-top: 4px;
        }
        .consent-buttons {
            display: flex;
            gap: 12px;
            margin-top: 30px;
        }
        .consent-buttons button {
            flex: 1;
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .btn-accept-all {
            background: #007bff;
            color: white;
        }
        .btn-accept-all:hover {
            background: #0056b3;
        }
        .btn-accept-selected {
            background: #28a745;
            color: white;
        }
        .btn-accept-selected:hover {
            background: #1e7e34;
        }
        .btn-decline {
            background: #6c757d;
            color: white;
        }
        .btn-decline:hover {
            background: #545b62;
        }
        .toggle-switch {
            position: relative;
            width: 50px;
            height: 26px;
        }
        .toggle-switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }
        .toggle-slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #ccc;
            transition: .4s;
            border-radius: 34px;
        }
        .toggle-slider:before {
            position: absolute;
            content: "";
            height: 18px;
            width: 18px;
            left: 4px;
            bottom: 4px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
        }
        input:checked + .toggle-slider {
            background-color: #007bff;
        }
        input:checked + .toggle-slider:before {
            transform: translateX(24px);
        }
        input:disabled + .toggle-slider {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .links {
            text-align: center;
            margin-top: 20px;
            font-size: 14px;
        }
        .links a {
            color: #007bff;
            text-decoration: none;
            margin: 0 10px;
        }
        .links a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="consent-container">
        <div class="consent-header">
            <h1>🍪 Cookie Consent</h1>
        </div>

        <div class="consent-description">
            <p>We use cookies and similar technologies to help personalize content, tailor and measure ads, and provide a better experience. By clicking accept, you agree to this, as outlined in our Cookie Policy.</p>
        </div>

        <div class="consent-categories">
            <div class="consent-category">
                <label>
                    <span class="category-name">Essential Cookies</span>
                    <span class="category-description">Required for the site to function properly</span>
                </label>
                <div class="toggle-switch">
                    <input type="checkbox" id="necessary" checked disabled>
                    <span class="toggle-slider"></span>
                </div>
            </div>

            <div class="consent-category">
                <label>
                    <span class="category-name">Functional Cookies</span>
                    <span class="category-description">Enable enhanced functionality and personalization</span>
                </label>
                <div class="toggle-switch">
                    <input type="checkbox" id="functional">
                    <span class="toggle-slider"></span>
                </div>
            </div>

            <div class="consent-category">
                <label>
                    <span class="category-name">Analytics Cookies</span>
                    <span class="category-description">Help us understand how the site is used</span>
                </label>
                <div class="toggle-switch">
                    <input type="checkbox" id="analytics">
                    <span class="toggle-slider"></span>
                </div>
            </div>

            <div class="consent-category">
                <label>
                    <span class="category-name">Marketing Cookies</span>
                    <span class="category-description">Used to deliver ads relevant to you</span>
                </label>
                <div class="toggle-switch">
                    <input type="checkbox" id="marketing">
                    <span class="toggle-slider"></span>
                </div>
            </div>

            <div class="consent-category">
                <label>
                    <span class="category-name">Preference Cookies</span>
                    <span class="category-description">Remember your settings and preferences</span>
                </label>
                <div class="toggle-switch">
                    <input type="checkbox" id="preferences">
                    <span class="toggle-slider"></span>
                </div>
            </div>
        </div>

        <div class="consent-buttons">
            <button class="btn-accept-all" onclick="acceptAll()">Accept All</button>
            <button class="btn-accept-selected" onclick="acceptSelected()">Accept Selected</button>
            <button class="btn-decline" onclick="declineAll()">Decline All</button>
        </div>

        <div class="links">
            <a href="/privacy-policy">Privacy Policy</a>
            <a href="/cookie-policy">Cookie Policy</a>
            <a href="/terms">Terms of Service</a>
        </div>
    </div>

    <script>
        function getConsentData() {
            return {
                necessary: document.getElementById('necessary').checked,
                functional: document.getElementById('functional').checked,
                analytics: document.getElementById('analytics').checked,
                marketing: document.getElementById('marketing').checked,
                preferences: document.getElementById('preferences').checked
            };
        }

        async function saveConsent(consent) {
            try {
                const response = await fetch('/api/v1/compliance/cookie-consent', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(consent)
                });

                if (response.ok) {
                    // Reload the original page
                    window.location.href = window.location.pathname + window.location.search;
                } else {
                    alert('Error saving consent preferences');
                }
            } catch (error) {
                console.error('Error saving consent:', error);
                alert('Error saving consent preferences');
            }
        }

        function acceptAll() {
            const consent = {
                necessary: true,
                functional: true,
                analytics: true,
                marketing: true,
                preferences: true
            };
            saveConsent(consent);
        }

        function acceptSelected() {
            const consent = getConsentData();
            saveConsent(consent);
        }

        function declineAll() {
            const consent = {
                necessary: true,
                functional: false,
                analytics: false,
                marketing: false,
                preferences: false
            };
            saveConsent(consent);
        }
    </script>
</body>
</html>
    `;
  }

  /**
   * Get current consent version
   */
  private async getCurrentConsentVersion(): Promise<string> {
    const result = await this.db.query(`
      SELECT version FROM privacy_policy_versions
      WHERE is_current = true
      ORDER BY effective_date DESC
      LIMIT 1
    `);

    return result.rows[0]?.version || '1.0';
  }

  /**
   * Generate privacy policy link with consent
   */
  generatePrivacyPolicyLink(consent?: CookieConsentData): string {
    const baseUrl = '/privacy-policy';
    if (!consent) return baseUrl;

    return `${baseUrl}?consent_v=${consent.version}`;
  }

  /**
   * Check if consent version is current
   */
  async isConsentVersionCurrent(version: string): Promise<boolean> {
    const currentVersion = await this.getCurrentConsentVersion();
    return version === currentVersion;
  }
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      cookieConsent?: CookieConsentData | null;
    }
  }
}

// Singleton instance
export let cookieConsentService: CookieConsentService;

export function initializeCookieConsentService(
  db: DatabaseService,
  options?: CookieConsentOptions
): CookieConsentService {
  cookieConsentService = new CookieConsentService(db, options);
  return cookieConsentService;
}