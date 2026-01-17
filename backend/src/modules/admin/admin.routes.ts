import { Router } from 'express';
import { validateResource } from '../../middlewares/validateResource';
import { heroImageUpload, examAssetUpload, contentImageUpload, optimizeUploadedImages } from '../../config/upload';
import {
  adminLandingOverviewController,
  createHeroSlideController,
  createMemberSlideController,
  createLandingStatController,
  updateLandingStatController,
  deleteLandingStatController,
  deleteHeroSlideController,
  deleteMemberSlideController,
  createTestimonialController,
  updateTestimonialController,
  deleteTestimonialController,
  createGalleryItemController,
  updateGalleryItemController,
  deleteGalleryItemController,
  createVideoController,
  updateVideoController,
  deleteVideoController,
  createAnnouncementController,
  updateAnnouncementController,
  deleteAnnouncementController,
  createFaqController,
  updateFaqController,
  deleteFaqController,
  createNewsController,
  updateNewsController,
  deleteNewsController,
  listTryoutCategoriesController,
  createTryoutCategoryController,
  updateTryoutCategoryController,
  deleteTryoutCategoryController,
  listTryoutSubCategoriesController,
  createTryoutSubCategoryController,
  updateTryoutSubCategoryController,
  deleteTryoutSubCategoryController,
  listTryoutsController,
  createTryoutController,
  updateTryoutController,
  deleteTryoutController,
  listPracticeCategoriesController,
  createPracticeCategoryController,
  updatePracticeCategoryController,
  deletePracticeCategoryController,
  listPracticeSubCategoriesController,
  createPracticeSubCategoryController,
  updatePracticeSubCategoryController,
  deletePracticeSubCategoryController,
  listPracticeSubSubCategoriesController,
  createPracticeSubSubCategoryController,
  updatePracticeSubSubCategoryController,
  deletePracticeSubSubCategoryController,
  listPracticeSetsController,
  createPracticeSetController,
  updatePracticeSetController,
  deletePracticeSetController,
  listMaterialsAdminController,
  createMaterialAdminController,
  updateMaterialAdminController,
  deleteMaterialAdminController,
  listMembershipPackagesController,
  createMembershipPackageController,
  updateMembershipPackageController,
  deleteMembershipPackageController,
  listAddonPackagesAdminController,
  createAddonPackageController,
  updateAddonPackageController,
  deleteAddonPackageController,
  listTransactionsAdminController,
  updateTransactionStatusController,
  adminUsersController,
  updateUserRoleController,
  updateUserStatusController,
  impersonateUserController,
  resetUserPasswordController,
  adminOverviewController,
  adminReportingSummaryController,
  adminReportingMembersController,
  adminReportingUsersController,
  adminReportingExportController,
  getPaymentSettingAdminController,
  updatePaymentSettingAdminController,
  getHeroImageController,
  getContactConfigAdminController,
  listWelcomeModalAdminController,
  getExamControlAdminController,
  updateExamControlAdminController,
  createWelcomeModalAdminController,
  getCermatConfigAdminController,
  listExamBlocksAdminController,
  listHeroSlidesController,
  listMemberSlidesController,
  resolveExamBlockAdminController,
  grantTryoutQuotaAdminController,
  regenerateExamBlockAdminController,
  updateContactConfigAdminController,
  updateWelcomeModalAdminController,
  deleteWelcomeModalAdminController,
  updateCermatConfigAdminController,
  uploadHeroImageController,
  adminMonitoringUsersController,
  adminMonitoringUserDetailController,
  updateMemberSlideController,
  listContactMessagesAdminController,
} from './admin.controller';
import { adminCalculatorListController, adminCalculatorUpdateController } from '../calculators/calculators.controller';
import { adminCalculatorUpdateSchema } from '../calculators/calculators.schemas';
import monitoringRouter from './monitoring/admin.monitoring.route';
import {
  createLandingStatSchema,
  updateLandingStatSchema,
  createTestimonialSchema,
  updateTestimonialSchema,
  createGalleryItemSchema,
  updateGalleryItemSchema,
  createVideoSchema,
  updateVideoSchema,
  createAnnouncementSchema,
  updateAnnouncementSchema,
  createFaqSchema,
  updateFaqSchema,
  createNewsSchema,
  updateNewsSchema,
  createTryoutCategorySchema,
  updateTryoutCategorySchema,
  createTryoutSubCategorySchema,
  updateTryoutSubCategorySchema,
  createTryoutSchema,
  updateTryoutSchema,
  createPracticeCategorySchema,
  updatePracticeCategorySchema,
  createPracticeSubCategorySchema,
  updatePracticeSubCategorySchema,
  createPracticeSubSubCategorySchema,
  updatePracticeSubSubCategorySchema,
  createPracticeSetSchema,
  updatePracticeSetSchema,
  materialMutationSchema,
  materialUpdateSchema,
  membershipPackageSchema,
  membershipPackageUpdateSchema,
  addonPackageSchema,
  addonPackageUpdateSchema,
  transactionStatusSchema,
  userRoleSchema,
  userStatusSchema,
  userImpersonateSchema,
  userResetPasswordSchema,
  paymentSettingSchema,
  contactConfigSchema,
  examControlSchema,
  cermatConfigSchema,
  createMemberSlideSchema,
  updateMemberSlideSchema,
  grantTryoutQuotaSchema,
} from './admin.schemas';

