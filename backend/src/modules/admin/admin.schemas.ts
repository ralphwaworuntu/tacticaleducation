import { z } from 'zod';

const idParam = z.object({ params: z.object({ id: z.string().min(1) }) });

const landingStatBase = z.object({
  label: z.string().min(2),
  value: z.number().int().nonnegative(),
});

const testimonialBase = z.object({
  name: z.string().min(2),
  message: z.string().min(5),
  role: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
});

const galleryBase = z.object({
  title: z.string().min(2),
  imageUrl: z.string().url(),
  kind: z.string().min(2),
});

const videoBase = z.object({
  title: z.string().min(2),
  embedUrl: z.string().url(),
  thumbnail: z.string().url().optional(),
  description: z.string().optional(),
});

const targetPackageIdsSchema = z.preprocess((value) => {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return value;
}, z.array(z.string().min(5))).optional();

const announcementBase = z.object({
  title: z.string().min(3),
  body: z.string().min(5),
  publishedAt: z.string().datetime().optional(),
  imageUrl: z.string().url().optional(),
  targetAll: z.preprocess((value) => {
    if (typeof value === 'string') return value === 'true';
    return value;
  }, z.boolean()).optional(),
  targetPackageIds: targetPackageIdsSchema,
});

const faqBase = z.object({
  question: z.string().min(3),
  answer: z.string().min(3),
  order: z.number().int().nonnegative().optional(),
});

const newsBase = z.object({
  title: z.string().min(5),
  slug: z.string().min(3),
  excerpt: z.string().min(10),
  content: z.string().min(20),
  coverUrl: z.string().url().optional(),
  kind: z.enum(['NEWS', 'INSIGHT']).default('NEWS'),
});

const tryoutCategoryBase = z.object({
  name: z.string().min(3),
  slug: z.string().min(3),
  thumbnail: z.string().url().optional(),
});

const tryoutSubCategoryBase = z.object({
  name: z.string().min(3),
  slug: z.string().min(3),
  categoryId: z.string().min(1),
  imageUrl: z.string().url().optional(),
});

const tryoutOptionSchema = z.object({
  label: z.string().min(1),
  isCorrect: z.boolean().optional(),
});

const tryoutQuestionSchema = z
    .object({
      prompt: z.string().min(3),
      explanation: z.string().optional(),
      explanationImageUrl: z.string().optional(),
      order: z.number().int().positive().optional(),
      options: z.array(tryoutOptionSchema).min(2),
    })
  .refine((value) => value.options.some((opt) => opt.isCorrect), {
    message: 'Each question must have at least one correct option',
    path: ['options'],
  });

const practiceOptionSchema = z.object({
  label: z.string().min(1),
  isCorrect: z.boolean().optional(),
});

const practiceQuestionSchema = z
    .object({
      prompt: z.string().min(3),
      explanation: z.string().optional(),
      explanationImageUrl: z.string().optional(),
      order: z.number().int().positive().optional(),
      options: z.array(practiceOptionSchema).min(2),
    })
  .refine((value) => value.options.some((opt) => opt.isCorrect), {
    message: 'Each question must have at least one correct option',
    path: ['options'],
  });

const practiceCategoryBase = z.object({
  name: z.string().min(3),
  slug: z.string().min(3),
  imageUrl: z.string().url().optional(),
});

const practiceSubCategoryBase = z.object({
  name: z.string().min(3),
  slug: z.string().min(3),
  categoryId: z.string().min(1),
  imageUrl: z.string().url().optional(),
});

const practiceSubSubCategoryBase = z.object({
  name: z.string().min(3),
  slug: z.string().min(3),
  subCategoryId: z.string().min(1),
  imageUrl: z.string().url().optional(),
});

const memberSlideBase = z.object({
  title: z.string().min(3).optional(),
  subtitle: z.string().min(3).optional(),
  imageUrl: z.string().url(),
  ctaLabel: z.string().min(2).optional(),
  ctaLink: z.string().url().optional(),
  order: z.number().int().nonnegative().optional(),
});

const materialBase = z.object({
  title: z.string().min(3),
  category: z.string().min(2),
  type: z.enum(['PDF', 'VIDEO', 'LINK']),
  description: z.string().optional(),
  fileUrl: z.string().url(),
});

