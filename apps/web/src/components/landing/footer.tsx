import { Hexagon } from 'lucide-react';

const footerLinks = {
  Product: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#' },
    { label: 'Integrations', href: '#' },
    { label: 'Changelog', href: '#' },
  ],
  Company: [
    { label: 'About', href: '#about' },
    { label: 'Blog', href: '#' },
    { label: 'Careers', href: '#' },
    { label: 'Contact', href: '#contact' },
  ],
  Resources: [
    { label: 'Documentation', href: '#' },
    { label: 'API Reference', href: '#' },
    { label: 'Help Center', href: '#' },
    { label: 'Status', href: '#' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Service', href: '#' },
    { label: 'Cookie Policy', href: '#' },
    { label: 'GDPR', href: '#' },
  ],
};

export function Footer() {
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
              The AI-powered Supplier Intelligence Platform for modern procurement teams.
              Discover, qualify, and manage suppliers — intelligently.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="mb-4 text-sm font-semibold text-[hsl(var(--foreground))]">{category}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
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
            &copy; {new Date().getFullYear()} xProcurAI. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <a
              href="#"
              className="text-sm text-[hsl(var(--muted-foreground))]/70 transition-colors hover:text-[hsl(var(--foreground))]"
            >
              Privacy
            </a>
            <a
              href="#"
              className="text-sm text-[hsl(var(--muted-foreground))]/70 transition-colors hover:text-[hsl(var(--foreground))]"
            >
              Terms
            </a>
            <a
              href="#"
              className="text-sm text-[hsl(var(--muted-foreground))]/70 transition-colors hover:text-[hsl(var(--foreground))]"
            >
              Cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
