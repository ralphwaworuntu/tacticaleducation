export type Tryout = {
  id: string;
  name: string;
  slug: string;
  summary: string;
  description: string;
  coverImageUrl?: string | null;
  durationMinutes: number;
  totalQuestions: number;
  subCategory: { id: string; name: string; imageUrl?: string | null; category: { id: string; name: string; slug?: string; thumbnail?: string | null } };
  openAt?: string | null;
  closeAt?: string | null;
};

export type TryoutQuestion = {
  id: string;
  prompt: string;
  imageUrl?: string | null;
  order: number;
  explanation?: string | null;
  explanationImageUrl?: string | null;
  options: Array<{ id: string; label: string; imageUrl?: string | null; isCorrect?: boolean }>;
};

export type TryoutDetail = Tryout & { questions: TryoutQuestion[] };

export type TryoutReviewQuestion = TryoutQuestion & {
  userOptionId?: string | null;
  isCorrect: boolean;
};

export type TryoutReview = {
  tryout: {
    id: string;
    name: string;
    slug: string;
    totalQuestions: number;
    durationMinutes: number;
  };
  score: number;
  completedAt?: string | null;
  questions: TryoutReviewQuestion[];
};

export type PracticeCategory = {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  subCategories: Array<{
    id: string;
    name: string;
    slug: string;
    imageUrl?: string | null;
    subSubs: Array<{
      id: string;
      name: string;
      slug: string;
      imageUrl?: string | null;
      sets: Array<{
        id: string;
        title: string;
        slug: string;
        level?: string | null;
        description: string;
        coverImageUrl?: string | null;
        durationMinutes: number;
        totalQuestions: number;
        openAt?: string | null;
        closeAt?: string | null;
      }>;
    }>;
  }>;
};

export type PracticeSet = {
  id: string;
  title: string;
  slug: string;
  description: string;
  coverImageUrl?: string | null;
  level?: string | null;
  durationMinutes: number;
  totalQuestions: number;
  openAt?: string | null;
  closeAt?: string | null;
  subSubCategory: {
    id: string;
    name: string;
    subCategory: { id: string; name: string; category: { id: string; name: string } };
  };
  questions: Array<{
    id: string;
    prompt: string;
    imageUrl?: string | null;
    order: number;
    explanation?: string | null;
    explanationImageUrl?: string | null;
    options: Array<{ id: string; label: string; imageUrl?: string | null; isCorrect?: boolean }>;
  }>;
};

export type PracticeSetInfo = Omit<PracticeSet, 'questions'>;


export type PracticeReviewQuestion = PracticeSet['questions'][number] & {
  userOptionId?: string | null;
  isCorrect: boolean;
};

export type PracticeReview = {
  set: {
    id: string;
    title: string;
    slug: string;
    level?: string | null;
  };
  score: number;
  completedAt?: string | null;
  questions: PracticeReviewQuestion[];
};
export type Material = {
  id: string;
  title: string;
  category: string;
  type: 'PDF' | 'VIDEO' | 'LINK';
  description?: string;
  fileUrl: string;
  createdAt: string;
};

export type MembershipPackage = {
  id: string;
  name: string;
  slug: string;
  category: string;
  tagline?: string | null;
  description: string;
  price: number;
  durationDays: number;
  badgeLabel?: string | null;
  tryoutQuota?: number;
  moduleQuota?: number;
  allowTryout?: boolean;
  allowPractice?: boolean;
  allowCermat?: boolean;
  features?: string[];
  materialIds?: string[];
  materialCount?: number;
};

export type AddonPackage = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  price: number;
  tryoutBonus?: number;
  moduleBonus?: number;
  materialIds?: string[];
};

export type MemberTransaction = {
  id: string;
  code: string;
  type: 'MEMBERSHIP' | 'ADDON';
  amount: number;
  method: string;
  status: 'PENDING' | 'PAID' | 'REJECTED';
  createdAt: string;
  proofUrl?: string | null;
  description?: string | null;
  activatedAt?: string | null;
  expiresAt?: string | null;
  package: { name: string; category: string };
  addon?: { name: string } | null;
};

export type AdminTransaction = {
  id: string;
  code: string;
  type: 'MEMBERSHIP' | 'ADDON';
  amount: number;
  method: string;
  status: 'PENDING' | 'PAID' | 'REJECTED';
  createdAt: string;
  package: { name: string; category: string };
  addon?: { name: string } | null;
  user: { name: string; email: string };
  proofUrl?: string | null;
  description?: string | null;
  activatedAt?: string | null;
  expiresAt?: string | null;
};

export type MembershipStatus = {
  isActive: boolean;
  expiresAt?: string | null;
  packageName?: string;
  packageId?: string;
  transactionCode?: string;
  transactionId?: string;
  allowTryout?: boolean;
  allowPractice?: boolean;
  allowCermat?: boolean;
  tryoutQuota?: number;
  tryoutUsed?: number;
  tryoutRemaining?: number | null;
  moduleQuota?: number;
  moduleUsed?: number;
  moduleRemaining?: number | null;
  allowedMaterialIds?: string[];
};

export type PaymentSetting = {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
};

export type ReferralOverview = {
  referralCode: string;
  link: string;
  total: number;
  list: Array<{ id: string; referred: { name: string; email: string; createdAt: string } }>;
};

export type ExamBlock = {
  id: string;
  type: 'TRYOUT' | 'PRACTICE';
  reason?: string | null;
  blockedAt: string;
  violationCount: number;
};

export type ExamSectionStatus = {
  enabled: boolean;
  allowed: boolean;
  targetAll: boolean;
  targetPackageIds: string[];
  tryoutQuota: number;
  examQuota: number;
  tryoutsUsed: number;
  examsUsed: number;
  startAt?: string | null;
  endAt?: string | null;
};
