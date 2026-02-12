import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/lib/api';
import { getAssetUrl } from '@/lib/media';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

type PracticeCategory = {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  _count: { subCategories: number };
};

type PracticeSubCategory = {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  category: { id: string; name: string };
  _count: { subSubs: number };
};

type PracticeSubSubCategory = {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  subCategory: { id: string; name: string; category: { id: string; name: string } };
  _count: { sets: number };
};

type PracticeOption = { id: string; label: string; isCorrect?: boolean };
type PracticeQuestion = { id: string; prompt: string; order: number; options: PracticeOption[] };
type PracticeSet = {
  id: string;
  title: string;
  slug: string;
  description: string;
  level?: string | null;
  coverImageUrl?: string | null;
  durationMinutes: number;
  totalQuestions: number;
  isFree?: boolean;
  openAt?: string | null;
  closeAt?: string | null;
  subSubCategory: { id: string; name: string; subCategory: { id: string; name: string; category: { id: string; name: string } } };
  questions: PracticeQuestion[];
};

type CermatConfig = {
  questionCount: number;
  durationSeconds: number;
  totalSessions: number;
  breakSeconds: number;
};

const defaultSetValues = {
  title: '',
  slug: '',
  description: '',
  level: 'Beginner',
  categoryId: '',
  subCategoryId: '',
  subSubCategoryId: '',
  durationMinutes: 30,
  totalQuestions: 5,
  openAt: '',
  closeAt: '',
  isFree: false,
};

