import { Resend } from 'resend';
import { env } from '../config/env.js';
import prisma from './prisma.js';

// Initialisation lazy — ne pas créer le client si pas de clé API
let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(env.RESEND_API_KEY);
  return _resend;
}

// Cooldown en mémoire : userId → timestamp dernier email envoyé
const emailCooldown = new Map<number, number>();
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export async function sendNewMessageNotification(
  receiverId: number,
  receiverEmail: string,
  receiverName: string,
  senderName: string,
  messagePreview: string
): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  console.log(`[email] sendNewMessageNotification to ${receiverEmail} (id=${receiverId})`);

  const lastSent = emailCooldown.get(receiverId);
  if (lastSent && Date.now() - lastSent < COOLDOWN_MS) {
    console.log(`[email] Skipped (cooldown, ${Math.round((COOLDOWN_MS - (Date.now() - lastSent)) / 1000)}s remaining)`);
    return;
  }

  emailCooldown.set(receiverId, Date.now());

  const preview = messagePreview.length > 120
    ? messagePreview.substring(0, 120) + '...'
    : messagePreview;

  try {
    console.log(`[email] Sending via Resend to ${receiverEmail}...`);
    await resend.emails.send({
      from: 'Weekook <notifications@weekook.com>',
      to: receiverEmail,
      subject: `Nouveau message de ${senderName} sur Weekook`,
      html: `
        <div style="font-family: Inter, Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #f2f4fc; padding: 32px 16px;">
          <div style="background: white; border-radius: 20px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; background: #c1a0fd; border-radius: 50%; width: 48px; height: 48px; line-height: 48px; text-align: center; font-size: 24px;">💬</div>
            </div>
            <h2 style="color: #111125; font-size: 20px; font-weight: 700; margin: 0 0 8px 0;">
              Nouveau message de ${senderName}
            </h2>
            <p style="color: #6b7280; font-size: 14px; margin: 0 0 20px 0;">
              Bonjour ${receiverName}, vous avez reçu un nouveau message sur Weekook.
            </p>
            <div style="background: #f3ecff; border-left: 4px solid #c1a0fd; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="color: #111125; font-size: 15px; margin: 0; font-style: italic;">"${preview}"</p>
            </div>
            <a href="${env.APP_URL}/messages" style="display: block; text-align: center; background: #c1a0fd; color: white; text-decoration: none; padding: 14px 24px; border-radius: 12px; font-weight: 600; font-size: 15px;">
              Répondre au message
            </a>
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 20px 0 0 0;">
              Weekook — La cuisine à domicile réinventée
            </p>
          </div>
        </div>
      `,
    });
    console.log(`[email] Sent OK to ${receiverEmail}`);
  } catch (err) {
    // Email failure ne doit pas impacter la réponse API
    console.error('[email] Failed to send notification:', err);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

function emailWrapper(icon: string, title: string, body: string, ctaUrl: string, ctaLabel: string): string {
  return `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #f2f4fc; padding: 32px 16px;">
      <div style="background: white; border-radius: 20px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; background: #c1a0fd; border-radius: 50%; width: 48px; height: 48px; line-height: 48px; text-align: center; font-size: 24px;">${icon}</div>
        </div>
        <h2 style="color: #111125; font-size: 20px; font-weight: 700; margin: 0 0 16px 0;">${title}</h2>
        ${body}
        <a href="${ctaUrl}" style="display: block; text-align: center; background: #c1a0fd; color: white; text-decoration: none; padding: 14px 24px; border-radius: 12px; font-weight: 600; font-size: 15px; margin-top: 24px;">
          ${ctaLabel}
        </a>
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 20px 0 0 0;">
          Weekook — La cuisine à domicile réinventée
        </p>
      </div>
    </div>`;
}

function infoBox(rows: { label: string; value: string }[]): string {
  const items = rows.map(r =>
    `<tr><td style="color:#6b7280;font-size:13px;padding:4px 0;width:140px;">${r.label}</td><td style="color:#111125;font-size:13px;font-weight:600;padding:4px 0;">${r.value}</td></tr>`
  ).join('');
  return `<table style="background:#f3ecff;border-radius:12px;padding:16px;width:100%;border-collapse:collapse;margin-bottom:8px;">${items}</table>`;
}

async function sendEmail(to: string, subject: string, html: string, label: string): Promise<void> {
  const resend = getResend();
  if (!resend) return;
  try {
    console.log(`[email] Sending "${label}" to ${to}...`);
    await resend.emails.send({ from: 'Weekook <notifications@weekook.com>', to, subject, html });
    console.log(`[email] Sent OK: "${label}" to ${to}`);
  } catch (err) {
    console.error(`[email] Failed "${label}" to ${to}:`, err);
  }
}

// ─── Password reset ───────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(
  userEmail: string,
  userName: string,
  resetUrl: string
): Promise<void> {
  const html = emailWrapper(
    '🔑',
    `Réinitialisez votre mot de passe`,
    `<p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">Bonjour ${userName}, vous avez demandé à réinitialiser votre mot de passe Weekook.</p>
    <p style="color:#6b7280;font-size:13px;margin:0 0 16px 0;">Ce lien est valable <strong>1 heure</strong>. Si vous n'avez pas fait cette demande, ignorez cet email.</p>`,
    resetUrl,
    'Réinitialiser mon mot de passe'
  );
  await sendEmail(userEmail, 'Réinitialisation de votre mot de passe Weekook', html, 'password-reset');
}

