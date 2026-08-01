'use client';

import { useRef, useState, useEffect } from 'react';
import { Languages, Check } from 'lucide-react';
import { useLanguage, LANGUAGE_LABELS } from '@/lib/i18n/language-context';
import type { Language } from '@/lib/i18n/types';

const LANGUAGES: Language[] = ['en', 'fr', 'es', 'ar'];

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
        aria-label="Change language"
      >
        <Languages className="h-[18px] w-[18px]" />
        <span className="text-xs font-semibold uppercase">{language}</span>
      </button>

      {open && (
        <div className="absolute right-0 rtl:right-auto rtl:left-0 mt-2 w-48 overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] py-1 shadow-lg">
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              onClick={() => {
                setLanguage(lang);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-sm transition-colors ${
                language === lang
                  ? 'bg-[hsl(var(--muted))] font-medium text-[hsl(var(--foreground))]'
                  : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]/50'
              }`}
            >
              <span className="text-base leading-none">{LANGUAGE_LABELS[lang].flag}</span>
              <span className="flex-1 text-left rtl:text-right">{LANGUAGE_LABELS[lang].nativeLabel}</span>
              {language === lang && <Check className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