export function AdminPracticePage() {
  const queryClient = useQueryClient();
  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['admin-practice-categories'],
    queryFn: () => apiGet<PracticeCategory[]>('/admin/practice/categories'),
  });
  const { data: subCategoriesData, isLoading: subCategoriesLoading } = useQuery({
    queryKey: ['admin-practice-sub-categories'],
    queryFn: () => apiGet<PracticeSubCategory[]>('/admin/practice/sub-categories'),
  });
  const { data: subSubCategoriesData, isLoading: subSubCategoriesLoading } = useQuery({
    queryKey: ['admin-practice-sub-sub-categories'],
    queryFn: () => apiGet<PracticeSubSubCategory[]>('/admin/practice/sub-sub-categories'),
  });
  const { data: setsData, isLoading: setsLoading } = useQuery({
    queryKey: ['admin-practice-sets'],
    queryFn: () => apiGet<PracticeSet[]>('/admin/practice/sets'),
  });
  const { data: cermatConfig } = useQuery({
    queryKey: ['admin-cermat-config'],
    queryFn: () => apiGet<CermatConfig>('/admin/exams/cermat-config'),
  });

  const categoryForm = useForm<{ name: string; slug: string }>({ defaultValues: { name: '', slug: '' } });
  const [editingCategory, setEditingCategory] = useState<PracticeCategory | null>(null);
  const subCategoryForm = useForm<{ name: string; slug: string; categoryId: string }>({
    defaultValues: { name: '', slug: '', categoryId: '' },
  });
  const [editingSubCategory, setEditingSubCategory] = useState<PracticeSubCategory | null>(null);
  const subSubCategoryForm = useForm<{ name: string; slug: string; subCategoryId: string }>({
    defaultValues: { name: '', slug: '', subCategoryId: '' },
  });
  const [editingSubSubCategory, setEditingSubSubCategory] = useState<PracticeSubSubCategory | null>(null);
  const [categoryImageFile, setCategoryImageFile] = useState<File | null>(null);
  const [subCategoryImageFile, setSubCategoryImageFile] = useState<File | null>(null);
  const [subSubCategoryImageFile, setSubSubCategoryImageFile] = useState<File | null>(null);
  const setForm = useForm<typeof defaultSetValues>({
    defaultValues: defaultSetValues,
  });
  const cermatForm = useForm<CermatConfig>({
    defaultValues: { questionCount: 60, durationSeconds: 60, totalSessions: 10, breakSeconds: 5 },
  });

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [questionsFile, setQuestionsFile] = useState<File | null>(null);
  const [editingSet, setEditingSet] = useState<PracticeSet | null>(null);
  const isEditing = Boolean(editingSet);
  const [togglingSetId, setTogglingSetId] = useState<string | null>(null);

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
        ? apiPut(`/admin/practice/categories/${editingCategory.id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
        : apiPost('/admin/practice/categories', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => {
      toast.success(editingCategory ? 'Kategori diperbarui' : 'Kategori latihan dibuat');
      setEditingCategory(null);
      categoryForm.reset({ name: '', slug: '' });
      setCategoryImageFile(null);
      queryClient.invalidateQueries({ queryKey: ['admin-practice-categories'] });
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
        ? apiPut(`/admin/practice/sub-categories/${editingSubCategory.id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
        : apiPost('/admin/practice/sub-categories', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => {
      toast.success(editingSubCategory ? 'Sub kategori diperbarui' : 'Sub kategori latihan dibuat');
      setEditingSubCategory(null);
      subCategoryForm.reset({ name: '', slug: '', categoryId: '' });
      setSubCategoryImageFile(null);
      queryClient.invalidateQueries({ queryKey: ['admin-practice-sub-categories'] });
    },
    onError: () => toast.error('Gagal menyimpan sub kategori'),
  });

  const saveSubSubCategory = useMutation({
    mutationFn: (values: { name: string; slug: string; subCategoryId: string }) => {
      const formData = new FormData();
      formData.append('name', values.name);
      formData.append('slug', values.slug);
      formData.append('subCategoryId', values.subCategoryId);
      if (subSubCategoryImageFile) {
        formData.append('image', subSubCategoryImageFile);
      }
      return editingSubSubCategory
        ? apiPut(`/admin/practice/sub-sub-categories/${editingSubSubCategory.id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
        : apiPost('/admin/practice/sub-sub-categories', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => {
      toast.success(editingSubSubCategory ? 'Sub sub kategori diperbarui' : 'Sub sub kategori latihan dibuat');
      setEditingSubSubCategory(null);
      subSubCategoryForm.reset({ name: '', slug: '', subCategoryId: '' });
      setSubSubCategoryImageFile(null);
      queryClient.invalidateQueries({ queryKey: ['admin-practice-sub-sub-categories'] });
    },
    onError: () => toast.error('Gagal menyimpan sub sub kategori'),
  });

  const deleteCategory = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/practice/categories/${id}`),
    onSuccess: (_data, id) => {
      toast.success('Kategori dihapus');
      if (editingCategory && editingCategory.id === id) {
        setEditingCategory(null);
        categoryForm.reset({ name: '', slug: '' });
        setCategoryImageFile(null);
      }
      queryClient.invalidateQueries({ queryKey: ['admin-practice-categories'] });
    },
    onError: () => toast.error('Kategori tidak dapat dihapus'),
  });

  const deleteSubCategory = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/practice/sub-categories/${id}`),
    onSuccess: (_data, id) => {
      toast.success('Sub kategori dihapus');
      if (editingSubCategory && editingSubCategory.id === id) {
        setEditingSubCategory(null);
        subCategoryForm.reset({ name: '', slug: '', categoryId: '' });
        setSubCategoryImageFile(null);
      }
      queryClient.invalidateQueries({ queryKey: ['admin-practice-sub-categories'] });
    },
    onError: () => toast.error('Sub kategori tidak dapat dihapus'),
  });

  const deleteSubSubCategory = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/practice/sub-sub-categories/${id}`),
    onSuccess: (_data, id) => {
      toast.success('Sub sub kategori dihapus');
      if (editingSubSubCategory && editingSubSubCategory.id === id) {
        setEditingSubSubCategory(null);
        subSubCategoryForm.reset({ name: '', slug: '', subCategoryId: '' });
        setSubSubCategoryImageFile(null);
      }
      queryClient.invalidateQueries({ queryKey: ['admin-practice-sub-sub-categories'] });
    },
    onError: () => toast.error('Sub sub kategori tidak dapat dihapus'),
  });

  const createSet = useMutation({
    mutationFn: (payload: FormData) => apiPost('/admin/practice/sets', payload, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => {
      toast.success('Latihan baru tersimpan');
      setForm.reset(defaultSetValues);
      setCoverFile(null);
      setCoverPreview(null);
      setQuestionsFile(null);
      queryClient.invalidateQueries({ queryKey: ['admin-practice-sets'] });
    },
    onError: () => toast.error('Gagal menyimpan latihan'),
  });

  const updateSet = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormData }) =>
      apiPut(`/admin/practice/sets/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => {
      toast.success('Latihan diperbarui');
      setEditingSet(null);
      setForm.reset(defaultSetValues);
      setCoverFile(null);
      setCoverPreview(null);
      setQuestionsFile(null);
      queryClient.invalidateQueries({ queryKey: ['admin-practice-sets'] });
    },
    onError: () => toast.error('Gagal memperbarui latihan'),
  });

  const deleteSet = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/practice/sets/${id}`),
    onSuccess: () => {
      toast.success('Latihan dihapus');
      queryClient.invalidateQueries({ queryKey: ['admin-practice-sets'] });
    },
    onError: () => toast.error('Gagal menghapus latihan'),
  });

  const toggleSetFree = useMutation({
    mutationFn: ({ id, isFree }: { id: string; isFree: boolean }) => apiPatch(`/admin/practice/sets/${id}/free`, { isFree }),
    onMutate: ({ id }) => {
      setTogglingSetId(id);
    },
    onSuccess: () => {
      toast.success('Status gratis diperbarui');
      queryClient.invalidateQueries({ queryKey: ['admin-practice-sets'] });
    },
    onError: () => toast.error('Gagal memperbarui status gratis'),
    onSettled: () => setTogglingSetId(null),
  });

  const saveCermatConfig = useMutation({
    mutationFn: (values: CermatConfig) => apiPut('/admin/exams/cermat-config', values),
    onSuccess: () => {
      toast.success('Pengaturan tes kecermatan diperbarui');
      queryClient.invalidateQueries({ queryKey: ['admin-cermat-config'] });
    },
    onError: () => toast.error('Gagal memperbarui pengaturan tes kecermatan'),
  });

  const onSubmitCategory = categoryForm.handleSubmit((values) => saveCategory.mutate(values));
  const onSubmitSubCategory = subCategoryForm.handleSubmit((values) => {
    if (!values.categoryId) {
      toast.error('Pilih kategori utama terlebih dahulu');
      return;
    }
    saveSubCategory.mutate(values);
  });
  const onSubmitSubSubCategory = subSubCategoryForm.handleSubmit((values) => {
    if (!values.subCategoryId) {
      toast.error('Pilih sub kategori terlebih dahulu');
      return;
    }
    saveSubSubCategory.mutate(values);
  });
  const onSubmitCermat = cermatForm.handleSubmit((values) => saveCermatConfig.mutate(values));

  const onSubmitSet = setForm.handleSubmit((values) => {
    if (!values.subSubCategoryId) {
      toast.error('Pilih sub sub kategori latihan terlebih dahulu');
      return;
    }
    if (!questionsFile && !isEditing) {
      toast.error('Unggah CSV soal terlebih dahulu');
      return;
    }
    const formData = new FormData();
    formData.append('title', values.title);
    formData.append('slug', values.slug);
    formData.append('description', values.description);
    if (values.level) {
      formData.append('level', values.level);
    }
    formData.append('subSubCategoryId', values.subSubCategoryId);
    if (values.durationMinutes) {
      formData.append('durationMinutes', String(values.durationMinutes));
    }
    if (values.totalQuestions) {
      formData.append('totalQuestions', String(values.totalQuestions));
    }
    formData.append('isFree', String(values.isFree ?? false));
    if (values.openAt) {
      formData.append('openAt', values.openAt);
    }
    if (values.closeAt) {
      formData.append('closeAt', values.closeAt);
    }
    if (coverFile) {
      formData.append('coverImage', coverFile);
    }
    if (questionsFile) {
      formData.append('questionsCsv', questionsFile);
    }
    if (isEditing && editingSet) {
      updateSet.mutate({ id: editingSet.id, data: formData });
    } else {
      createSet.mutate(formData);
    }
  });

  const handleCoverChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setCoverFile(file);
    setCoverPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleQuestionsFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setQuestionsFile(file);
  };

  const handleEditSet = (set: PracticeSet) => {
    setEditingSet(set);
    setForm.reset({
      title: set.title,
      slug: set.slug,
      description: set.description,
      level: set.level ?? '',
      categoryId: set.subSubCategory.subCategory.category.id,
      subCategoryId: set.subSubCategory.subCategory.id,
      subSubCategoryId: set.subSubCategory.id,
      durationMinutes: set.durationMinutes,
      totalQuestions: set.totalQuestions,
      openAt: toInputDateTime(set.openAt),
      closeAt: toInputDateTime(set.closeAt),
      isFree: set.isFree ?? false,
    });
    setCoverPreview(set.coverImageUrl ?? null);
    setCoverFile(null);
    setQuestionsFile(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingSet(null);
    setForm.reset(defaultSetValues);
    setCoverPreview(null);
    setCoverFile(null);
    setQuestionsFile(null);
  };

  const isSubmittingSet = createSet.isPending || updateSet.isPending;

  const categories = useMemo(() => categoriesData ?? [], [categoriesData]);
  const subCategories = useMemo(() => subCategoriesData ?? [], [subCategoriesData]);
  const subSubCategories = useMemo(() => subSubCategoriesData ?? [], [subSubCategoriesData]);
  const sets = useMemo(() => setsData ?? [], [setsData]);
  const selectedCategoryId = useWatch({ control: setForm.control, name: 'categoryId' });
  const selectedSubCategoryId = useWatch({ control: setForm.control, name: 'subCategoryId' });
  const filteredSubCategories = useMemo(
    () => subCategories.filter((item) => item.category.id === selectedCategoryId),
    [selectedCategoryId, subCategories],
  );
  const filteredSubSubCategories = useMemo(
    () => subSubCategories.filter((item) => item.subCategory.id === selectedSubCategoryId),
    [selectedSubCategoryId, subSubCategories],
  );

  useEffect(() => {
    if (cermatConfig) {
      cermatForm.reset(cermatConfig);
    }
  }, [cermatConfig, cermatForm]);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Latihan & Bank Soal</h2>
        <p className="mt-2 text-sm text-slate-500">Kelola modul latihan, tugas, dan jenis soal harian.</p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Tes Kecermatan</p>
            <h3 className="text-xl font-semibold text-slate-900">Pengaturan jumlah soal & durasi</h3>
            <p className="text-xs text-slate-500">Atur total sesi, durasi, dan jumlah soal per sesi.</p>
          </div>
          <form className="grid gap-3 md:grid-cols-4" onSubmit={onSubmitCermat}>
            <div>
              <p className="text-xs font-semibold text-slate-500">Jumlah Soal</p>
              <Input type="number" {...cermatForm.register('questionCount', { valueAsNumber: true })} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Durasi (detik)</p>
              <Input type="number" {...cermatForm.register('durationSeconds', { valueAsNumber: true })} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Total Sesi</p>
              <Input type="number" {...cermatForm.register('totalSessions', { valueAsNumber: true })} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Jeda (detik)</p>
              <Input type="number" {...cermatForm.register('breakSeconds', { valueAsNumber: true })} />
            </div>
            <div className="md:col-span-4">
              <Button type="submit" disabled={saveCermatConfig.isPending}>
                {saveCermatConfig.isPending ? 'Menyimpan...' : 'Simpan Pengaturan'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">Kategori Latihan</p>
              <h3 className="text-xl font-semibold text-slate-900">
                {editingCategory ? `Edit: ${editingCategory.name}` : `${categories.length} kategori`}
              </h3>
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
            <Button type="submit" disabled={saveCategory.isPending}>
              {saveCategory.isPending ? 'Menyimpan...' : editingCategory ? 'Perbarui Kategori' : 'Tambah Kategori'}
            </Button>
          </form>
          <div className="grid gap-3 md:grid-cols-2">
            {categoriesLoading && <Skeleton className="h-20" />}
            {categories.map((category) => (
              <div key={category.id} className="rounded-2xl border border-slate-100 p-4">
                {getAssetUrl(category.imageUrl) && (
                  <img
                    src={getAssetUrl(category.imageUrl)}
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
              <p className="text-xs uppercase tracking-widest text-slate-500">Sub Kategori Latihan</p>
              <h3 className="text-xl font-semibold text-slate-900">
                {editingSubCategory ? `Edit: ${editingSubCategory.name}` : `${subCategories.length} sub kategori`}
              </h3>
              <p className="text-xs text-slate-500">Pilih kategori utama untuk membuat sub kategori.</p>
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
            <Button type="submit" disabled={saveSubCategory.isPending}>
              {saveSubCategory.isPending ? 'Menyimpan...' : editingSubCategory ? 'Perbarui Sub Kategori' : 'Tambah Sub Kategori'}
            </Button>
          </form>
          <div className="grid gap-3 md:grid-cols-2">
            {subCategoriesLoading && <Skeleton className="h-20" />}
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
                <p className="text-xs text-slate-500">Sub sub kategori: {subCategory._count.subSubs}</p>
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">Sub Sub Kategori Latihan</p>
              <h3 className="text-xl font-semibold text-slate-900">
                {editingSubSubCategory ? `Edit: ${editingSubSubCategory.name}` : `${subSubCategories.length} sub sub kategori`}
              </h3>
              <p className="text-xs text-slate-500">Pilih sub kategori sebelum membuat sub sub kategori.</p>
            </div>
            {editingSubSubCategory && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingSubSubCategory(null);
                  subSubCategoryForm.reset({ name: '', slug: '', subCategoryId: '' });
                  setSubSubCategoryImageFile(null);
                }}
              >
                Batalkan Edit
              </Button>
            )}
          </div>
          <form className="grid gap-3 md:grid-cols-3" onSubmit={onSubmitSubSubCategory}>
            <Input placeholder="Nama" {...subSubCategoryForm.register('name')} />
            <Input placeholder="Slug" {...subSubCategoryForm.register('slug')} />
            <select className="rounded-2xl border border-slate-200 px-4 py-2 text-sm" {...subSubCategoryForm.register('subCategoryId')}>
              <option value="">Pilih sub kategori</option>
              {subCategories.map((subCategory) => (
                <option key={subCategory.id} value={subCategory.id}>
                  {subCategory.category.name} / {subCategory.name}
                </option>
              ))}
            </select>
            <Input
              type="file"
              accept="image/*"
              onChange={(event) => setSubSubCategoryImageFile(event.target.files?.[0] ?? null)}
            />
            <Button type="submit" disabled={saveSubSubCategory.isPending}>
              {saveSubSubCategory.isPending ? 'Menyimpan...' : editingSubSubCategory ? 'Perbarui Sub Sub Kategori' : 'Tambah Sub Sub Kategori'}
            </Button>
          </form>
          <div className="grid gap-3 md:grid-cols-2">
            {subSubCategoriesLoading && <Skeleton className="h-20" />}
            {subSubCategories.map((subSubCategory) => (
              <div key={subSubCategory.id} className="rounded-2xl border border-slate-100 p-4">
                {getAssetUrl(subSubCategory.imageUrl) && (
                  <img
                    src={getAssetUrl(subSubCategory.imageUrl)}
                    alt={subSubCategory.name}
                    className="mb-3 h-24 w-full rounded-xl object-cover"
                    loading="lazy"
                  />
                )}
                <p className="font-semibold text-slate-900">{subSubCategory.name}</p>
                <p className="text-xs text-slate-500">
                  {subSubCategory.subCategory.category.name} / {subSubCategory.subCategory.name}
                </p>
                <p className="text-xs text-slate-500">Set soal: {subSubCategory._count.sets}</p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingSubSubCategory(subSubCategory);
                      subSubCategoryForm.reset({
                        name: subSubCategory.name,
                        slug: subSubCategory.slug,
                        subCategoryId: subSubCategory.subCategory.id,
                      });
                      setSubSubCategoryImageFile(null);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteSubSubCategory.mutate(subSubCategory.id)}
                    disabled={deleteSubSubCategory.isPending}
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
            <p className="text-xs uppercase tracking-widest text-slate-500">Buat Latihan</p>
            <h3 className="text-xl font-semibold text-slate-900">Tambah soal baru</h3>
          </div>
          {isEditing && editingSet && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
              <p className="text-sm font-semibold">Sedang mengedit: {editingSet.title}</p>
              <p className="text-xs text-amber-700">Unggah CSV hanya jika ingin mengganti seluruh soal latihan.</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                  Batalkan Edit
                </Button>
              </div>
            </div>
          )}
          <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmitSet}>
            <Input placeholder="Judul" {...setForm.register('title')} />
            <Input placeholder="Slug" {...setForm.register('slug')} />
            <Textarea placeholder="Deskripsi" className="md:col-span-2" {...setForm.register('description')} />
            <div className="md:col-span-2 space-y-2">
              <p className="text-xs font-semibold text-slate-500">Cover Latihan (Opsional)</p>
              {coverPreview && (
                <img src={getAssetUrl(coverPreview)} alt="Cover" className="h-32 w-full rounded-2xl object-cover" />
              )}
              <Input type="file" accept="image/*" onChange={handleCoverChange} />
              <p className="text-[11px] text-slate-500">Gunakan JPG, PNG, atau WEBP maksimal 5MB.</p>
            </div>
            <Input placeholder="Level" {...setForm.register('level')} />
            <select
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm"
              {...setForm.register('categoryId')}
              onChange={(event) => {
                setForm.setValue('categoryId', event.target.value);
                setForm.setValue('subCategoryId', '');
                setForm.setValue('subSubCategoryId', '');
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
              {...setForm.register('subCategoryId')}
              onChange={(event) => {
                setForm.setValue('subCategoryId', event.target.value);
                setForm.setValue('subSubCategoryId', '');
              }}
            >
              <option value="">Pilih sub kategori</option>
              {filteredSubCategories.map((subCategory) => (
                <option key={subCategory.id} value={subCategory.id}>
                  {subCategory.name}
                </option>
              ))}
            </select>
            <select className="rounded-2xl border border-slate-200 px-4 py-2 text-sm" {...setForm.register('subSubCategoryId')}>
              <option value="">Pilih sub sub kategori</option>
              {filteredSubSubCategories.map((subSubCategory) => (
                <option key={subSubCategory.id} value={subSubCategory.id}>
                  {subSubCategory.name}
                </option>
              ))}
            </select>
            <Input type="number" placeholder="Durasi (menit)" {...setForm.register('durationMinutes', { valueAsNumber: true })} />
            <Input type="number" placeholder="Total Soal" {...setForm.register('totalQuestions', { valueAsNumber: true })} />
            <Input type="datetime-local" placeholder="Buka pada" {...setForm.register('openAt')} />
            <Input type="datetime-local" placeholder="Tutup pada" {...setForm.register('closeAt')} />
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 md:col-span-2">
              <input type="checkbox" {...setForm.register('isFree')} />
              Latihan gratis untuk member baru
            </label>
            <div className="md:col-span-2 space-y-2">
              <p className="text-xs font-semibold text-slate-500">
                Upload Soal (CSV) {isEditing && <span className="font-normal">(opsional saat edit)</span>}
              </p>
              <Input type="file" accept=".csv" onChange={handleQuestionsFileChange} />
              {!questionsFile && !isEditing && <p className="text-[11px] text-red-500">CSV soal wajib diunggah.</p>}
              {isEditing && !questionsFile && <p className="text-[11px] text-slate-500">Biarkan kosong jika tidak mengganti bank soal.</p>}
            </div>
            <Button type="submit" disabled={isSubmittingSet} className="md:col-span-2">
              {isSubmittingSet ? (isEditing ? 'Memperbarui...' : 'Mengunggah...') : isEditing ? 'Perbarui Latihan' : 'Simpan Latihan'}
            </Button>
          </form>
          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
            <span>Gunakan template CSV terbaru agar format soal sesuai sistem.</span>
            <Button asChild size="sm" variant="outline">
              <a href="/templates/Template_Latihan_Soal.csv" download>
                Unduh Template Latihan
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-xl font-semibold text-slate-900">Daftar Latihan</h3>
          {setsLoading && <Skeleton className="h-32" />}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sets.map((set) => (
              <div key={set.id} className="rounded-2xl border border-slate-100 p-4">
                {getAssetUrl(set.coverImageUrl) && (
                  <img
                    src={getAssetUrl(set.coverImageUrl)}
                    alt={set.title}
                    className="mb-3 h-32 w-full rounded-2xl object-cover"
                    loading="lazy"
                  />
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{set.title}</p>
                    <p className="text-xs text-slate-500">
                      {set.subSubCategory.subCategory.category.name} / {set.subSubCategory.subCategory.name} / {set.subSubCategory.name} - {set.totalQuestions} soal
                    </p>
                    {set.isFree && <p className="text-[11px] font-semibold text-emerald-600">Gratis untuk member baru</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className={set.isFree ? 'border-emerald-300 text-emerald-700' : undefined}
                      onClick={() => toggleSetFree.mutate({ id: set.id, isFree: !set.isFree })}
                      disabled={togglingSetId === set.id && toggleSetFree.isPending}
                    >
                      <span className="flex items-center gap-2">
                        {togglingSetId === set.id && toggleSetFree.isPending && (
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        )}
                        Gratis: {set.isFree ? 'ON' : 'OFF'}
                      </span>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleEditSet(set)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSet.mutate(set.id)}
                      disabled={deleteSet.isPending}
                    >
                      Hapus
                    </Button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-600">{set.description}</p>
              </div>
            ))}
          </div>
          {sets.length === 0 && <p className="text-sm text-slate-500">Belum ada data latihan.</p>}
        </CardContent>
      </Card>
    </section>
  );
}