const membershipPackageBase = z.object({
  name: z.string().min(3),
  slug: z.string().min(3),
  category: z.string().min(2),
  tagline: z.string().optional(),
  description: z.string().min(5),
  price: z.number().int().nonnegative(),
  durationDays: z.number().int().positive(),
  badgeLabel: z.string().optional(),
  features: z.array(z.string().min(2)).optional(),
  tryoutQuota: z.number().int().nonnegative().optional(),
  moduleQuota: z.number().int().nonnegative().optional(),
  allowTryout: z.boolean().optional(),
  allowPractice: z.boolean().optional(),
  allowCermat: z.boolean().optional(),
  materialIds: z.array(z.string().min(5)).optional(),
  isActive: z.boolean().optional(),
});

const addonPackageBase = z.object({
  name: z.string().min(3),
  slug: z.string().min(3),
  description: z.string().optional(),
  price: z.number().int().positive(),
  tryoutBonus: z.number().int().nonnegative().optional(),
  moduleBonus: z.number().int().nonnegative().optional(),
  materialIds: z.array(z.string().min(5)).optional(),
  isActive: z.boolean().optional(),
});

export const createLandingStatSchema = z.object({ body: landingStatBase });
export const updateLandingStatSchema = z.object({ body: landingStatBase.partial(), params: idParam.shape.params });

export const createTestimonialSchema = z.object({ body: testimonialBase });
export const updateTestimonialSchema = z.object({ body: testimonialBase.partial(), params: idParam.shape.params });

export const createGalleryItemSchema = z.object({ body: galleryBase });
export const updateGalleryItemSchema = z.object({ body: galleryBase.partial(), params: idParam.shape.params });

export const createVideoSchema = z.object({ body: videoBase });
export const updateVideoSchema = z.object({ body: videoBase.partial(), params: idParam.shape.params });

export const createAnnouncementSchema = z.object({ body: announcementBase });
export const updateAnnouncementSchema = z.object({ body: announcementBase.partial(), params: idParam.shape.params });

export const createFaqSchema = z.object({ body: faqBase });
export const updateFaqSchema = z.object({ body: faqBase.partial(), params: idParam.shape.params });

export const createNewsSchema = z.object({ body: newsBase });
export const updateNewsSchema = z.object({ body: newsBase.partial(), params: idParam.shape.params });

export const createTryoutCategorySchema = z.object({ body: tryoutCategoryBase });
export const updateTryoutCategorySchema = z.object({ body: tryoutCategoryBase.partial(), params: idParam.shape.params });
export const createTryoutSubCategorySchema = z.object({ body: tryoutSubCategoryBase });
export const updateTryoutSubCategorySchema = z.object({ body: tryoutSubCategoryBase.partial(), params: idParam.shape.params });

export const createTryoutSchema = z.object({
  body: z.object({
    name: z.string().min(3),
    slug: z.string().min(3),
    summary: z.string().optional(),
    description: z.string().optional(),
    durationMinutes: z.coerce.number().int().positive(),
    totalQuestions: z.coerce.number().int().positive().optional(),
    subCategoryId: z.string().min(1),
    openAt: z.string().optional(),
    closeAt: z.string().optional(),
    isPublished: z.boolean().optional(),
    isFree: z.coerce.boolean().optional(),
  }),
});

export const updateTryoutSchema = z.object({
  params: idParam.shape.params,
    body: z
      .object({
        name: z.string().min(3).optional(),
        summary: z.string().optional(),
        description: z.string().optional(),
        coverImageUrl: z.string().url().optional(),
        durationMinutes: z.coerce.number().int().positive().optional(),
        totalQuestions: z.coerce.number().int().positive().optional(),
        isPublished: z.coerce.boolean().optional(),
        isFree: z.coerce.boolean().optional(),
        subCategoryId: z.string().min(1).optional(),
        openAt: z.string().optional(),
        closeAt: z.string().optional(),
      })
    .refine((value) => Object.keys(value).length > 0, { message: 'No data provided' }),
});

export const updateTryoutFreeSchema = z.object({
  params: idParam.shape.params,
  body: z.object({
    isFree: z.coerce.boolean(),
  }),
});

export const createPracticeCategorySchema = z.object({ body: practiceCategoryBase });
export const updatePracticeCategorySchema = z.object({ body: practiceCategoryBase.partial(), params: idParam.shape.params });
export const createPracticeSubCategorySchema = z.object({ body: practiceSubCategoryBase });
export const updatePracticeSubCategorySchema = z.object({ body: practiceSubCategoryBase.partial(), params: idParam.shape.params });
export const createPracticeSubSubCategorySchema = z.object({ body: practiceSubSubCategoryBase });
export const updatePracticeSubSubCategorySchema = z.object({
  body: practiceSubSubCategoryBase.partial(),
  params: idParam.shape.params,
});

