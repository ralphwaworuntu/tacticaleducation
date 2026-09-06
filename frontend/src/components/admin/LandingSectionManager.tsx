import { type ChangeEvent, useMemo, useState } from 'react';
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiDelete, apiPost, apiPut } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getAssetUrl } from '@/lib/media';
import type { PackageOption } from '@/types/landing';

export type FieldConfig = {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'textarea' | 'url' | 'boolean' | 'packages';
  placeholder?: string;
  defaultValue?: string | number;
};

export type LandingItem = { id: string } & Record<string, string | number | boolean | string[] | null | undefined>;

export type LandingResourceConfig = {
  key: string;
  title: string;
  endpoint: string;
  primaryField: string;
  secondaryField?: string;
  fields: FieldConfig[];
  uploadField?: {
    name: string;
    label: string;
    previewKey?: string;
    helper?: string;
    accept?: string;
  };
};

type SectionFormValues = Record<string, string | number | null | boolean | string[]>;
type PackageSelectorProps = {
  fieldName: keyof SectionFormValues;
  disable: boolean;
  packageOptions: PackageOption[];
  form: UseFormReturn<SectionFormValues>;
  helpText?: string;
};

function PackageSelector({ fieldName, disable, packageOptions, form, helpText }: PackageSelectorProps) {
  const selected = (useWatch({ control: form.control, name: fieldName }) ?? []) as string[];

  return (
    <div className="mt-2 grid gap-2 md:grid-cols-2">
      {packageOptions.map((pkg) => (
        <label key={pkg.id} className="admin-check-row">
          <input
            type="checkbox"
            disabled={disable}
            checked={selected.includes(pkg.id)}
            onChange={(event) => {
              const current = Array.isArray(form.getValues(fieldName)) ? (form.getValues(fieldName) as string[]) : [];
              const next = event.target.checked ? [...current, pkg.id] : current.filter((id) => id !== pkg.id);
              form.setValue(fieldName, next);
            }}
          />
          {pkg.name}
        </label>
      ))}
      {disable && helpText && (
        <p className="text-xs text-slate-500 md:col-span-2">{helpText}</p>
      )}
    </div>
  );
}

