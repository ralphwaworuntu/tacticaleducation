export const formatCurrency = (value: number, locale = 'id-ID') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

export const formatDate = (value?: string | Date, locale = 'id-ID') => {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
};

export const parseNameInitials = (name?: string) => {
  if (!name) return 'TE';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');
};
