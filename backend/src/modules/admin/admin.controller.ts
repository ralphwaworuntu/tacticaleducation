import type { NextFunction, Request, Response } from 'express';
import { nanoid } from 'nanoid';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { HttpError } from '../../middlewares/errorHandler';
import { buildPublicUploadPath } from '../../config/upload';
import { adminUpdateTransaction, getPaymentSetting, grantFreeTryoutQuota, updatePaymentSetting } from '../commerce/commerce.service';
import { regenerateExamBlockCode } from '../exams/exam-block.service';
import { parsePracticeCsv, parseTryoutCsv } from '../../utils/examCsv';
import { hashPassword } from '../../utils/password';
import { createImpersonationSession } from '../auth/auth.service';
import type { Express } from 'express';
import { getExamControlConfig, updateExamControlConfig } from '../exams/exam-control.service';
import { getExamBlockConfig, updateExamBlockConfig } from '../exams/exam-block.service';

function ensurePayload(body: Record<string, unknown>) {
  if (!body || Object.keys(body).length === 0) {
    throw new HttpError('No data provided', 400);
  }
}

function getIdParam(req: Request) {
  const { id } = req.params;
  if (!id) {
    throw new HttpError('Invalid resource id', 400);
  }
  return id;
}

function buildDateFilter(query: Request['query']) {
  const start = typeof query.startDate === 'string' ? new Date(query.startDate) : null;
  const end = typeof query.endDate === 'string' ? new Date(query.endDate) : null;
  const validStart = start && !Number.isNaN(start.getTime()) ? start : null;
  const validEnd = end && !Number.isNaN(end.getTime()) ? end : null;
  if (!validStart && !validEnd) return undefined;
  return {
    ...(validStart ? { gte: validStart } : {}),
    ...(validEnd ? { lte: validEnd } : {}),
  };
}

function toCsv(rows: Array<Record<string, string | number | null | undefined>>) {
  if (!rows.length) return '';
  const first = rows[0];
  if (!first) return '';
  const headers = Object.keys(first);
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = [headers.join(',')];
  rows.forEach((row) => {
    const values = headers.map((key) => {
      const raw = row[key];
      if (raw === null || raw === undefined) return '';
      if (typeof raw === 'number') return String(raw);
      return escape(String(raw));
    });
    lines.push(values.join(','));
  });
  return lines.join('\n');
}

function toCsvWithHeaders(headers: string[], rows: Array<Record<string, string | number | null | undefined>>) {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = [headers.join(',')];
  rows.forEach((row) => {
    const values = headers.map((key) => {
      const raw = row[key];
      if (raw === null || raw === undefined) return '';
      if (typeof raw === 'number') return String(raw);
      return escape(String(raw));
    });
    lines.push(values.join(','));
  });
  return lines.join('\n');
}

function withOrigin(req: Request, path: string | null) {
  if (!path) {
    return null;
  }
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const host = req.get('host');
  if (!host) {
    return path;
  }
  return `${req.protocol}://${host}${path}`;
}

const siteContactKeys = ['company_email', 'whatsapp_primary', 'whatsapp_consult', 'company_address'] as const;
const memberBackgroundKeys = ['member_area_background_enabled', 'member_area_background_image'] as const;
const cermatConfigKeys = ['cermat_question_count', 'cermat_duration_seconds', 'cermat_total_sessions', 'cermat_break_seconds'] as const;
const psikoTryoutConfigKeys = ['psiko_tryout_break_seconds'] as const;
const hiddenAdminEmails = ['developer@tacticaleducation.id'];
const optionLetters = ['a', 'b', 'c', 'd', 'e'] as const;
const questionExportHeaders = [
  'exam_type',
  'category',
  'sub_category',
  'sub_sub_category',
  'item_id',
  'item_name',
  'item_slug',
  'prompt',
  'prompt_image',
  'explanation',
  'explanationImageUrl',
  'order',
  'option_a',
  'option_a_image',
  'option_a_correct',
  'option_b',
  'option_b_image',
  'option_b_correct',
  'option_c',
  'option_c_image',
  'option_c_correct',
  'option_d',
  'option_d_image',
  'option_d_correct',
  'option_e',
  'option_e_image',
  'option_e_correct',
] as const;
type WelcomeModalItem = { id: string; imageUrl: string; linkUrl?: string | null; enabled: boolean; createdAt: string };

function mapOptionsToCsvFields(options: Array<{ label: string; imageUrl: string | null; isCorrect: boolean }>) {
  const fields: Record<string, string> = {};
  optionLetters.forEach((letter, index) => {
    const option = options[index];
    fields[`option_${letter}`] = option?.label ?? '';
    fields[`option_${letter}_image`] = option?.imageUrl ?? '';
    fields[`option_${letter}_correct`] = option ? (option.isCorrect ? 'TRUE' : 'FALSE') : '';
  });
  return fields;
}

