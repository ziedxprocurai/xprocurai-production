'use client';

import { Hexagon, Mail } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/language-context';

export function Footer() {
  const { t } = useLanguage();
  const L = t.footer.links;

  const footerLinks = [
    {
      category: t.footer.columns.product.label,
      links: [
        { label: L.features, href: '/#features' },
        { label: L.pricing, href: '/#' },
        { label: L.integrations, href: '/#' },
        { label: L.changelog, href: '/#' },
      ],
    },
    {
      category: t.footer.columns.company.label,
      links: [
        { label: L.about, href: '/#about' },
        { label: L.founders, href: '/founders' },
        { label: L.investors, href: '/investors' },
        { label: L.careers, href: 'mailto:careers@xprocur.ai' },
        { label: L.contact, href: '/#contact' },
      ],
    },
    {
      category: t.footer.columns.resources.label,
      links: [
        { label: L.documentation, href: '/#' },
        { label: L.apiReference, href: '/#' },
        { label: L.helpCenter, href: '/#' },
        { label: L.status, href: '/#' },
      ],
    },
    {
      category: t.footer.columns.legal.label,
      links: [
        { label: L.privacy, href: '/#' },
        { label: L.terms, href: '/#' },
        { label: L.cookies, href: '/#' },
        { label: L.gdpr, href: '/#' },
      ],
    },
  ];

  return (
    <footer className="border-t border-[hsl(var(--border))]/40 bg-[hsl(var(--muted))]/20">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-6">
          {/* Brand column */}
          <div className="lg:col-span-2">
            <a href="/" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary))]">
                <Hexagon className="h-4 w-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-lg font-bold text-[hsl(var(--foreground))]">
                xProcur<span className="text-[hsl(var(--primary))]">AI</span>
              </span>
            </a>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
              {t.footer.tagline}
            </p>
            <a
              href="mailto:contact@xprocur.ai"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[hsl(var(--primary))] transition-opacity hover:opacity-80"
            >
              <Mail className="h-4 w-4" />
              contact@xprocur.ai
            </a>
          </div>

          {/* Link columns */}
          {footerLinks.map((col) => (
            <div key={col.category}>
              <h4 className="mb-4 text-sm font-semibold text-[hsl(var(--foreground))]">{col.category}</h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-[hsl(var(--border))]/40 pt-8 sm:flex-row">
          <p className="text-sm text-[hsl(var(--muted-foreground))]/70">
            {t.footer.copyright.replace('{year}', String(new Date().getFullYear()))}
          </p>
          <div className="flex items-center gap-6">
            <a
              href="/#"
              className="text-sm text-[hsl(var(--muted-foreground))]/70 transition-colors hover:text-[hsl(var(--foreground))]"
            >
              {L.privacy}
            </a>
            <a
              href="/#"
              className="text-sm text-[hsl(var(--muted-foreground))]/70 transition-colors hover:text-[hsl(var(--foreground))]"
            >
              {L.terms}
            </a>
            <a
              href="/#"
              className="text-sm text-[hsl(var(--muted-foreground))]/70 transition-colors hover:text-[hsl(var(--foreground))]"
            >
              {L.cookies}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
