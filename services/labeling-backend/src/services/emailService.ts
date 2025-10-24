import { query } from '../database/connection';
import nodemailer from 'nodemailer';

interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
  fromName: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  variables: string[];
}

interface EmailSequence {
  leadId: number;
  email: string;
  name: string;
  company?: string;
  personalizations: any;
}

export class EmailService {
  private transporter: nodemailer.Transporter;
  private config: EmailConfig;

  constructor() {
    this.config = {
      smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
      smtpPort: parseInt(process.env.SMTP_PORT || '587'),
      smtpUser: process.env.SMTP_USER || '',
      smtpPass: process.env.SMTP_PASS || '',
      fromEmail: process.env.FROM_EMAIL || 'growth@labelmint.it',
      fromName: process.env.FROM_NAME || 'Deligate Growth Team'
    };

    this.transporter = nodemailer.createTransporter({
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      secure: this.config.smtpPort === 465,
      auth: {
        user: this.config.smtpUser,
        pass: this.config.smtpPass
      }
    });
  }

  async sendEmail(to: string, subject: string, content: string, variables: any = {}): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      // Replace variables in content
      let processedContent = content;
      let processedSubject = subject;

      for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{{${key}}}`;
        processedContent = processedContent.replace(new RegExp(placeholder, 'g'), value as string);
        processedSubject = processedSubject.replace(new RegExp(placeholder, 'g'), value as string);
      }

      const mailOptions = {
        from: `${this.config.fromName} <${config.fromEmail}>`,
        to,
        subject: processedSubject,
        html: processedContent,
        headers: {
          'X-Priority': '3',
          'X-Mailer': 'Deligate Growth Bot'
        }
      };

      const info = await this.transporter.sendMail(mailOptions);

      // Track the email
      await query(`
        INSERT INTO analytics_events (event_type, properties, created_at)
        VALUES ('email_sent', $1, NOW())
      `, [JSON.stringify({
        to,
        subject: processedSubject,
        messageId: info.messageId
      })]);

      return {
        success: true,
        messageId: info.messageId
      };

    } catch (error: any) {
      console.error('Error sending email:', error);

      await query(`
        INSERT INTO analytics_events (event_type, properties, created_at)
        VALUES ('email_failed', $1, NOW())
      `, [JSON.stringify({
        to,
        subject,
        error: error.message
      })]);

      return {
        success: false,
        error: error.message
      };
    }
  }

  async scrapeCrunchbaseStartups(): Promise<void> {
    console.log('💼 Starting Crunchbase scraping...');

    // This is a simplified scraper. In production, you'd use Crunchbase API or a proper scraping service
    const aiStartups = [
      {
        name: 'AI Vision Labs',
        website: 'aivisionlabs.com',
        description: 'Computer vision startup for autonomous vehicles',
        industry: 'Computer Vision',
        founded_year: 2021,
        employee_count: '11-50',
        funding_stage: 'Series A',
        total_funding: 5000000,
        contacts: {
          ceo: 'john.smith@aivisionlabs.com',
          cto: 'sarah.jones@aivisionlabs.com'
        }
      },
      {
        name: 'Neural Health AI',
        website: 'neuralhealth.ai',
        description: 'AI-powered medical diagnosis platform',
        industry: 'Healthcare AI',
        founded_year: 2020,
        employee_count: '51-100',
        funding_stage: 'Series B',
        total_funding: 15000000,
        contacts: {
          ceo: 'dr.mike@neuralhealth.ai',
          head_of_ml: 'lisa.chen@neuralhealth.ai'
        }
      },
      {
        name: 'FinTech Analytics',
        website: 'fintechanalytics.io',
        description: 'Machine learning for financial fraud detection',
        industry: 'FinTech',
        founded_year: 2019,
        employee_count: '101-250',
        funding_stage: 'Series A',
        total_funding: 8000000,
        contacts: {
          ceo: 'alex@fintechanalytics.io',
          cto: 'maria@fintechanalytics.io'
        }
      }
    ];

    for (const startup of aiStartups) {
      await this.saveScrapedCompany(startup);
    }

    console.log(`Scraped ${aiStartups.length} AI startups from Crunchbase`);
  }

  private async saveScrapedCompany(company: any): Promise<void> {
    try {
      await query(`
        INSERT INTO scraped_companies
        (company_name, website, description, industry, founded_year, employee_count, funding_stage, total_funding, contacts)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (company_name) DO UPDATE SET
          last_verified = NOW(),
          contacts = EXCLUDED.contacts
      `, [
        company.name,
        company.website,
        company.description,
        company.industry,
        company.founded_year,
        company.employee_count,
        company.funding_stage,
        company.total_funding,
        JSON.stringify(company.contacts)
      ]);
    } catch (error) {
      console.error(`Error saving company ${company.name}:`, error);
    }
  }

  async processEmailCampaign(): Promise<void> {
    console.log('📧 Processing email campaign...');

    // Get companies to email (50 per day limit)
    const companies = await query(`
      SELECT *
      FROM scraped_companies
      WHERE status = 'new'
        AND contacts IS NOT NULL
      ORDER BY total_funding DESC, employee_count DESC
      LIMIT 50
    `);

    let emailsSent = 0;

    for (const company of companies.rows) {
      const contacts = company.contacts;

      // Try CEO first, then CTO
      const emails = [
        { email: contacts.ceo, name: 'CEO', role: 'CEO' },
        { email: contacts.cto, name: 'CTO', role: 'CTO' },
        { email: contacts.head_of_ml, name: 'Head of ML', role: 'Head of ML' }
      ].filter(c => c.email);

      for (const contact of emails) {
        if (emailsSent >= 50) break;

        // Check if already contacted
        const alreadyContacted = await query(
          'SELECT id FROM leads WHERE email = $1',
          [contact.email]
        );

        if (alreadyContacted.rows.length > 0) {
          continue;
        }

        // Create lead
        const leadResult = await query(`
          INSERT INTO leads (email, name, company, source, source_details, lead_score, status, tags)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id
        `, [
          contact.email,
          contact.name,
          company.company_name,
          'cold_email',
          JSON.stringify({
            role: contact.role,
            industry: company.industry,
            funding_stage: company.funding_stage,
            employee_count: company.employee_count,
            total_funding: company.total_funding,
            website: company.website
          }),
          this.calculateLeadScore(company),
          'new',
          ['cold_email', 'ai_startup', company.industry.toLowerCase()]
        ]);

        const leadId = leadResult.rows[0].id;

        // Send personalized email
        const emailSent = await this.sendPersonalizedEmail(contact, company, leadId);

        if (emailSent) {
          emailsSent++;

          // Update company status
          await query(
            'UPDATE scraped_companies SET status = $1 WHERE id = $2',
            ['contacted', company.id]
          );

          // Update lead status
          await query(
            'UPDATE leads SET status = $1, first_contact_at = NOW() WHERE id = $2',
            ['contacted', leadId]
          );

          // Add delay between emails
          await new Promise(resolve => setTimeout(resolve, Math.random() * 30000 + 30000)); // 30-60 seconds
        }
      }
    }

    console.log(`Email campaign complete: ${emailsSent} emails sent`);
  }

  private calculateLeadScore(company: any): number {
    let score = 10; // Base score

    // Funding stage scoring
    if (company.funding_stage === 'Series A') score += 20;
    else if (company.funding_stage === 'Series B') score += 30;
    else if (company.funding_stage === 'Series C+') score += 40;

    // Company size scoring
    if (company.employee_count === '11-50') score += 10;
    else if (company.employee_count === '51-100') score += 15;
    else if (company.employee_count === '101-250') score += 20;
    else if (company.employee_count === '251-500') score += 25;

    // Industry scoring
    if (company.industry.includes('Healthcare') || company.industry.includes('FinTech')) {
      score += 15;
    }

    // Total funding
    score += Math.min(company.total_funding / 1000000, 20); // Up to 20 points for funding

    return Math.min(score, 100);
  }

  private async sendPersonalizedEmail(contact: any, company: any, leadId: number): Promise<boolean> {
    try {
      const templates = await this.getTemplatesForCompany(company);

      if (templates.length === 0) return false;

      const template = templates[0];

      // Personalize content
      const variables = {
        name: contact.name.split(' ')[0],
        company: company.company_name,
        role: contact.role,
        industry: company.industry,
        funding_stage: company.funding_stage
      };

      const result = await this.sendEmail(
        contact.email,
        template.subject,
        template.content,
        variables
      );

      if (result.success) {
        // Save to email sequences
        await query(`
          INSERT INTO email_sequences
          (lead_id, sequence_step, template_name, subject, content, sent_at, status, metadata)
          VALUES ($1, 1, $2, $3, $4, NOW(), 'sent', $5)
        `, [
          leadId,
          template.name,
          template.subject,
          template.content,
          JSON.stringify({
            messageId: result.messageId,
            templateId: template.id,
            variables
          })
        ]);

        return true;
      }

      return false;
    } catch (error) {
      console.error(`Error sending email to ${contact.email}:`, error);
      return false;
    }
  }

  private async getTemplatesForCompany(company: any): Promise<EmailTemplate[]> {
    const templates: EmailTemplate[] = [
      {
        id: 'cold_outreach_1',
        name: 'cold_outreach_1',
        subject: 'AI data labeling for {{company}}',
        content: `
          <p>Hi {{name}},</p>