// ─── Booking notifications ────────────────────────────────────────────────────

export async function sendBookingRequestToKooker(
  kookerEmail: string,
  kookerName: string,
  clientName: string,
  serviceName: string,
  date: Date | string,
  startTime: string,
  guests: number,
  totalPriceInCents: number
): Promise<void> {
  const html = emailWrapper(
    '📅',
    `Nouvelle demande de réservation`,
    `<p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">Bonjour ${kookerName}, <strong>${clientName}</strong> souhaite réserver votre prestation.</p>
    ${infoBox([
      { label: 'Prestation', value: serviceName },
      { label: 'Date', value: formatDate(date) },
      { label: 'Heure', value: startTime },
      { label: 'Convives', value: String(guests) },
      { label: 'Montant total', value: formatPrice(totalPriceInCents) },
    ])}
    <p style="color:#6b7280;font-size:13px;margin:12px 0 0 0;">Connectez-vous pour accepter ou refuser cette réservation.</p>`,
    `${env.APP_URL}/tableau-de-bord`,
    'Voir la réservation'
  );
  await sendEmail(kookerEmail, `Nouvelle réservation de ${clientName} — ${serviceName}`, html, 'booking-request');
}

export async function sendBookingConfirmedToUser(
  userEmail: string,
  userName: string,
  kookerName: string,
  serviceName: string,
  date: Date | string,
  startTime: string,
  guests: number,
  totalPriceInCents: number
): Promise<void> {
  const html = emailWrapper(
    '✅',
    `Votre réservation est confirmée !`,
    `<p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">Bonjour ${userName}, <strong>${kookerName}</strong> a accepté votre demande. C'est officiel !</p>
    ${infoBox([
      { label: 'Prestation', value: serviceName },
      { label: 'Kooker', value: kookerName },
      { label: 'Date', value: formatDate(date) },
      { label: 'Heure', value: startTime },
      { label: 'Convives', value: String(guests) },
      { label: 'Montant total', value: formatPrice(totalPriceInCents) },
    ])}`,
    `${env.APP_URL}/tableau-de-bord`,
    'Voir mes réservations'
  );
  await sendEmail(userEmail, `Réservation confirmée — ${serviceName} avec ${kookerName}`, html, 'booking-confirmed');
}

