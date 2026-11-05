import { api, apiDelete, apiGet, apiPost, apiPostForm, apiPut } from '@/lib/api';
import type {
  BankQuestionsResult,
  BankSource,
  DashboardStats,
  EditorQuestion,
  JoinInfo,
  LivePhase,
  PlayerDetail,
  QuizDetail,
  QuizListItem,
  QuizSettings,
  ReportData,
  SessionListItem,
  SessionMeta,
} from './types';

const base = '/admin/live-quiz';

export type QuizPayload = {
  title: string;
  description?: string | null;
  subject?: string | null;
  category?: string | null;
  settings?: Partial<QuizSettings>;
  questions: Array<Omit<EditorQuestion, 'key'>>;
};

export const liveQuizApi = {
  dashboard: () => apiGet<DashboardStats>(`${base}/dashboard`),
  listQuizzes: (search?: string) => apiGet<QuizListItem[]>(`${base}/quizzes`, { params: search ? { search } : undefined }),
  getQuiz: (id: string) => apiGet<QuizDetail>(`${base}/quizzes/${id}`),
  createQuiz: (payload: QuizPayload) => apiPost<QuizDetail, QuizPayload>(`${base}/quizzes`, payload),
  updateQuiz: (id: string, payload: QuizPayload) => apiPut<QuizDetail, QuizPayload>(`${base}/quizzes/${id}`, payload),
  duplicateQuiz: (id: string) => apiPost<QuizDetail>(`${base}/quizzes/${id}/duplicate`),
  deleteQuiz: (id: string) => apiDelete(`${base}/quizzes/${id}`),
  uploadImage: async (file: File) => {
    const form = new FormData();
    form.append('image', file);
    return apiPostForm<{ url: string }>(`${base}/images`, form);
  },
  bankSources: (type: 'TRYOUT' | 'PRACTICE', search?: string) =>
    apiGet<BankSource[]>(`${base}/bank/sources`, { params: { type, ...(search ? { search } : {}) } }),
  bankQuestions: (type: 'TRYOUT' | 'PRACTICE', id: string) =>
    apiGet<BankQuestionsResult>(`${base}/bank/sources/${type}/${id}/questions`),
  createSession: (quizId: string, settings?: Partial<QuizSettings>) =>
    apiPost<
      { id: string; pin: string; status: LivePhase; title: string; totalQuestions: number; join: JoinInfo },
      { quizId: string; settings?: Partial<QuizSettings> }
    >(`${base}/sessions`, { quizId, ...(settings ? { settings } : {}) }),
  listSessions: (params: { status?: string; page?: number; pageSize?: number }) =>
    apiGet<{ total: number; page: number; pageSize: number; items: SessionListItem[] }>(`${base}/sessions`, { params }),
  sessionMeta: (id: string) => apiGet<SessionMeta>(`${base}/sessions/${id}`),
  report: (id: string) => apiGet<ReportData>(`${base}/sessions/${id}/report`),
  playerDetail: (sessionId: string, playerId: string) =>
    apiGet<PlayerDetail>(`${base}/sessions/${sessionId}/players/${playerId}`),
  downloadCsv: async (id: string) => {
    const response = await api.get(`${base}/sessions/${id}/export.csv`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data as Blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `live-quiz-${id}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
  getSettings: () => apiGet<{ settings: QuizSettings; defaults: QuizSettings }>(`${base}/settings`),
  saveSettings: (settings: Partial<QuizSettings>) =>
    apiPut<{ settings: QuizSettings; defaults: QuizSettings }, { settings: Partial<QuizSettings> }>(`${base}/settings`, {
      settings,
    }),
};