          <p>I noticed {{company}} is working in the {{industry}} space and recently raised {{funding_stage}} funding. Getting quality labeled data is often the biggest bottleneck in ML development.</p>

          <p>Our platform at labelmint.it uses AI to reduce labeling costs by 40% while maintaining 99%+ accuracy. We help companies like yours scale their ML initiatives faster.</p>

          <p>We're offering 100 free labels for you to test our platform - no credit card required.</p>

          <p>Would you be open to a quick 15-minute demo next week?</p>

          <p>Best regards,<br>
          Growth Team<br>
          <a href="https://labelmint.it">labelmint.it</a></p>
        `,
        variables: ['name', 'company', 'industry', 'funding_stage']
      },
      {
        id: 'cold_outreach_2',
        name: 'cold_outreach_2',
        subject: 'Training data solutions for {{company}}',
        content: `
          <p>Hi {{name}},</p>

          <p>As the {{role}} at {{company}}, you're likely dealing with the challenge of creating high-quality training datasets at scale.</p>

          <p>We've helped over 50 AI companies reduce their data labeling costs by 40% using our hybrid AI-human approach. Our clients typically see 3x faster turnaround while maintaining 99%+ accuracy.</p>

          <p>I'd love to show you how we could help {{company}} accelerate your ML development.</p>