function normalizeWord(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function matchesKeyword(name: string | null | undefined, slug: string | null | undefined, keyword: string) {
  const key = normalizeWord(keyword);
  return normalizeWord(name) === key || normalizeWord(slug) === key;
}

function isPolriPsikoSubCategory(subCategory: {
  name: string;
  slug: string;
  category: { name: string; slug: string };
}) {
  return (
    matchesKeyword(subCategory.category.name, subCategory.category.slug, 'polri') &&
    matchesKeyword(subCategory.name, subCategory.slug, 'psiko')
  );
}

function buildContactConfig(settings: Array<{ key: string; value: string }>) {
  const map = settings.reduce<Record<string, string>>((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {});
  const whatsappPrimary = map.whatsapp_primary ?? '6281234567890';
  return {
    email: map.company_email ?? 'hallo@tacticaleducation.id',
    whatsappPrimary,
    whatsappConsult: map.whatsapp_consult ?? whatsappPrimary,
    companyAddress: map.company_address ?? 'Alamat perusahaan belum diatur',
  };
}

function buildMemberBackgroundConfig(settings: Array<{ key: string; value: string }>) {
  const map = settings.reduce<Record<string, string>>((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {});
  return {
    enabled: map.member_area_background_enabled === 'true',
    imageUrl: map.member_area_background_image || null,
  };
}

function buildWelcomeModalConfig(settings: Array<{ key: string; value: string }>) {
  // Legacy single modal support
  const map = settings.reduce<Record<string, string>>((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {});
  const legacyModal = map.welcome_modal_image
    ? {
        id: 'legacy',
        imageUrl: map.welcome_modal_image,
        linkUrl: map.welcome_modal_link ?? null,
        enabled: map.welcome_modal_enabled === 'true',
        createdAt: new Date().toISOString(),
      }
    : null;

  const itemsSetting = settings.find((s) => s.key === 'welcome_modal_items');
  let items: WelcomeModalItem[] = [];
  if (itemsSetting?.value) {
    try {
      const parsed = JSON.parse(itemsSetting.value);
      if (Array.isArray(parsed)) {
        items = parsed.filter((item): item is WelcomeModalItem => Boolean(item?.id && item?.imageUrl));
      }
    } catch {
      items = [];
    }
  }

  if (legacyModal) {
    items = [legacyModal, ...items];
  }

  return items;
}

function buildCermatConfig(settings: Array<{ key: string; value: string }>) {
  const map = settings.reduce<Record<string, string>>((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {});
  return {
    questionCount: Number(map.cermat_question_count || 60),
    durationSeconds: Number(map.cermat_duration_seconds || 60),
    totalSessions: Number(map.cermat_total_sessions || 10),
    breakSeconds: Number(map.cermat_break_seconds || 5),
  };
}

function buildPsikoTryoutConfig(settings: Array<{ key: string; value: string }>) {
  const map = settings.reduce<Record<string, string>>((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {});
  return {
    breakSeconds: Number(map.psiko_tryout_break_seconds || 5),
  };
}

export async function adminLandingOverviewController(_req: Request, res: Response, next: NextFunction) {
  try {
    const [stats, testimonials, gallery, videos, announcements, faqs, news] = await Promise.all([
      prisma.landingStat.findMany({ orderBy: { label: 'asc' } }),
      prisma.testimonial.findMany({ orderBy: { name: 'asc' } }),
      prisma.galleryItem.findMany({ orderBy: { title: 'asc' } }),
      prisma.youtubeVideo.findMany({ orderBy: { title: 'asc' } }),
      prisma.announcement.findMany({ orderBy: { publishedAt: 'desc' } }),
      prisma.faq.findMany({ orderBy: { order: 'asc' } }),
      prisma.newsArticle.findMany({ orderBy: { published: 'desc' } }),
    ]);

    res.json({
      status: 'success',
      data: { stats, testimonials, gallery, videos, announcements, faqs, news },
    });
  } catch (error) {
    next(error);
  }
}

export async function createLandingStatController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await prisma.landingStat.create({ data: req.body });
    res.status(201).json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function updateLandingStatController(req: Request, res: Response, next: NextFunction) {
  try {
    ensurePayload(req.body);
    const id = getIdParam(req);
    const data = await prisma.landingStat.update({ where: { id }, data: req.body });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function deleteLandingStatController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    await prisma.landingStat.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function createTestimonialController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await prisma.testimonial.create({ data: req.body });
    res.status(201).json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function updateTestimonialController(req: Request, res: Response, next: NextFunction) {
  try {
    ensurePayload(req.body);
    const id = getIdParam(req);
    const data = await prisma.testimonial.update({ where: { id }, data: req.body });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function deleteTestimonialController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    await prisma.testimonial.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function createGalleryItemController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await prisma.galleryItem.create({ data: req.body });
    res.status(201).json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function updateGalleryItemController(req: Request, res: Response, next: NextFunction) {
  try {
    ensurePayload(req.body);
    const id = getIdParam(req);
    const data = await prisma.galleryItem.update({ where: { id }, data: req.body });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function deleteGalleryItemController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    await prisma.galleryItem.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function createVideoController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await prisma.youtubeVideo.create({ data: req.body });
    res.status(201).json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function updateVideoController(req: Request, res: Response, next: NextFunction) {
  try {
    ensurePayload(req.body);
    const id = getIdParam(req);
    const data = await prisma.youtubeVideo.update({ where: { id }, data: req.body });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function deleteVideoController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    await prisma.youtubeVideo.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function createAnnouncementController(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = req.body as {
      title: string;
      body: string;
      publishedAt?: string;
      imageUrl?: string;
      targetAll?: boolean;
      targetPackageIds?: string[] | string;
    };
    const imageFile = getFile(req, 'image');
    const imageUrl = imageFile ? buildPublicUploadPath(imageFile.path) : payload.imageUrl?.trim() || null;
    const targetAll = payload.targetAll !== undefined ? String(payload.targetAll) === 'true' || payload.targetAll === true : true;
    let parsedTargets: string[] = [];
    if (payload.targetPackageIds) {
      if (Array.isArray(payload.targetPackageIds)) {
        parsedTargets = payload.targetPackageIds;
      } else {
        try {
          parsedTargets = JSON.parse(payload.targetPackageIds);
        } catch {
          parsedTargets = payload.targetPackageIds.split(',').map((item) => item.trim()).filter(Boolean);
        }
      }
    }
    const data = await prisma.announcement.create({
      data: {
        title: payload.title,
        body: payload.body,
        imageUrl,
        publishedAt: payload.publishedAt ? new Date(payload.publishedAt) : undefined,
        targetAll,
        targetPackageIds: targetAll ? [] : parsedTargets,
      } as any,
    });
    res.status(201).json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function updateAnnouncementController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    const imageFile = getFile(req, 'image');
    if (!imageFile) {
      ensurePayload(req.body);
    }
    const payload = req.body as {
      title?: string;
      body?: string;
      publishedAt?: string;
      imageUrl?: string;
      targetAll?: boolean;
      targetPackageIds?: string[] | string;
    };
    const updateData: Record<string, unknown> = { ...payload };
    if (payload.publishedAt) {
      updateData.publishedAt = new Date(payload.publishedAt);
    }
    if (imageFile) {
      updateData.imageUrl = buildPublicUploadPath(imageFile.path);
    } else if (payload.imageUrl !== undefined) {
      updateData.imageUrl = payload.imageUrl?.trim() || null;
    }
    if (payload.targetAll !== undefined) {
      const nextTargetAll = String(payload.targetAll) === 'true' || payload.targetAll === true;
      updateData.targetAll = nextTargetAll;
      if (nextTargetAll) {
        updateData.targetPackageIds = [];
      }
    }
    if (payload.targetPackageIds !== undefined && payload.targetAll === false) {
      if (Array.isArray(payload.targetPackageIds)) {
        updateData.targetPackageIds = payload.targetPackageIds;
      } else {
        try {
          updateData.targetPackageIds = JSON.parse(payload.targetPackageIds);
        } catch {
          updateData.targetPackageIds = payload.targetPackageIds.split(',').map((item) => item.trim()).filter(Boolean);
        }
      }
    }
    const data = await prisma.announcement.update({ where: { id }, data: updateData as any });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function deleteAnnouncementController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    await prisma.announcement.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function exportAnnouncementsAdminController(_req: Request, res: Response, next: NextFunction) {
  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      include: {
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    const csv = toCsv(
      announcements.map((item) => ({
        id: item.id,
        title: item.title,
        body: item.body,
        publishedAt: item.publishedAt.toISOString(),
        imageUrl: item.imageUrl ?? '',
        targetAll: item.targetAll ? 'TRUE' : 'FALSE',
        targetPackageIds: JSON.stringify(item.targetPackageIds ?? []),
        createdByName: item.createdBy?.name ?? '',
        createdByEmail: item.createdBy?.email ?? '',
      })),
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="pengumuman.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
}

export async function createFaqController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await prisma.faq.create({ data: req.body });
    res.status(201).json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function updateFaqController(req: Request, res: Response, next: NextFunction) {
  try {
    ensurePayload(req.body);
    const id = getIdParam(req);
    const data = await prisma.faq.update({ where: { id }, data: req.body });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function deleteFaqController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    await prisma.faq.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function createNewsController(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = req.body as {
      title: string;
      slug: string;
      excerpt: string;
      content: string;
      coverUrl?: string;
      kind?: 'NEWS' | 'INSIGHT';
    };
    const coverFile = getFile(req, 'coverImage');
    const coverUrl = coverFile ? buildPublicUploadPath(coverFile.path) : payload.coverUrl?.trim() || null;
    const data = await prisma.newsArticle.create({
      data: {
        title: payload.title,
        slug: payload.slug,
        excerpt: payload.excerpt,
        content: payload.content,
        coverUrl,
        kind: payload.kind ?? 'NEWS',
      },
    });
    res.status(201).json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function updateNewsController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    const coverFile = getFile(req, 'coverImage');
    if (!coverFile) {
      ensurePayload(req.body);
    }
    const payload = req.body as {
      title?: string;
      slug?: string;
      excerpt?: string;
      content?: string;
      coverUrl?: string | null;
      kind?: 'NEWS' | 'INSIGHT';
    };
    const updateData: Record<string, unknown> = { ...payload };
    if (coverFile) {
      updateData.coverUrl = buildPublicUploadPath(coverFile.path);
    } else if (payload.coverUrl !== undefined) {
      updateData.coverUrl = payload.coverUrl?.trim() || null;
    }
    const data = await prisma.newsArticle.update({ where: { id }, data: updateData });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function deleteNewsController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    await prisma.newsArticle.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function listTryoutCategoriesController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await prisma.tryoutCategory.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { subCategories: true } } },
    });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function listTryoutSubCategoriesController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await prisma.tryoutSubCategory.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        _count: { select: { tryouts: true } },
      },
    });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function createTryoutSubCategoryController(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = req.body as { name: string; slug: string; categoryId: string; imageUrl?: string };
    const imageFile = getFile(req, 'image');
    const imageUrl = imageFile ? buildPublicUploadPath(imageFile.path) : payload.imageUrl?.trim() || null;
    const data = await prisma.tryoutSubCategory.create({
      data: {
        name: payload.name,
        slug: payload.slug,
        categoryId: payload.categoryId,
        imageUrl,
      },
    });
    res.status(201).json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function updateTryoutSubCategoryController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    const imageFile = getFile(req, 'image');
    if (!imageFile) {
      ensurePayload(req.body);
    }
    const payload = req.body as { name?: string; slug?: string; categoryId?: string; imageUrl?: string };
    const updateData: Record<string, unknown> = { ...payload };
    if (imageFile) {
      updateData.imageUrl = buildPublicUploadPath(imageFile.path);
    } else if (payload.imageUrl !== undefined) {
      updateData.imageUrl = payload.imageUrl?.trim() || null;
    }
    const data = await prisma.tryoutSubCategory.update({ where: { id }, data: updateData });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function deleteTryoutSubCategoryController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    await prisma.tryoutSubCategory.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function createTryoutCategoryController(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = req.body as { name: string; slug: string; thumbnail?: string };
    const imageFile = getFile(req, 'image');
    const thumbnail = imageFile ? buildPublicUploadPath(imageFile.path) : payload.thumbnail?.trim() || null;
    const data = await prisma.tryoutCategory.create({
      data: {
        name: payload.name,
        slug: payload.slug,
        thumbnail,
      },
    });
    res.status(201).json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function updateTryoutCategoryController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    const imageFile = getFile(req, 'image');
    if (!imageFile) {
      ensurePayload(req.body);
    }
    const payload = req.body as { name?: string; slug?: string; thumbnail?: string };
    const updateData: Record<string, unknown> = { ...payload };
    if (imageFile) {
      updateData.thumbnail = buildPublicUploadPath(imageFile.path);
    } else if (payload.thumbnail !== undefined) {
      updateData.thumbnail = payload.thumbnail?.trim() || null;
    }
    const data = await prisma.tryoutCategory.update({ where: { id }, data: updateData });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function deleteTryoutCategoryController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    await prisma.tryoutCategory.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function listTryoutsController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await prisma.tryout.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        subCategory: { include: { category: true } },
        questions: { include: { options: true }, orderBy: { order: 'asc' } },
      },
    });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function exportTryoutManagementController(_req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await prisma.tryoutCategory.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        subCategories: {
          orderBy: { createdAt: 'desc' },
          include: {
            tryouts: {
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                name: true,
                slug: true,
                summary: true,
                durationMinutes: true,
                totalQuestions: true,
                isPublished: true,
                isFree: true,
                freeForNewMembers: true,
                freePackageIds: true,
                openAt: true,
                closeAt: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    const rows: Array<Record<string, string | number | null | undefined>> = [];

    categories.forEach((category) => {
      if (category.subCategories.length === 0) {
        rows.push({
          categoryId: category.id,
          categoryName: category.name,
          categorySlug: category.slug,
          subCategoryId: '',
          subCategoryName: '',
          subCategorySlug: '',
          tryoutId: '',
          tryoutName: '',
          tryoutSlug: '',
          summary: '',
          durationMinutes: '',
          totalQuestions: '',
          isPublished: '',
          isFree: '',
          freeForNewMembers: '',
          freePackageIds: '',
          openAt: '',
          closeAt: '',
          createdAt: '',
        });
        return;
      }

      category.subCategories.forEach((subCategory) => {
        if (subCategory.tryouts.length === 0) {
          rows.push({
            categoryId: category.id,
            categoryName: category.name,
            categorySlug: category.slug,
            subCategoryId: subCategory.id,
            subCategoryName: subCategory.name,
            subCategorySlug: subCategory.slug,
            tryoutId: '',
            tryoutName: '',
            tryoutSlug: '',
            summary: '',
            durationMinutes: '',
            totalQuestions: '',
            isPublished: '',
            isFree: '',
            freeForNewMembers: '',
            freePackageIds: '',
            openAt: '',
            closeAt: '',
            createdAt: '',
          });
          return;
        }

        subCategory.tryouts.forEach((tryout) => {
          rows.push({
            categoryId: category.id,
            categoryName: category.name,
            categorySlug: category.slug,
            subCategoryId: subCategory.id,
            subCategoryName: subCategory.name,
            subCategorySlug: subCategory.slug,
            tryoutId: tryout.id,
            tryoutName: tryout.name,
            tryoutSlug: tryout.slug,
            summary: tryout.summary,
            durationMinutes: tryout.durationMinutes,
            totalQuestions: tryout.totalQuestions,
            isPublished: tryout.isPublished ? 'TRUE' : 'FALSE',
            isFree: tryout.isFree ? 'TRUE' : 'FALSE',
            freeForNewMembers: tryout.freeForNewMembers ? 'TRUE' : 'FALSE',
            freePackageIds: JSON.stringify(tryout.freePackageIds ?? []),
            openAt: tryout.openAt?.toISOString() ?? '',
            closeAt: tryout.closeAt?.toISOString() ?? '',
            createdAt: tryout.createdAt.toISOString(),
          });
        });
      });
    });

    const csv = toCsv(rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="manajemen-tryout-tes.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
}

export async function exportTryoutQuestionsCsvAdminController(req: Request, res: Response, next: NextFunction) {
  try {
    const tryoutId = typeof req.query.tryoutId === 'string' && req.query.tryoutId.trim() ? req.query.tryoutId.trim() : null;
    const tryouts = await prisma.tryout.findMany({
      where: tryoutId ? { id: tryoutId } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        subCategory: { include: { category: true } },
        questions: {
          orderBy: { order: 'asc' },
          include: {
            options: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });

    if (tryoutId && tryouts.length === 0) {
      throw new HttpError('Tryout tidak ditemukan', 404);
    }

    const rows: Array<Record<string, string | number | null | undefined>> = [];
    tryouts.forEach((tryout) => {
      tryout.questions.forEach((question) => {
        rows.push({
          exam_type: 'TRYOUT',
          category: tryout.subCategory.category.name,
          sub_category: tryout.subCategory.name,
          sub_sub_category: '',
          item_id: tryout.id,
          item_name: tryout.name,
          item_slug: tryout.slug,
          prompt: question.prompt,
          prompt_image: question.imageUrl ?? '',
          explanation: question.explanation ?? '',
          explanationImageUrl: question.explanationImageUrl ?? '',
          order: question.order,
          ...mapOptionsToCsvFields(question.options),
        });
      });
    });

    const csv = toCsvWithHeaders([...questionExportHeaders], rows);
    const singleTryout = tryouts[0];
    const filename = tryoutId && singleTryout ? `soal-tryout-${singleTryout.slug}.csv` : 'soal-tryout-semua.csv';

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
}

type UploadedFiles = Partial<Record<string, Express.Multer.File[]>>;

function getFile(req: Request, fieldName: string) {
  const files = (req.files as UploadedFiles) || {};
  const list = files[fieldName];
  if (list && list.length > 0) {
    return list[0];
  }
  // Support multer.single uploads
  const single = (req as Request & { file?: Express.Multer.File }).file;
  if (single && single.fieldname === fieldName) {
    return single;
  }
  return null;
}

export async function createTryoutController(req: Request, res: Response, next: NextFunction) {
  try {
      const payload = req.body as {
        name: string;
        slug: string;
        summary?: string;
        description?: string;
        durationMinutes: number;
        totalQuestions?: number;
        subCategoryId: string;
        isPublished?: boolean;
        isFree?: boolean;
        openAt?: string;
        closeAt?: string;
        sessionOrder?: number;
      };

    const questionsFile = getFile(req, 'questionsCsv');
    if (!questionsFile) {
      throw new HttpError('File CSV soal wajib diunggah.', 400);
    }
    let questions;
    try {
      questions = parseTryoutCsv(questionsFile.path);
    } catch (error) {
      throw new HttpError('CSV soal tidak valid. Gunakan template terbaru dan pastikan format kolom sesuai.', 400, { error: String(error) });
    }
    if (!questions.length) {
      throw new HttpError('CSV soal kosong atau tidak valid.', 400);
    }

    const coverFile = getFile(req, 'coverImage');
    const coverImageUrl = coverFile ? buildPublicUploadPath(coverFile.path) : null;
    const totalQuestions = payload.totalQuestions ?? questions.length;
    const trimmedSummary = payload.summary?.trim();
    const safeSummary = trimmedSummary && trimmedSummary.length >= 3 ? trimmedSummary : payload.name;
    const trimmedDescription = payload.description?.trim();
    const safeDescription =
      trimmedDescription && trimmedDescription.length >= 10
        ? trimmedDescription
        : `${payload.name} - Bank Soal Tryout dengan ${questions.length} soal`;
    const targetSubCategory = await prisma.tryoutSubCategory.findUnique({
      where: { id: payload.subCategoryId },
      include: { category: true },
    });
    if (!targetSubCategory) {
      throw new HttpError('Sub kategori tryout tidak ditemukan', 404);
    }
    const isPolriPsiko = isPolriPsikoSubCategory(targetSubCategory);
    if (isPolriPsiko && payload.sessionOrder === undefined) {
      throw new HttpError('Urutan sesi wajib dipilih untuk kategori POLRI / sub kategori PSIKO.', 400);
    }
    if (!isPolriPsiko && payload.sessionOrder !== undefined) {
      throw new HttpError('Urutan sesi hanya berlaku untuk kategori POLRI / sub kategori PSIKO.', 400);
    }
    const data = await prisma.tryout.create({
      data: {
        name: payload.name,
        slug: payload.slug,
        summary: safeSummary,
        description: safeDescription,
        coverImageUrl,
          durationMinutes: payload.durationMinutes,
          totalQuestions,
          isPublished: payload.isPublished ?? true,
          isFree: payload.isFree ?? false,
          sessionOrder: isPolriPsiko ? payload.sessionOrder ?? null : null,
          openAt: payload.openAt ? new Date(payload.openAt) : null,
          closeAt: payload.closeAt ? new Date(payload.closeAt) : null,
          subCategoryId: payload.subCategoryId,
        questions: {
            create: questions.map((question, index) => ({
              prompt: question.prompt,
              imageUrl: question.imageUrl ?? null,
              explanation: question.explanation ?? null,
              explanationImageUrl: question.explanationImageUrl ?? null,
              order: question.order ?? index + 1,
              options: {
                create: question.options.map((option) => ({
                  label: option.label,
                  imageUrl: option.imageUrl ?? null,
                isCorrect: option.isCorrect ?? false,
              })),
            },
          })),
        },
      },
      include: { subCategory: { include: { category: true } }, questions: { include: { options: true } } },
    });

    res.status(201).json({ status: 'success', data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target) ? error.meta?.target.join(',') : String(error.meta?.target ?? '');
      if (target.includes('sessionOrder') || target.includes('subCategoryId')) {
        next(new HttpError('Urutan sesi sudah digunakan. Pilih urutan sesi lain.', 400));
        return;
      }
    }
    next(error);
  }
}

export async function updateTryoutController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    const existingTryout = await prisma.tryout.findUnique({
      where: { id },
      include: { subCategory: { include: { category: true } } },
    });
    if (!existingTryout) {
      throw new HttpError('Tryout tidak ditemukan', 404);
    }
      const payload = req.body as {
        name?: string;
        summary?: string;
        description?: string;
        durationMinutes?: number;
        totalQuestions?: number;
        isPublished?: boolean;
        isFree?: boolean;
        subCategoryId?: string;
        openAt?: string | null;
        closeAt?: string | null;
        sessionOrder?: number;
      };

    const coverFile = getFile(req, 'coverImage');
    const questionsFile = getFile(req, 'questionsCsv');
    const targetSubCategory =
      payload.subCategoryId && payload.subCategoryId !== existingTryout.subCategoryId
        ? await prisma.tryoutSubCategory.findUnique({
            where: { id: payload.subCategoryId },
            include: { category: true },
          })
        : existingTryout.subCategory;

    if (!targetSubCategory) {
      throw new HttpError('Sub kategori tryout tidak ditemukan', 404);
    }
    const isPolriPsiko = isPolriPsikoSubCategory(targetSubCategory);

    const updateData: Record<string, unknown> = {};
    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.summary !== undefined) {
      const trimmed = payload.summary?.trim();
      if (trimmed) {
        updateData.summary = trimmed;
      }
    }
    if (payload.description !== undefined) {
      const trimmed = payload.description?.trim();
      if (trimmed) {
        updateData.description = trimmed;
      }
    }
    if (payload.durationMinutes !== undefined) updateData.durationMinutes = payload.durationMinutes;
    if (payload.totalQuestions !== undefined) updateData.totalQuestions = payload.totalQuestions;
      if (payload.isPublished !== undefined) updateData.isPublished = payload.isPublished;
      if (payload.isFree !== undefined) updateData.isFree = payload.isFree;
    if (payload.subCategoryId !== undefined) updateData.subCategoryId = payload.subCategoryId;
    if (payload.sessionOrder !== undefined) {
      if (!isPolriPsiko) {
        throw new HttpError('Urutan sesi hanya berlaku untuk kategori POLRI / sub kategori PSIKO.', 400);
      }
      updateData.sessionOrder = payload.sessionOrder;
    } else if (payload.subCategoryId !== undefined && !isPolriPsiko) {
      updateData.sessionOrder = null;
    }
    if (isPolriPsiko && payload.subCategoryId !== undefined && existingTryout.sessionOrder === null && payload.sessionOrder === undefined) {
      throw new HttpError('Urutan sesi wajib dipilih untuk kategori POLRI / sub kategori PSIKO.', 400);
    }
    if (payload.openAt !== undefined) {
      updateData.openAt = payload.openAt ? new Date(payload.openAt) : null;
    }
    if (payload.closeAt !== undefined) {
      updateData.closeAt = payload.closeAt ? new Date(payload.closeAt) : null;
    }
    if (coverFile) {
      updateData.coverImageUrl = buildPublicUploadPath(coverFile.path);
    }

    if (questionsFile) {
      let questions;
      try {
        questions = parseTryoutCsv(questionsFile.path);
      } catch (error) {
        throw new HttpError('CSV soal tidak valid. Gunakan template terbaru dan pastikan format kolom sesuai.', 400, {
          error: String(error),
        });
      }
      if (!questions.length) {
        throw new HttpError('CSV soal kosong atau tidak valid.', 400);
      }
      const totalQuestions = payload.totalQuestions ?? questions.length;
      const data = await prisma.$transaction(async (tx) => {
        await tx.tryoutAnswer.deleteMany({ where: { question: { tryoutId: id } } });
        await tx.tryoutQuestion.deleteMany({ where: { tryoutId: id } });
        return tx.tryout.update({
          where: { id },
          data: {
            ...updateData,
            totalQuestions,
            questions: {
                create: questions.map((question, index) => ({
                  prompt: question.prompt,
                  imageUrl: question.imageUrl ?? null,
                  explanation: question.explanation ?? null,
                  explanationImageUrl: question.explanationImageUrl ?? null,
                  order: question.order ?? index + 1,
                  options: {
                    create: question.options.map((option) => ({
                      label: option.label,
                      imageUrl: option.imageUrl ?? null,
                    isCorrect: option.isCorrect ?? false,
                  })),
                },
              })),
            },
          },
          include: { subCategory: { include: { category: true } }, questions: { include: { options: true }, orderBy: { order: 'asc' } } },
        });
      });
      res.json({ status: 'success', data });
      return;
    }

    const data = await prisma.tryout.update({
      where: { id },
      data: updateData,
      include: { subCategory: { include: { category: true } }, questions: { include: { options: true }, orderBy: { order: 'asc' } } },
    });
    res.json({ status: 'success', data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target) ? error.meta?.target.join(',') : String(error.meta?.target ?? '');
      if (target.includes('sessionOrder') || target.includes('subCategoryId')) {
        next(new HttpError('Urutan sesi sudah digunakan. Pilih urutan sesi lain.', 400));
        return;
      }
    }
    next(error);
  }
}

export async function updateTryoutFreeAdminController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    const payload = req.body as { isFree: boolean; freeForNewMembers?: boolean; freePackageIds?: string[] };
    const freePackageIds =
      Array.isArray(payload.freePackageIds) && payload.freePackageIds.length
        ? payload.freePackageIds
        : [];
    const data = await prisma.tryout.update({
      where: { id },
      data: {
        isFree: payload.isFree,
        freeForNewMembers: payload.freeForNewMembers ?? true,
        freePackageIds,
      },
      include: { subCategory: { include: { category: true } } },
    });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function deleteTryoutController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    await prisma.$transaction([
      prisma.tryoutAnswer.deleteMany({ where: { question: { tryoutId: id } } }),
      prisma.tryoutResult.deleteMany({ where: { tryoutId: id } }),
      prisma.tryoutOption.deleteMany({ where: { question: { tryoutId: id } } }),
      prisma.tryoutQuestion.deleteMany({ where: { tryoutId: id } }),
      prisma.tryout.delete({ where: { id } }),
    ]);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function listPracticeCategoriesController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await prisma.practiceCategory.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { subCategories: true } } },
    });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function listPracticeSubCategoriesController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await prisma.practiceSubCategory.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        _count: { select: { subSubs: true } },
      },
    });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function createPracticeSubCategoryController(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = req.body as { name: string; slug: string; categoryId: string; imageUrl?: string };
    const imageFile = getFile(req, 'image');
    const imageUrl = imageFile ? buildPublicUploadPath(imageFile.path) : payload.imageUrl?.trim() || null;
    const data = await prisma.practiceSubCategory.create({
      data: {
        name: payload.name,
        slug: payload.slug,
        categoryId: payload.categoryId,
        imageUrl,
      },
    });
    res.status(201).json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function updatePracticeSubCategoryController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    const imageFile = getFile(req, 'image');
    if (!imageFile) {
      ensurePayload(req.body);
    }
    const payload = req.body as { name?: string; slug?: string; categoryId?: string; imageUrl?: string };
    const updateData: Record<string, unknown> = { ...payload };
    if (imageFile) {
      updateData.imageUrl = buildPublicUploadPath(imageFile.path);
    } else if (payload.imageUrl !== undefined) {
      updateData.imageUrl = payload.imageUrl?.trim() || null;
    }
    const data = await prisma.practiceSubCategory.update({ where: { id }, data: updateData });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function deletePracticeSubCategoryController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    await prisma.practiceSubCategory.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function listPracticeSubSubCategoriesController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await prisma.practiceSubSubCategory.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        subCategory: { include: { category: true } },
        _count: { select: { sets: true } },
      },
    });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function createPracticeSubSubCategoryController(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = req.body as { name: string; slug: string; subCategoryId: string; imageUrl?: string };
    const imageFile = getFile(req, 'image');
    const imageUrl = imageFile ? buildPublicUploadPath(imageFile.path) : payload.imageUrl?.trim() || null;
    const data = await prisma.practiceSubSubCategory.create({
      data: {
        name: payload.name,
        slug: payload.slug,
        subCategoryId: payload.subCategoryId,
        imageUrl,
      },
    });
    res.status(201).json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function updatePracticeSubSubCategoryController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    const imageFile = getFile(req, 'image');
    if (!imageFile) {
      ensurePayload(req.body);
    }
    const payload = req.body as { name?: string; slug?: string; subCategoryId?: string; imageUrl?: string };
    const updateData: Record<string, unknown> = { ...payload };
    if (imageFile) {
      updateData.imageUrl = buildPublicUploadPath(imageFile.path);
    } else if (payload.imageUrl !== undefined) {
      updateData.imageUrl = payload.imageUrl?.trim() || null;
    }
    const data = await prisma.practiceSubSubCategory.update({ where: { id }, data: updateData });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function deletePracticeSubSubCategoryController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    await prisma.practiceSubSubCategory.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function createPracticeCategoryController(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = req.body as { name: string; slug: string; imageUrl?: string };
    const imageFile = getFile(req, 'image');
    const imageUrl = imageFile ? buildPublicUploadPath(imageFile.path) : payload.imageUrl?.trim() || null;
    const data = await prisma.practiceCategory.create({
      data: {
        name: payload.name,
        slug: payload.slug,
        imageUrl,
      },
    });
    res.status(201).json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function updatePracticeCategoryController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    const imageFile = getFile(req, 'image');
    if (!imageFile) {
      ensurePayload(req.body);
    }
    const payload = req.body as { name?: string; slug?: string; imageUrl?: string };
    const updateData: Record<string, unknown> = { ...payload };
    if (imageFile) {
      updateData.imageUrl = buildPublicUploadPath(imageFile.path);
    } else if (payload.imageUrl !== undefined) {
      updateData.imageUrl = payload.imageUrl?.trim() || null;
    }
    const data = await prisma.practiceCategory.update({ where: { id }, data: updateData });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function deletePracticeCategoryController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    await prisma.practiceCategory.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function listPracticeSetsController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await prisma.practiceSet.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        subSubCategory: { include: { subCategory: { include: { category: true } } } },
        questions: { include: { options: true }, orderBy: { order: 'asc' } },
      },
    });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function exportPracticeManagementController(_req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await prisma.practiceCategory.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        subCategories: {
          orderBy: { createdAt: 'desc' },
          include: {
            subSubs: {
              orderBy: { createdAt: 'desc' },
              include: {
                sets: {
                  orderBy: { createdAt: 'desc' },
                  select: {
                    id: true,
                    title: true,
                    slug: true,
                    description: true,
                    level: true,
                    durationMinutes: true,
                    totalQuestions: true,
                    isFree: true,
                    freeForNewMembers: true,
                    freePackageIds: true,
                    openAt: true,
                    closeAt: true,
                    createdAt: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const rows: Array<Record<string, string | number | null | undefined>> = [];

    categories.forEach((category) => {
      if (category.subCategories.length === 0) {
        rows.push({
          categoryId: category.id,
          categoryName: category.name,
          categorySlug: category.slug,
          subCategoryId: '',
          subCategoryName: '',
          subCategorySlug: '',
          subSubCategoryId: '',
          subSubCategoryName: '',
          subSubCategorySlug: '',
          setId: '',
          setTitle: '',
          setSlug: '',
          description: '',
          level: '',
          durationMinutes: '',
          totalQuestions: '',
          isFree: '',
          freeForNewMembers: '',
          freePackageIds: '',
          openAt: '',
          closeAt: '',
          createdAt: '',
        });
        return;
      }

      category.subCategories.forEach((subCategory) => {
        if (subCategory.subSubs.length === 0) {
          rows.push({
            categoryId: category.id,
            categoryName: category.name,
            categorySlug: category.slug,
            subCategoryId: subCategory.id,
            subCategoryName: subCategory.name,
            subCategorySlug: subCategory.slug,
            subSubCategoryId: '',
            subSubCategoryName: '',
            subSubCategorySlug: '',
            setId: '',
            setTitle: '',
            setSlug: '',
            description: '',
            level: '',
            durationMinutes: '',
            totalQuestions: '',
            isFree: '',
            freeForNewMembers: '',
            freePackageIds: '',
            openAt: '',
            closeAt: '',
            createdAt: '',
          });
          return;
        }

        subCategory.subSubs.forEach((subSubCategory) => {
          if (subSubCategory.sets.length === 0) {
            rows.push({
              categoryId: category.id,
              categoryName: category.name,
              categorySlug: category.slug,
              subCategoryId: subCategory.id,
              subCategoryName: subCategory.name,
              subCategorySlug: subCategory.slug,
              subSubCategoryId: subSubCategory.id,
              subSubCategoryName: subSubCategory.name,
              subSubCategorySlug: subSubCategory.slug,
              setId: '',
              setTitle: '',
              setSlug: '',
              description: '',
              level: '',
              durationMinutes: '',
              totalQuestions: '',
              isFree: '',
              freeForNewMembers: '',
              freePackageIds: '',
              openAt: '',
              closeAt: '',
              createdAt: '',
            });
            return;
          }

          subSubCategory.sets.forEach((set) => {
            rows.push({
              categoryId: category.id,
              categoryName: category.name,
              categorySlug: category.slug,
              subCategoryId: subCategory.id,
              subCategoryName: subCategory.name,
              subCategorySlug: subCategory.slug,
              subSubCategoryId: subSubCategory.id,
              subSubCategoryName: subSubCategory.name,
              subSubCategorySlug: subSubCategory.slug,
              setId: set.id,
              setTitle: set.title,
              setSlug: set.slug,
              description: set.description,
              level: set.level ?? '',
              durationMinutes: set.durationMinutes,
              totalQuestions: set.totalQuestions,
              isFree: set.isFree ? 'TRUE' : 'FALSE',
              freeForNewMembers: set.freeForNewMembers ? 'TRUE' : 'FALSE',
              freePackageIds: JSON.stringify(set.freePackageIds ?? []),
              openAt: set.openAt?.toISOString() ?? '',
              closeAt: set.closeAt?.toISOString() ?? '',
              createdAt: set.createdAt.toISOString(),
            });
          });
        });
      });
    });

    const csv = toCsv(rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="latihan-bank-soal.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
}

export async function exportPracticeQuestionsCsvAdminController(req: Request, res: Response, next: NextFunction) {
  try {
    const setId = typeof req.query.setId === 'string' && req.query.setId.trim() ? req.query.setId.trim() : null;
    const sets = await prisma.practiceSet.findMany({
      where: setId ? { id: setId } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        subSubCategory: { include: { subCategory: { include: { category: true } } } },
        questions: {
          orderBy: { order: 'asc' },
          include: {
            options: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });

    if (setId && sets.length === 0) {
      throw new HttpError('Set latihan tidak ditemukan', 404);
    }

    const rows: Array<Record<string, string | number | null | undefined>> = [];
    sets.forEach((set) => {
      set.questions.forEach((question) => {
        rows.push({
          exam_type: 'PRACTICE',
          category: set.subSubCategory.subCategory.category.name,
          sub_category: set.subSubCategory.subCategory.name,
          sub_sub_category: set.subSubCategory.name,
          item_id: set.id,
          item_name: set.title,
          item_slug: set.slug,
          prompt: question.prompt,
          prompt_image: question.imageUrl ?? '',
          explanation: question.explanation ?? '',
          explanationImageUrl: question.explanationImageUrl ?? '',
          order: question.order,
          ...mapOptionsToCsvFields(question.options),
        });
      });
    });

    const csv = toCsvWithHeaders([...questionExportHeaders], rows);
    const singleSet = sets[0];
    const filename = setId && singleSet ? `soal-latihan-${singleSet.slug}.csv` : 'soal-latihan-semua.csv';

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
}

export async function createPracticeSetController(req: Request, res: Response, next: NextFunction) {
  try {
      const payload = req.body as {
        title: string;
        slug: string;
        description?: string;
        level?: string;
        subSubCategoryId: string;
        durationMinutes?: number;
        totalQuestions?: number;
        openAt?: string;
        closeAt?: string;
        isFree?: boolean;
      };
    const levelValue = payload.level && payload.level.trim() ? payload.level.trim() : null;
    const questionsFile = getFile(req, 'questionsCsv');
    if (!questionsFile) {
      throw new HttpError('File CSV soal wajib diunggah.', 400);
    }
    let questions;
    try {
      questions = parsePracticeCsv(questionsFile.path);
    } catch (error) {
      throw new HttpError('CSV soal tidak valid. Gunakan template terbaru dan pastikan format kolom sesuai.', 400, {
        error: String(error),
      });
    }
    if (!questions.length) {
      throw new HttpError('CSV soal kosong atau tidak valid.', 400);
    }
    const coverFile = getFile(req, 'coverImage');
    const coverImageUrl = coverFile ? buildPublicUploadPath(coverFile.path) : null;
    const trimmedDescription = payload.description?.trim();
    const safeDescription =
      trimmedDescription && trimmedDescription.length >= 5
        ? trimmedDescription
        : `${payload.title} - Latihan Soal dengan ${questions.length} soal`;
    const totalQuestions = payload.totalQuestions ?? questions.length;
    const data = await prisma.practiceSet.create({
        data: {
          title: payload.title,
          slug: payload.slug,
          description: safeDescription,
          coverImageUrl,
          level: levelValue,
          durationMinutes: payload.durationMinutes ?? 30,
          totalQuestions,
          isFree: payload.isFree ?? false,
          openAt: payload.openAt ? new Date(payload.openAt) : null,
          closeAt: payload.closeAt ? new Date(payload.closeAt) : null,
          subSubCategoryId: payload.subSubCategoryId,
        questions: {
            create: questions.map((question, index) => ({
              prompt: question.prompt,
              imageUrl: question.imageUrl ?? null,
              explanation: question.explanation ?? null,
              explanationImageUrl: question.explanationImageUrl ?? null,
              order: question.order ?? index + 1,
              options: {
                create: question.options.map((option) => ({
                  label: option.label,
                  imageUrl: option.imageUrl ?? null,
                isCorrect: option.isCorrect ?? false,
              })),
            },
          })),
        },
      },
      include: { subSubCategory: { include: { subCategory: { include: { category: true } } } }, questions: { include: { options: true } } },
    });

    res.status(201).json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function updatePracticeSetController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
      const payload = req.body as {
        title?: string;
        slug?: string;
        description?: string;
        level?: string | null;
        subSubCategoryId?: string;
        durationMinutes?: number;
        totalQuestions?: number;
        openAt?: string | null;
        closeAt?: string | null;
        isFree?: boolean;
      };

    const coverFile = getFile(req, 'coverImage');
    const questionsFile = getFile(req, 'questionsCsv');

    const updateData: Record<string, unknown> = {};
    if (payload.title !== undefined) updateData.title = payload.title;
    if (payload.slug !== undefined) updateData.slug = payload.slug;
    if (payload.description !== undefined) {
      const trimmedDescription = payload.description?.trim();
      if (trimmedDescription) {
        updateData.description = trimmedDescription;
      }
    }
    if (payload.level !== undefined) {
      updateData.level = payload.level && payload.level.trim() ? payload.level.trim() : null;
    }
      if (payload.durationMinutes !== undefined) updateData.durationMinutes = payload.durationMinutes;
      if (payload.totalQuestions !== undefined) updateData.totalQuestions = payload.totalQuestions;
      if (payload.isFree !== undefined) updateData.isFree = payload.isFree;
      if (payload.subSubCategoryId !== undefined) updateData.subSubCategoryId = payload.subSubCategoryId;
    if (payload.openAt !== undefined) {
      updateData.openAt = payload.openAt ? new Date(payload.openAt) : null;
    }
    if (payload.closeAt !== undefined) {
      updateData.closeAt = payload.closeAt ? new Date(payload.closeAt) : null;
    }
    if (coverFile) {
      updateData.coverImageUrl = buildPublicUploadPath(coverFile.path);
    }

    if (questionsFile) {
      let questions;
      try {
        questions = parsePracticeCsv(questionsFile.path);
      } catch (error) {
        throw new HttpError('CSV soal tidak valid. Gunakan template terbaru dan pastikan format kolom sesuai.', 400, {
          error: String(error),
        });
      }
      if (!questions.length) {
        throw new HttpError('CSV soal kosong atau tidak valid.', 400);
      }
      const totalQuestions = payload.totalQuestions ?? questions.length;
      const data = await prisma.$transaction(async (tx) => {
        await tx.practiceAnswer.deleteMany({ where: { question: { setId: id } } });
        await tx.practiceQuestion.deleteMany({ where: { setId: id } });
        return tx.practiceSet.update({
          where: { id },
          data: {
            ...updateData,
            totalQuestions,
            questions: {
                create: questions.map((question, index) => ({
                  prompt: question.prompt,
                  imageUrl: question.imageUrl ?? null,
                  explanation: question.explanation ?? null,
                  explanationImageUrl: question.explanationImageUrl ?? null,
                  order: question.order ?? index + 1,
                  options: {
                    create: question.options.map((option) => ({
                      label: option.label,
                      imageUrl: option.imageUrl ?? null,
                    isCorrect: option.isCorrect ?? false,
                  })),
                },
              })),
            },
          },
          include: { subSubCategory: { include: { subCategory: { include: { category: true } } } }, questions: { include: { options: true }, orderBy: { order: 'asc' } } },
        });
      });
      res.json({ status: 'success', data });
      return;
    }

    const data = await prisma.practiceSet.update({
      where: { id },
      data: updateData,
      include: { subSubCategory: { include: { subCategory: { include: { category: true } } } }, questions: { include: { options: true }, orderBy: { order: 'asc' } } },
    });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function updatePracticeSetFreeAdminController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    const payload = req.body as { isFree: boolean; freeForNewMembers?: boolean; freePackageIds?: string[] };
    const freePackageIds =
      Array.isArray(payload.freePackageIds) && payload.freePackageIds.length
        ? payload.freePackageIds
        : [];
    const data = await prisma.practiceSet.update({
      where: { id },
      data: {
        isFree: payload.isFree,
        freeForNewMembers: payload.freeForNewMembers ?? true,
        freePackageIds,
      },
      include: { subSubCategory: { include: { subCategory: { include: { category: true } } } } },
    });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function deletePracticeSetController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    await prisma.$transaction([
      prisma.practiceAnswer.deleteMany({ where: { question: { setId: id } } }),
      prisma.practiceResult.deleteMany({ where: { setId: id } }),
      prisma.practiceOption.deleteMany({ where: { question: { setId: id } } }),
      prisma.practiceQuestion.deleteMany({ where: { setId: id } }),
      prisma.practiceSet.delete({ where: { id } }),
    ]);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function listMaterialsAdminController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await prisma.material.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function exportMaterialsAdminController(_req: Request, res: Response, next: NextFunction) {
  try {
    const materials = await prisma.material.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        uploadedBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    const csv = toCsv(
      materials.map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category,
        type: item.type,
        description: item.description ?? '',
        fileUrl: item.fileUrl,
        uploadedByName: item.uploadedBy?.name ?? '',
        uploadedByEmail: item.uploadedBy?.email ?? '',
        createdAt: item.createdAt.toISOString(),
      })),
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="daftar-materi.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
}

export async function createMaterialAdminController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await prisma.material.create({ data: { ...req.body, uploadedById: req.user?.id ?? null } });
    res.status(201).json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function updateMaterialAdminController(req: Request, res: Response, next: NextFunction) {
  try {
    ensurePayload(req.body);
    const id = getIdParam(req);
    const data = await prisma.material.update({ where: { id }, data: req.body });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function deleteMaterialAdminController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    await prisma.material.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function listMembershipPackagesController(_req: Request, res: Response, next: NextFunction) {
  try {
    const packages = await prisma.membershipPackage.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
      include: { materials: { select: { materialId: true } } },
    });
    const data = packages.map((pkg) => ({
      ...pkg,
      features: (pkg.features as string[]) ?? [],
      materialIds: pkg.materials.map((mat) => mat.materialId),
    }));
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function createMembershipPackageController(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as { features?: string[]; materialIds?: string[] };
    const { materialIds = [], features, ...rest } = req.body;
    const data = await prisma.membershipPackage.create({
      data: {
        ...rest,
        features: body.features ?? [],
        materials: materialIds.length
          ? {
              createMany: {
                data: materialIds.map((materialId: string) => ({ materialId })),
              },
            }
          : undefined,
      },
      include: { materials: { select: { materialId: true } } },
    });
    res.status(201).json({
      status: 'success',
      data: { ...data, features: (data.features as string[]) ?? [], materialIds: data.materials.map((mat) => mat.materialId) },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateMembershipPackageController(req: Request, res: Response, next: NextFunction) {
  try {
    ensurePayload(req.body);
    const body = req.body as { features?: string[]; materialIds?: string[] };
    const { materialIds, features, ...rest } = req.body;
    const id = getIdParam(req);
    const data = await prisma.$transaction(async (tx) => {
      const updated = await tx.membershipPackage.update({
        where: { id },
        data: {
          ...rest,
          features: body.features ?? undefined,
        },
        include: { materials: { select: { materialId: true } } },
      });

      if (Array.isArray(materialIds)) {
        await tx.packageMaterial.deleteMany({ where: { packageId: id, materialId: { notIn: materialIds } } });
        const existing = await tx.packageMaterial.findMany({ where: { packageId: id }, select: { materialId: true } });
        const existingIds = new Set(existing.map((item) => item.materialId));
        const createData = materialIds
          .filter((materialId) => !existingIds.has(materialId))
          .map((materialId) => ({ packageId: id, materialId }));
        if (createData.length) {
          await tx.packageMaterial.createMany({ data: createData });
        }
      }

      return tx.membershipPackage.findUnique({
        where: { id },
        include: { materials: { select: { materialId: true } } },
      });
    });

    if (!data) {
      throw new HttpError('Paket tidak ditemukan', 404);
    }

    res.json({
      status: 'success',
      data: {
        ...data,
        features: (data.features as string[]) ?? [],
        materialIds: data.materials.map((mat) => mat.materialId),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteMembershipPackageController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    const transactionCount = await prisma.transaction.count({ where: { packageId: id } });
    if (transactionCount > 0) {
      await prisma.membershipPackage.update({
        where: { id },
        data: { isActive: false },
      });
      res.status(204).send();
      return;
    }
    await prisma.membershipPackage.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function listAddonPackagesAdminController(_req: Request, res: Response, next: NextFunction) {
  try {
    const addons = await prisma.addonPackage.findMany({
      orderBy: { price: 'asc' },
      include: { materials: { select: { materialId: true } } },
    });
    const data = addons.map((addon) => ({
      ...addon,
      materialIds: addon.materials.map((item) => item.materialId),
    }));
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function createAddonPackageController(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as { materialIds?: string[] };
    const { materialIds = [], ...rest } = req.body;
    const data = await prisma.addonPackage.create({
      data: {
        ...rest,
        materials: materialIds.length
          ? {
              createMany: {
                data: materialIds.map((materialId: string) => ({ materialId })),
              },
            }
          : undefined,
      },
      include: { materials: { select: { materialId: true } } },
    });
    res.status(201).json({
      status: 'success',
      data: { ...data, materialIds: data.materials.map((item) => item.materialId) },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAddonPackageController(req: Request, res: Response, next: NextFunction) {
  try {
    ensurePayload(req.body);
    const body = req.body as { materialIds?: string[] };
    const { materialIds, ...rest } = req.body;
    const id = getIdParam(req);
    const data = await prisma.$transaction(async (tx) => {
      await tx.addonPackage.update({ where: { id }, data: { ...rest } });
      if (Array.isArray(materialIds)) {
        await tx.addonPackageMaterial.deleteMany({ where: { addonId: id, materialId: { notIn: materialIds } } });
        const existing = await tx.addonPackageMaterial.findMany({ where: { addonId: id }, select: { materialId: true } });
        const existingIds = new Set(existing.map((item) => item.materialId));
        const createData = materialIds
          .filter((materialId) => !existingIds.has(materialId))
          .map((materialId) => ({ addonId: id, materialId }));
        if (createData.length) {
          await tx.addonPackageMaterial.createMany({ data: createData });
        }
      }

      return tx.addonPackage.findUnique({
        where: { id },
        include: { materials: { select: { materialId: true } } },
      });
    });

    if (!data) {
      throw new HttpError('Addon tidak ditemukan', 404);
    }

    res.json({
      status: 'success',
      data: {
        ...data,
        materialIds: data.materials.map((item) => item.materialId),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteAddonPackageController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    await prisma.addonPackage.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function listTransactionsAdminController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        package: { select: { name: true } },
        addon: { select: { name: true } },
      },
    });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function updateTransactionStatusController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    const data = await adminUpdateTransaction(id, req.body.status);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function getPaymentSettingAdminController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getPaymentSetting();
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function updatePaymentSettingAdminController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await updatePaymentSetting(req.body);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function listHeroSlidesController(req: Request, res: Response, next: NextFunction) {
  try {
    const slides = await prisma.heroSlide.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] });
    res.json({
      status: 'success',
      data: slides.map((slide) => ({ ...slide, imageUrl: withOrigin(req, slide.imageUrl) })),
    });
  } catch (error) {
    next(error);
  }
}

export async function createHeroSlideController(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file;
    if (!file) {
      throw new HttpError('File slide wajib diunggah', 400);
    }
    const publicPath = buildPublicUploadPath(file.path);
    const position = await prisma.heroSlide.count();
    const slide = await prisma.heroSlide.create({ data: { imageUrl: publicPath, order: position } });
    res.status(201).json({ status: 'success', data: { ...slide, imageUrl: withOrigin(req, slide.imageUrl) } });
  } catch (error) {
    next(error);
  }
}

export async function deleteHeroSlideController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    await prisma.heroSlide.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function listMemberSlidesController(_req: Request, res: Response, next: NextFunction) {
  try {
    const slides = await prisma.memberOverviewSlide.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] });
    res.json({ status: 'success', data: slides });
  } catch (error) {
    next(error);
  }
}

export async function createMemberSlideController(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = req.body as {
      title?: string;
      subtitle?: string;
      imageUrl: string;
      ctaLabel?: string;
      ctaLink?: string;
      order?: number;
    };
    const fallbackOrder = await prisma.memberOverviewSlide.count();
    const slide = await prisma.memberOverviewSlide.create({
      data: {
        title: payload.title ?? null,
        subtitle: payload.subtitle ?? null,
        imageUrl: payload.imageUrl,
        ctaLabel: payload.ctaLabel ?? null,
        ctaLink: payload.ctaLink ?? null,
        order: payload.order ?? fallbackOrder,
      },
    });
    res.status(201).json({ status: 'success', data: slide });
  } catch (error) {
    next(error);
  }
}

export async function updateMemberSlideController(req: Request, res: Response, next: NextFunction) {
  try {
    ensurePayload(req.body);
    const id = getIdParam(req);
    const slide = await prisma.memberOverviewSlide.update({ where: { id }, data: req.body });
    res.json({ status: 'success', data: slide });
  } catch (error) {
    next(error);
  }
}

export async function deleteMemberSlideController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    await prisma.memberOverviewSlide.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function listContactMessagesAdminController(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(parseInt((req.query.page as string) ?? '1', 10), 1);
    const limit = Math.max(Math.min(parseInt((req.query.limit as string) ?? '20', 10) || 20, 100), 5);
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.contactMessage.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          message: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.contactMessage.count(),
    ]);
    res.json({ status: 'success', data: { items, total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
}

export async function getContactConfigAdminController(_req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await prisma.siteSetting.findMany({ where: { key: { in: [...siteContactKeys] } } });
    res.json({ status: 'success', data: buildContactConfig(settings) });
  } catch (error) {
    next(error);
  }
}

export async function updateContactConfigAdminController(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, whatsappPrimary, whatsappConsult, companyAddress } = req.body as {
      email: string;
      whatsappPrimary: string;
      whatsappConsult: string;
      companyAddress: string;
    };

    await prisma.$transaction([
      prisma.siteSetting.upsert({
        where: { key: 'company_email' },
        update: { value: email },
        create: { key: 'company_email', value: email },
      }),
      prisma.siteSetting.upsert({
        where: { key: 'whatsapp_primary' },
        update: { value: whatsappPrimary },
        create: { key: 'whatsapp_primary', value: whatsappPrimary },
      }),
      prisma.siteSetting.upsert({
        where: { key: 'whatsapp_consult' },
        update: { value: whatsappConsult },
        create: { key: 'whatsapp_consult', value: whatsappConsult },
      }),
      prisma.siteSetting.upsert({
        where: { key: 'company_address' },
        update: { value: companyAddress },
        create: { key: 'company_address', value: companyAddress },
      }),
    ]);

    res.json({ status: 'success', data: { email, whatsappPrimary, whatsappConsult, companyAddress } });
  } catch (error) {
    next(error);
  }
}

export async function getMemberBackgroundAdminController(_req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await prisma.siteSetting.findMany({ where: { key: { in: [...memberBackgroundKeys] } } });
    res.json({ status: 'success', data: buildMemberBackgroundConfig(settings) });
  } catch (error) {
    next(error);
  }
}

export async function updateMemberBackgroundAdminController(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = req.body as { enabled?: boolean; removeImage?: boolean };
    const imageFile = getFile(req, 'image');
    const removeImage = payload.removeImage !== undefined ? String(payload.removeImage) === 'true' || payload.removeImage === true : false;
    const enabled = payload.enabled !== undefined ? String(payload.enabled) === 'true' || payload.enabled === true : false;

    const settings = await prisma.siteSetting.findMany({ where: { key: { in: [...memberBackgroundKeys] } } });
    const current = buildMemberBackgroundConfig(settings);
    const nextImageUrl = removeImage ? null : imageFile ? buildPublicUploadPath(imageFile.path) : current.imageUrl;

    await prisma.$transaction([
      prisma.siteSetting.upsert({
        where: { key: 'member_area_background_enabled' },
        update: { value: String(enabled) },
        create: { key: 'member_area_background_enabled', value: String(enabled) },
      }),
      prisma.siteSetting.upsert({
        where: { key: 'member_area_background_image' },
        update: { value: nextImageUrl ?? '' },
        create: { key: 'member_area_background_image', value: nextImageUrl ?? '' },
      }),
    ]);

    res.json({ status: 'success', data: { enabled, imageUrl: nextImageUrl } });
  } catch (error) {
    next(error);
  }
}

export async function getExamControlAdminController(_req: Request, res: Response, next: NextFunction) {
  try {
    const config = await getExamControlConfig();
      res.json({
        status: 'success',
        data: {
          enabled: config.enabled,
          targetAll: config.targetAll,
          targetPackageIds: Array.isArray(config.targetPackageIds) ? config.targetPackageIds : [],
          tryoutQuota: config.tryoutQuota,
          examQuota: config.examQuota,
          startAt: config.startAt ? config.startAt.toISOString() : null,
          endAt: config.endAt ? config.endAt.toISOString() : null,
        },
      });
  } catch (error) {
    next(error);
  }
}

export async function getExamBlockConfigAdminController(_req: Request, res: Response, next: NextFunction) {
  try {
    const config = await getExamBlockConfig();
    res.json({ status: 'success', data: config });
  } catch (error) {
    next(error);
  }
}

export async function updateExamControlAdminController(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = req.body as {
      enabled: boolean;
        targetAll: boolean;
        targetPackageIds?: string[];
        tryoutQuota: number;
        examQuota: number;
        startAt?: string;
        endAt?: string;
      };
      const config = await updateExamControlConfig({
        enabled: payload.enabled,
        targetAll: payload.targetAll,
        targetPackageIds: payload.targetPackageIds ?? [],
        tryoutQuota: payload.tryoutQuota,
        examQuota: payload.examQuota,
        startAt: payload.startAt ?? null,
        endAt: payload.endAt ?? null,
      });
      res.json({
        status: 'success',
        data: {
          enabled: config.enabled,
          targetAll: config.targetAll,
          targetPackageIds: Array.isArray(config.targetPackageIds) ? config.targetPackageIds : [],
          tryoutQuota: config.tryoutQuota,
          examQuota: config.examQuota,
          startAt: config.startAt ? config.startAt.toISOString() : null,
          endAt: config.endAt ? config.endAt.toISOString() : null,
        },
      });
  } catch (error) {
    next(error);
  }
}

export async function updateExamBlockConfigAdminController(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = req.body as {
      practiceEnabled: boolean;
      tryoutEnabled: boolean;
      examEnabled: boolean;
    };
    const config = await updateExamBlockConfig({
      practiceEnabled: payload.practiceEnabled,
      tryoutEnabled: payload.tryoutEnabled,
      examEnabled: payload.examEnabled,
    });
    res.json({ status: 'success', data: config });
  } catch (error) {
    next(error);
  }
}

export async function getRankingAdminController(req: Request, res: Response, next: NextFunction) {
  try {
    const dateFilter = buildDateFilter(req.query);
    const [tryouts, practices, cermatAttempts] = await Promise.all([
      prisma.tryoutResult.findMany({
        where: {
          ...(dateFilter ? { createdAt: dateFilter } : {}),
          score: { not: null },
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          tryout: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.practiceResult.findMany({
        where: {
          ...(dateFilter ? { createdAt: dateFilter } : {}),
          score: { not: null },
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          set: { select: { title: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.cermatAttempt.findMany({
        where: {
          ...(dateFilter ? { startedAt: dateFilter } : {}),
          averageScore: { not: null },
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { startedAt: 'desc' },
      }),
    ]);

    const summaryMap = new Map<
      string,
      {
        user: { id: string; name: string; email: string };
        tryoutCount: number;
        tryoutTotal: number;
        practiceCount: number;
        practiceTotal: number;
        cermatCount: number;
        cermatTotal: number;
      }
    >();

    tryouts.forEach((result) => {
      if (typeof result.score !== 'number') return;
      const current =
        summaryMap.get(result.userId) ??
        ({
          user: result.user,
          tryoutCount: 0,
          tryoutTotal: 0,
          practiceCount: 0,
          practiceTotal: 0,
          cermatCount: 0,
          cermatTotal: 0,
        } as const);
      summaryMap.set(result.userId, {
        ...current,
        tryoutCount: current.tryoutCount + 1,
        tryoutTotal: current.tryoutTotal + result.score,
      });
    });

    practices.forEach((result) => {
      if (typeof result.score !== 'number') return;
      const current =
        summaryMap.get(result.userId) ??
        ({
          user: result.user,
          tryoutCount: 0,
          tryoutTotal: 0,
          practiceCount: 0,
          practiceTotal: 0,
          cermatCount: 0,
          cermatTotal: 0,
        } as const);
      summaryMap.set(result.userId, {
        ...current,
        practiceCount: current.practiceCount + 1,
        practiceTotal: current.practiceTotal + result.score,
      });
    });

    cermatAttempts.forEach((attempt) => {
      if (typeof attempt.averageScore !== 'number') return;
      const current =
        summaryMap.get(attempt.userId) ??
        ({
          user: attempt.user,
          tryoutCount: 0,
          tryoutTotal: 0,
          practiceCount: 0,
          practiceTotal: 0,
          cermatCount: 0,
          cermatTotal: 0,
        } as const);
      summaryMap.set(attempt.userId, {
        ...current,
        cermatCount: current.cermatCount + 1,
        cermatTotal: current.cermatTotal + attempt.averageScore,
      });
    });

    const summary = Array.from(summaryMap.values())
      .map((item) => {
        const totalCount = item.tryoutCount + item.practiceCount + item.cermatCount;
        const totalScore = item.tryoutTotal + item.practiceTotal + item.cermatTotal;
        return {
          user: item.user,
          tryoutCount: item.tryoutCount,
          tryoutAvg: item.tryoutCount ? item.tryoutTotal / item.tryoutCount : 0,
          practiceCount: item.practiceCount,
          practiceAvg: item.practiceCount ? item.practiceTotal / item.practiceCount : 0,
          cermatCount: item.cermatCount,
          cermatAvg: item.cermatCount ? item.cermatTotal / item.cermatCount : 0,
          overallAvg: totalCount ? totalScore / totalCount : 0,
        };
      })
      .sort((a, b) => {
        if (b.overallAvg !== a.overallAvg) return b.overallAvg - a.overallAvg;
        const countA = a.tryoutCount + a.practiceCount + a.cermatCount;
        const countB = b.tryoutCount + b.practiceCount + b.cermatCount;
        if (countB !== countA) return countB - countA;
        return a.user.name.localeCompare(b.user.name);
      });

    res.json({
      status: 'success',
      data: {
        summary,
        tryouts,
        practices,
        cermat: cermatAttempts,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function exportRankingAdminController(req: Request, res: Response, next: NextFunction) {
  try {
    const dateFilter = buildDateFilter(req.query);
    const [tryouts, practices, cermatAttempts] = await Promise.all([
      prisma.tryoutResult.findMany({
        where: {
          ...(dateFilter ? { createdAt: dateFilter } : {}),
          score: { not: null },
        },
        select: {
          userId: true,
          score: true,
          startedAt: true,
          completedAt: true,
          user: { select: { id: true, name: true, email: true } },
          tryout: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.practiceResult.findMany({
        where: {
          ...(dateFilter ? { createdAt: dateFilter } : {}),
          score: { not: null },
        },
        select: {
          userId: true,
          score: true,
          createdAt: true,
          completedAt: true,
          user: { select: { id: true, name: true, email: true } },
          set: { select: { title: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.cermatAttempt.findMany({
        where: {
          ...(dateFilter ? { startedAt: dateFilter } : {}),
          averageScore: { not: null },
        },
        select: {
          userId: true,
          averageScore: true,
          startedAt: true,
          finishedAt: true,
          mode: true,
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { startedAt: 'desc' },
      }),
    ]);

    const summaryMap = new Map<
      string,
      {
        user: { id: string; name: string; email: string };
        tryoutCount: number;
        tryoutTotal: number;
        practiceCount: number;
        practiceTotal: number;
        tryoutDetails: string[];
        practiceDetails: string[];
        cermatCount: number;
        cermatTotal: number;
        cermatDetails: string[];
      }
    >();

    const formatTime = (value?: Date | null) => (value ? value.toISOString() : '-');

    tryouts.forEach((result) => {
      if (typeof result.score !== 'number') return;
      const current =
        summaryMap.get(result.userId) ??
        ({
          user: result.user,
          tryoutCount: 0,
          tryoutTotal: 0,
          practiceCount: 0,
          practiceTotal: 0,
          tryoutDetails: [],
          practiceDetails: [],
          cermatCount: 0,
          cermatTotal: 0,
          cermatDetails: [],
        } as const);
      const detail = `${result.tryout.name} (${result.score.toFixed(1)}%) [${formatTime(result.startedAt)} - ${formatTime(result.completedAt)}]`;
      summaryMap.set(result.userId, {
        ...current,
        tryoutCount: current.tryoutCount + 1,
        tryoutTotal: current.tryoutTotal + result.score,
        tryoutDetails: [...current.tryoutDetails, detail],
      });
    });

    practices.forEach((result) => {
      if (typeof result.score !== 'number') return;
      const current =
        summaryMap.get(result.userId) ??
        ({
          user: result.user,
          tryoutCount: 0,
          tryoutTotal: 0,
          practiceCount: 0,
          practiceTotal: 0,
          tryoutDetails: [],
          practiceDetails: [],
          cermatCount: 0,
          cermatTotal: 0,
          cermatDetails: [],
        } as const);
      const detail = `${result.set.title} (${result.score.toFixed(1)}%) [${formatTime(result.createdAt)} - ${formatTime(result.completedAt)}]`;
      summaryMap.set(result.userId, {
        ...current,
        practiceCount: current.practiceCount + 1,
        practiceTotal: current.practiceTotal + result.score,
        practiceDetails: [...current.practiceDetails, detail],
      });
    });

    cermatAttempts.forEach((attempt) => {
      if (typeof attempt.averageScore !== 'number') return;
      const current =
        summaryMap.get(attempt.userId) ??
        ({
          user: attempt.user,
          tryoutCount: 0,
          tryoutTotal: 0,
          practiceCount: 0,
          practiceTotal: 0,
          tryoutDetails: [],
          practiceDetails: [],
          cermatCount: 0,
          cermatTotal: 0,
          cermatDetails: [],
        } as const);
      const detail = `${attempt.mode} (${attempt.averageScore.toFixed(1)}%) [${formatTime(attempt.startedAt)} - ${formatTime(attempt.finishedAt)}]`;
      summaryMap.set(attempt.userId, {
        ...current,
        cermatCount: current.cermatCount + 1,
        cermatTotal: current.cermatTotal + attempt.averageScore,
        cermatDetails: [...current.cermatDetails, detail],
      });
    });

    const rows = Array.from(summaryMap.values())
      .map((item) => {
        const totalCount = item.tryoutCount + item.practiceCount + item.cermatCount;
        const totalScore = item.tryoutTotal + item.practiceTotal + item.cermatTotal;
        return {
          memberName: item.user.name,
          email: item.user.email,
          tryoutCount: item.tryoutCount,
          tryoutAvg: Number((item.tryoutCount ? item.tryoutTotal / item.tryoutCount : 0).toFixed(1)),
          practiceCount: item.practiceCount,
          practiceAvg: Number((item.practiceCount ? item.practiceTotal / item.practiceCount : 0).toFixed(1)),
          cermatCount: item.cermatCount,
          cermatAvg: Number((item.cermatCount ? item.cermatTotal / item.cermatCount : 0).toFixed(1)),
          overallAvg: Number((totalCount ? totalScore / totalCount : 0).toFixed(1)),
          tryoutDetails: item.tryoutDetails.join(' | '),
          practiceDetails: item.practiceDetails.join(' | '),
          cermatDetails: item.cermatDetails.join(' | '),
        };
      })
      .sort((a, b) => {
        if (b.overallAvg !== a.overallAvg) return b.overallAvg - a.overallAvg;
        const countA = a.tryoutCount + a.practiceCount + a.cermatCount;
        const countB = b.tryoutCount + b.practiceCount + b.cermatCount;
        if (countB !== countA) return countB - countA;
        return a.memberName.localeCompare(b.memberName);
      });

    const csv = toCsv(rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="ranking-summary.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
}

async function loadWelcomeModalItems() {
  const setting = await prisma.siteSetting.findUnique({ where: { key: 'welcome_modal_items' } });
  if (!setting?.value) return [] as WelcomeModalItem[];
  try {
    const parsed = JSON.parse(setting.value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is WelcomeModalItem => Boolean(item?.id && item?.imageUrl));
    }
    return [];
  } catch {
    return [];
  }
}

async function saveWelcomeModalItems(items: WelcomeModalItem[]) {
  await prisma.siteSetting.upsert({
    where: { key: 'welcome_modal_items' },
    update: { value: JSON.stringify(items) },
    create: { key: 'welcome_modal_items', value: JSON.stringify(items) },
  });
}

export async function listWelcomeModalAdminController(_req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await prisma.siteSetting.findMany({ where: { key: { in: ['welcome_modal_items', 'welcome_modal_image', 'welcome_modal_enabled', 'welcome_modal_link'] } } });
    const items = buildWelcomeModalConfig(settings);
    res.json({ status: 'success', data: items });
  } catch (error) {
    next(error);
  }
}

export async function createWelcomeModalAdminController(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = req.body as { enabled?: boolean; linkUrl?: string };
    const imageFile = getFile(req, 'image');
    if (!imageFile) {
      throw new HttpError('Gambar welcome modal wajib diunggah', 400);
    }
    const imageUrl = buildPublicUploadPath(imageFile.path);
    const linkUrl = payload.linkUrl?.trim() || null;
    const enabled = payload.enabled !== undefined ? String(payload.enabled) === 'true' || payload.enabled === true : true;
    const items = await loadWelcomeModalItems();
    const newItem: WelcomeModalItem = {
      id: nanoid(12),
      imageUrl,
      linkUrl,
      enabled,
      createdAt: new Date().toISOString(),
    };
    await saveWelcomeModalItems([newItem, ...items]);
    res.status(201).json({ status: 'success', data: newItem });
  } catch (error) {
    next(error);
  }
}

export async function updateWelcomeModalAdminController(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    if (!id) throw new HttpError('ID welcome modal tidak valid', 400);
    const payload = req.body as { enabled?: boolean; imageUrl?: string; linkUrl?: string };
    const items = await loadWelcomeModalItems();
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) throw new HttpError('Welcome modal tidak ditemukan', 404);
    const current = items[index];
    if (!current) throw new HttpError('Welcome modal tidak ditemukan', 404);
    const imageFile = getFile(req, 'image');
    const nextItem: WelcomeModalItem = {
      ...current,
      linkUrl: payload.linkUrl?.trim() || null,
      enabled: payload.enabled !== undefined ? String(payload.enabled) === 'true' || payload.enabled === true : current.enabled,
      imageUrl: imageFile ? buildPublicUploadPath(imageFile.path) : current.imageUrl,
    };
    items[index] = nextItem;
    await saveWelcomeModalItems(items);
    res.json({ status: 'success', data: nextItem });
  } catch (error) {
    next(error);
  }
}

export async function deleteWelcomeModalAdminController(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    if (!id) throw new HttpError('ID welcome modal tidak valid', 400);
    const items = await loadWelcomeModalItems();
    const filtered = items.filter((item) => item.id !== id);
    await saveWelcomeModalItems(filtered);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function getCermatConfigAdminController(_req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await prisma.siteSetting.findMany({ where: { key: { in: [...cermatConfigKeys] } } });
    res.json({ status: 'success', data: buildCermatConfig(settings) });
  } catch (error) {
    next(error);
  }
}

export async function updateCermatConfigAdminController(req: Request, res: Response, next: NextFunction) {
  try {
    const { questionCount, durationSeconds, totalSessions, breakSeconds } = req.body as {
      questionCount: number;
      durationSeconds: number;
      totalSessions: number;
      breakSeconds: number;
    };
    await prisma.$transaction([
      prisma.siteSetting.upsert({
        where: { key: 'cermat_question_count' },
        update: { value: String(questionCount) },
        create: { key: 'cermat_question_count', value: String(questionCount) },
      }),
      prisma.siteSetting.upsert({
        where: { key: 'cermat_duration_seconds' },
        update: { value: String(durationSeconds) },
        create: { key: 'cermat_duration_seconds', value: String(durationSeconds) },
      }),
      prisma.siteSetting.upsert({
        where: { key: 'cermat_total_sessions' },
        update: { value: String(totalSessions) },
        create: { key: 'cermat_total_sessions', value: String(totalSessions) },
      }),
      prisma.siteSetting.upsert({
        where: { key: 'cermat_break_seconds' },
        update: { value: String(breakSeconds) },
        create: { key: 'cermat_break_seconds', value: String(breakSeconds) },
      }),
    ]);
    res.json({ status: 'success', data: { questionCount, durationSeconds, totalSessions, breakSeconds } });
  } catch (error) {
    next(error);
  }
}

export async function getPsikoTryoutConfigAdminController(_req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await prisma.siteSetting.findMany({ where: { key: { in: [...psikoTryoutConfigKeys] } } });
    res.json({ status: 'success', data: buildPsikoTryoutConfig(settings) });
  } catch (error) {
    next(error);
  }
}

export async function updatePsikoTryoutConfigAdminController(req: Request, res: Response, next: NextFunction) {
  try {
    const { breakSeconds } = req.body as { breakSeconds: number };
    await prisma.siteSetting.upsert({
      where: { key: 'psiko_tryout_break_seconds' },
      update: { value: String(breakSeconds) },
      create: { key: 'psiko_tryout_break_seconds', value: String(breakSeconds) },
    });
    res.json({ status: 'success', data: { breakSeconds } });
  } catch (error) {
    next(error);
  }
}

export async function getHeroImageController(req: Request, res: Response, next: NextFunction) {
  try {
    const setting = await prisma.siteSetting.findUnique({ where: { key: 'hero_image' } });
    res.json({ status: 'success', data: { imageUrl: withOrigin(req, setting?.value ?? null) } });
  } catch (error) {
    next(error);
  }
}

export async function uploadHeroImageController(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file;
    if (!file) {
      throw new HttpError('File hero wajib diunggah', 400);
    }
    const publicPath = buildPublicUploadPath(file.path);
    const data = await prisma.siteSetting.upsert({
      where: { key: 'hero_image' },
      update: { value: publicPath },
      create: { key: 'hero_image', value: publicPath },
    });
    res.json({ status: 'success', data: { imageUrl: withOrigin(req, data.value) } });
  } catch (error) {
    next(error);
  }
}

export async function adminUsersController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await prisma.user.findMany({
      where: { email: { notIn: hiddenAdminEmails } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        referralCode: true,
        memberArea: { select: { slug: true } },
        _count: {
          select: {
            transactions: true,
            tryoutResults: true,
            practiceResults: true,
          },
        },
      },
    });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function adminUsersExportController(_req: Request, res: Response, next: NextFunction) {
  try {
    const users = await prisma.user.findMany({
      where: { email: { notIn: hiddenAdminEmails } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        referralCode: true,
        memberArea: { select: { slug: true } },
        createdAt: true,
      },
    });

    const csv = toCsv(
      users.map((item) => ({
        id: item.id,
        name: item.name,
        email: item.email,
        phone: item.phone ?? '',
        role: item.role,
        status: item.isActive ? 'AKTIF' : 'NONAKTIF',
        kodeAkses: item.memberArea?.slug ?? '',
        referralCode: item.referralCode ?? '',
        joinedAt: item.createdAt.toISOString(),
      })),
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="manajemen-pengguna.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
}

export async function updateUserRoleController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    const target = await prisma.user.findUnique({ where: { id }, select: { name: true, email: true } });
    if (!target) {
      throw new HttpError('User tidak ditemukan', 404);
    }
    if (target.name === 'Super Admin' || target.email === 'developer@tacticaleducation.id') {
      throw new HttpError('Role Super Admin tidak dapat diubah.', 400);
    }
    const data = await prisma.user.update({ where: { id }, data: { role: req.body.role } });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function updateUserStatusController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    const target = await prisma.user.findUnique({ where: { id }, select: { name: true, email: true } });
    if (!target) {
      throw new HttpError('User tidak ditemukan', 404);
    }
    if (target.name === 'Super Admin' || target.email === 'developer@tacticaleducation.id') {
      throw new HttpError('Akun Super Admin tidak dapat dinonaktifkan.', 400);
    }
    const data = await prisma.user.update({ where: { id }, data: { isActive: req.body.isActive } });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function resetUserPasswordController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    const target = await prisma.user.findUnique({ where: { id }, select: { name: true, email: true } });
    if (!target) {
      throw new HttpError('User tidak ditemukan', 404);
    }
    if (target.name === 'Super Admin' || target.email === 'developer@tacticaleducation.id') {
      throw new HttpError('Password Super Admin tidak dapat direset.', 400);
    }
    const tempPassword = nanoid(10);
    const passwordHash = await hashPassword(tempPassword);
    await prisma.user.update({ where: { id }, data: { passwordHash } });
    res.json({ status: 'success', data: { userId: id, tempPassword } });
  } catch (error) {
    next(error);
  }
}

export async function impersonateUserController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    const data = await createImpersonationSession(id);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function adminMonitoringUsersController(_req: Request, res: Response, next: NextFunction) {
  try {
    const users = await prisma.user.findMany({
      where: { role: 'MEMBER' },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        transactions: {
          where: { type: 'MEMBERSHIP', status: 'PAID' },
          orderBy: { activatedAt: 'desc' },
          take: 1,
          select: {
            activatedAt: true,
            expiresAt: true,
            package: { select: { name: true } },
          },
        },
        tryoutResults: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { score: true, createdAt: true },
        },
        practiceResults: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { score: true, createdAt: true },
        },
        cermatSessions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { correctCount: true, totalQuestions: true, createdAt: true },
        },
      },
    });

    const data = users.map((user) => {
      const membership = user.transactions[0];
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        joinedAt: user.createdAt,
        membership: membership
          ? {
              packageName: membership.package?.name,
              activatedAt: membership.activatedAt,
              expiresAt: membership.expiresAt,
            }
          : null,
        latestTryout: user.tryoutResults[0] ?? null,
        latestPractice: user.practiceResults[0] ?? null,
        latestCermat: user.cermatSessions[0]
          ? {
              correct: user.cermatSessions[0].correctCount,
              total: user.cermatSessions[0].totalQuestions,
              createdAt: user.cermatSessions[0].createdAt,
            }
          : null,
      };
    });

    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function adminMonitoringUserDetailController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        tryoutResults: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            score: true,
            createdAt: true,
            tryout: { select: { name: true } },
          },
        },
        practiceResults: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            score: true,
            createdAt: true,
            set: { select: { title: true } },
          },
        },
        cermatSessions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            correctCount: true,
            totalQuestions: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new HttpError('User tidak ditemukan', 404);
    }

    res.json({ status: 'success', data: user });
  } catch (error) {
    next(error);
  }
}

export async function listExamBlocksAdminController(_req: Request, res: Response, next: NextFunction) {
  try {
    const blocks = await prisma.examBlock.findMany({
      where: { resolvedAt: null },
      orderBy: { blockedAt: 'desc' },
      select: {
        id: true,
        type: true,
        reason: true,
        code: true,
        violationCount: true,
        blockedAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
    res.json({ status: 'success', data: blocks });
  } catch (error) {
    next(error);
  }
}

export async function regenerateExamBlockAdminController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    await regenerateExamBlockCode(id);
    const block = await prisma.examBlock.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        reason: true,
        code: true,
        violationCount: true,
        blockedAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
    if (!block) {
      throw new HttpError('Blokir ujian tidak ditemukan', 404);
    }
    res.json({ status: 'success', data: block });
  } catch (error) {
    next(error);
  }
}

export async function resolveExamBlockAdminController(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getIdParam(req);
    const block = await prisma.examBlock.update({
      where: { id },
      data: { resolvedAt: new Date() },
    });
    res.json({ status: 'success', data: block });
  } catch (error) {
    next(error);
  }
}

export async function grantTryoutQuotaAdminController(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, amount } = req.body as { userId: string; amount: number };
    const data = await grantFreeTryoutQuota(userId, amount);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function adminOverviewController(_req: Request, res: Response, next: NextFunction) {
  try {
    const [users, tryouts, practiceSets, materials, transactions, transactionSum] = await Promise.all([
      prisma.user.count(),
      prisma.tryout.count(),
      prisma.practiceSet.count(),
      prisma.material.count(),
      prisma.transaction.count(),
      prisma.transaction.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
    ]);

    const transactionAmount = transactionSum._sum.amount ?? 0;
    const chartSeries = [
      { label: 'Total Pengguna', value: users },
      { label: 'Tryout Aktif', value: tryouts },
      { label: 'Latihan & Tugas', value: practiceSets },
      { label: 'Materi Belajar', value: materials },
      { label: 'Transaksi', value: transactions },
    ];

    res.json({
      status: 'success',
      data: {
        users,
        tryouts,
        practiceSets,
        materials,
        transactions,
        transactionAmount,
        chartSeries,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function adminReportingSummaryController(req: Request, res: Response, next: NextFunction) {
  try {
    const dateFilter = buildDateFilter(req.query);
    const [members, tryoutCategories, tryoutQuestions, practiceCategories, practiceQuestions] = await Promise.all([
      prisma.user.count({ where: dateFilter ? { role: 'MEMBER', createdAt: dateFilter } : { role: 'MEMBER' } }),
      dateFilter ? prisma.tryoutCategory.count({ where: { createdAt: dateFilter } }) : prisma.tryoutCategory.count(),
      dateFilter ? prisma.tryoutQuestion.count({ where: { createdAt: dateFilter } }) : prisma.tryoutQuestion.count(),
      dateFilter ? prisma.practiceCategory.count({ where: { createdAt: dateFilter } }) : prisma.practiceCategory.count(),
      dateFilter ? prisma.practiceQuestion.count({ where: { createdAt: dateFilter } }) : prisma.practiceQuestion.count(),
    ]);

    res.json({
      status: 'success',
      data: {
        members,
        tryoutCategories,
        tryoutQuestions,
        practiceCategories,
        practiceQuestions,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function adminReportingMembersController(req: Request, res: Response, next: NextFunction) {
  try {
    const dateFilter = buildDateFilter(req.query);
    const sort = req.query.sort === 'asc' ? 'asc' : 'desc';
    const where: Prisma.UserWhereInput = dateFilter
      ? { role: Role.MEMBER, createdAt: dateFilter }
      : { role: Role.MEMBER };
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: sort },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        transactions: {
          where: { type: 'MEMBERSHIP', status: 'PAID' },
          orderBy: { activatedAt: 'desc' },
          take: 1,
          select: { package: { select: { name: true } }, activatedAt: true, expiresAt: true },
        },
        tryoutResults: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { score: true, createdAt: true },
        },
        practiceResults: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { score: true, createdAt: true },
        },
        cermatSessions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { correctCount: true, totalQuestions: true, createdAt: true },
        },
      },
    });

    const data = users.map((user) => {
      const membership = user.transactions[0];
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        joinedAt: user.createdAt,
        membership: membership
          ? {
              packageName: membership.package?.name,
              activatedAt: membership.activatedAt,
              expiresAt: membership.expiresAt,
            }
          : null,
        latestTryout: user.tryoutResults[0] ?? null,
        latestPractice: user.practiceResults[0] ?? null,
        latestCermat: user.cermatSessions[0] ?? null,
      };
    });

    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function adminReportingUsersController(req: Request, res: Response, next: NextFunction) {
  try {
    const dateFilter = buildDateFilter(req.query);
    const sort = req.query.sort === 'asc' ? 'asc' : 'desc';
    const data = await prisma.user.findMany({
      where: dateFilter ? { createdAt: dateFilter } : {},
      orderBy: { createdAt: sort },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        phone: true,
        memberArea: { select: { slug: true } },
      },
    });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function adminReportingExportController(req: Request, res: Response, next: NextFunction) {
  try {
    const type = req.query.type;
    if (type !== 'members' && type !== 'users') {
      throw new HttpError('Tipe export tidak valid', 400);
    }
    const dateFilter = buildDateFilter(req.query);
    const sort = req.query.sort === 'asc' ? 'asc' : 'desc';

    if (type === 'members') {
      const users = await prisma.user.findMany({
        where: dateFilter ? { role: 'MEMBER', createdAt: dateFilter } : { role: 'MEMBER' },
        orderBy: { createdAt: sort },
        select: { id: true, name: true, email: true, phone: true, createdAt: true },
      });
      const csv = toCsv(
        users.map((item) => ({
          id: item.id,
          name: item.name,
          email: item.email,
          phone: item.phone ?? '',
          joinedAt: item.createdAt.toISOString(),
        })),
      );
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="report-members.csv"');
      res.send(csv);
      return;
    }

    const users = await prisma.user.findMany({
      where: dateFilter ? { createdAt: dateFilter } : {},
      orderBy: { createdAt: sort },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, phone: true },
    });
    const csv = toCsv(
      users.map((item) => ({
        id: item.id,
        name: item.name,
        email: item.email,
        role: item.role,
        active: item.isActive ? 'ACTIVE' : 'INACTIVE',
        phone: item.phone ?? '',
        joinedAt: item.createdAt.toISOString(),
      })),
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="report-users.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
}

export async function exportCalculatorsAdminController(_req: Request, res: Response, next: NextFunction) {
  try {
    const calculators = await prisma.psychCalculatorTemplate.findMany({
      where: { type: 'GENERAL' },
      orderBy: [{ category: 'asc' }, { sectionOrder: 'asc' }, { order: 'asc' }],
    });

    const csv = toCsv(
      calculators.map((item) => ({
        id: item.id,
        title: item.title,
        slug: item.slug,
        description: item.description,
        category: item.category,
        categoryLabel: item.categoryLabel,
        section: item.section ?? '',
        sectionLabel: item.sectionLabel ?? '',
        order: item.order,
        sectionOrder: item.sectionOrder,
        configInputs: JSON.stringify((item.config as any)?.inputs ?? []),
        configGroups: JSON.stringify((item.config as any)?.groups ?? []),
        configThresholds: JSON.stringify((item.config as any)?.thresholds ?? []),
      })),
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="daftar-kalkulator.csv"');
    res.send(csv);
  } catch (error) {
    next(error);
  }
}
