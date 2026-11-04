import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { TIME_LIMIT_OPTIONS, type QuizSettings } from '../types';

type Props = {
  value: QuizSettings;
  onChange: (next: QuizSettings) => void;
  /** Sembunyikan opsi yang hanya relevan untuk global (mis. maxPlayers) bila perlu. */
  compact?: boolean;
};

const selectClass =
  'h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500';

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
    <label className="admin-check-row cursor-pointer items-start">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="min-w-0">
        <span className="block">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs font-normal text-slate-500">{hint}</span> : null}
      </span>
    </label>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="admin-field-label">{label}</span>
      {children}
    </div>
  );
}

export function SettingsForm({ value, onChange, compact }: Props) {
  const set = <K extends keyof QuizSettings>(key: K, next: QuizSettings[K]) => onChange({ ...value, [key]: next });
  const num = (key: keyof QuizSettings, min: number, max: number) => (
    <Input
      type="number"
      min={min}
      max={max}
      value={value[key] as number}
      onChange={(event) => {
        const parsed = Number(event.target.value);
        if (Number.isFinite(parsed)) set(key, Math.min(max, Math.max(min, Math.round(parsed))) as never);
      }}
    />
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Durasi default per soal">
          <select
            className={selectClass}
            value={value.timeLimitSec}
            onChange={(event) => set('timeLimitSec', Number(event.target.value))}
          >
            {TIME_LIMIT_OPTIONS.map((seconds) => (
              <option key={seconds} value={seconds}>
                {seconds} detik
              </option>
            ))}
          </select>
        </Field>
        <Field label="Mode skor">
          <select
            className={selectClass}
            value={value.scoreMode}
            onChange={(event) => set('scoreMode', event.target.value as QuizSettings['scoreMode'])}
          >
            <option value="SPEED">Kecepatan + ketepatan</option>
            <option value="ACCURACY">Ketepatan saja</option>
          </select>
        </Field>
        <Field label="Lanjut ke soal berikutnya">
          <select
            className={selectClass}
            value={value.advanceMode}
            onChange={(event) => set('advanceMode', event.target.value as QuizSettings['advanceMode'])}
          >
            <option value="MANUAL">Manual (tutor menekan Next)</option>
            <option value="AUTO">Otomatis setelah leaderboard</option>
          </select>
        </Field>
        <Field label="Poin maksimal per soal">{num('maxPoints', 100, 10000)}</Field>
        <Field label="Jumlah baris leaderboard">{num('leaderboardSize', 3, 10)}</Field>
        {!compact && <Field label="Maksimal peserta">{num('maxPlayers', 1, 500)}</Field>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Hitung mundur (dtk)">{num('countdownSec', 1, 10)}</Field>
        <Field label="Tampil jawaban benar (dtk)">{num('resultDurationSec', 1, 30)}</Field>
        <Field label="Tampil poin (dtk)">{num('scoreDurationSec', 1, 30)}</Field>
        <Field label="Leaderboard otomatis (dtk)">{num('leaderboardDurationSec', 1, 60)}</Field>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
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

      <div>
        <span className="admin-field-label">Avatar &amp; reaksi emoji</span>
        <div className="grid gap-2 sm:grid-cols-2">
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
      </div>
    </div>
  );
}
