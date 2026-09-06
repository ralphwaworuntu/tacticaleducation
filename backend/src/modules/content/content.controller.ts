import type { NextFunction, Request, Response } from 'express';
import {
  getBimbelPackages,
  getGalleryContent,
  getContactInfo,
  getHomeContent,
  getProfilePage,
  getTestimonials,
} from './content.service';
import { prisma } from '../../config/prisma';
import { HttpError } from '../../middlewares/errorHandler';

export async function homeContentController(req: Request, res: Response, next: NextFunction) {
  try {
    const host = req.get('host');
    const baseUrl = host ? `${req.protocol}://${host}` : undefined;
    const data = await getHomeContent(baseUrl);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function profilePageController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getProfilePage();
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function bimbelPackagesController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getBimbelPackages();
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function galleryController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getGalleryContent();
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function testimonialsController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getTestimonials();
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function contactInfoController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getContactInfo();
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function parentProgressController(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = req.params.slug;
    if (!slug) {
      throw new HttpError('Slug member wajib diisi', 400);
    }
    const memberArea = await prisma.memberArea.findUnique({
      where: { slug },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            createdAt: true,
            transactions: {
              where: { type: 'MEMBERSHIP', status: 'PAID' },
              orderBy: { activatedAt: 'desc' },
              take: 1,
              select: {
                package: { select: { name: true } },
                activatedAt: true,
                expiresAt: true,
              },
            },
          },
        },
      },
    });
    if (!memberArea) {
      throw new HttpError('Data member tidak ditemukan', 404);
    }
    const userId = memberArea.user.id;
    const [tryouts, practices, cermat] = await Promise.all([
      prisma.tryoutResult.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { score: true, createdAt: true, tryout: { select: { name: true } } },
      }),
      prisma.practiceResult.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { score: true, createdAt: true, set: { select: { title: true } } },
      }),
      prisma.cermatSession.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { correctCount: true, totalQuestions: true, createdAt: true },
      }),
    ]);

    const membership = memberArea.user.transactions[0];

    res.json({
      status: 'success',
      data: {
        member: {
          name: memberArea.user.name,
          avatarUrl: memberArea.user.avatarUrl ?? null,
          joinedAt: memberArea.user.createdAt,
        },
        membership: membership
          ? {
              packageName: membership.package?.name ?? null,
              activatedAt: membership.activatedAt,
              expiresAt: membership.expiresAt,
            }
          : null,
        tryouts,
        practices,
        cermat,
      },
    });
  } catch (error) {
    next(error);
  }
}
