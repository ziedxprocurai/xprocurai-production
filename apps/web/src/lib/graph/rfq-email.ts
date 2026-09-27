import { unitLabel } from '../rfq-constants';
import type { RfqRequestPayload } from '../rfq-payload';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHtmlMultiline(value: string): string {
  return escapeHtml(value).replace(/\r\n|\r|\n/g, '<br>');
}

function formatDateFr(dateStr: string): string {
  // 'YYYY-MM-DD' → 'dd/MM/yyyy'
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function formatBudget(amount: number, currency: string | null): string {
  const formatted = amount.toFixed(2);
  return currency ? `${formatted} ${currency}` : formatted;
}

interface DetailRow {
  label: string;
  value: string;
}

export function renderRfqEmail({
  reference,
  payload,
  attachmentNames,
  attachmentLinks = [],
}: {
  reference: string;
  payload: RfqRequestPayload;
  attachmentNames: string[];
  attachmentLinks?: { fileName: string; url: string }[];
}): { subject: string; html: string } {
  const subject = `[${reference}] ${payload.title}`
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, 250);

  const rows: DetailRow[] = [
    { label: 'RFQ Reference', value: escapeHtml(reference) },
    { label: 'RFQ Title', value: escapeHtml(payload.title) },
  ];
  if (payload.category) rows.push({ label: 'Category', value: escapeHtml(payload.category) });
  if (payload.itemName) {
    rows.push({ label: 'Item / Service', value: escapeHtml(payload.itemName) });
  }
  if (payload.quantity != null) {
    rows.push({ label: 'Quantity', value: escapeHtml(String(payload.quantity)) });
  }
  const unit = unitLabel(payload.unitOfMeasure);
  if (unit) rows.push({ label: 'Unit', value: escapeHtml(unit) });
  if (payload.requiredDeliveryDate) {
    rows.push({
      label: 'Delivery Date',
      value: escapeHtml(formatDateFr(payload.requiredDeliveryDate)),
    });
  }
  if (payload.deliveryLocation) {
    rows.push({ label: 'Delivery Location', value: escapeHtml(payload.deliveryLocation) });
  }
  if (payload.currency) {
    rows.push({ label: 'Currency', value: escapeHtml(payload.currency) });
  }
  if (payload.targetBudget != null) {
    rows.push({
      label: 'Target Budget',
      value: escapeHtml(formatBudget(payload.targetBudget, payload.currency)),
    });
  }
  if (payload.incoterm) rows.push({ label: 'Incoterm', value: escapeHtml(payload.incoterm) });
  if (payload.paymentTerms) {
    rows.push({ label: 'Payment Terms', value: escapeHtml(payload.paymentTerms) });
  }

  const detailsRows = rows
    .map(
      (row) =>
        `<tr><td style="padding:6px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:600;color:#334155;white-space:nowrap;vertical-align:top;width:180px;">${row.label}</td><td style="padding:6px 12px;border:1px solid #e2e8f0;color:#0f172a;">${row.value}</td></tr>`,
    )
    .join('');

  const specificationsBlock = payload.specifications
    ? `<p style="margin:16px 0 4px;font-weight:600;color:#334155;">Specifications:</p>
       <div style="margin:0;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;color:#0f172a;">${escapeHtmlMultiline(payload.specifications)}</div>`
    : '';

  const additionalBlock = payload.additionalRequirements
    ? `<p style="margin:16px 0 4px;font-weight:600;color:#334155;">Additional requirements:</p>
       <div style="margin:0;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;color:#0f172a;">${escapeHtmlMultiline(payload.additionalRequirements)}</div>`
    : '';

  const attachmentsBlock =
    attachmentNames.length > 0
      ? `<p style="margin:16px 0 4px;font-weight:600;color:#334155;">Attachments:</p>
         <ul style="margin:0;padding-left:20px;color:#0f172a;">${attachmentNames
           .map((name) => `<li>${escapeHtml(name)}</li>`)
           .join('')}</ul>`
      : '';

  // Files too large for sendMail's request-body cap are sent as signed
  // Supabase download links instead of real attachments.
  const attachmentLinksBlock =
    attachmentLinks.length > 0
      ? `<p style="margin:16px 0 4px;font-weight:600;color:#334155;">Large files (download links valid for 14 days):</p>
         <ul style="margin:0;padding-left:20px;color:#0f172a;">${attachmentLinks
           .map(
             (link) =>
               `<li><a href="${escapeHtml(link.url)}" style="color:#2563eb;">${escapeHtml(link.fileName)}</a></li>`,
           )
           .join('')}</ul>`
      : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#0f172a;">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;">
      <tr>
        <td style="padding:24px;">
          <p style="margin:0 0 12px;">Hello,</p>
          <p style="margin:0 0 16px;">XprocurAi is requesting a quotation for the following requirement:</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            ${detailsRows}
          </table>
          ${specificationsBlock}
          ${additionalBlock}
          ${attachmentsBlock}
          ${attachmentLinksBlock}
          <p style="margin:20px 0 8px;">Please reply directly to this email with your quotation and any supporting documents.</p>
          <p style="margin:0 0 16px;font-size:12px;color:#64748b;">Please keep the reference [${escapeHtml(
            reference,
          )}] in the subject of your reply.</p>
          <p style="margin:0;">Regards,<br>XprocurAi</p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;

  return { subject, html };
}
