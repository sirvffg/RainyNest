// lib/mailer.ts — 统一邮件发送入口
// 插件 notifier 扩展点可以替换/增强这个实现
import nodemailer from 'nodemailer';
import { getSiteSetting } from './site';

let transporter: nodemailer.Transporter | null = null;

// 懒加载 SMTP 连接（第一次发邮件时才初始化）
async function getTransporter() {
  if (transporter) return transporter;

  const site = await getSiteSetting();
  if (!site?.smtpHost) {
    throw new Error('SMTP 未配置，请在后台系统设置里填写 SMTP 信息');
  }

  transporter = nodemailer.createTransport({
    host: site.smtpHost,
    port: site.smtpPort || 587,
    secure: (site.smtpPort || 587) === 465,
    auth: site.smtpUser
      ? { user: site.smtpUser, pass: site.smtpPass ?? undefined }
      : undefined,
  });

  return transporter;
}

export async function sendMail(
  to: string | string[],
  opts: { subject: string; html?: string; text?: string; replyTo?: string; scene?: string }
) {
  // 插件 notifier 扩展点优先（邮件/Webhook/短信等自定义通道）
  try {
    const { getPluginNotifier } = await import('./plugin/engine');
    const notifier = await getPluginNotifier();
    if (notifier) {
      const r = await notifier.send({ to, ...opts });
      if (r.ok) return { ok: true, messageId: r.messageId };
    }
  } catch { /* 插件系统未就绪 → 回退 SMTP */ }

  try {
    const t = await getTransporter();
    const site = await getSiteSetting();

    const info = await t.sendMail({
      from: site?.smtpFrom || site?.email || 'rainynest@localhost',
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      replyTo: opts.replyTo,
    });

    console.log(`[Mailer] ✓ Sent to ${Array.isArray(to) ? to.join(', ') : to} (${info.messageId})`);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error('[Mailer] ✗ Failed:', err);
    return { ok: false, error: (err as Error).message };
  }
}

// 常用业务场景封装
export const mailScenes = {
  commentApproved: (to: string, postTitle: string, commentContent: string) =>
    sendMail(to, {
      subject: `你的评论已通过审核 - ${postTitle}`,
      html: `<p>你在文章 <strong>${postTitle}</strong> 下的评论已通过审核。</p><blockquote>${commentContent}</blockquote>`,
    }),

  newCommentPending: async (postTitle: string, commenterEmail: string, content: string) => {
    const site = await getSiteSetting();
    if (!site?.email) return null;
    return sendMail(site.email, {
      subject: `新评论待审核 - ${postTitle}`,
      html: `<p><strong>${commenterEmail}</strong> 在 <em>${postTitle}</em> 下发表了评论：</p><blockquote>${content}</blockquote><p><a href="${site.url}/console/comments">去审核</a></p>`,
    });
  },

  emailVerification: (to: string, code: string, siteName: string) =>
    sendMail(to, {
      subject: `【${siteName}】邮箱验证码`,
      html: `<p>你的验证码是：<strong style="font-size: 24px; letter-spacing: 4px;">${code}</strong></p><p>5 分钟内有效，请勿泄露给他人。</p>`,
    }),
};

// SMTP 连接测试（后台"测试连接"按钮调用）
export async function testSmtpConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const t = await getTransporter();
    await t.verify();
    return { ok: true, message: 'SMTP 连接成功' };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}
