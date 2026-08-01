export type Language = 'en' | 'fr' | 'ar' | 'es';

export interface FeatureBlock {
  badge: string;
  title: string;
  description: string;
  details: string[];
}

export interface Dictionary {
  meta: {
    title: string;
    description: string;
  };
  nav: {
    features: string;
    about: string;
    founders: string;
    investors: string;
    contact: string;
    signIn: string;
    startFree: string;
  };
  hero: {
    badge: string;
    title1: string;
    title2: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
    socialProof: string;
  };
  trust: {
    badge: string;
    title: string;
    subtitle: string;
    items: { name: string; note: string }[];
    disclaimer: string;
  };
  stats: {
    badge: string;
    title: string;
    items: { value: string; label: string }[];
  };
  features: {
    supplierDiscovery: FeatureBlock;
    aiIntelligence: FeatureBlock;
    onboarding: FeatureBlock;
    erp: FeatureBlock;
  };
  investorsTeaser: {
    badge: string;
    title: string;
    description: string;
    cta: string;
  };
  cta: {
    title1: string;
    title2: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
    badges: string[];
  };
  footer: {
    tagline: string;
    columns: {
      product: { label: string; category: string };
      company: { label: string; category: string };
      resources: { label: string; category: string };
      legal: { label: string; category: string };
    };
    links: {
      features: string;
      pricing: string;
      integrations: string;
      changelog: string;
      about: string;
      founders: string;
      investors: string;
      careers: string;
      contact: string;
      documentation: string;
      apiReference: string;
      helpCenter: string;
      status: string;
      privacy: string;
      terms: string;
      cookies: string;
      gdpr: string;
    };
    copyright: string;
  };
  founders: {
    badge: string;
    title: string;
    subtitle: string;
    members: { name: string; role: string; bio: string }[];
    cta: {
      title: string;
      subtitle: string;
      button: string;
    };
  };
  investors: {
    hero: {
      badge: string;
      title1: string;
      title2: string;
      subtitle: string;
      ctaPrimary: string;
      ctaSecondary: string;
    };
    opportunity: {
      badge: string;
      title: string;
      description: string;
      stats: { value: string; label: string }[];
    };
    whyInvest: {
      badge: string;
      title: string;
      items: { title: string; description: string }[];
    };
    traction: {
      title: string;
      items: { value: string; label: string }[];
    };
    contact: {
      title: string;
      subtitle: string;
      form: {
        name: string;
        email: string;
        company: string;
        message: string;
        messagePlaceholder: string;
        submit: string;
        submitting: string;
        success: string;
      };
      directEmail: string;
    };
  };
}
