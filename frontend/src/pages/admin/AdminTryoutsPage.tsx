import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiDelete, apiGet, apiPatch, apiPostForm, apiPutForm, getApiErrorMessage } from '@/lib/api';
import { getAssetUrl } from '@/lib/media';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/common/PageHeader';
import {
  AdminPanel,
  AdminWorkflowGuide,
  CategoryPathPreview,
  CsvQuestionUpload,
  EntityCard,
  EntityListEmpty,
  FormField,
  FormSection,
  formSelectClassName,
  ImageUploadField,
  NameSlugFields,
  slugifyExamSlug,
  useAutoSlug,
} from '@/components/admin/ExamSetFormUi';

type TryoutCategory = {
  id: string;
  name: string;
  slug: string;
  thumbnail?: string | null;
  _count: { subCategories: number };
};

type TryoutSubCategory = {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  category: { id: string; name: string };
  _count: { tryouts: number };
};

type TryoutOption = { id: string; label: string; isCorrect?: boolean };
type TryoutQuestion = { id: string; prompt: string; order: number; options: TryoutOption[] };
type AdminTryout = {
  id: string;
  name: string;
  slug: string;
  summary: string;
  description?: string | null;
  coverImageUrl?: string | null;
  durationMinutes: number;
  totalQuestions: number;
  isPublished: boolean;
  isFree?: boolean;
  sessionOrder?: number | null;
  openAt?: string | null;
  closeAt?: string | null;
  subCategory: { id: string; name: string; slug?: string; category: { id: string; name: string; slug?: string } };
  questions: TryoutQuestion[];
};

const defaultTryoutValues = {
  name: '',
  slug: '',
  summary: '',
  description: '',
  durationMinutes: 90,
  totalQuestions: 5,
  categoryId: '',
  subCategoryId: '',
  sessionOrder: '',
  openAt: '',
  closeAt: '',
  isFree: false,
};

