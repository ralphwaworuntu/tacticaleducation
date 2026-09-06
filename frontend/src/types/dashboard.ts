export type DashboardSlide = {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  imageUrl: string;
  ctaLabel?: string | null;
  ctaLink?: string | null;
};

export type DashboardOverview = {
  transactions: Array<{
    id: string;
    code: string;
    amount: number;
    status: 'PENDING' | 'PAID' | 'REJECTED';
    method: string;
    createdAt: string;
    type: 'MEMBERSHIP' | 'ADDON';
    package: { name: string };
    addon?: { name: string } | null;
  }>;
  announcements: Array<{ id: string; title: string; body: string; publishedAt: string; imageUrl?: string | null }>;
  tryoutResults: Array<{
    id: string;
    score: number;
    startedAt: string;
    tryout: { name: string; subCategory: { name: string; category: { name: string } } };
  }>;
  slides: DashboardSlide[];
  summary: {
    tryouts: number;
    materials: number;
    pendingPayments: number;
  };
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
  imageUrl?: string | null;
};

export type FAQ = {
  id: string;
  question: string;
  answer: string;
};

export type NewsArticle = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  published: string;
  kind: 'NEWS' | 'INSIGHT';
};