export const adminRouter = Router();

adminRouter.get('/overview', adminOverviewController);
adminRouter.get('/reporting/summary', adminReportingSummaryController);
adminRouter.get('/reporting/members', adminReportingMembersController);
adminRouter.get('/reporting/users', adminReportingUsersController);
adminRouter.get('/reporting/export', adminReportingExportController);
adminRouter.get('/landing', adminLandingOverviewController);

adminRouter.post('/landing/stats', validateResource(createLandingStatSchema), createLandingStatController);
adminRouter.put('/landing/stats/:id', validateResource(updateLandingStatSchema), updateLandingStatController);
adminRouter.delete('/landing/stats/:id', deleteLandingStatController);

adminRouter.post('/landing/testimonials', validateResource(createTestimonialSchema), createTestimonialController);
adminRouter.put('/landing/testimonials/:id', validateResource(updateTestimonialSchema), updateTestimonialController);
adminRouter.delete('/landing/testimonials/:id', deleteTestimonialController);

adminRouter.post('/landing/gallery', validateResource(createGalleryItemSchema), createGalleryItemController);
adminRouter.put('/landing/gallery/:id', validateResource(updateGalleryItemSchema), updateGalleryItemController);
adminRouter.delete('/landing/gallery/:id', deleteGalleryItemController);

adminRouter.post('/landing/videos', validateResource(createVideoSchema), createVideoController);
adminRouter.put('/landing/videos/:id', validateResource(updateVideoSchema), updateVideoController);
adminRouter.delete('/landing/videos/:id', deleteVideoController);

adminRouter.post(
  '/landing/announcements',
  contentImageUpload.single('image'),
  optimizeUploadedImages,
  validateResource(createAnnouncementSchema),
  createAnnouncementController,
);
adminRouter.put(
  '/landing/announcements/:id',
  contentImageUpload.single('image'),
  optimizeUploadedImages,
  validateResource(updateAnnouncementSchema),
  updateAnnouncementController,
);
adminRouter.delete('/landing/announcements/:id', deleteAnnouncementController);

adminRouter.post('/landing/faq', validateResource(createFaqSchema), createFaqController);
adminRouter.put('/landing/faq/:id', validateResource(updateFaqSchema), updateFaqController);
adminRouter.delete('/landing/faq/:id', deleteFaqController);

adminRouter.post(
  '/landing/news',
  contentImageUpload.single('coverImage'),
  optimizeUploadedImages,
  validateResource(createNewsSchema),
  createNewsController,
);
adminRouter.put(
  '/landing/news/:id',
  contentImageUpload.single('coverImage'),
  optimizeUploadedImages,
  validateResource(updateNewsSchema),
  updateNewsController,
);
adminRouter.delete('/landing/news/:id', deleteNewsController);

adminRouter.get('/tryouts/categories', listTryoutCategoriesController);
adminRouter.post(
  '/tryouts/categories',
  contentImageUpload.single('image'),
  optimizeUploadedImages,
  validateResource(createTryoutCategorySchema),
  createTryoutCategoryController,
);
adminRouter.put(
  '/tryouts/categories/:id',
  contentImageUpload.single('image'),
  optimizeUploadedImages,
  validateResource(updateTryoutCategorySchema),
  updateTryoutCategoryController,
);
adminRouter.delete('/tryouts/categories/:id', deleteTryoutCategoryController);

