import { Link } from 'react-router-dom';
import { publicNavLinks } from '@/constants/navigation';
import { BrandMark } from '@/components/common/BrandMark';
import { useContactConfig } from '@/hooks/useContactConfig';

export function Footer() {
  const { data: contact } = useContactConfig();
  const whatsappNumber = contact?.whatsappPrimary ?? '6281234567890';
  const formattedWhatsApp = whatsappNumber.startsWith('+') ? whatsappNumber : `+${whatsappNumber}`;
  const whatsappHref = `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}`;

  const companyAddress = contact?.companyAddress ?? 'Alamat belum diatur';

  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-4">
        <div>
          <BrandMark size="lg" tagline="Bimbingan belajar terintegrasi untuk persiapan POLRI dan TNI." framed />
          <p className="mt-4 text-sm leading-relaxed text-slate-500">
            Pendekatan data-driven untuk membantu casis fokus, terukur, dan siap menghadapi seleksi.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Menu</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {publicNavLinks.slice(0, 4).map((link) => (
              <li key={link.href}>
                <Link to={link.href} className="transition hover:text-brand-600">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Bantuan</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>
              <a href={`mailto:${contact?.email ?? 'hallo@tacticaleducation.id'}`} className="transition hover:text-brand-600">
                {contact?.email ?? 'hallo@tacticaleducation.id'}
              </a>
            </li>
            <li>
              <a href={whatsappHref} target="_blank" className="transition hover:text-brand-600" rel="noreferrer">
                {formattedWhatsApp} (WhatsApp)
              </a>
            </li>
            <li>{companyAddress}</li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Tetap Terhubung</h4>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Ikuti update tryout terbaru, promo membership, dan kelas intensif langsung dari dashboard.
          </p>
        </div>
      </div>
      <div className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Tactical Education. All rights reserved.
      </div>
    </footer>
  );
}