          <p>Are you available for a brief chat next Tuesday or Thursday?</p>

          <p>Best,<br>
          {{name}}<br>
          Business Development<br>
          labelmint.it</p>
        `,
        variables: ['name', 'company', 'role']
      }
    ];

    // Filter based on company attributes
    if (company.industry.includes('Healthcare')) {
      templates.unshift({
        id: 'healthcare_specific',
        name: 'healthcare_specific',
        subject: 'Medical AI data labeling for {{company}}',
        content: `
          <p>Hi {{name}},</p>

          <p>I saw {{company}}'s work in medical AI. Accurate labeled data is especially critical in healthcare - both for model performance and regulatory compliance.</p>

          <p>We specialize in healthcare data labeling with HIPAA-compliant processes and medical expert reviewers. Our platform has helped medical AI companies reduce annotation costs by 40% while maintaining 99.5%+ accuracy.</p>

          <p>Would you be interested in learning how we can support your data needs?</p>

          <p>Best regards,<br>
          Healthcare Solutions Team<br>
          labelmint.it</p>
        `,
        variables: ['name', 'company']
      });
    }

    return templates;
  }

  async sendFollowUpEmails(): Promise<void> {
    console.log('📬 Processing follow-up emails...');

    // Get leads that need follow-up (7 days after last email)
    const leads = await query(`
      SELECT DISTINCT ON (l.id)
        l.*,
        es.sent_at as last_email_at,
        es.sequence_step
      FROM leads l
      JOIN email_sequences es ON l.id = es.lead_id
      WHERE l.status = 'contacted'
        AND es.sent_at < NOW() - INTERVAL '7 days'
        AND es.sequence_step < 3
        AND NOT EXISTS (
          SELECT 1 FROM email_sequences es2
          WHERE es2.lead_id = l.id
            AND es2.sequence_step > es.sequence_step
            AND es2.status != 'failed'
        )
      ORDER BY l.id, es.sent_at DESC
    `);

    for (const lead of leads.rows) {
      await this.sendFollowUp(lead, lead.sequence_step + 1);
    }

    console.log(`Processed ${leads.rows.length} follow-up emails`);
  }

  private async sendFollowUp(lead: any, step: number): Promise<void> {
    const followUpTemplates = {
      2: {
        subject: 'Re: AI data labeling solution',
        content: `
          <p>Hi {{name}},</p>