export async function sendBookingCancelledToUser(
  userEmail: string,
  userName: string,
  kookerName: string,
  serviceName: string,
  date: Date | string
): Promise<void> {
  const html = emailWrapper(
    '❌',
    `Réservation annulée`,
    `<p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">Bonjour ${userName}, <strong>${kookerName}</strong> a annulé votre réservation pour la prestation <strong>${serviceName}</strong> du <strong>${formatDate(date)}</strong>.</p>
    <p style="color:#6b7280;font-size:13px;margin:0;">Vous pouvez rechercher un autre kooker disponible.</p>`,
    `${env.APP_URL}/recherche`,
    'Trouver un autre kooker'
  );
  await sendEmail(userEmail, `Réservation annulée — ${serviceName}`, html, 'booking-cancelled-to-user');
}

export async function sendBookingModifiedToKooker(
  kookerEmail: string,
  kookerName: string,
  clientName: string,
  serviceName: string,
  changes: string,
  bookingId: number
): Promise<void> {
  const changesHtml = changes.split('\n').map(c =>
    `<li style="color:#111125;font-size:13px;padding:3px 0;">${c}</li>`
  ).join('');
  const html = emailWrapper(
    '✏️',
    `Réservation modifiée par le client`,
    `<p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">Bonjour ${kookerName}, <strong>${clientName}</strong> a modifié sa réservation pour <strong>${serviceName}</strong>.</p>
    <div style="background:#f3ecff;border-radius:12px;padding:16px;margin-bottom:8px;">
      <p style="color:#6b7280;font-size:12px;margin:0 0 8px 0;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Modifications</p>
      <ul style="margin:0;padding-left:16px;">${changesHtml}</ul>
    </div>`,
    `${env.APP_URL}/reservation/${bookingId}`,
    'Voir la réservation'
  );
  await sendEmail(kookerEmail, `Réservation modifiée par ${clientName} — ${serviceName}`, html, 'booking-modified-to-kooker');
}

export async function sendBookingModifiedToUser(
  userEmail: string,
  userName: string,
  kookerName: string,
  serviceName: string,
  changes: string,
  bookingId: number
): Promise<void> {
  const changesHtml = changes.split('\n').map(c =>
    `<li style="color:#111125;font-size:13px;padding:3px 0;">${c}</li>`
  ).join('');
  const html = emailWrapper(
    '✏️',
    `Votre réservation a été modifiée`,
    `<p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">Bonjour ${userName}, <strong>${kookerName}</strong> a modifié votre réservation pour <strong>${serviceName}</strong>.</p>
    <div style="background:#f3ecff;border-radius:12px;padding:16px;margin-bottom:8px;">
      <p style="color:#6b7280;font-size:12px;margin:0 0 8px 0;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Modifications</p>
      <ul style="margin:0;padding-left:16px;">${changesHtml}</ul>
    </div>`,
    `${env.APP_URL}/reservation/${bookingId}`,
    'Voir la réservation'
  );
  await sendEmail(userEmail, `Réservation modifiée par ${kookerName} — ${serviceName}`, html, 'booking-modified-to-user');
}

export async function sendBookingCancelledToKooker(
  kookerEmail: string,
  kookerName: string,
  clientName: string,
  serviceName: string,
  date: Date | string
): Promise<void> {
  const html = emailWrapper(
    '❌',
    `Réservation annulée par le client`,
    `<p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">Bonjour ${kookerName}, <strong>${clientName}</strong> a annulé sa réservation pour la prestation <strong>${serviceName}</strong> du <strong>${formatDate(date)}</strong>.</p>`,
    `${env.APP_URL}/tableau-de-bord`,
    'Voir mon planning'
  );
  await sendEmail(kookerEmail, `Annulation de ${clientName} — ${serviceName}`, html, 'booking-cancelled-to-kooker');
}

// ─── Kooker pending reminders ─────────────────────────────────────────────────

