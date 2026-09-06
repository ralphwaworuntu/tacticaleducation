import { useEffect, type ChangeEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FileSpreadsheet, FileText, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export const formSelectClassName =
  'h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100';

export function slugifyExamSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function useAutoSlug(
  name: string | undefined,
  manuallyEdited: boolean,
  setSlug: (value: string) => void,
) {
  useEffect(() => {
    if (!manuallyEdited && name?.trim()) {
      setSlug(slugifyExamSlug(name));
    }
  }, [name, manuallyEdited, setSlug]);
}

type WorkflowStep = { label: string; detail: string };

export function AdminWorkflowGuide({ title, steps }: { title: string; steps: WorkflowStep[] }) {
  return (
    <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/80 via-white to-slate-50 p-5 shadow-sm">
      <p className="text-sm font-semibold text-brand-900">{title}</p>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.label}
            className="flex gap-2.5 rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-xs text-slate-700 shadow-sm"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
              {index + 1}
            </span>
            <span>
              <strong className="text-slate-900">{step.label}</strong>
              <span className="text-slate-500"> — {step.detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

type AdminPanelProps = {
  step: number;
  title: string;
  description?: string;
  meta?: string;
  isEditing?: boolean;
  editTitle?: string;
  onCancelEdit?: () => void;
  children: ReactNode;
};

export function AdminPanel({
  step,
  title,
  description,
  meta,
  isEditing,
  editTitle,
  onCancelEdit,
  children,
}: AdminPanelProps) {
  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white shadow-sm">
              {step}
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">Langkah {step}</p>
              <h3 className="text-xl font-semibold text-slate-900">{isEditing && editTitle ? editTitle : title}</h3>
              {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
              {meta && <p className="mt-1 text-xs font-medium text-slate-400">{meta}</p>}
            </div>
          </div>
          {isEditing && onCancelEdit && (
            <Button variant="ghost" size="sm" onClick={onCancelEdit}>
              Batalkan Edit
            </Button>
          )}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function FormSection({ step, title, description, children }: { step: number; title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 md:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-white">
          {step}
        </span>
        <div>
          <h4 className="font-semibold text-slate-900">{title}</h4>
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function FormField({
  label,
  htmlFor,
  required,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

type NameSlugFieldsProps = {
  nameLabel?: string;
  slugLabel?: string;
  namePlaceholder?: string;
  slugPlaceholder?: string;
  nameRegister: object;
  slugValue: string;
  onSlugChange: (value: string) => void;
  onSlugManualEdit: () => void;
};

export function NameSlugFields({
  nameLabel = 'Nama',
  slugLabel = 'Slug URL',
  namePlaceholder = 'Nama tampilan',
  slugPlaceholder = 'slug-url',
  nameRegister,
  slugValue,
  onSlugChange,
  onSlugManualEdit,
}: NameSlugFieldsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FormField label={nameLabel} required hint="Nama yang tampil di dashboard.">
        <Input placeholder={namePlaceholder} {...nameRegister} />
      </FormField>
      <FormField label={slugLabel} required hint="Otomatis dari nama. Huruf kecil & strip.">
        <Input
          placeholder={slugPlaceholder}
          value={slugValue}
          onChange={(event) => {
            onSlugManualEdit();
            onSlugChange(event.target.value);
          }}
        />
      </FormField>
    </div>
  );
}

export function ImageUploadField({
  label,
  hint,
  fileName,
  onChange,
}: {
  label?: string;
  hint?: string;
  fileName?: string | null;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <FormField label={label ?? 'Gambar (opsional)'} hint={hint ?? 'JPG, PNG, atau WEBP.'}>
      <Input type="file" accept="image/*" onChange={onChange} />
      {fileName && <p className="mt-1 text-xs text-emerald-700">File dipilih: {fileName}</p>}
    </FormField>
  );
}

export function CategoryPathPreview({ segments }: { segments: string[] }) {
  const path = segments.filter(Boolean);
  if (!path.length) return null;

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/60 px-3 py-2 text-xs text-brand-900">
      <span className="font-semibold">Lokasi: </span>
      {path.join(' → ')}
    </div>
  );
}

type EntityCardProps = {
  title: string;
  imageUrl?: string | null;
  lines: string[];
  onEdit: () => void;
  onDelete: () => void;
  deletePending?: boolean;
};

export function EntityCard({ title, imageUrl, lines, onEdit, onDelete, deletePending }: EntityCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-200">
      {imageUrl && (
        <img src={imageUrl} alt={title} className="mb-3 h-24 w-full rounded-xl object-cover" loading="lazy" />
      )}
      <p className="font-semibold text-slate-900">{title}</p>
      {lines.map((line) => (
        <p key={line} className="text-xs text-slate-500">
          {line}
        </p>
      ))}
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" onClick={onEdit}>
          Edit
        </Button>
        <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={onDelete} disabled={deletePending}>
          Hapus
        </Button>
      </div>
    </div>
  );
}

export function EntityListEmpty({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

export function CsvQuestionUpload({
  isEditing,
  questionsFile,
  onFileChange,
  templateHref,
  templateLabel,
  inputId,
}: {
  isEditing: boolean;
  questionsFile: File | null;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  templateHref: string;
  templateLabel: string;
  inputId: string;
}) {
  return (
    <div className="space-y-3">
      <label
        htmlFor={inputId}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white px-4 py-8 text-center transition hover:border-brand-400 hover:bg-brand-50/30"
      >
        <Upload className="h-8 w-8 text-brand-600" />
        <span className="text-sm font-semibold text-slate-800">
          {questionsFile ? questionsFile.name : 'Klik untuk pilih file CSV soal'}
        </span>
        <span className="text-xs text-slate-500">
          {isEditing ? 'Opsional — kosongkan jika tidak mengganti bank soal' : 'Wajib — hasil konversi Word atau template CSV'}
        </span>
        <Input id={inputId} type="file" accept=".csv,text/csv" className="hidden" onChange={onFileChange} />
      </label>

      {!questionsFile && !isEditing && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">CSV soal wajib diunggah sebelum menyimpan.</p>
      )}

      {questionsFile && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
          File siap: {questionsFile.name} ({Math.max(1, Math.round(questionsFile.size / 1024))} KB)
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button asChild type="button" size="sm" variant="outline">
          <a href={templateHref} download>
            <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
            {templateLabel}
          </a>
        </Button>
        <Button asChild type="button" size="sm" variant="outline">
          <Link to="/admin/word-converter">
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            Konversi Word → CSV
          </Link>
        </Button>
      </div>
    </div>
  );
}
