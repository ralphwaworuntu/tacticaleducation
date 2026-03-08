import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/lib/api';
import { getAssetUrl } from '@/lib/media';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';

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
type PsikoTryoutConfig = {
  breakSeconds: number;
};
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
  subCategory: { id: string; name: string; category: { id: string; name: string } };
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
  const { data: psikoConfigData } = useQuery({
    queryKey: ['admin-psiko-tryout-config'],
    queryFn: () => apiGet<PsikoTryoutConfig>('/admin/tryouts/psiko-config'),
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
  const psikoConfigForm = useForm<PsikoTryoutConfig>({
    defaultValues: { breakSeconds: 5 },
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
        ? apiPut(`/admin/tryouts/categories/${editingCategory.id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
        : apiPost('/admin/tryouts/categories', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => {
      toast.success(editingCategory ? 'Kategori diperbarui' : 'Kategori tryout tersimpan');
      setEditingCategory(null);
      categoryForm.reset({ name: '', slug: '' });
      setCategoryImageFile(null);
      queryClient.invalidateQueries({ queryKey: ['admin-tryout-categories'] });
    },
    onError: () => toast.error('Gagal menyimpan kategori'),
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
        ? apiPut(`/admin/tryouts/sub-categories/${editingSubCategory.id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
        : apiPost('/admin/tryouts/sub-categories', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => {
      toast.success(editingSubCategory ? 'Sub kategori diperbarui' : 'Sub kategori tryout tersimpan');
      setEditingSubCategory(null);
      subCategoryForm.reset({ name: '', slug: '', categoryId: '' });
      setSubCategoryImageFile(null);
      queryClient.invalidateQueries({ queryKey: ['admin-tryout-sub-categories'] });
    },
    onError: () => toast.error('Gagal menyimpan sub kategori'),
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
    mutationFn: (payload: FormData) =>
      apiPost('/admin/tryouts', payload, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => {
      toast.success('Tryout berhasil dibuat');
      tryoutForm.reset(defaultTryoutValues);
      setCoverFile(null);
      setCoverPreview(null);
      setQuestionsFile(null);
      queryClient.invalidateQueries({ queryKey: ['admin-tryouts'] });
    },
    onError: () => toast.error('Gagal membuat tryout'),
  });

  const updateTryout = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormData }) =>
      apiPut(`/admin/tryouts/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => {
      toast.success('Tryout diperbarui');
      setEditingTryout(null);
      tryoutForm.reset(defaultTryoutValues);
      setCoverFile(null);
      setCoverPreview(null);
      setQuestionsFile(null);
      queryClient.invalidateQueries({ queryKey: ['admin-tryouts'] });
    },
    onError: () => toast.error('Gagal memperbarui tryout'),
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

  const savePsikoConfig = useMutation({
    mutationFn: (values: PsikoTryoutConfig) => apiPut('/admin/tryouts/psiko-config', values),
    onSuccess: () => {
      toast.success('Durasi jeda sesi PSIKO diperbarui');
      queryClient.invalidateQueries({ queryKey: ['admin-psiko-tryout-config'] });
    },
    onError: () => toast.error('Gagal memperbarui durasi jeda sesi PSIKO'),
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
  const onSubmitPsikoConfig = psikoConfigForm.handleSubmit((values) => savePsikoConfig.mutate(values));

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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingTryout(null);
    tryoutForm.reset(defaultTryoutValues);
    setCoverPreview(null);
    setCoverFile(null);
    setQuestionsFile(null);
  };

  const categories = useMemo(() => categoriesData ?? [], [categoriesData]);
  const subCategories = useMemo(() => subCategoriesData ?? [], [subCategoriesData]);
  const tryouts = useMemo(() => tryoutsData ?? [], [tryoutsData]);

  const sampleQuestionCount = useMemo(() => tryouts.reduce((acc, t) => acc + t.questions.length, 0), [tryouts]);
  const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString('id-ID') : 'Tidak diatur');
  const selectedCategoryId = useWatch({ control: tryoutForm.control, name: 'categoryId' });
  const selectedSubCategoryId = useWatch({ control: tryoutForm.control, name: 'subCategoryId' });
  const selectedSessionOrder = useWatch({ control: tryoutForm.control, name: 'sessionOrder' });
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
  const normalize = (value?: string | null) => (value ?? '').trim().toLowerCase();
  const matchesKeyword = (name?: string | null, slug?: string | null, keyword?: string) => {
    const key = normalize(keyword);
    return normalize(name) === key || normalize(slug) === key;
  };
  const isSessionOrderRequired =
    matchesKeyword(selectedCategory?.name, selectedCategory?.slug, 'polri') &&
    matchesKeyword(selectedSubCategory?.name, selectedSubCategory?.slug, 'psiko');
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

  useEffect(() => {
    if (psikoConfigData) {
      psikoConfigForm.reset(psikoConfigData);
    }
  }, [psikoConfigData, psikoConfigForm]);

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
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Manajemen Tryout & Tes</h2>
          <p className="mt-2 text-sm text-slate-500">Buat kategori, atur tryout resmi, dan unggah soal melalui template CSV.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handleExport} disabled={isExporting}>
            {isExporting ? 'Mengunduh...' : 'Download Struktur CSV'}
          </Button>
          <Button type="button" variant="outline" onClick={() => handleExportQuestionsCsv()} disabled={isExportingQuestionsAll}>
            {isExportingQuestionsAll ? 'Mengunduh...' : 'Download Soal CSV (Semua)'}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Konfigurasi PSIKO</p>
            <h3 className="text-xl font-semibold text-slate-900">Durasi Jeda Antar Sesi</h3>
            <p className="text-xs text-slate-500">Berlaku untuk alur tryout POLRI / PSIKO (urutan sesi 1, 2, 3, dst).</p>
          </div>
          <form className="flex flex-wrap items-end gap-3" onSubmit={onSubmitPsikoConfig}>
            <div className="w-full max-w-xs">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Jeda (detik)</p>
              <Input type="number" min={0} max={300} {...psikoConfigForm.register('breakSeconds', { valueAsNumber: true })} />
            </div>
            <Button type="submit" disabled={savePsikoConfig.isPending}>
              {savePsikoConfig.isPending ? 'Menyimpan...' : 'Simpan Pengaturan Jeda'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">Kategori Tryout</p>
              <h3 className="text-xl font-semibold text-slate-900">
                {editingCategory ? `Edit: ${editingCategory.name}` : `${categories.length} kategori`}
              </h3>
              <p className="text-xs text-slate-500">Total soal terdata: {sampleQuestionCount}</p>
            </div>
            {editingCategory && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingCategory(null);
                  categoryForm.reset({ name: '', slug: '' });
                  setCategoryImageFile(null);
                }}
              >
                Batalkan Edit
              </Button>
            )}
          </div>

          <form className="grid gap-3 md:grid-cols-3" onSubmit={onSubmitCategory}>
            <Input placeholder="Nama" {...categoryForm.register('name')} />
            <Input placeholder="Slug" {...categoryForm.register('slug')} />
            <Input
              type="file"
              accept="image/*"
              onChange={(event) => setCategoryImageFile(event.target.files?.[0] ?? null)}
            />
            <Button type="submit" disabled={saveCategory.isPending} className="md:col-span-3">
              {saveCategory.isPending ? 'Menyimpan...' : editingCategory ? 'Perbarui Kategori' : 'Tambah Kategori'}
            </Button>
          </form>

          <div className="grid gap-3 md:grid-cols-2">
            {categoriesLoading && <Skeleton className="h-24" />}
            {categories.map((category) => (
              <div key={category.id} className="rounded-2xl border border-slate-100 p-4">
                {getAssetUrl(category.thumbnail) && (
                  <img
                    src={getAssetUrl(category.thumbnail)}
                    alt={category.name}
                    className="mb-3 h-24 w-full rounded-xl object-cover"
                    loading="lazy"
                  />
                )}
                <p className="font-semibold text-slate-900">{category.name}</p>
                <p className="text-xs text-slate-500">Slug: {category.slug}</p>
                <p className="text-xs text-slate-500">Sub kategori: {category._count.subCategories}</p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingCategory(category);
                      categoryForm.reset({ name: category.name, slug: category.slug });
                      setCategoryImageFile(null);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteCategory.mutate(category.id)}
                    disabled={deleteCategory.isPending}
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">Sub Kategori Tryout</p>
              <h3 className="text-xl font-semibold text-slate-900">
                {editingSubCategory ? `Edit: ${editingSubCategory.name}` : `${subCategories.length} sub kategori`}
              </h3>
              <p className="text-xs text-slate-500">Pilih kategori utama sebelum membuat sub kategori.</p>
            </div>
            {editingSubCategory && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingSubCategory(null);
                  subCategoryForm.reset({ name: '', slug: '', categoryId: '' });
                  setSubCategoryImageFile(null);
                }}
              >
                Batalkan Edit
              </Button>
            )}
          </div>

          <form className="grid gap-3 md:grid-cols-3" onSubmit={onSubmitSubCategory}>
            <Input placeholder="Nama" {...subCategoryForm.register('name')} />
            <Input placeholder="Slug" {...subCategoryForm.register('slug')} />
            <select className="rounded-2xl border border-slate-200 px-4 py-2 text-sm" {...subCategoryForm.register('categoryId')}>
              <option value="">Pilih kategori utama</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <Input
              type="file"
              accept="image/*"
              onChange={(event) => setSubCategoryImageFile(event.target.files?.[0] ?? null)}
            />
            <Button type="submit" disabled={saveSubCategory.isPending} className="md:col-span-3">
              {saveSubCategory.isPending ? 'Menyimpan...' : editingSubCategory ? 'Perbarui Sub Kategori' : 'Tambah Sub Kategori'}
            </Button>
          </form>

          <div className="grid gap-3 md:grid-cols-2">
            {subCategoriesLoading && <Skeleton className="h-24" />}
            {subCategories.map((subCategory) => (
              <div key={subCategory.id} className="rounded-2xl border border-slate-100 p-4">
                {getAssetUrl(subCategory.imageUrl) && (
                  <img
                    src={getAssetUrl(subCategory.imageUrl)}
                    alt={subCategory.name}
                    className="mb-3 h-24 w-full rounded-xl object-cover"
                    loading="lazy"
                  />
                )}
                <p className="font-semibold text-slate-900">{subCategory.name}</p>
                <p className="text-xs text-slate-500">Kategori: {subCategory.category.name}</p>
                <p className="text-xs text-slate-500">Tryout terkait: {subCategory._count.tryouts}</p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingSubCategory(subCategory);
                      subCategoryForm.reset({ name: subCategory.name, slug: subCategory.slug, categoryId: subCategory.category.id });
                      setSubCategoryImageFile(null);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteSubCategory.mutate(subCategory.id)}
                    disabled={deleteSubCategory.isPending}
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Tryout Baru</p>
            <h3 className="text-xl font-semibold text-slate-900">Upload Soal Tryout</h3>
          </div>
          {isEditing && editingTryout && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
              <p className="text-sm font-semibold">Sedang mengedit: {editingTryout.name}</p>
              <p className="text-xs text-amber-700">
                Unggah CSV baru hanya jika ingin mengganti seluruh bank soal. Biarkan kosong bila hanya memperbarui data dasar.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                  Batalkan Edit
                </Button>
              </div>
            </div>
          )}
          <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmitTryout}>
            <Input placeholder="Nama" {...tryoutForm.register('name')} />
            <Input placeholder="Slug" {...tryoutForm.register('slug')} />
            <Input placeholder="Ringkasan" {...tryoutForm.register('summary')} className="md:col-span-2" />
            <Textarea placeholder="Deskripsi" className="md:col-span-2" {...tryoutForm.register('description')} />
            <div className="md:col-span-2 space-y-2">
              <p className="text-xs font-semibold text-slate-500">Cover Tryout (Opsional)</p>
              {coverPreview && (
                <img src={getAssetUrl(coverPreview)} alt="Preview" className="h-32 w-full rounded-2xl object-cover" />
              )}
              <Input type="file" accept="image/*" onChange={handleCoverChange} />
              <p className="text-[11px] text-slate-500">Gunakan JPG, PNG, atau WEBP maksimal 5MB.</p>
            </div>
            <Input type="number" placeholder="Durasi (menit)" {...tryoutForm.register('durationMinutes', { valueAsNumber: true })} />
            <Input type="number" placeholder="Total Soal" {...tryoutForm.register('totalQuestions', { valueAsNumber: true })} />
            <select
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm"
              {...tryoutForm.register('categoryId')}
              onChange={(event) => {
                tryoutForm.setValue('categoryId', event.target.value);
                tryoutForm.setValue('subCategoryId', '');
                tryoutForm.setValue('sessionOrder', '');
              }}
            >
              <option value="">Pilih kategori</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm"
              {...tryoutForm.register('subCategoryId')}
              onChange={(event) => {
                tryoutForm.setValue('subCategoryId', event.target.value);
                tryoutForm.setValue('sessionOrder', '');
              }}
            >
              <option value="">Pilih sub kategori</option>
              {filteredSubCategories.map((subCategory) => (
                <option key={subCategory.id} value={subCategory.id}>
                  {subCategory.name}
                </option>
              ))}
            </select>
            {isSessionOrderRequired && (
              <select className="rounded-2xl border border-slate-200 px-4 py-2 text-sm" {...tryoutForm.register('sessionOrder')}>
                <option value="">Urutan Sesi (1/2/3/dst)</option>
                {availableSessionOrders.map((num) => (
                  <option key={num} value={String(num)}>
                    {num}
                  </option>
                ))}
              </select>
            )}
            <Input type="datetime-local" placeholder="Buka pada" {...tryoutForm.register('openAt')} />
            <Input type="datetime-local" placeholder="Tutup pada" {...tryoutForm.register('closeAt')} />
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <input type="checkbox" {...tryoutForm.register('isFree')} />
              Tryout gratis untuk member baru
            </label>
            <div className="md:col-span-2 space-y-2">
              <p className="text-xs font-semibold text-slate-500">
                Upload Soal (CSV) {isEditing && <span className="font-normal">(opsional saat edit)</span>}
              </p>
              <Input type="file" accept=".csv" onChange={handleQuestionsFileChange} />
              {!questionsFile && !isEditing && <p className="text-[11px] text-red-500">Wajib mengunggah CSV soal.</p>}
              {isEditing && !questionsFile && (
                <p className="text-[11px] text-slate-500">Kosongkan jika tidak ingin mengganti soal.</p>
              )}
            </div>
            <Button type="submit" disabled={isSubmittingTryout} className="md:col-span-2">
              {isSubmittingTryout ? (isEditing ? 'Memperbarui...' : 'Menyimpan...') : isEditing ? 'Perbarui Tryout' : 'Publikasikan Tryout'}
            </Button>
          </form>
          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
            <span>Gunakan template CSV terbaru untuk menyusun soal lengkap beserta pembahasan.</span>
            <Button asChild size="sm" variant="outline">
              <a href="/templates/Template_Tryout.csv" download>
                Unduh Template Tryout
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-xl font-semibold text-slate-900">Daftar Tryout</h3>
          {tryoutsLoading && <Skeleton className="h-40" />}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tryouts.map((tryout) => (
              <div key={tryout.id} className="rounded-2xl border border-slate-100 p-4">
                {getAssetUrl(tryout.coverImageUrl) && (
                  <img
                    src={getAssetUrl(tryout.coverImageUrl)}
                    alt={tryout.name}
                    className="mb-3 h-36 w-full rounded-xl object-cover"
                    loading="lazy"
                  />
                )}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{tryout.name}</p>
                      <p className="text-xs text-slate-500">
                        {tryout.subCategory.category.name} / {tryout.subCategory.name} - {tryout.totalQuestions} soal - {tryout.durationMinutes} menit
                      </p>
                      {tryout.sessionOrder ? <p className="text-[11px] text-slate-500">Urutan sesi: {tryout.sessionOrder}</p> : null}
                      {tryout.isFree && <p className="text-[11px] font-semibold text-emerald-600">Gratis untuk member baru</p>}
                      {(tryout.openAt || tryout.closeAt) && (
                        <p className="text-[11px] text-slate-500">
                          Jadwal: {formatDateTime(tryout.openAt)} s/d {formatDateTime(tryout.closeAt)}
                        </p>
                      )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className={tryout.isFree ? 'border-emerald-300 text-emerald-700' : undefined}
                      onClick={() => toggleTryoutFree.mutate({ id: tryout.id, isFree: !tryout.isFree })}
                      disabled={togglingTryoutId === tryout.id && toggleTryoutFree.isPending}
                    >
                      <span className="flex items-center gap-2">
                        {togglingTryoutId === tryout.id && toggleTryoutFree.isPending && (
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        )}
                        Gratis: {tryout.isFree ? 'ON' : 'OFF'}
                      </span>
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
                      onClick={() => deleteTryout.mutate(tryout.id)}
                      disabled={deleteTryout.isPending}
                    >
                      Hapus
                    </Button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-600">{tryout.summary}</p>
              </div>
            ))}
          </div>
          {tryouts.length === 0 && <p className="text-sm text-slate-500">Belum ada tryout.</p>}
        </CardContent>
      </Card>
    </section>
  );
}

