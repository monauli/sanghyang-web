import { MessageCircle } from 'lucide-react';
import { whatsappNumber } from '@/lib/contact';

const SOCIAL_LINKS = [
  { label: 'Facebook', href: 'https://www.facebook.com/sanghyangindahsparesort/' },
  { label: 'Instagram', href: 'https://www.instagram.com/sanghyangresort/' },
  { label: 'TikTok', href: 'https://www.tiktok.com/@sanghyangsparesort' },
];

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M13.5 21v-8h2.7l.4-3.1h-3.1V8c0-.9.25-1.5 1.55-1.5H16.7V3.7c-.28-.04-1.25-.12-2.36-.12-2.35 0-3.96 1.43-3.96 4.06V10H7.6v3.1h2.78v8h3.12z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M16.6 3c.4 2.3 1.9 3.8 4.4 4v2.9c-1.5 0-2.9-.4-4.1-1.3v6.3c0 3.4-2.8 5.6-5.8 5.6-3 0-5.5-2.2-5.5-5.5 0-3.3 2.6-5.5 5.6-5.5.3 0 .6 0 .9.1v2.9c-.3-.1-.6-.1-.9-.1-1.5 0-2.7 1.1-2.7 2.6 0 1.5 1.2 2.6 2.7 2.6 1.6 0 2.9-1.3 2.9-3.1V3h2.5z" />
    </svg>
  );
}

const ICONS: Record<string, () => React.ReactElement> = {
  Facebook: FacebookIcon,
  Instagram: InstagramIcon,
  TikTok: TikTokIcon,
};

/** Ikon link sosmed + WhatsApp. WhatsApp otomatis dari contact_phone di site_content. */
export function SocialIcons({
  contactPhone,
  vertical = false,
  className = '',
}: {
  contactPhone?: string;
  vertical?: boolean;
  className?: string;
}) {
  const wa = whatsappNumber(contactPhone);

  return (
    <div className={`flex items-center gap-4 ${vertical ? 'flex-col' : ''} ${className}`}>
      {SOCIAL_LINKS.map(({ label, href }) => {
        const Icon = ICONS[label];
        return (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noreferrer"
            aria-label={label}
            className="text-primary-foreground/70 transition-colors hover:text-white"
          >
            <Icon />
          </a>
        );
      })}
      {wa && (
        <a
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noreferrer"
          aria-label="WhatsApp"
          className="text-primary-foreground/70 transition-colors hover:text-white"
        >
          <MessageCircle className="h-5 w-5" />
        </a>
      )}
    </div>
  );
}