export async function sendPendingReminderToKooker1(
  kookerEmail: string,
  kookerName: string,
  clientName: string,
  serviceTitle: string,
  date: Date | string
): Promise<void> {
  const html = emailWrapper(
    '📅',
    `Nouvelle demande en attente`,
    `<p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">Bonjour ${kookerName}, <strong>${clientName}</strong> vous a envoyé une demande de réservation pour <strong>${serviceTitle}</strong> le <strong>${formatDate(date)}</strong>.</p>
    <p style="color:#6b7280;font-size:13px;margin:0;">Connectez-vous pour accepter ou refuser cette demande.</p>`,
    `${env.APP_URL}/tableau-de-bord`,
    'Voir la demande'
  );
  await sendEmail(kookerEmail, `Demande en attente — ${serviceTitle}`, html, 'pending-reminder-1');
}

export async function sendPendingReminderToKooker2(
  kookerEmail: string,
  kookerName: string,
  clientName: string,
  serviceTitle: string,
  date: Date | string
): Promise<void> {
  const html = emailWrapper(
    '⏰',
    `Répondez sous 48h`,
    `<p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">Bonjour ${kookerName}, la demande de <strong>${clientName}</strong> pour <strong>${serviceTitle}</strong> le <strong>${formatDate(date)}</strong> est toujours en attente.</p>
    <p style="color:#6b7280;font-size:13px;margin:0;">Merci de répondre sous <strong>48 heures</strong>, sinon la réservation sera automatiquement annulée.</p>`,
    `${env.APP_URL}/tableau-de-bord`,
    'Répondre maintenant'
  );
  await sendEmail(kookerEmail, `Rappel — Répondez à ${clientName} pour ${serviceTitle}`, html, 'pending-reminder-2');
}

export async function sendPendingReminderToKooker3(
  kookerEmail: string,
  kookerName: string,
  clientName: string,
  serviceTitle: string,
  date: Date | string
): Promise<void> {
  const html = emailWrapper(
    '⚠️',
    `Dernier rappel — annulation dans 24h`,
    `<p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">Bonjour ${kookerName}, c'est votre <strong>dernier rappel</strong> pour la demande de <strong>${clientName}</strong> pour <strong>${serviceTitle}</strong> le <strong>${formatDate(date)}</strong>.</p>
    <p style="color:#6b7280;font-size:13px;margin:0;">Sans réponse de votre part dans les <strong>24 prochaines heures</strong>, la réservation sera automatiquement annulée.</p>`,
    `${env.APP_URL}/tableau-de-bord`,
    'Répondre maintenant'
  );
  await sendEmail(kookerEmail, `Dernier rappel — ${serviceTitle} avec ${clientName}`, html, 'pending-reminder-3');
}

export async function sendBookingExpiredToUser(
  userEmail: string,
  userName: string,
  kookerName: string,
  serviceTitle: string,
  date: Date | string
): Promise<void> {
  const html = emailWrapper(
    '❌',
    `Réservation annulée — pas de réponse du kooker`,
    `<p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">Bonjour ${userName}, votre réservation pour <strong>${serviceTitle}</strong> le <strong>${formatDate(date)}</strong> avec <strong>${kookerName}</strong> a été automatiquement annulée.</p>
    <p style="color:#6b7280;font-size:13px;margin:0;">Le kooker n'a pas répondu dans le délai imparti. Votre pré-autorisation bancaire a été libérée — aucun montant n'a été débité.</p>`,
    `${env.APP_URL}/recherche`,
    'Trouver un autre kooker'
  );
  await sendEmail(userEmail, `Réservation annulée — ${serviceTitle}`, html, 'booking-expired-to-user');
}

export async function sendBookingExpiredToKooker(
  kookerEmail: string,
  kookerName: string,
  clientName: string,
  serviceTitle: string,
  date: Date | string
): Promise<void> {
  const html = emailWrapper(
    '❌',
    `Réservation annulée faute de réponse`,
    `<p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">Bonjour ${kookerName}, la réservation de <strong>${clientName}</strong> pour <strong>${serviceTitle}</strong> le <strong>${formatDate(date)}</strong> a été automatiquement annulée car vous n'avez pas répondu dans les 72 heures.</p>
    <p style="color:#6b7280;font-size:13px;margin:0;">Pensez à répondre rapidement aux prochaines demandes pour ne pas perdre de clients.</p>`,
    `${env.APP_URL}/tableau-de-bord`,
    'Voir mon tableau de bord'
  );
  await sendEmail(kookerEmail, `Réservation annulée — ${serviceTitle} avec ${clientName}`, html, 'booking-expired-to-kooker');
}

