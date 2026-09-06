import type { NextFunction, Request, Response } from 'express';
import { createMaterial, listMaterials } from './materials.service';

export async function listMaterialsController(req: Request, res: Response, next: NextFunction) {
  try {
    const filter: { category?: string; type?: 'PDF' | 'VIDEO' | 'LINK' } = {};
    if (typeof req.query.category === 'string' && req.query.category.trim()) {
      filter.category = req.query.category;
    }
    if (typeof req.query.type === 'string') {
      const type = req.query.type.toUpperCase();
      if (type === 'PDF' || type === 'VIDEO' || type === 'LINK') {
        filter.type = type as 'PDF' | 'VIDEO' | 'LINK';
      }
    }
    const data = await listMaterials(filter);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function createMaterialController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await createMaterial(req.user!.id, req.body);
    res.status(201).json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}