export function LandingSectionManager({
  config,
  items,
  packageOptions,
}: {
  config: LandingResourceConfig;
  items: LandingItem[];
  packageOptions: PackageOption[];
}) {
  const queryClient = useQueryClient();
  const initialValues = useMemo<SectionFormValues>(() => {
    const base: SectionFormValues = {};
    config.fields.forEach((field) => {
      if (field.type === 'boolean') {
        base[field.name] = Boolean(field.defaultValue ?? false);
      } else if (field.type === 'packages') {
        base[field.name] = [];
      } else {
        base[field.name] = field.defaultValue ?? '';
      }
    });
    return base;
  }, [config.fields]);

  const mapItemToValues = (item?: LandingItem): SectionFormValues => {
    const values: SectionFormValues = {};
    config.fields.forEach((field) => {
      const fallback = initialValues[field.name] ?? '';
      values[field.name] = (item?.[field.name] ?? fallback) as SectionFormValues[string];
    });
    return values;
  };

  const form = useForm<SectionFormValues>({ defaultValues: initialValues });
  const [editing, setEditing] = useState<LandingItem | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const targetAll = Boolean(useWatch({ control: form.control, name: 'targetAll' }));

  const resetForm = () => {
    setEditing(null);
    setUploadFile(null);
    form.reset(initialValues);
  };

  const mutation = useMutation<void, unknown, SectionFormValues | FormData>({
    mutationFn: (payload) =>
      editing
        ? apiPut(`/admin/landing/${config.endpoint}/${editing.id}`, payload)
        : apiPost(`/admin/landing/${config.endpoint}`, payload),
    onSuccess: () => {
      toast.success(`${config.title} berhasil disimpan`);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['admin-landing'] });
    },
    onError: () => toast.error('Gagal menyimpan data'),
  });

  const deleteMutation = useMutation<void, unknown, string>({
    mutationFn: (id: string) => apiDelete(`/admin/landing/${config.endpoint}/${id}`),
    onSuccess: (_data, id) => {
      toast.success('Data terhapus');
      if (editing && editing.id === id) {
        resetForm();
      }
      queryClient.invalidateQueries({ queryKey: ['admin-landing'] });
    },
    onError: () => toast.error('Gagal menghapus data'),
  });

  const buildPayload = (values: SectionFormValues): SectionFormValues | FormData => {
    if (!config.uploadField) {
      return values;
    }
    const formData = new FormData();
    Object.entries(values).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      if (Array.isArray(value)) {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, typeof value === 'number' ? String(value) : String(value));
      }
    });
    if (uploadFile) {
      formData.append(config.uploadField.name, uploadFile);
    }
    return formData;
  };

  const onSubmit = form.handleSubmit((values) => mutation.mutate(buildPayload(values)));

  const handleUploadChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setUploadFile(file);
  };

  const currentPreviewKey = config.uploadField?.previewKey;
  const currentPreview = currentPreviewKey && editing ? (editing[currentPreviewKey] as string | null | undefined) : null;

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{config.title}</h3>
            <p className="mt-1 text-sm text-slate-500">Kelola data untuk {config.title.toLowerCase()}.</p>
          </div>
          {editing && (
            <Button variant="ghost" size="sm" onClick={resetForm}>
              Batal edit
            </Button>
          )}
        </div>

        <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
          {config.fields.map((field) => {
            const fieldName = field.name as keyof SectionFormValues;
            const isTextarea = field.type === 'textarea';
            const isPackages = field.type === 'packages';
            const isBoolean = field.type === 'boolean';
            const disablePackages = isPackages && targetAll;
            return (
              <div key={field.name} className={isTextarea || isPackages ? 'md:col-span-2' : ''}>
                <p className="admin-field-label">{field.label}</p>
                {isTextarea ? (
                  <Textarea className="mt-1" placeholder={field.placeholder} {...form.register(fieldName)} />
                ) : isPackages ? (
                  <PackageSelector
                    fieldName={fieldName}
                    disable={disablePackages}
                    packageOptions={packageOptions}
                    form={form}
                    helpText='Nonaktifkan "Kirim ke semua member" untuk memilih paket.'
                  />
                ) : isBoolean ? (
                  <label className="admin-check-row mt-1">
                    <input type="checkbox" {...form.register(fieldName)} />
                    Aktifkan
                  </label>
                ) : (
                  <Input
                    className="mt-1"
                    type={field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'}
                    placeholder={field.placeholder}
                    {...form.register(fieldName, field.type === 'number' ? { valueAsNumber: true } : undefined)}
                  />
                )}
              </div>
            );
          })}
          {config.uploadField && (
            <div className="md:col-span-2 space-y-2">
              <p className="admin-field-label">{config.uploadField.label}</p>
              {currentPreview && (
                <img src={getAssetUrl(currentPreview)} alt="Preview" className="h-32 w-full rounded-2xl object-cover" />
              )}
              <Input type="file" accept={config.uploadField.accept ?? 'image/*'} onChange={handleUploadChange} />
              <p className="text-[11px] text-slate-500">{config.uploadField.helper ?? 'Format JPG/PNG/WEBP diperbolehkan.'}</p>
            </div>
          )}
          <div className="md:col-span-2">
            <Button type="submit" disabled={mutation.isPending} className="w-full md:w-auto">
              {mutation.isPending ? 'Menyimpan...' : editing ? 'Perbarui Data' : 'Tambah Data'}
            </Button>
          </div>
        </form>

        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="admin-list-item">
              <p className="font-semibold text-slate-900">{item[config.primaryField]}</p>
              {config.secondaryField && item[config.secondaryField] && (
                <p className="text-sm text-slate-500">{item[config.secondaryField]}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(item);
                    form.reset(mapItemToValues(item));
                    setUploadFile(null);
                  }}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteMutation.mutate(item.id)}
                  disabled={deleteMutation.isPending}
                >
                  Hapus
                </Button>
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-slate-500">Belum ada data.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
