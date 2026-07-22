/**
 * Mailer — unified sender supporting 3 providers.
 *
 *   smtp     → nodemailer (any SMTP server: Gmail, SES SMTP, Postfix, ...)
 *   mailgun  → Mailgun HTTPS API (mailgun.js + form-data)
 *   sendgrid → SendGrid HTTPS API (@sendgrid/mail)
 *
 * Provider + credentials are read from system_configs (keys defined below).
 * Configure via Admin UI at /system/mail.
 *
 * Mailgun + SendGrid are preferred for production — they have:
 *  - higher deliverability (warmed IPs, DKIM)
 *  - simpler ops (no STARTTLS / port 25 firewalling)
 *  - usage dashboards
 *
 * SMTP remains for self-hosted Postfix or quick Gmail test.
 */

import { prisma } from "@/lib/prisma";

export type MailProvider = "smtp" | "mailgun" | "sendgrid" | "brevo";

export interface MailMessage {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

export interface MailResult {
  ok: boolean;
  provider: MailProvider;
  id?: string;
  error?: string;
}

const CONFIG_KEYS = [
  "mail_provider",      // smtp | mailgun | sendgrid | brevo
  "smtp_host",
  "smtp_port",
  "smtp_user",
  "smtp_password",
  "smtp_secure",        // "true" for 465 SSL, else STARTTLS
  "smtp_from",
  "smtp_from_name",
  "smtp_reply_to",
  "mailgun_api_key",
  "mailgun_domain",
  "mailgun_region",     // "us" (default) or "eu"
  "sendgrid_api_key",
  "brevo_api_key",      // Brevo (Sendinblue) transactional email — HTTPS API (port 443)
] as const;

export type MailConfigKey = (typeof CONFIG_KEYS)[number];
export type MailConfig = Partial<Record<MailConfigKey, string>>;

/** Read all mail-related config from system_configs into a plain object. */
export async function loadMailConfig(): Promise<MailConfig> {
  const rows = await prisma.systemConfig.findMany({
    where: { key: { in: CONFIG_KEYS as unknown as string[] } },
  });
  const out: MailConfig = {};
  for (const r of rows) out[r.key as MailConfigKey] = r.value;
  return out;
}

/** Persist a partial mail config. Only known keys are written. */
export async function saveMailConfig(input: Record<string, unknown>): Promise<void> {
  for (const key of CONFIG_KEYS) {
    if (input[key] === undefined) continue;
    const value = String(input[key] ?? "");
    await prisma.systemConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value, label: humanLabel(key) },
    });
  }
}