// ─── Post-prestation confirmation emails ─────────────────────────────────────

export async function sendConfirmationRequestToUser(
  userEmail: string,
  userName: string,
  kookerName: string,
  serviceName: string,
  date: Date | string,
  startTime: string,
  bookingId: number
): Promise<void> {
  const html = emailWrapper(
    '🔔',
    `Confirmez que la prestation a eu lieu`,
    `<p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">Bonjour ${userName}, la prestation <strong>${serviceName}</strong> avec <strong>${kookerName}</strong> est terminée.</p>
    ${infoBox([
      { label: 'Prestation', value: serviceName },
      { label: 'Date', value: formatDate(date) },
      { label: 'Heure', value: startTime },
    ])}
    <p style="color:#6b7280;font-size:13px;margin:12px 0 0 0;">Merci de confirmer que tout s'est bien passé. Sans action de votre part, la prestation sera automatiquement validée sous 48h.</p>`,
    `${env.APP_URL}/reservation/${bookingId}`,
    'Confirmer la prestation'
  );
  await sendEmail(userEmail, `Confirmez votre prestation — ${serviceName}`, html, 'confirmation-request');
}

export async function sendConfirmationReminder1ToUser(
  userEmail: string,
  userName: string,
  kookerName: string,
  serviceName: string,
  bookingId: number
): Promise<void> {
  const html = emailWrapper(
    '⏰',
    `Rappel : confirmez votre prestation`,
    `<p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">Bonjour ${userName}, n'oubliez pas de confirmer que la prestation <strong>${serviceName}</strong> avec <strong>${kookerName}</strong> a bien eu lieu.</p>
    <p style="color:#6b7280;font-size:13px;margin:0;">Sans confirmation, elle sera automatiquement validée dans <strong>24 heures</strong>.</p>`,
    `${env.APP_URL}/reservation/${bookingId}`,
    'Confirmer maintenant'
  );
  await sendEmail(userEmail, `Rappel — Confirmez votre prestation ${serviceName}`, html, 'confirmation-reminder-1');
}

export async function sendConfirmationReminder2ToUser(
  userEmail: string,
  userName: string,
  kookerName: string,
  serviceName: string,
  bookingId: number
): Promise<void> {
  const html = emailWrapper(
    '⚠️',
    `Dernier rappel avant validation automatique`,
    `<p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">Bonjour ${userName}, c'est votre <strong>dernier rappel</strong> pour confirmer la prestation <strong>${serviceName}</strong> avec <strong>${kookerName}</strong>.</p>
    <p style="color:#6b7280;font-size:13px;margin:0;">Elle sera automatiquement validée dans <strong>12 heures</strong> et le paiement sera versé au kooker.</p>`,
    `${env.APP_URL}/reservation/${bookingId}`,
    'Confirmer maintenant'
  );
  await sendEmail(userEmail, `Dernier rappel — ${serviceName}`, html, 'confirmation-reminder-2');
}

export async function sendAutoConfirmationToUser(
  userEmail: string,
  userName: string,
  kookerName: string,
  serviceName: string,
  bookingId: number
): Promise<void> {
  const html = emailWrapper(
    '✅',
    `Prestation validée automatiquement`,
    `<p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">Bonjour ${userName}, la prestation <strong>${serviceName}</strong> avec <strong>${kookerName}</strong> a été automatiquement validée après 48h.</p>
    <p style="color:#6b7280;font-size:13px;margin:0;">Le paiement va être versé au kooker. Vous pouvez encore laisser un avis sur votre expérience.</p>`,
    `${env.APP_URL}/reservation/${bookingId}`,
    'Laisser un avis'
  );
  await sendEmail(userEmail, `Prestation validée — ${serviceName}`, html, 'auto-confirmation');
}