adminRouter.get('/tryouts/sub-categories', listTryoutSubCategoriesController);
adminRouter.post(
  '/tryouts/sub-categories',
  contentImageUpload.single('image'),
  optimizeUploadedImages,
  validateResource(createTryoutSubCategorySchema),
  createTryoutSubCategoryController,
);
adminRouter.put(
  '/tryouts/sub-categories/:id',
  contentImageUpload.single('image'),
  optimizeUploadedImages,
  validateResource(updateTryoutSubCategorySchema),
  updateTryoutSubCategoryController,
);
adminRouter.delete('/tryouts/sub-categories/:id', deleteTryoutSubCategoryController);

adminRouter.get('/tryouts', listTryoutsController);
adminRouter.post(
  '/tryouts',
  examAssetUpload.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'questionsCsv', maxCount: 1 },
  ]),
  optimizeUploadedImages,
  validateResource(createTryoutSchema),
  createTryoutController,
);
adminRouter.put(
  '/tryouts/:id',
  examAssetUpload.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'questionsCsv', maxCount: 1 },
  ]),
  optimizeUploadedImages,
  validateResource(updateTryoutSchema),
  updateTryoutController,
);
adminRouter.delete('/tryouts/:id', deleteTryoutController);

adminRouter.get('/practice/categories', listPracticeCategoriesController);
adminRouter.post(
  '/practice/categories',
  contentImageUpload.single('image'),
  optimizeUploadedImages,
  validateResource(createPracticeCategorySchema),
  createPracticeCategoryController,
);
adminRouter.put(
  '/practice/categories/:id',
  contentImageUpload.single('image'),
  optimizeUploadedImages,
  validateResource(updatePracticeCategorySchema),
  updatePracticeCategoryController,
);
adminRouter.delete('/practice/categories/:id', deletePracticeCategoryController);

adminRouter.get('/practice/sub-categories', listPracticeSubCategoriesController);
adminRouter.post(
  '/practice/sub-categories',
  contentImageUpload.single('image'),
  optimizeUploadedImages,
  validateResource(createPracticeSubCategorySchema),
  createPracticeSubCategoryController,
);
adminRouter.put(
  '/practice/sub-categories/:id',
  contentImageUpload.single('image'),
  optimizeUploadedImages,
  validateResource(updatePracticeSubCategorySchema),
  updatePracticeSubCategoryController,
);
adminRouter.delete('/practice/sub-categories/:id', deletePracticeSubCategoryController);

adminRouter.get('/practice/sub-sub-categories', listPracticeSubSubCategoriesController);
adminRouter.post(
  '/practice/sub-sub-categories',
  contentImageUpload.single('image'),
  optimizeUploadedImages,
  validateResource(createPracticeSubSubCategorySchema),
  createPracticeSubSubCategoryController,
);
adminRouter.put(
  '/practice/sub-sub-categories/:id',
  contentImageUpload.single('image'),
  optimizeUploadedImages,
  validateResource(updatePracticeSubSubCategorySchema),
  updatePracticeSubSubCategoryController,
);
adminRouter.delete('/practice/sub-sub-categories/:id', deletePracticeSubSubCategoryController);

adminRouter.get('/practice/sets', listPracticeSetsController);
adminRouter.post(
  '/practice/sets',
  examAssetUpload.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'questionsCsv', maxCount: 1 },
  ]),
  optimizeUploadedImages,
  validateResource(createPracticeSetSchema),
  createPracticeSetController,
);
adminRouter.put(
  '/practice/sets/:id',
  examAssetUpload.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'questionsCsv', maxCount: 1 },
  ]),
  optimizeUploadedImages,
  validateResource(updatePracticeSetSchema),
  updatePracticeSetController,
);
adminRouter.delete('/practice/sets/:id', deletePracticeSetController);

adminRouter.get('/materials', listMaterialsAdminController);
adminRouter.post('/materials', validateResource(materialMutationSchema), createMaterialAdminController);
adminRouter.put('/materials/:id', validateResource(materialUpdateSchema), updateMaterialAdminController);
adminRouter.delete('/materials/:id', deleteMaterialAdminController);