function humanLabel(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Send a message via the configured provider.
 * Throws if config is incomplete. Returns provider's message-id on success.
 */
export async function sendMail(msg: MailMessage): Promise<MailResult> {
  const cfg = await loadMailConfig();
  const provider = (cfg.mail_provider as MailProvider) || "smtp";
  
  // Format From header dynamically: e.g. "From Name <smtp_from>" or just "smtp_from"
  let from = msg.from || cfg.smtp_from || "noreply@vinhgiang.com";
  if (!msg.from && cfg.smtp_from_name && cfg.smtp_from) {
    from = `"${cfg.smtp_from_name}" <${cfg.smtp_from}>`;
  }
  const replyTo = cfg.smtp_reply_to || undefined;

  try {
    if (provider === "sendgrid") {
      if (!cfg.sendgrid_api_key) throw new Error("Thiếu sendgrid_api_key.");
      // Lazy import — keeps SDK out of cold-start cost when other providers active.
      const sg = (await import("@sendgrid/mail")).default;
      sg.setApiKey(cfg.sendgrid_api_key);
      const [resp] = await sg.send({
        to: msg.to,
        from,
        subject: msg.subject,
        html: msg.html,
        text: msg.text ?? stripHtml(msg.html ?? ""),
        replyTo,
      });
      return {
        ok: true,
        provider,
        id: resp.headers?.["x-message-id"],
      };
    }

    if (provider === "brevo") {
      if (!cfg.brevo_api_key) throw new Error("Thiếu brevo_api_key.");
      const sender = parseFrom(from);
      const recipients = (Array.isArray(msg.to) ? msg.to : [msg.to]).map((email) => ({ email }));
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": cfg.brevo_api_key,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          sender: { email: sender.email, name: cfg.smtp_from_name || sender.name || "WMS Vĩnh Giang" },
          to: recipients,
          subject: msg.subject,
          htmlContent: msg.html,
          textContent: msg.text ?? stripHtml(msg.html ?? ""),
          replyTo: replyTo ? { email: replyTo } : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Brevo API ${res.status}: ${body.slice(0, 200)}`);
      }
      const data = (await res.json().catch(() => ({}))) as { messageId?: string };
      return { ok: true, provider, id: data.messageId };
    }

    if (provider === "mailgun") {
      if (!cfg.mailgun_api_key || !cfg.mailgun_domain) {
        throw new Error("Thiếu mailgun_api_key hoặc mailgun_domain.");
      }
      const formData = (await import("form-data")).default;
      const Mailgun = (await import("mailgun.js")).default;
      const mailgun = new Mailgun(formData);
      const mg = mailgun.client({
        username: "api",
        key: cfg.mailgun_api_key,
        url:
          cfg.mailgun_region === "eu"
            ? "https://api.eu.mailgun.net"
            : "https://api.mailgun.net",
      });
      const resp = await mg.messages.create(cfg.mailgun_domain, {
        from,
        to: Array.isArray(msg.to) ? msg.to : [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text ?? stripHtml(msg.html ?? ""),
        ...(replyTo ? { "h:Reply-To": replyTo } : {}),
      });
      return { ok: true, provider, id: resp.id };
    }

    // smtp (default)
    if (!cfg.smtp_host || !cfg.smtp_port) {
      throw new Error("Thiếu smtp_host hoặc smtp_port.");
    }
    const nodemailer = (await import("nodemailer")).default;
    const port = Number(cfg.smtp_port) || 587;
    const transporter = nodemailer.createTransport({
      host: cfg.smtp_host,
      port,
      secure: cfg.smtp_secure === "SSL" || cfg.smtp_secure === "true" || port === 465,
      auth: cfg.smtp_user
        ? { user: cfg.smtp_user, pass: cfg.smtp_password ?? "" }
        : undefined,
    });
    const info = await transporter.sendMail({
      from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text ?? stripHtml(msg.html ?? ""),
      replyTo,
    });
    return { ok: true, provider, id: info.messageId };
  } catch (err) {
    return {
      ok: false,
      provider,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Verify provider config by attempting a lightweight connection
 * (SMTP verify, Mailgun GET /domains, SendGrid no-op send to verify key).
 * Returns success status WITHOUT actually sending a message.
 */
export async function verifyMail(): Promise<MailResult> {
  const cfg = await loadMailConfig();
  const provider = (cfg.mail_provider as MailProvider) || "smtp";

  try {
    if (provider === "sendgrid") {
      if (!cfg.sendgrid_api_key) throw new Error("Thiếu sendgrid_api_key.");
      // SendGrid offers /v3/scopes for key validation
      const res = await fetch("https://api.sendgrid.com/v3/scopes", {
        headers: { Authorization: `Bearer ${cfg.sendgrid_api_key}` },
      });
      if (!res.ok) throw new Error(`SendGrid auth failed (HTTP ${res.status}).`);
      return { ok: true, provider };
    }

    if (provider === "brevo") {
      if (!cfg.brevo_api_key) throw new Error("Thiếu brevo_api_key.");
      // Brevo expose GET /v3/account để kiểm tra API key.
      const res = await fetch("https://api.brevo.com/v3/account", {
        headers: { "api-key": cfg.brevo_api_key, accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Brevo auth failed (HTTP ${res.status}).`);
      return { ok: true, provider };
    }

    if (provider === "mailgun") {
      if (!cfg.mailgun_api_key || !cfg.mailgun_domain) {
        throw new Error("Thiếu mailgun_api_key hoặc mailgun_domain.");
      }
      const base =
        cfg.mailgun_region === "eu"
          ? "https://api.eu.mailgun.net"
          : "https://api.mailgun.net";
      const auth = Buffer.from(`api:${cfg.mailgun_api_key}`).toString("base64");
      const res = await fetch(`${base}/v3/domains/${cfg.mailgun_domain}`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      if (!res.ok) {
        throw new Error(`Mailgun auth/domain check failed (HTTP ${res.status}).`);
      }
      return { ok: true, provider };
    }

    // smtp
    if (!cfg.smtp_host || !cfg.smtp_port) {
      throw new Error("Thiếu smtp_host hoặc smtp_port.");
    }
    const nodemailer = (await import("nodemailer")).default;
    const port = Number(cfg.smtp_port) || 587;
    const transporter = nodemailer.createTransport({
      host: cfg.smtp_host,
      port,
      secure: cfg.smtp_secure === "SSL" || cfg.smtp_secure === "true" || port === 465,
      auth: cfg.smtp_user
        ? { user: cfg.smtp_user, pass: cfg.smtp_password ?? "" }
        : undefined,
    });
    await transporter.verify();
    return { ok: true, provider };
  } catch (err) {
    return {
      ok: false,
      provider,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

/** Tách "Tên <email@x.com>" → { name, email }. Nếu chỉ có email → { email }. */
function parseFrom(from: string): { email: string; name?: string } {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1] || undefined, email: m[2].trim() };
  return { email: from.trim() };
}
