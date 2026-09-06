import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
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
  const { accessToken } = useAuth();
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

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [questionsFile, setQuestionsFile] = useState<File | null>(null);
  const [editingSet, setEditingSet] = useState<PracticeSet | null>(null);
  const isEditing = Boolean(editingSet);
  const [togglingSetId, setTogglingSetId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingQuestionsAll, setIsExportingQuestionsAll] = useState(false);
  const [exportingSetQuestionsId, setExportingSetQuestionsId] = useState<string | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [categorySlugManual, setCategorySlugManual] = useState(false);
  const [subCategorySlugManual, setSubCategorySlugManual] = useState(false);
  const [subSubCategorySlugManual, setSubSubCategorySlugManual] = useState(false);

  const watchCategoryName = useWatch({ control: categoryForm.control, name: 'name' });
  const watchCategorySlug = useWatch({ control: categoryForm.control, name: 'slug' });
  const watchSubCategoryName = useWatch({ control: subCategoryForm.control, name: 'name' });
  const watchSubCategorySlug = useWatch({ control: subCategoryForm.control, name: 'slug' });
  const watchSubSubCategoryName = useWatch({ control: subSubCategoryForm.control, name: 'name' });
  const watchSubSubCategorySlug = useWatch({ control: subSubCategoryForm.control, name: 'slug' });

  useAutoSlug(watchCategoryName, categorySlugManual, (value) => categoryForm.setValue('slug', value));
  useAutoSlug(watchSubCategoryName, subCategorySlugManual, (value) => subCategoryForm.setValue('slug', value));
  useAutoSlug(watchSubSubCategoryName, subSubCategorySlugManual, (value) => subSubCategoryForm.setValue('slug', value));

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
        ? apiPutForm(`/admin/practice/categories/${editingCategory.id}`, formData)
        : apiPostForm('/admin/practice/categories', formData);
    },
    onSuccess: () => {
      toast.success(editingCategory ? 'Kategori diperbarui' : 'Kategori latihan dibuat');
      setEditingCategory(null);
      categoryForm.reset({ name: '', slug: '' });
      setCategoryImageFile(null);
      setCategorySlugManual(false);
      queryClient.invalidateQueries({ queryKey: ['admin-practice-categories'] });
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
        ? apiPutForm(`/admin/practice/sub-categories/${editingSubCategory.id}`, formData)
        : apiPostForm('/admin/practice/sub-categories', formData);
    },
    onSuccess: () => {
      toast.success(editingSubCategory ? 'Sub kategori diperbarui' : 'Sub kategori latihan dibuat');
      setEditingSubCategory(null);
      subCategoryForm.reset({ name: '', slug: '', categoryId: '' });
      setSubCategoryImageFile(null);
      setSubCategorySlugManual(false);
      queryClient.invalidateQueries({ queryKey: ['admin-practice-sub-categories'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Gagal menyimpan sub kategori')),
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
        ? apiPutForm(`/admin/practice/sub-sub-categories/${editingSubSubCategory.id}`, formData)
        : apiPostForm('/admin/practice/sub-sub-categories', formData);
    },
    onSuccess: () => {
      toast.success(editingSubSubCategory ? 'Sub sub kategori diperbarui' : 'Sub sub kategori latihan dibuat');
      setEditingSubSubCategory(null);
      subSubCategoryForm.reset({ name: '', slug: '', subCategoryId: '' });
      setSubSubCategoryImageFile(null);
      setSubSubCategorySlugManual(false);
      queryClient.invalidateQueries({ queryKey: ['admin-practice-sub-sub-categories'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Gagal menyimpan sub sub kategori')),
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
    mutationFn: (payload: FormData) => apiPostForm('/admin/practice/sets', payload),
    onSuccess: () => {
      toast.success('Latihan baru tersimpan');
      setForm.reset(defaultSetValues);
      setCoverFile(null);
      setCoverPreview(null);
      setQuestionsFile(null);
      setSlugManuallyEdited(false);
      queryClient.invalidateQueries({ queryKey: ['admin-practice-sets'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Gagal menyimpan latihan')),
  });

  const updateSet = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormData }) => apiPutForm(`/admin/practice/sets/${id}`, data),
    onSuccess: () => {
      toast.success('Latihan diperbarui');
      setEditingSet(null);
      setForm.reset(defaultSetValues);
      setCoverFile(null);
      setCoverPreview(null);
      setQuestionsFile(null);
      queryClient.invalidateQueries({ queryKey: ['admin-practice-sets'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Gagal memperbarui latihan')),
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
    setSlugManuallyEdited(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingSet(null);
    setForm.reset(defaultSetValues);
    setCoverPreview(null);
    setCoverFile(null);
    setQuestionsFile(null);
    setSlugManuallyEdited(false);
  };

  const isSubmittingSet = createSet.isPending || updateSet.isPending;

  const categories = useMemo(() => categoriesData ?? [], [categoriesData]);
  const subCategories = useMemo(() => subCategoriesData ?? [], [subCategoriesData]);
  const subSubCategories = useMemo(() => subSubCategoriesData ?? [], [subSubCategoriesData]);
  const sets = useMemo(() => setsData ?? [], [setsData]);
  const selectedCategoryId = useWatch({ control: setForm.control, name: 'categoryId' });
  const selectedSubCategoryId = useWatch({ control: setForm.control, name: 'subCategoryId' });
  const selectedSubSubCategoryId = useWatch({ control: setForm.control, name: 'subSubCategoryId' });
  const watchTitle = useWatch({ control: setForm.control, name: 'title' });
  const filteredSubCategories = useMemo(
    () => subCategories.filter((item) => item.category.id === selectedCategoryId),
    [selectedCategoryId, subCategories],
  );
  const filteredSubSubCategories = useMemo(
    () => subSubCategories.filter((item) => item.subCategory.id === selectedSubCategoryId),
    [selectedSubCategoryId, subSubCategories],
  );

  const categoryPath = useMemo(() => {
    const category = categories.find((item) => item.id === selectedCategoryId);
    const subCategory = filteredSubCategories.find((item) => item.id === selectedSubCategoryId);
    const subSubCategory = filteredSubSubCategories.find((item) => item.id === selectedSubSubCategoryId);
    return [category?.name, subCategory?.name, subSubCategory?.name].filter(Boolean) as string[];
  }, [categories, filteredSubCategories, filteredSubSubCategories, selectedCategoryId, selectedSubCategoryId, selectedSubSubCategoryId]);

  useEffect(() => {
    if (!slugManuallyEdited && watchTitle?.trim()) {
      setForm.setValue('slug', slugifyExamSlug(watchTitle));
    }
  }, [watchTitle, slugManuallyEdited, setForm]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await api.get('/admin/practice/export', {
        responseType: 'blob',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'latihan-bank-soal.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error('Gagal mengunduh CSV latihan');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportQuestionsCsv = async (setItem?: { id: string; slug: string }) => {
    if (setItem) {
      setExportingSetQuestionsId(setItem.id);
    } else {
      setIsExportingQuestionsAll(true);
    }
    try {
      const query = setItem ? `?setId=${encodeURIComponent(setItem.id)}` : '';
      const response = await api.get(`/admin/practice/questions/export${query}`, {
        responseType: 'blob',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = setItem ? `soal-latihan-${setItem.slug}.csv` : 'soal-latihan-semua.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error('Gagal mengunduh CSV soal latihan');
    } finally {
      if (setItem) {
        setExportingSetQuestionsId(null);
      } else {
        setIsExportingQuestionsAll(false);
      }
    }
  };

  return (
    <section className="page-shell space-y-6">
      <PageHeader variant="panel"
        eyebrow="Admin"
        title="Latihan & Bank Soal"
        description="Atur struktur kategori, unggah bank soal dari CSV, dan kelola modul latihan harian."
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
          { label: 'Buat kategori', detail: 'Kategori → Sub → Sub-sub (langkah 1–3)' },
          { label: 'Konversi Word', detail: 'Menu Konversi Word → CSV jika belum punya file' },
          { label: 'Upload latihan', detail: 'Isi form langkah 4 + unggah CSV soal' },
          { label: 'Kelola daftar', detail: 'Edit, hapus, atau unduh soal per latihan' },
        ]}
      />

      <AdminPanel
        step={1}
        title="Kategori Latihan"
        description="Tingkat paling atas — contoh: POLRI, TNI, CPNS."
        meta={`${categories.length} kategori terdaftar`}
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
                imageUrl={getAssetUrl(category.imageUrl)}
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
        title="Sub Kategori Latihan"
        description="Grup materi di bawah kategori — contoh: Tes Akademik, Tes Kesehatan."
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
            namePlaceholder="Tes Akademik"
            slugPlaceholder="tes-akademik"
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
                lines={[`Kategori: ${subCategory.category.name}`, `Sub sub kategori: ${subCategory._count.subSubs}`]}
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
        title="Sub Sub Kategori Latihan"
        description="Folder tempat latihan disimpan — contoh: Pancasila, Matematika Dasar."
        meta={`${subSubCategories.length} sub sub kategori terdaftar`}
        isEditing={Boolean(editingSubSubCategory)}
        editTitle={editingSubSubCategory ? `Edit sub sub kategori: ${editingSubSubCategory.name}` : undefined}
        onCancelEdit={
          editingSubSubCategory
            ? () => {
                setEditingSubSubCategory(null);
                subSubCategoryForm.reset({ name: '', slug: '', subCategoryId: '' });
                setSubSubCategoryImageFile(null);
                setSubSubCategorySlugManual(false);
              }
            : undefined
        }
      >
        <form className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4" onSubmit={onSubmitSubSubCategory}>
          <NameSlugFields
            nameLabel="Nama sub sub kategori"
            namePlaceholder="Pancasila"
            slugPlaceholder="pancasila"
            nameRegister={subSubCategoryForm.register('name')}
            slugValue={watchSubSubCategorySlug ?? ''}
            onSlugChange={(value) => subSubCategoryForm.setValue('slug', value)}
            onSlugManualEdit={() => setSubSubCategorySlugManual(true)}
          />
          <FormField label="Sub kategori induk" required hint="Pilih sub kategori tempat folder ini berada.">
            <select className={formSelectClassName} {...subSubCategoryForm.register('subCategoryId')}>
              <option value="">— Pilih sub kategori —</option>
              {subCategories.map((subCategory) => (
                <option key={subCategory.id} value={subCategory.id}>
                  {subCategory.category.name} / {subCategory.name}
                </option>
              ))}
            </select>
          </FormField>
          <ImageUploadField
            fileName={subSubCategoryImageFile?.name}
            onChange={(event) => setSubSubCategoryImageFile(event.target.files?.[0] ?? null)}
          />
          <Button type="submit" disabled={saveSubSubCategory.isPending}>
            {saveSubSubCategory.isPending ? 'Menyimpan...' : editingSubSubCategory ? 'Perbarui Sub Sub Kategori' : 'Tambah Sub Sub Kategori'}
          </Button>
        </form>

        <div>
          <p className="mb-3 text-sm font-semibold text-slate-800">Daftar sub sub kategori</p>
          {subSubCategoriesLoading && <Skeleton className="h-24" />}
          {!subSubCategoriesLoading && subSubCategories.length === 0 && (
            <EntityListEmpty message="Belum ada sub sub kategori. Buat sub kategori dulu (langkah 2)." />
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {subSubCategories.map((subSubCategory) => (
              <EntityCard
                key={subSubCategory.id}
                title={subSubCategory.name}
                imageUrl={getAssetUrl(subSubCategory.imageUrl)}
                lines={[
                  `${subSubCategory.subCategory.category.name} / ${subSubCategory.subCategory.name}`,
                  `Set latihan: ${subSubCategory._count.sets}`,
                ]}
                onEdit={() => {
                  setEditingSubSubCategory(subSubCategory);
                  subSubCategoryForm.reset({
                    name: subSubCategory.name,
                    slug: subSubCategory.slug,
                    subCategoryId: subSubCategory.subCategory.id,
                  });
                  setSubSubCategoryImageFile(null);
                  setSubSubCategorySlugManual(true);
                }}
                onDelete={() => deleteSubSubCategory.mutate(subSubCategory.id)}
                deletePending={deleteSubSubCategory.isPending}
              />
            ))}
          </div>
        </div>
      </AdminPanel>

      <AdminPanel
        step={4}
        title={isEditing ? 'Edit latihan' : 'Upload latihan baru'}
        description="Isi form bertahap di bawah, lalu unggah file CSV hasil konversi Word atau template."
        isEditing={isEditing}
        editTitle={editingSet ? `Mengedit: ${editingSet.title}` : undefined}
        onCancelEdit={isEditing ? handleCancelEdit : undefined}
      >
        {isEditing && editingSet && (
          <p className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-800">
            Unggah CSV hanya jika ingin mengganti seluruh bank soal. Kosongkan jika hanya mengubah judul atau pengaturan.
          </p>
        )}
        <form className="space-y-5" onSubmit={onSubmitSet}>
          <FormSection step={1} title="Informasi dasar" description="Judul dan deskripsi yang tampil di halaman latihan.">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Judul latihan" required hint="Contoh: Pancasila Wawasan Kebangsaan 1">
                <Input placeholder="Judul latihan" {...setForm.register('title')} />
              </FormField>
              <FormField label="Slug URL" required hint="Otomatis dari judul. Bisa diedit manual.">
                <Input
                  placeholder="pancasila-wawasan-1"
                  {...setForm.register('slug')}
                  onChange={(event) => {
                    setSlugManuallyEdited(true);
                    setForm.setValue('slug', event.target.value);
                  }}
                />
              </FormField>
            </div>
            <FormField label="Deskripsi" hint="Instruksi singkat untuk peserta (min. 5 karakter).">
              <Textarea placeholder="Kerjakan semua soal pilihan ganda..." rows={3} {...setForm.register('description')} />
            </FormField>
          </FormSection>

          <FormSection step={2} title="Kategori & level" description="Pilih lokasi latihan di struktur kategori (langkah 1–3).">
            <CategoryPathPreview segments={categoryPath} />
            <div className="grid gap-4 md:grid-cols-3">
              <FormField label="Kategori" required>
                <select
                  className={formSelectClassName}
                  {...setForm.register('categoryId')}
                  onChange={(event) => {
                    setForm.setValue('categoryId', event.target.value);
                    setForm.setValue('subCategoryId', '');
                    setForm.setValue('subSubCategoryId', '');
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
                  {...setForm.register('subCategoryId')}
                  onChange={(event) => {
                    setForm.setValue('subCategoryId', event.target.value);
                    setForm.setValue('subSubCategoryId', '');
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
              <FormField label="Sub sub kategori" required>
                <select className={formSelectClassName} disabled={!selectedSubCategoryId} {...setForm.register('subSubCategoryId')}>
                  <option value="">{selectedSubCategoryId ? '— Pilih sub sub kategori —' : 'Pilih sub kategori dulu'}</option>
                  {filteredSubSubCategories.map((subSubCategory) => (
                    <option key={subSubCategory.id} value={subSubCategory.id}>
                      {subSubCategory.name}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <FormField label="Level" hint="Tingkat kesulitan latihan.">
              <select className={formSelectClassName} {...setForm.register('level')}>
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </FormField>
          </FormSection>

          <FormSection step={3} title="Pengaturan ujian" description="Durasi, jadwal, dan akses gratis.">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Durasi (menit)" required hint="Waktu pengerjaan latihan.">
                <Input type="number" min={1} {...setForm.register('durationMinutes', { valueAsNumber: true })} />
              </FormField>
              <FormField label="Total soal" required hint="Sesuaikan dengan jumlah baris di CSV.">
                <Input type="number" min={1} {...setForm.register('totalQuestions', { valueAsNumber: true })} />
              </FormField>
              <FormField label="Buka pada" hint="Kosongkan jika latihan selalu aktif.">
                <Input type="datetime-local" {...setForm.register('openAt')} />
              </FormField>
              <FormField label="Tutup pada" hint="Kosongkan jika tidak ada batas akhir.">
                <Input type="datetime-local" {...setForm.register('closeAt')} />
              </FormField>
            </div>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700">
              <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...setForm.register('isFree')} />
              Latihan gratis untuk member baru
            </label>
          </FormSection>

          <FormSection step={4} title="Cover & bank soal" description="Upload cover opsional dan file CSV soal.">
            <FormField label="Cover latihan (opsional)" hint="JPG, PNG, atau WEBP — maks. 5 MB.">
              {coverPreview && (
                <img src={getAssetUrl(coverPreview)} alt="Cover" className="mb-2 h-32 w-full rounded-xl object-cover" />
              )}
              <Input type="file" accept="image/*" onChange={handleCoverChange} />
            </FormField>
            <FormField label="File soal (CSV)" required={!isEditing}>
              <CsvQuestionUpload
                inputId="practice-csv-upload"
                isEditing={isEditing}
                questionsFile={questionsFile}
                onFileChange={handleQuestionsFileChange}
                templateHref="/templates/Template_Latihan_Soal.csv"
                templateLabel="Template Latihan"
              />
            </FormField>
          </FormSection>

          <Button type="submit" disabled={isSubmittingSet} size="lg" className="w-full md:w-auto">
            {isSubmittingSet ? (isEditing ? 'Memperbarui...' : 'Menyimpan...') : isEditing ? 'Perbarui Latihan' : 'Simpan Latihan'}
          </Button>
        </form>
      </AdminPanel>

      <AdminPanel step={5} title="Daftar Latihan" description="Semua modul latihan yang sudah diunggah." meta={`${sets.length} latihan`}>
        {setsLoading && <Skeleton className="h-32" />}
        {!setsLoading && sets.length === 0 && (
          <EntityListEmpty message="Belum ada latihan. Upload latihan pertama di langkah 4." />
        )}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sets.map((set) => (
            <div key={set.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              {getAssetUrl(set.coverImageUrl) && (
                <img
                  src={getAssetUrl(set.coverImageUrl)}
                  alt={set.title}
                  className="mb-3 h-32 w-full rounded-xl object-cover"
                  loading="lazy"
                />
              )}
              <p className="font-semibold text-slate-900">{set.title}</p>
              <p className="text-xs text-slate-500">
                {set.subSubCategory.subCategory.category.name} / {set.subSubCategory.subCategory.name} / {set.subSubCategory.name}
              </p>
              <p className="text-xs text-slate-500">{set.totalQuestions} soal · {set.durationMinutes} menit</p>
              {set.isFree && <p className="text-[11px] font-semibold text-emerald-600">Gratis untuk member baru</p>}
              <p className="mt-2 line-clamp-2 text-sm text-slate-600">{set.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className={set.isFree ? 'border-emerald-300 text-emerald-700' : undefined}
                  onClick={() => toggleSetFree.mutate({ id: set.id, isFree: !set.isFree })}
                  disabled={togglingSetId === set.id && toggleSetFree.isPending}
                >
                  Gratis: {set.isFree ? 'ON' : 'OFF'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleEditSet(set)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExportQuestionsCsv({ id: set.id, slug: set.slug })}
                  disabled={exportingSetQuestionsId === set.id}
                >
                  {exportingSetQuestionsId === set.id ? 'Mengunduh...' : 'CSV Soal'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  onClick={() => deleteSet.mutate(set.id)}
                  disabled={deleteSet.isPending}
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