adminRouter.get('/packages', listMembershipPackagesController);
adminRouter.post('/packages', validateResource(membershipPackageSchema), createMembershipPackageController);
adminRouter.put('/packages/:id', validateResource(membershipPackageUpdateSchema), updateMembershipPackageController);
adminRouter.delete('/packages/:id', deleteMembershipPackageController);

adminRouter.get('/addons', listAddonPackagesAdminController);
adminRouter.post('/addons', validateResource(addonPackageSchema), createAddonPackageController);
adminRouter.put('/addons/:id', validateResource(addonPackageUpdateSchema), updateAddonPackageController);
adminRouter.delete('/addons/:id', deleteAddonPackageController);

adminRouter.get('/payment-setting', getPaymentSettingAdminController);
adminRouter.put('/payment-setting', validateResource(paymentSettingSchema), updatePaymentSettingAdminController);
adminRouter.get('/site/contact-config', getContactConfigAdminController);
adminRouter.put('/site/contact-config', validateResource(contactConfigSchema), updateContactConfigAdminController);
adminRouter.get('/site/exam-control', getExamControlAdminController);
adminRouter.put('/site/exam-control', validateResource(examControlSchema), updateExamControlAdminController);
adminRouter.get('/site/welcome-modal', listWelcomeModalAdminController);
adminRouter.post('/site/welcome-modal', contentImageUpload.single('image'),
  optimizeUploadedImages, createWelcomeModalAdminController);
adminRouter.put('/site/welcome-modal/:id', contentImageUpload.single('image'),
  optimizeUploadedImages, updateWelcomeModalAdminController);
adminRouter.delete('/site/welcome-modal/:id', deleteWelcomeModalAdminController);
adminRouter.get('/exams/cermat-config', getCermatConfigAdminController);
adminRouter.put('/exams/cermat-config', validateResource(cermatConfigSchema), updateCermatConfigAdminController);
adminRouter.get('/site/hero-image', getHeroImageController);
adminRouter.post('/site/hero-image', heroImageUpload.single('hero'),
  optimizeUploadedImages, uploadHeroImageController);
adminRouter.get('/site/hero-slides', listHeroSlidesController);
adminRouter.post('/site/hero-slides', heroImageUpload.single('slide'),
  optimizeUploadedImages, createHeroSlideController);
adminRouter.delete('/site/hero-slides/:id', deleteHeroSlideController);
adminRouter.get('/dashboard/slides', listMemberSlidesController);
adminRouter.post('/dashboard/slides', validateResource(createMemberSlideSchema), createMemberSlideController);
adminRouter.put('/dashboard/slides/:id', validateResource(updateMemberSlideSchema), updateMemberSlideController);
adminRouter.delete('/dashboard/slides/:id', deleteMemberSlideController);
adminRouter.get('/monitoring/users', adminMonitoringUsersController);
adminRouter.get('/monitoring/users/:id', adminMonitoringUserDetailController);
adminRouter.get('/exams/blocks', listExamBlocksAdminController);
adminRouter.post('/exams/blocks/:id/regenerate', regenerateExamBlockAdminController);
adminRouter.post('/exams/blocks/:id/resolve', resolveExamBlockAdminController);
adminRouter.post('/membership/grant-tryout', validateResource(grantTryoutQuotaSchema), grantTryoutQuotaAdminController);
adminRouter.get('/contacts/messages', listContactMessagesAdminController);
adminRouter.get('/calculators', adminCalculatorListController);
adminRouter.put('/calculators/:id', validateResource(adminCalculatorUpdateSchema), adminCalculatorUpdateController);

adminRouter.get('/transactions', listTransactionsAdminController);
adminRouter.patch('/transactions/:id/status', validateResource(transactionStatusSchema), updateTransactionStatusController);

adminRouter.get('/users', adminUsersController);
adminRouter.patch('/users/:id/role', validateResource(userRoleSchema), updateUserRoleController);
adminRouter.patch('/users/:id/status', validateResource(userStatusSchema), updateUserStatusController);
adminRouter.post('/users/:id/reset-password', validateResource(userResetPasswordSchema), resetUserPasswordController);
adminRouter.post('/users/:id/impersonate', validateResource(userImpersonateSchema), impersonateUserController);

adminRouter.use('/monitoring', monitoringRouter);