export async function sendCompletionToKooker(
  kookerEmail: string,
  kookerName: string,
  clientName: string,
  serviceName: string,
  date: Date | string,
  totalPriceInCents: number
): Promise<void> {
  const html = emailWrapper(
    '💰',
    `Prestation confirmée — paiement en cours`,
    `<p style="color:#6b7280;font-size:14px;margin:0 0 16px 0;">Bonjour ${kookerName}, <strong>${clientName}</strong> a confirmé la réalisation de la prestation.</p>
    ${infoBox([
      { label: 'Prestation', value: serviceName },
      { label: 'Date', value: formatDate(date) },
      { label: 'Montant total', value: formatPrice(totalPriceInCents) },
    ])}
    <p style="color:#6b7280;font-size:13px;margin:12px 0 0 0;">Le paiement (moins la commission) va être versé sur votre compte Stripe.</p>`,
    `${env.APP_URL}/tableau-de-bord`,
    'Voir mon tableau de bord'
  );
  await sendEmail(kookerEmail, `Paiement en cours — ${serviceName}`, html, 'completion-to-kooker');
}

// ─── New review pending notification ─────────────────────────────────────────

export async function sendNewReviewPendingToAdmins(
  reviewerName: string,
  kookerName: string,
  rating: number,
  comment: string | undefined,
  kookerProfileId: number
): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: 'admin' },
    select: { email: true },
  });

  if (admins.length === 0) return;

  const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
  const commentHtml = comment
    ? `<div style="background:#f3ecff;border-left:4px solid #c1a0fd;border-radius:8px;padding:12px 16px;margin:12px 0;"><p style="color:#111125;font-size:14px;margin:0;font-style:italic;">"${comment}"</p></div>`
    : `<p style="color:#9ca3af;font-size:13px;margin:8px 0 0 0;">Aucun commentaire.</p>`;

  const html = emailWrapper(
    '⭐',
    'Nouvel avis à modérer',
    `<p style="color:#6b7280;font-size:14px;margin:0 0 12px 0;">
      <strong>${reviewerName}</strong> a laissé un avis sur le kooker <strong>${kookerName}</strong>.
    </p>
    ${infoBox([
      { label: 'Note', value: `${stars} (${rating}/5)` },
      { label: 'Auteur', value: reviewerName },
      { label: 'Kooker', value: kookerName },
    ])}
    ${commentHtml}
    <p style="color:#6b7280;font-size:13px;margin:8px 0 0 0;">Cet avis est en attente de validation. Approuvez-le ou supprimez-le depuis le panneau admin.</p>`,
    `${env.APP_URL}/admin/kookers`,
    'Modérer les avis'
  );

  for (const admin of admins) {
    await sendEmail(admin.email, `Nouvel avis à modérer — ${kookerName}`, html, 'review-pending');
  }
}

// ─── Kooker auto-validation notification ─────────────────────────────────────

export async function sendKookerAutoValidatedToAdmins(
  kookerName: string,
  kookerId: number
): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: 'admin' },
    select: { email: true },
  });

  if (admins.length === 0) return;

  const html = emailWrapper(
    '✅',
    'Kooker auto-validé',
    `<p style="color:#374151;font-size:14px;line-height:1.6;">
      Le kooker <strong>${kookerName}</strong> (#${String(kookerId).padStart(5, '0')}) a été automatiquement validé.
    </p>
    <p style="color:#6b7280;font-size:13px;margin-top:8px;">
      Toutes les conditions sont remplies : données complètes, au moins une spécialité, et identité vérifiée via Stripe.
    </p>`,
    `${env.APP_URL}/admin/kookers`,
    'Voir les kookers'
  );

  for (const admin of admins) {
    await sendEmail(admin.email, `Kooker auto-validé : ${kookerName}`, html, 'kooker-auto-validated');
  }
}
