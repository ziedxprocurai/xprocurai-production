'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { Dictionary, Language } from './types';
import { en } from './dictionaries/en';
import { fr } from './dictionaries/fr';
import { es } from './dictionaries/es';
import { ar } from './dictionaries/ar';

const dictionaries: Record<Language, Dictionary> = { en, fr, es, ar };

export const RTL_LANGUAGES: Language[] = ['ar'];

export const LANGUAGE_LABELS: Record<Language, { label: string; nativeLabel: string; flag: string }> = {
  en: { label: 'English', nativeLabel: 'English', flag: '🇬🇧' },
  fr: { label: 'French', nativeLabel: 'Français', flag: '🇫🇷' },
  es: { label: 'Spanish', nativeLabel: 'Español', flag: '🇪🇸' },
  ar: { label: 'Arabic', nativeLabel: 'العربية', flag: '🇸🇦' },
};

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Dictionary;
  dir: 'ltr' | 'rtl';
  isTransitioning: boolean;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function applyDocumentLanguage(language: Language) {
  const dir = RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';
  document.documentElement.lang = language;
  document.documentElement.dir = dir;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('language') as Language | null;
    const initial = stored && dictionaries[stored] ? stored : 'en';
    setLanguageState(initial);
    applyDocumentLanguage(initial);
  }, []);

  const setLanguage = (newLanguage: Language) => {
    if (newLanguage === language) return;
    setIsTransitioning(true);
    window.setTimeout(() => {
      setLanguageState(newLanguage);
      localStorage.setItem('language', newLanguage);
      applyDocumentLanguage(newLanguage);
      window.setTimeout(() => setIsTransitioning(false), 30);
    }, 180);
  };

  const dir = RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage, t: dictionaries[language], dir, isTransitioning }}
    >
      <div
        className={`transition-opacity duration-200 ease-out ${
          isTransitioning ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