          <p>Following up on my email from last week about data labeling solutions for {{company}}.</p>

          <p>Quick question: What's your current process for handling training data? Many companies we work with are initially managing annotation in-house before realizing the cost and quality benefits of specialized platforms.</p>

          <p>Our free trial still includes 100 labels - no strings attached.</p>

          <p>Best,<br>
          Growth Team<br>
          labelmint.it</p>
        `
      },
      3: {
        subject: 'Final follow-up: Data labeling partnership',
        content: `
          <p>Hi {{name}},</p>

          <p>Last follow-up from me about this. If now's not the right time, no worries at all.</p>

          <p>Just wanted to share that we recently helped a {{industry}} company similar to {{company}} reduce their data preparation time by 70%. Case study here if interested: <a href="https://labelmint.it/case-studies">labelmint.it/case-studies</a></p>

          <p>Feel free to reach out if your needs change. Wishing you the best with your ML initiatives.</p>

          <p>Best regards,<br>
          labelmint.it Team</p>
        `
      }
    };

    const template = followUpTemplates[step as keyof typeof followUpTemplates];
    if (!template) return;

    const variables = {
      name: lead.name?.split(' ')[0] || 'there',
      company: lead.company || 'your company',
      industry: lead.source_details?.industry || 'AI'
    };

    const result = await this.sendEmail(lead.email, template.subject, template.content, variables);

    if (result.success) {
      await query(`
        INSERT INTO email_sequences
        (lead_id, sequence_step, template_name, subject, content, sent_at, status)
        VALUES ($1, $2, $3, $4, $5, NOW(), 'sent')
      `, [lead.id, step, `follow_up_${step}`, template.subject, template.content]);
    }
  }

  async getEmailAnalytics(): Promise<any> {
    const result = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'sent') as emails_sent,
        COUNT(*) FILTER (WHERE status = 'opened') as emails_opened,
        COUNT(*) FILTER (WHERE status = 'clicked') as emails_clicked,
        COUNT(*) FILTER (WHERE status = 'replied') as emails_replied,
        COUNT(DISTINCT lead_id) as unique_leads,
        AVG(CASE WHEN opened_at IS NOT NULL AND sent_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (opened_at - sent_at))/3600
          ELSE NULL END) as avg_hours_to_open
      FROM email_sequences
      WHERE sent_at >= CURRENT_DATE - INTERVAL '7 days'
    `);

    const campaignStats = await query(`
      SELECT
        c.name as campaign_name,
        c.type as campaign_type,
        COUNT(es.id) as emails_sent,
        COUNT(DISTINCT es.lead_id) as leads_contacted,
        COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'converted') as conversions
      FROM campaigns c
      LEFT JOIN email_sequences es ON es.campaign_id = c.id
      LEFT JOIN leads l ON l.id = es.lead_id
      WHERE c.start_date >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY c.id, c.name, c.type
      ORDER BY conversions DESC
    `);

    return {
      weekly: result.rows[0],
      campaigns: campaignStats.rows
    };
  }
}

export default EmailService;