export const createPracticeSetSchema = z.object({
  body: z.object({
    title: z.string().min(3),
    slug: z.string().min(3),
    description: z.string().optional(),
    level: z.string().optional(),
    subSubCategoryId: z.string().min(1),
    durationMinutes: z.coerce.number().int().positive().optional(),
    totalQuestions: z.coerce.number().int().positive().optional(),
    openAt: z.string().optional(),
    closeAt: z.string().optional(),
    isFree: z.coerce.boolean().optional(),
  }),
});

export const updatePracticeSetSchema = z.object({
  params: idParam.shape.params,
    body: z
      .object({
        title: z.string().min(3).optional(),
        slug: z.string().min(3).optional(),
        description: z.string().optional(),
        level: z.string().optional(),
        subSubCategoryId: z.string().min(1).optional(),
        durationMinutes: z.coerce.number().int().positive().optional(),
        totalQuestions: z.coerce.number().int().positive().optional(),
        openAt: z.string().optional(),
        closeAt: z.string().optional(),
        isFree: z.coerce.boolean().optional(),
      })
    .refine((value) => Object.keys(value).length > 0, { message: 'No data provided' }),
});

export const updatePracticeSetFreeSchema = z.object({
  params: idParam.shape.params,
  body: z.object({
    isFree: z.coerce.boolean(),
  }),
});

export const materialMutationSchema = z.object({ body: materialBase });
export const materialUpdateSchema = z.object({ body: materialBase.partial(), params: idParam.shape.params });

export const membershipPackageSchema = z.object({ body: membershipPackageBase });
export const membershipPackageUpdateSchema = z.object({ body: membershipPackageBase.partial(), params: idParam.shape.params });

export const addonPackageSchema = z.object({ body: addonPackageBase });
export const addonPackageUpdateSchema = z.object({ body: addonPackageBase.partial(), params: idParam.shape.params });

export const transactionStatusSchema = z.object({
  body: z.object({ status: z.enum(['PENDING', 'PAID', 'REJECTED']) }),
  params: idParam.shape.params,
});

export const userRoleSchema = z.object({
  body: z.object({ role: z.enum(['ADMIN', 'MEMBER']) }),
  params: idParam.shape.params,
});

export const userStatusSchema = z.object({
  body: z.object({ isActive: z.boolean() }),
  params: idParam.shape.params,
});

export const userResetPasswordSchema = z.object({
  params: idParam.shape.params,
});

export const userImpersonateSchema = z.object({
  params: idParam.shape.params,
});

export const paymentSettingSchema = z.object({
  body: z.object({
    bankName: z.string().min(3),
    accountNumber: z.string().min(5),
    accountHolder: z.string().min(3),
  }),
});

export const createMemberSlideSchema = z.object({ body: memberSlideBase });
export const updateMemberSlideSchema = z.object({ body: memberSlideBase.partial(), params: idParam.shape.params });

export const contactConfigSchema = z.object({
  body: z.object({
    email: z.string().email(),
    whatsappPrimary: z.string().min(8),
    whatsappConsult: z.string().min(8),
    companyAddress: z.string().min(5),
  }),
});

export const welcomeModalSchema = z.object({
  body: z.object({
    enabled: z.coerce.boolean(),
    imageUrl: z.string().url().optional(),
    linkUrl: z.string().url().optional(),
  }),
});

export const examControlSchema = z.object({
  body: z.object({
    enabled: z.coerce.boolean(),
    targetAll: z.coerce.boolean(),
    targetPackageIds: z.array(z.string().min(10)).optional(),
    tryoutQuota: z.coerce.number().int().nonnegative(),
    examQuota: z.coerce.number().int().nonnegative(),
    startAt: z.string().optional(),
    endAt: z.string().optional(),
  }),
});

export const examBlockConfigSchema = z.object({
  body: z.object({
    practiceEnabled: z.coerce.boolean(),
    tryoutEnabled: z.coerce.boolean(),
    examEnabled: z.coerce.boolean(),
  }),
});

export const grantTryoutQuotaSchema = z.object({
  body: z.object({
    userId: z.string().min(10),
    amount: z.number().int().min(1).max(50),
  }),
});

export const cermatConfigSchema = z.object({
  body: z.object({
    questionCount: z.number().int().min(10).max(200),
    durationSeconds: z.number().int().min(30).max(600),
    totalSessions: z.number().int().min(1).max(20),
    breakSeconds: z.number().int().min(0).max(30),
  }),
});
