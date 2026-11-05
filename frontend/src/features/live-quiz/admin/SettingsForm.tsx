import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { TIME_LIMIT_OPTIONS, type QuizSettings } from '../types';

type Props = {
  value: QuizSettings;
  onChange: (next: QuizSettings) => void;
  /** Sembunyikan opsi yang hanya relevan untuk global (mis. maxPlayers) bila perlu. */
  compact?: boolean;
};

const controlClass =
  'h-12 w-full max-w-full rounded-xl border border-slate-200 bg-white px-3 text-[16px] text-[#17243D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:text-[15px]';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-[13px] font-semibold leading-snug text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | number;
  options: Array<{ value: string | number; label: string }>;
  onChange: (value: string) => void;
}) {
  const current = options.find((option) => String(option.value) === String(value));
  return (
    <Field label={label}>
      <select className={controlClass} value={value} title={current?.label} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex h-full cursor-pointer items-start gap-3 rounded-[14px] border border-slate-200 bg-white p-3.5 transition hover:border-brand-200 focus-within:ring-2 focus-within:ring-brand-500">
      <input
        type="checkbox"
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="min-w-0">
        <span className="block text-[15px] font-medium leading-snug text-[#17243D]">{label}</span>
        {hint ? <span className="mt-1 block text-[13px] font-normal leading-snug text-slate-500">{hint}</span> : null}
      </span>
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
      <h3 className="text-[15px] font-semibold text-[#17243D] sm:text-base">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function SettingsForm({ value, onChange, compact }: Props) {
  const set = <K extends keyof QuizSettings>(key: K, next: QuizSettings[K]) => onChange({ ...value, [key]: next });
  const num = (key: keyof QuizSettings, min: number, max: number) => (
    <Input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      className="h-12 rounded-xl border-slate-200 text-[16px] sm:text-[15px]"
      value={value[key] as number}
      onChange={(event) => {
        const parsed = Number(event.target.value);
        if (Number.isFinite(parsed)) set(key, Math.min(max, Math.max(min, Math.round(parsed))) as never);
      }}
    />
  );

  return (
    <div className="session-settings space-y-5">
      <Section title="Timer & skor">
        <div className="session-grid-timer">
          <SelectField
            label="Durasi default per soal"
            value={value.timeLimitSec}
            onChange={(next) => set('timeLimitSec', Number(next))}
            options={TIME_LIMIT_OPTIONS.map((seconds) => ({ value: seconds, label: `${seconds} detik` }))}
          />
          <SelectField
            label="Mode skor"
            value={value.scoreMode}
            onChange={(next) => set('scoreMode', next as QuizSettings['scoreMode'])}
            options={[
              { value: 'SPEED', label: 'Kecepatan + ketepatan' },
              { value: 'ACCURACY', label: 'Ketepatan saja' },
            ]}
          />
          <SelectField
            label="Lanjut ke soal berikutnya"
            value={value.advanceMode}
            onChange={(next) => set('advanceMode', next as QuizSettings['advanceMode'])}
            options={[
              { value: 'MANUAL', label: 'Manual (tutor menekan Next)' },
              { value: 'AUTO', label: 'Otomatis setelah leaderboard' },
            ]}
          />
        </div>
        <div className="session-grid-pair mt-4">
          <Field label="Poin maksimal per soal">{num('maxPoints', 100, 10000)}</Field>
          <Field label="Jumlah baris leaderboard">{num('leaderboardSize', 3, 10)}</Field>
        </div>
        <div className="session-grid-times mt-4">
          <Field label="Hitung mundur (dtk)">{num('countdownSec', 1, 10)}</Field>
          <Field label="Tampil jawaban benar (dtk)">{num('resultDurationSec', 1, 30)}</Field>
          <Field label="Tampil poin (dtk)">{num('scoreDurationSec', 1, 30)}</Field>
          <Field label="Leaderboard otomatis (dtk)">{num('leaderboardDurationSec', 1, 60)}</Field>
        </div>
      </Section>

      <Section title="Gameplay">
        <div className="session-grid-checks">
          <Toggle label="Acak urutan soal" checked={value.shuffleQuestions} onChange={(v) => set('shuffleQuestions', v)} />
          <Toggle label="Acak urutan pilihan" checked={value.shuffleOptions} onChange={(v) => set('shuffleOptions', v)} />
          <Toggle
            label="Tampilkan jawaban benar setelah soal"
            checked={value.showCorrectAnswer}
            onChange={(v) => set('showCorrectAnswer', v)}
          />
          <Toggle
            label="Tampilkan grafik hasil soal"
            checked={value.showQuestionResult}
            onChange={(v) => set('showQuestionResult', v)}
          />
          <Toggle label="Tampilkan leaderboard" checked={value.showLeaderboard} onChange={(v) => set('showLeaderboard', v)} />
          <Toggle
            label="Tutup soal otomatis bila semua sudah menjawab"
            checked={value.autoCloseWhenAllAnswered}
            onChange={(v) => set('autoCloseWhenAllAnswered', v)}
          />
          <Toggle label="Aktifkan animasi" checked={value.animationsEnabled} onChange={(v) => set('animationsEnabled', v)} />
          <Toggle label="Aktifkan suara" checked={value.soundEnabled} onChange={(v) => set('soundEnabled', v)} />
          <Toggle
            label="Kunci lobby saat permainan dimulai"
            checked={value.lockLobbyOnStart}
            onChange={(v) => set('lockLobbyOnStart', v)}
          />
          <Toggle
            label="Izinkan bergabung setelah mulai"
            hint="Peserta terlambat langsung ikut soal yang sedang berjalan, tanpa poin soal yang terlewat."
            checked={value.allowLateJoin}
            onChange={(v) => set('allowLateJoin', v)}
          />
          <Toggle
            label="Tampilkan teks soal di HP peserta"
            checked={value.showQuestionOnPlayer}
            onChange={(v) => set('showQuestionOnPlayer', v)}
          />
          <Toggle
            label="Mode proyektor (HP hanya menampilkan tombol pilihan)"
            hint="Soal hanya terlihat di layar tutor."
            checked={value.projectorMode}
            onChange={(v) => set('projectorMode', v)}
          />
        </div>
      </Section>

      <Section title="Avatar & emoji">
        <div className="session-grid-checks">
          <Toggle
            label="Izinkan peserta mengganti avatar di lobby"
            hint="Peserta hanya bisa mengganti avatarnya sendiri, dan hanya sebelum permainan dimulai."
            checked={value.allowAvatarChange}
            onChange={(v) => set('allowAvatarChange', v)}
          />
          <Toggle
            label="Aktifkan reaksi emoji"
            hint="Peserta bisa mengirim 🔥 ❤️ 😂 👏 🎉 😮 😎 🚀. Tutor bisa mematikannya kapan saja saat sesi."
            checked={value.reactionsEnabled}
            onChange={(v) => set('reactionsEnabled', v)}
          />
          <Toggle
            label="Izinkan reaksi setelah peserta menjawab"
            hint="Saat soal aktif, reaksi hanya terbuka bagi peserta yang sudah mengirim jawaban."
            checked={value.reactionsAfterSubmit}
            onChange={(v) => set('reactionsAfterSubmit', v)}
          />
          <Toggle
            label="Tampilkan reaksi di layar proyektor"
            hint="Reaksi muncul di tepi layar tutor, tidak menutupi soal atau jawaban."
            checked={value.reactionsOnProjector}
            onChange={(v) => set('reactionsOnProjector', v)}
          />
        </div>
      </Section>

      {!compact && (
        <Section title="Pengaturan peserta">
          <div className="max-w-xs">
            <Field label="Maksimal peserta">{num('maxPlayers', 1, 500)}</Field>
          </div>
        </Section>
      )}
    </div>
  );
}