export function AdminTryoutsPage() {
  const queryClient = useQueryClient();
  const { accessToken } = useAuth();
  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['admin-tryout-categories'],
    queryFn: () => apiGet<TryoutCategory[]>('/admin/tryouts/categories'),
  });
  const { data: subCategoriesData, isLoading: subCategoriesLoading } = useQuery({
    queryKey: ['admin-tryout-sub-categories'],
    queryFn: () => apiGet<TryoutSubCategory[]>('/admin/tryouts/sub-categories'),
  });
  const { data: tryoutsData, isLoading: tryoutsLoading } = useQuery({
    queryKey: ['admin-tryouts'],
    queryFn: () => apiGet<AdminTryout[]>('/admin/tryouts'),
  });

  const categoryForm = useForm<{ name: string; slug: string }>({
    defaultValues: { name: '', slug: '' },
  });
  const [editingCategory, setEditingCategory] = useState<TryoutCategory | null>(null);

  const subCategoryForm = useForm<{ name: string; slug: string; categoryId: string }>({
    defaultValues: { name: '', slug: '', categoryId: '' },
  });
  const [editingSubCategory, setEditingSubCategory] = useState<TryoutSubCategory | null>(null);
  const [categoryImageFile, setCategoryImageFile] = useState<File | null>(null);
  const [subCategoryImageFile, setSubCategoryImageFile] = useState<File | null>(null);

  const tryoutForm = useForm<typeof defaultTryoutValues>({
    defaultValues: defaultTryoutValues,
  });

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [questionsFile, setQuestionsFile] = useState<File | null>(null);
  const [editingTryout, setEditingTryout] = useState<AdminTryout | null>(null);
  const isEditing = Boolean(editingTryout);
  const [togglingTryoutId, setTogglingTryoutId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingQuestionsAll, setIsExportingQuestionsAll] = useState(false);
  const [exportingTryoutQuestionsId, setExportingTryoutQuestionsId] = useState<string | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [categorySlugManual, setCategorySlugManual] = useState(false);
  const [subCategorySlugManual, setSubCategorySlugManual] = useState(false);

  const watchCategoryName = useWatch({ control: categoryForm.control, name: 'name' });
  const watchCategorySlug = useWatch({ control: categoryForm.control, name: 'slug' });
  const watchSubCategoryName = useWatch({ control: subCategoryForm.control, name: 'name' });
  const watchSubCategorySlug = useWatch({ control: subCategoryForm.control, name: 'slug' });

  useAutoSlug(watchCategoryName, categorySlugManual, (value) => categoryForm.setValue('slug', value));
  useAutoSlug(watchSubCategoryName, subCategorySlugManual, (value) => subCategoryForm.setValue('slug', value));

  const toInputDateTime = (value?: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };


  const saveCategory = useMutation({
    mutationFn: (values: { name: string; slug: string }) => {
      const formData = new FormData();
      formData.append('name', values.name);
      formData.append('slug', values.slug);
      if (categoryImageFile) {
        formData.append('image', categoryImageFile);
      }
      return editingCategory
        ? apiPutForm(`/admin/tryouts/categories/${editingCategory.id}`, formData)
        : apiPostForm('/admin/tryouts/categories', formData);
    },
    onSuccess: () => {
      toast.success(editingCategory ? 'Kategori diperbarui' : 'Kategori tryout tersimpan');
      setEditingCategory(null);
      categoryForm.reset({ name: '', slug: '' });
      setCategoryImageFile(null);
      setCategorySlugManual(false);
      queryClient.invalidateQueries({ queryKey: ['admin-tryout-categories'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Gagal menyimpan kategori')),
  });

  const saveSubCategory = useMutation({
    mutationFn: (values: { name: string; slug: string; categoryId: string }) => {
      const formData = new FormData();
      formData.append('name', values.name);
      formData.append('slug', values.slug);
      formData.append('categoryId', values.categoryId);
      if (subCategoryImageFile) {
        formData.append('image', subCategoryImageFile);
      }
      return editingSubCategory
        ? apiPutForm(`/admin/tryouts/sub-categories/${editingSubCategory.id}`, formData)
        : apiPostForm('/admin/tryouts/sub-categories', formData);
    },
    onSuccess: () => {
      toast.success(editingSubCategory ? 'Sub kategori diperbarui' : 'Sub kategori tryout tersimpan');
      setEditingSubCategory(null);
      subCategoryForm.reset({ name: '', slug: '', categoryId: '' });
      setSubCategoryImageFile(null);
      setSubCategorySlugManual(false);
      queryClient.invalidateQueries({ queryKey: ['admin-tryout-sub-categories'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Gagal menyimpan sub kategori')),
  });

  const deleteCategory = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/tryouts/categories/${id}`),
    onSuccess: (_data, id) => {
      toast.success('Kategori dihapus');
      if (editingCategory && editingCategory.id === id) {
        setEditingCategory(null);
        categoryForm.reset({ name: '', slug: '' });
        setCategoryImageFile(null);
      }
      queryClient.invalidateQueries({ queryKey: ['admin-tryout-categories'] });
    },
    onError: () => toast.error('Kategori tidak dapat dihapus'),
  });

  const deleteSubCategory = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/tryouts/sub-categories/${id}`),
    onSuccess: (_data, id) => {
      toast.success('Sub kategori dihapus');
      if (editingSubCategory && editingSubCategory.id === id) {
        setEditingSubCategory(null);
        subCategoryForm.reset({ name: '', slug: '', categoryId: '' });
        setSubCategoryImageFile(null);
      }
      queryClient.invalidateQueries({ queryKey: ['admin-tryout-sub-categories'] });
    },
    onError: () => toast.error('Sub kategori tidak dapat dihapus'),
  });

  const createTryout = useMutation({
    mutationFn: (payload: FormData) => apiPostForm('/admin/tryouts', payload),
    onSuccess: () => {
      toast.success('Tryout berhasil dibuat');
      tryoutForm.reset(defaultTryoutValues);
      setCoverFile(null);
      setCoverPreview(null);
      setQuestionsFile(null);
      setSlugManuallyEdited(false);
      queryClient.invalidateQueries({ queryKey: ['admin-tryouts'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Gagal membuat tryout')),
  });

  const updateTryout = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormData }) => apiPutForm(`/admin/tryouts/${id}`, data),
    onSuccess: () => {
      toast.success('Tryout diperbarui');
      setEditingTryout(null);
      tryoutForm.reset(defaultTryoutValues);
      setCoverFile(null);
      setCoverPreview(null);
      setQuestionsFile(null);
      queryClient.invalidateQueries({ queryKey: ['admin-tryouts'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Gagal memperbarui tryout')),
  });

  const isSubmittingTryout = createTryout.isPending || updateTryout.isPending;

  const deleteTryout = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/tryouts/${id}`),
    onSuccess: () => {
      toast.success('Tryout dihapus');
      queryClient.invalidateQueries({ queryKey: ['admin-tryouts'] });
    },
    onError: () => toast.error('Gagal menghapus tryout'),
  });

  const toggleTryoutFree = useMutation({
    mutationFn: ({ id, isFree }: { id: string; isFree: boolean }) => apiPatch(`/admin/tryouts/${id}/free`, { isFree }),
    onMutate: ({ id }) => {
      setTogglingTryoutId(id);
    },
    onSuccess: () => {
      toast.success('Status gratis diperbarui');
      queryClient.invalidateQueries({ queryKey: ['admin-tryouts'] });
    },
    onError: () => toast.error('Gagal memperbarui status gratis'),
    onSettled: () => setTogglingTryoutId(null),
  });

  const onSubmitCategory = categoryForm.handleSubmit((values) => saveCategory.mutate(values));
  const onSubmitSubCategory = subCategoryForm.handleSubmit((values) => {
    if (!values.categoryId) {
      toast.error('Pilih kategori utama terlebih dahulu');
      return;
    }
    saveSubCategory.mutate(values);
  });

  const onSubmitTryout = tryoutForm.handleSubmit((values) => {
    if (!values.subCategoryId) {
      toast.error('Pilih sub kategori tryout terlebih dahulu');
      return;
    }
    if (isSessionOrderRequired && !values.sessionOrder) {
      toast.error('Pilih Urutan Sesi terlebih dahulu');
      return;
    }
    if (!questionsFile && !isEditing) {
      toast.error('Unggah file CSV soal terlebih dahulu');
      return;
    }
    const formData = new FormData();
    formData.append('name', values.name);
    formData.append('slug', values.slug);
    formData.append('summary', values.summary);
    formData.append('description', values.description);
    formData.append('durationMinutes', String(values.durationMinutes));
    if (values.totalQuestions) {
      formData.append('totalQuestions', String(values.totalQuestions));
    }
    formData.append('subCategoryId', values.subCategoryId);
    if (values.sessionOrder) {
      formData.append('sessionOrder', values.sessionOrder);
    }
    formData.append('isFree', String(values.isFree ?? false));
    if (isEditing) {
      formData.append('openAt', values.openAt ?? '');
      formData.append('closeAt', values.closeAt ?? '');
    } else {
      if (values.openAt) formData.append('openAt', values.openAt);
      if (values.closeAt) formData.append('closeAt', values.closeAt);
    }
    if (coverFile) {
      formData.append('coverImage', coverFile);
    }
    if (questionsFile) {
      formData.append('questionsCsv', questionsFile);
    }
    if (isEditing && editingTryout) {
      updateTryout.mutate({ id: editingTryout.id, data: formData });
    } else {
      createTryout.mutate(formData);
    }
  });
  const handleCoverChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setCoverFile(null);
      setCoverPreview(null);
      return;
    }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleQuestionsFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setQuestionsFile(file);
  };

  const handleEditTryout = (tryout: AdminTryout) => {
    setEditingTryout(tryout);
    tryoutForm.reset({
      name: tryout.name,
      slug: tryout.slug,
      summary: tryout.summary,
      description: tryout.description ?? '',
      durationMinutes: tryout.durationMinutes,
      totalQuestions: tryout.totalQuestions,
      categoryId: tryout.subCategory.category.id,
      subCategoryId: tryout.subCategory.id,
      sessionOrder: tryout.sessionOrder ? String(tryout.sessionOrder) : '',
      openAt: toInputDateTime(tryout.openAt),
      closeAt: toInputDateTime(tryout.closeAt),
      isFree: tryout.isFree ?? false,
    });
    setCoverPreview(tryout.coverImageUrl ?? null);
    setCoverFile(null);
    setQuestionsFile(null);
    setSlugManuallyEdited(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingTryout(null);
    tryoutForm.reset(defaultTryoutValues);
    setCoverPreview(null);
    setCoverFile(null);
    setQuestionsFile(null);
    setSlugManuallyEdited(false);
  };

  const categories = useMemo(() => categoriesData ?? [], [categoriesData]);
  const subCategories = useMemo(() => subCategoriesData ?? [], [subCategoriesData]);
  const tryouts = useMemo(() => tryoutsData ?? [], [tryoutsData]);

  const sampleQuestionCount = useMemo(() => tryouts.reduce((acc, t) => acc + t.questions.length, 0), [tryouts]);
  const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString('id-ID') : 'Tidak diatur');
  const selectedCategoryId = useWatch({ control: tryoutForm.control, name: 'categoryId' });
  const selectedSubCategoryId = useWatch({ control: tryoutForm.control, name: 'subCategoryId' });
  const selectedSessionOrder = useWatch({ control: tryoutForm.control, name: 'sessionOrder' });
  const watchName = useWatch({ control: tryoutForm.control, name: 'name' });
  const filteredSubCategories = useMemo(
    () => subCategories.filter((item) => item.category.id === selectedCategoryId),
    [selectedCategoryId, subCategories],
  );
  const selectedCategory = useMemo(
    () => categories.find((item) => item.id === selectedCategoryId),
    [categories, selectedCategoryId],
  );
  const selectedSubCategory = useMemo(
    () => subCategories.find((item) => item.id === selectedSubCategoryId),
    [selectedSubCategoryId, subCategories],
  );

  const categoryPath = useMemo(() => {
    return [selectedCategory?.name, selectedSubCategory?.name].filter(Boolean) as string[];
  }, [selectedCategory, selectedSubCategory]);

  useEffect(() => {
    if (!slugManuallyEdited && watchName?.trim()) {
      tryoutForm.setValue('slug', slugifyExamSlug(watchName));
    }
  }, [watchName, slugManuallyEdited, tryoutForm]);
  const normalize = (value?: string | null) => (value ?? '').trim().toLowerCase();
  const matchesKeyword = (name?: string | null, slug?: string | null, keyword?: string) => {
    const key = normalize(keyword);
    return normalize(name) === key || normalize(slug) === key;
  };
  const isSessionOrderRequired =
    matchesKeyword(selectedCategory?.name, selectedCategory?.slug, 'polri') &&
    matchesKeyword(selectedSubCategory?.name, selectedSubCategory?.slug, 'psiko');
  const isPolriPsikoTryoutItem = useCallback(
    (item: AdminTryout) =>
      matchesKeyword(item.subCategory.category.name, item.subCategory.category.slug, 'polri') &&
      matchesKeyword(item.subCategory.name, item.subCategory.slug, 'psiko'),
    [matchesKeyword],
  );
  const psikoTryouts = useMemo(
    () =>
      tryouts
        .filter((item) => isPolriPsikoTryoutItem(item))
        .sort((a, b) => (a.sessionOrder ?? 0) - (b.sessionOrder ?? 0)),
    [isPolriPsikoTryoutItem, tryouts],
  );
  const regularTryouts = useMemo(() => tryouts.filter((item) => !isPolriPsikoTryoutItem(item)), [isPolriPsikoTryoutItem, tryouts]);
  const usedSessionOrders = useMemo(() => {
    if (!selectedSubCategoryId) return [] as number[];
    return tryouts
      .filter((item) => item.subCategory.id === selectedSubCategoryId && item.id !== editingTryout?.id && item.sessionOrder)
      .map((item) => item.sessionOrder as number);
  }, [selectedSubCategoryId, tryouts, editingTryout?.id]);
  const maxSessionOption = useMemo(() => {
    const maxUsed = usedSessionOrders.length ? Math.max(...usedSessionOrders) : 0;
    return Math.max(10, maxUsed + 5);
  }, [usedSessionOrders]);
  const availableSessionOrders = useMemo(() => {
    const keepCurrent = Number(selectedSessionOrder || 0);
    return Array.from({ length: maxSessionOption }, (_, index) => index + 1).filter(
      (num) => !usedSessionOrders.includes(num) || num === keepCurrent,
    );
  }, [maxSessionOption, usedSessionOrders, selectedSessionOrder]);

  useEffect(() => {
    if (!isSessionOrderRequired && selectedSessionOrder) {
      tryoutForm.setValue('sessionOrder', '');
    }
    if (isSessionOrderRequired && selectedSessionOrder) {
      const parsed = Number(selectedSessionOrder);
      if (!availableSessionOrders.includes(parsed)) {
        tryoutForm.setValue('sessionOrder', '');
      }
    }
  }, [isSessionOrderRequired, selectedSessionOrder, availableSessionOrders, tryoutForm]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await api.get('/admin/tryouts/export', {
        responseType: 'blob',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'manajemen-tryout-tes.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error('Gagal mengunduh CSV tryout');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportQuestionsCsv = async (tryout?: { id: string; slug: string }) => {
    if (tryout) {
      setExportingTryoutQuestionsId(tryout.id);
    } else {
      setIsExportingQuestionsAll(true);
    }
    try {
      const query = tryout ? `?tryoutId=${encodeURIComponent(tryout.id)}` : '';
      const response = await api.get(`/admin/tryouts/questions/export${query}`, {
        responseType: 'blob',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = tryout ? `soal-tryout-${tryout.slug}.csv` : 'soal-tryout-semua.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error('Gagal mengunduh CSV soal tryout');
    } finally {
      if (tryout) {
        setExportingTryoutQuestionsId(null);
      } else {
        setIsExportingQuestionsAll(false);
      }
    }
  };

  return (
    <section className="page-shell space-y-6">
      <PageHeader variant="panel"
        eyebrow="Admin"
        title="Manajemen Tryout & Tes"
        description="Atur kategori tryout, unggah bank soal dari CSV, dan kelola sesi resmi."
        action={
          <>
            <Button type="button" variant="outline" onClick={handleExport} isLoading={isExporting}>
              Download Struktur CSV
            </Button>
            <Button type="button" variant="outline" onClick={() => handleExportQuestionsCsv()} isLoading={isExportingQuestionsAll}>
              Download Soal CSV (Semua)
            </Button>
          </>
        }
      />

      <AdminWorkflowGuide
        title="Alur kerja — ikuti langkah berurutan"
        steps={[
          { label: 'Buat kategori', detail: 'Kategori → Sub kategori (langkah 1–2)' },
          { label: 'Konversi Word', detail: 'Menu Konversi Word → CSV jika belum punya file' },
          { label: 'Upload tryout', detail: 'Isi form langkah 3 + unggah CSV soal' },
          { label: 'Kelola daftar', detail: 'Edit, hapus, atau unduh soal per tryout' },
        ]}
      />

      <AdminPanel
        step={1}
        title="Kategori Tryout"
        description="Tingkat paling atas — contoh: POLRI, TNI, CPNS."
        meta={`${categories.length} kategori · ${sampleQuestionCount} soal terdata`}
        isEditing={Boolean(editingCategory)}
        editTitle={editingCategory ? `Edit kategori: ${editingCategory.name}` : undefined}
        onCancelEdit={
          editingCategory
            ? () => {
                setEditingCategory(null);
                categoryForm.reset({ name: '', slug: '' });
                setCategoryImageFile(null);
                setCategorySlugManual(false);
              }
            : undefined
        }
      >
        <form className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4" onSubmit={onSubmitCategory}>
          <NameSlugFields
            nameLabel="Nama kategori"
            namePlaceholder="POLRI"
            slugPlaceholder="polri"
            nameRegister={categoryForm.register('name')}
            slugValue={watchCategorySlug ?? ''}
            onSlugChange={(value) => categoryForm.setValue('slug', value)}
            onSlugManualEdit={() => setCategorySlugManual(true)}
          />
          <ImageUploadField
            fileName={categoryImageFile?.name}
            onChange={(event) => setCategoryImageFile(event.target.files?.[0] ?? null)}
          />
          <Button type="submit" disabled={saveCategory.isPending}>
            {saveCategory.isPending ? 'Menyimpan...' : editingCategory ? 'Perbarui Kategori' : 'Tambah Kategori'}
          </Button>
        </form>

        <div>
          <p className="mb-3 text-sm font-semibold text-slate-800">Daftar kategori</p>
          {categoriesLoading && <Skeleton className="h-24" />}
          {!categoriesLoading && categories.length === 0 && (
            <EntityListEmpty message="Belum ada kategori. Tambahkan kategori pertama di form di atas." />
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {categories.map((category) => (
              <EntityCard
                key={category.id}
                title={category.name}
                imageUrl={getAssetUrl(category.thumbnail)}
                lines={[`Slug: ${category.slug}`, `Sub kategori: ${category._count.subCategories}`]}
                onEdit={() => {
                  setEditingCategory(category);
                  categoryForm.reset({ name: category.name, slug: category.slug });
                  setCategoryImageFile(null);
                  setCategorySlugManual(true);
                }}
                onDelete={() => deleteCategory.mutate(category.id)}
                deletePending={deleteCategory.isPending}
              />
            ))}
          </div>
        </div>
      </AdminPanel>

      <AdminPanel
        step={2}
        title="Sub Kategori Tryout"
        description="Grup materi di bawah kategori — contoh: PSIKO, Tes Akademik."
        meta={`${subCategories.length} sub kategori terdaftar`}
        isEditing={Boolean(editingSubCategory)}
        editTitle={editingSubCategory ? `Edit sub kategori: ${editingSubCategory.name}` : undefined}
        onCancelEdit={
          editingSubCategory
            ? () => {
                setEditingSubCategory(null);
                subCategoryForm.reset({ name: '', slug: '', categoryId: '' });
                setSubCategoryImageFile(null);
                setSubCategorySlugManual(false);
              }
            : undefined
        }
      >
        <form className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4" onSubmit={onSubmitSubCategory}>
          <NameSlugFields
            nameLabel="Nama sub kategori"
            namePlaceholder="PSIKO"
            slugPlaceholder="psiko"
            nameRegister={subCategoryForm.register('name')}
            slugValue={watchSubCategorySlug ?? ''}
            onSlugChange={(value) => subCategoryForm.setValue('slug', value)}
            onSlugManualEdit={() => setSubCategorySlugManual(true)}
          />
          <FormField label="Kategori induk" required hint="Sub kategori harus berada di bawah satu kategori utama.">
            <select className={formSelectClassName} {...subCategoryForm.register('categoryId')}>
              <option value="">— Pilih kategori utama —</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </FormField>
          <ImageUploadField
            fileName={subCategoryImageFile?.name}
            onChange={(event) => setSubCategoryImageFile(event.target.files?.[0] ?? null)}
          />
          <Button type="submit" disabled={saveSubCategory.isPending}>
            {saveSubCategory.isPending ? 'Menyimpan...' : editingSubCategory ? 'Perbarui Sub Kategori' : 'Tambah Sub Kategori'}
          </Button>
        </form>

        <div>
          <p className="mb-3 text-sm font-semibold text-slate-800">Daftar sub kategori</p>
          {subCategoriesLoading && <Skeleton className="h-24" />}
          {!subCategoriesLoading && subCategories.length === 0 && (
            <EntityListEmpty message="Belum ada sub kategori. Buat kategori utama dulu (langkah 1)." />
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {subCategories.map((subCategory) => (
              <EntityCard
                key={subCategory.id}
                title={subCategory.name}
                imageUrl={getAssetUrl(subCategory.imageUrl)}
                lines={[`Kategori: ${subCategory.category.name}`, `Tryout terkait: ${subCategory._count.tryouts}`]}
                onEdit={() => {
                  setEditingSubCategory(subCategory);
                  subCategoryForm.reset({ name: subCategory.name, slug: subCategory.slug, categoryId: subCategory.category.id });
                  setSubCategoryImageFile(null);
                  setSubCategorySlugManual(true);
                }}
                onDelete={() => deleteSubCategory.mutate(subCategory.id)}
                deletePending={deleteSubCategory.isPending}
              />
            ))}
          </div>
        </div>
      </AdminPanel>

      <AdminPanel
        step={3}
        title={isEditing ? 'Edit tryout' : 'Upload tryout baru'}
        description="Isi form bertahap di bawah, lalu unggah file CSV hasil konversi Word atau template."
        isEditing={isEditing}
        editTitle={editingTryout ? `Mengedit: ${editingTryout.name}` : undefined}
        onCancelEdit={isEditing ? handleCancelEdit : undefined}
      >
        {isEditing && editingTryout && (
          <p className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-800">
            Unggah CSV baru hanya jika ingin mengganti seluruh bank soal. Kosongkan jika hanya mengubah data dasar.
          </p>
        )}
        <form className="space-y-5" onSubmit={onSubmitTryout}>
          <FormSection step={1} title="Informasi tryout" description="Nama dan deskripsi yang tampil di halaman tryout.">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Nama tryout" required hint="Contoh: Pancasila Wawasan Kebangsaan 1">
                <Input placeholder="Nama tryout" {...tryoutForm.register('name')} />
              </FormField>
              <FormField label="Slug URL" required hint="Otomatis dari nama. Bisa diedit manual.">
                <Input
                  placeholder="pancasila-wawasan-1"
                  {...tryoutForm.register('slug')}
                  onChange={(event) => {
                    setSlugManuallyEdited(true);
                    tryoutForm.setValue('slug', event.target.value);
                  }}
                />
              </FormField>
            </div>
            <FormField label="Ringkasan" required hint="Satu kalimat singkat tentang tryout.">
              <Input placeholder="Tryout Pancasila sesi 1" {...tryoutForm.register('summary')} />
            </FormField>
            <FormField label="Deskripsi" hint="Penjelasan lengkap untuk peserta.">
              <Textarea placeholder="Tryout ini menguji pemahaman..." rows={3} {...tryoutForm.register('description')} />
            </FormField>
          </FormSection>

          <FormSection step={2} title="Kategori" description="Pilih kategori dan sub kategori tryout (langkah 1–2).">
            <CategoryPathPreview segments={categoryPath} />
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Kategori" required>
                <select
                  className={formSelectClassName}
                  {...tryoutForm.register('categoryId')}
                  onChange={(event) => {
                    tryoutForm.setValue('categoryId', event.target.value);
                    tryoutForm.setValue('subCategoryId', '');
                    tryoutForm.setValue('sessionOrder', '');
                  }}
                >
                  <option value="">— Pilih kategori —</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Sub kategori" required>
                <select
                  className={formSelectClassName}
                  disabled={!selectedCategoryId}
                  {...tryoutForm.register('subCategoryId')}
                  onChange={(event) => {
                    tryoutForm.setValue('subCategoryId', event.target.value);
                    tryoutForm.setValue('sessionOrder', '');
                  }}
                >
                  <option value="">{selectedCategoryId ? '— Pilih sub kategori —' : 'Pilih kategori dulu'}</option>
                  {filteredSubCategories.map((subCategory) => (
                    <option key={subCategory.id} value={subCategory.id}>
                      {subCategory.name}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            {isSessionOrderRequired && (
              <FormField label="Urutan sesi" required hint="Wajib untuk kategori POLRI / sub kategori PSIKO.">
                <select className={formSelectClassName} {...tryoutForm.register('sessionOrder')}>
                  <option value="">— Pilih sesi (1, 2, 3, …) —</option>
                  {availableSessionOrders.map((num) => (
                    <option key={num} value={String(num)}>
                      Sesi {num}
                    </option>
                  ))}
                </select>
              </FormField>
            )}
          </FormSection>

          <FormSection step={3} title="Pengaturan ujian" description="Durasi, jadwal, dan akses gratis.">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Durasi (menit)" required>
                <Input type="number" min={1} {...tryoutForm.register('durationMinutes', { valueAsNumber: true })} />
              </FormField>
              <FormField label="Total soal" required hint="Sesuaikan dengan jumlah baris di CSV.">
                <Input type="number" min={1} {...tryoutForm.register('totalQuestions', { valueAsNumber: true })} />
              </FormField>
              <FormField label="Buka pada" hint="Kosongkan jika tryout selalu aktif.">
                <Input type="datetime-local" {...tryoutForm.register('openAt')} />
              </FormField>
              <FormField label="Tutup pada" hint="Kosongkan jika tidak ada batas akhir.">
                <Input type="datetime-local" {...tryoutForm.register('closeAt')} />
              </FormField>
            </div>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...tryoutForm.register('isFree')} />
              Tryout gratis untuk member baru
            </label>
          </FormSection>

          <FormSection step={4} title="Cover & bank soal" description="Upload cover opsional dan file CSV soal.">
            <FormField label="Cover tryout (opsional)" hint="JPG, PNG, atau WEBP — maks. 5 MB.">
              {coverPreview && (
                <img src={getAssetUrl(coverPreview)} alt="Preview" className="mb-2 h-32 w-full rounded-xl object-cover" />
              )}
              <Input type="file" accept="image/*" onChange={handleCoverChange} />
            </FormField>
            <FormField label="File soal (CSV)" required={!isEditing}>
              <CsvQuestionUpload
                inputId="tryout-csv-upload"
                isEditing={isEditing}
                questionsFile={questionsFile}
                onFileChange={handleQuestionsFileChange}
                templateHref="/templates/Template_Tryout.csv"
                templateLabel="Template Tryout"
              />
            </FormField>
          </FormSection>

          <Button type="submit" disabled={isSubmittingTryout} size="lg" className="w-full md:w-auto">
            {isSubmittingTryout ? (isEditing ? 'Memperbarui...' : 'Menyimpan...') : isEditing ? 'Perbarui Tryout' : 'Publikasikan Tryout'}
          </Button>
        </form>
      </AdminPanel>

      <AdminPanel step={4} title="Daftar Tryout" description="Semua tryout resmi yang sudah diunggah." meta={`${tryouts.length} tryout`}>
        {tryoutsLoading && <Skeleton className="h-40" />}
        {!tryoutsLoading && tryouts.length === 0 && (
          <EntityListEmpty message="Belum ada tryout. Upload tryout pertama di langkah 3." />
        )}
        {psikoTryouts.length > 0 && (
          <div className="rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Paket khusus</p>
                <h4 className="text-lg font-semibold text-slate-900">POLRI / PSIKO — semua sesi</h4>
                <p className="text-xs text-slate-600">Tryout PSIKO dikelompokkan per urutan sesi.</p>
              </div>
              <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
                {psikoTryouts.length} sesi
              </span>
            </div>
            <div className="space-y-3">
              {psikoTryouts.map((tryout) => (
                <div key={tryout.id} className="rounded-xl border border-brand-100 bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Sesi {tryout.sessionOrder ?? '-'} — {tryout.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {tryout.totalQuestions} soal · {tryout.durationMinutes} menit
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className={tryout.isFree ? 'border-emerald-300 text-emerald-700' : undefined}
                        onClick={() => toggleTryoutFree.mutate({ id: tryout.id, isFree: !tryout.isFree })}
                        disabled={togglingTryoutId === tryout.id && toggleTryoutFree.isPending}
                      >
                        Gratis: {tryout.isFree ? 'ON' : 'OFF'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleEditTryout(tryout)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExportQuestionsCsv({ id: tryout.id, slug: tryout.slug })}
                        disabled={exportingTryoutQuestionsId === tryout.id}
                      >
                        {exportingTryoutQuestionsId === tryout.id ? 'Mengunduh...' : 'CSV Soal'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                        onClick={() => deleteTryout.mutate(tryout.id)}
                        disabled={deleteTryout.isPending}
                      >
                        Hapus
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {regularTryouts.map((tryout) => (
            <div key={tryout.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              {getAssetUrl(tryout.coverImageUrl) && (
                <img
                  src={getAssetUrl(tryout.coverImageUrl)}
                  alt={tryout.name}
                  className="mb-3 h-36 w-full rounded-xl object-cover"
                  loading="lazy"
                />
              )}
              <p className="font-semibold text-slate-900">{tryout.name}</p>
              <p className="text-xs text-slate-500">
                {tryout.subCategory.category.name} / {tryout.subCategory.name}
              </p>
              <p className="text-xs text-slate-500">
                {tryout.totalQuestions} soal · {tryout.durationMinutes} menit
              </p>
              {tryout.sessionOrder ? <p className="text-[11px] text-slate-500">Urutan sesi: {tryout.sessionOrder}</p> : null}
              {tryout.isFree && <p className="text-[11px] font-semibold text-emerald-600">Gratis untuk member baru</p>}
              {(tryout.openAt || tryout.closeAt) && (
                <p className="text-[11px] text-slate-500">
                  Jadwal: {formatDateTime(tryout.openAt)} s/d {formatDateTime(tryout.closeAt)}
                </p>
              )}
              <p className="mt-2 line-clamp-2 text-sm text-slate-600">{tryout.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className={tryout.isFree ? 'border-emerald-300 text-emerald-700' : undefined}
                  onClick={() => toggleTryoutFree.mutate({ id: tryout.id, isFree: !tryout.isFree })}
                  disabled={togglingTryoutId === tryout.id && toggleTryoutFree.isPending}
                >
                  Gratis: {tryout.isFree ? 'ON' : 'OFF'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleEditTryout(tryout)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExportQuestionsCsv({ id: tryout.id, slug: tryout.slug })}
                  disabled={exportingTryoutQuestionsId === tryout.id}
                >
                  {exportingTryoutQuestionsId === tryout.id ? 'Mengunduh...' : 'CSV Soal'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600"
                  onClick={() => deleteTryout.mutate(tryout.id)}
                  disabled={deleteTryout.isPending}
                >
                  Hapus
                </Button>
              </div>
            </div>
          ))}
        </div>
      </AdminPanel>
    </section>
  );
}

