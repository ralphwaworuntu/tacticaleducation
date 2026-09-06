export type HeroSlide = {
  id: string;
  imageUrl: string;
};

export type HomeHero = {
  title: string;
  subtitle: string;
  ctaPrimary: { label: string; href: string };
  ctaSecondary: { label: string; href: string };
  imageUrl?: string | null;
  slides: HeroSlide[];
};

export type HomePackage = {
  id?: string;
  name: string;
  category: string;
  price: number;
  description: string;
  badgeLabel?: string | null;
};

export type ContactConfig = {
  email: string;
  whatsappPrimary: string;
  whatsappConsult: string;
  companyAddress: string;
};

export type HomeContent = {
  hero: HomeHero;
  stats: Array<{ label: string; value: number }>;
  reasons: string[];
  packages: HomePackage[];
  testimonials: Array<{ id: string; name: string; message: string; role?: string }>;
  videos: Array<{ id: string; title: string; embedUrl: string; description?: string | null }>;
  contact: ContactConfig;
};

export type ProfileContent = {
  title: string;
  body: string;
  highlights: string[];
};
