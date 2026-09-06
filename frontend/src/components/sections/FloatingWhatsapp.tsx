import { useContactConfig } from '@/hooks/useContactConfig';

export function FloatingWhatsapp() {
  const { data: contact } = useContactConfig();
  const whatsappNumber = contact?.whatsappConsult ?? contact?.whatsappPrimary ?? '6281234567890';
  const whatsappLink = (contact?.whatsappConsult || contact?.whatsappPrimary)
    ? `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}`
    : import.meta.env.VITE_WHATSAPP_LINK || 'https://wa.me/6281234567890';

  return (
    <a
      href={whatsappLink}
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-2xl shadow-emerald-500/40 transition-transform hover:scale-105"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 32 32"
        className="h-7 w-7"
        fill="currentColor"
        aria-hidden
      >
        <path d="M16.04 5c-5.5 0-9.96 4.46-9.96 9.97 0 1.84.51 3.63 1.47 5.2L5 27l6.98-2.17c1.5.82 3.19 1.25 4.94 1.25 5.5 0 9.98-4.47 9.98-9.98C26.9 9.46 21.53 5 16.04 5zm5.74 14.3c-.24.68-1.38 1.31-1.9 1.34-.53.03-1.02.33-3.46-.71-2.93-1.28-4.8-4.4-4.95-4.6-.14-.2-1.17-1.55-1.17-2.95 0-1.4.74-2.08 1-2.36.27-.29.59-.36.78-.36h.56c.18 0 .42-.03.64.48.24.58.81 1.99.88 2.13.07.14.12.3.02.48-.1.19-.15.3-.3.46-.15.17-.31.37-.45.5-.15.14-.3.29-.13.58.17.29.75 1.24 1.61 2 1.11.98 2.04 1.28 2.33 1.43.3.14.48.12.65-.07.16-.18.74-.86.94-1.15.2-.29.4-.24.67-.15.27.1 1.73.81 2.03.96.3.15.5.22.58.34.08.12.08.69-.16 1.37z" />
      </svg>
    </a>
  );
}
