import { useNavigate } from 'react-router-dom';

const discoverLinks = [
  { label: 'Trouver une expérience', path: '/recherche' },
  { label: 'Se connecter / s\u2019inscrire', path: '/connexion' },
  { label: 'Pourquoi devenir Kooker ?', path: '/avantages' },
];

const helpLinks = [
  { label: 'FAQ', path: '/faq' },
  { label: 'Confiance & sécurité', path: '/confiance' },
  { label: 'Charte du Kooker', path: '#' },
];

const weekookLinks = [
  { label: 'A propos', path: '/a-propos' },
  { label: 'Nous contacter', path: '/contact' },
];

const legalLinks = [
  { label: 'Mentions légales', path: '#' },
  { label: 'CGU', path: '#' },
  { label: 'Politique de confidentialité', path: '#' },
  { label: 'Politique de cookies', path: '#' },
];

function FooterColumn({
  title,
  links,
  onNavigate,
}: {
  title: string;
  links: { label: string; path: string }[];
  onNavigate: (path: string) => void;
}) {
  return (
    <div className="flex flex-col gap-[24px]">
      <p className="font-semibold text-[16px] text-[#303044] tracking-[2.56px] uppercase leading-[1.5]">
        {title}
      </p>
      <div className="flex flex-col gap-[8px]">
        {links.map((link) => (
          <button
            key={link.label}
            onClick={() => onNavigate(link.path)}
            className="font-bold text-[12px] text-[#828294] leading-[1.5] tracking-[-0.24px] hover:text-[#c1a0fd] transition-colors text-left cursor-pointer"
          >
            {link.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Footer() {
  const navigate = useNavigate();

  const handleNavigate = (path: string) => {
    if (path === '#') return;
    navigate(path);
  };

  return (
    <footer className="bg-white border-t border-[#ece2fe]" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Main Footer Content */}
      <div className="px-4 md:px-12 lg:px-[96px] py-[48px]">
        <div className="flex flex-col md:flex-row items-start justify-between gap-[40px]">
          {/* Link Columns */}
          <div className="flex flex-col md:flex-row gap-[24px] md:gap-[72px]">
            <FooterColumn title="Découvrir" links={discoverLinks} onNavigate={handleNavigate} />
            <FooterColumn title="Aide &amp; Confiance" links={helpLinks} onNavigate={handleNavigate} />
            <FooterColumn title="Weekook" links={weekookLinks} onNavigate={handleNavigate} />
          </div>

          {/* Newsletter */}
          <div className="bg-[#f8f9fb] rounded-[16px] px-[24px] py-[32px] w-full md:w-auto">
            <p className="font-bold text-[18px] text-[#303044] tracking-[-0.54px] leading-[1.5] mb-[24px]">
              Recevoir notre Newsletter
            </p>
            <div className="bg-[#f3ecff] flex items-center h-[40px] rounded-[8px] w-full md:max-w-[500px] lg:max-w-[550px]">
              <input
                type="email"
                placeholder="Entrer votre adresse email"
                className="flex-1 bg-transparent pl-[16px] font-bold text-[12px] text-[#828294] leading-[1.5] tracking-[-0.24px] outline-none placeholder:text-[#828294] placeholder:opacity-80"
              />
              <button className="bg-[#c1a0fd] h-full px-[16px] rounded-tr-[8px] rounded-br-[8px] font-bold text-[14px] text-[#111125] tracking-[-0.28px] hover:bg-[#b090ed] transition-colors cursor-pointer flex items-center gap-[8px] shrink-0">
                OK
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Separator Line */}
      <div className="mx-4 md:mx-12 lg:mx-[96px] border-t border-[#ece2fe]" />

      {/* Bottom Bar */}
      <div className="px-4 md:px-12 lg:px-[96px] py-[24px]">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo */}
          <button
            onClick={() => navigate('/')}
            className="font-bold text-[37px] text-[#c1a0fd] tracking-[-0.74px] leading-[1.2] cursor-pointer shrink-0"
          >
            WEEKOOK
          </button>

          {/* Copyright + liens légaux */}
          <div className="flex flex-col items-center gap-1">
            <p className="font-bold text-[12px] text-[#828294] leading-[1.5] tracking-[-0.24px] text-center">
              &copy; 2026 Weekook
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              {legalLinks.map((link, i) => (
                <span key={link.label} className="flex items-center gap-2">
                  {i > 0 && <span className="text-[12px] text-[#828294]">·</span>}
                  <button
                    onClick={() => handleNavigate(link.path)}
                    className="font-bold text-[12px] text-[#828294] leading-[1.5] tracking-[-0.24px] hover:text-[#c1a0fd] transition-colors cursor-pointer"
                  >
                    {link.label}
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Social Icons */}
          <div className="flex items-center gap-[16px]">
            {/* Instagram */}
            <a href="#" className="w-[28px] h-[28px] cursor-pointer hover:opacity-80 transition-opacity" aria-label="Instagram">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M8.75 2.625H19.25C22.6307 2.625 25.375 5.36929 25.375 8.75V19.25C25.375 22.6307 22.6307 25.375 19.25 25.375H8.75C5.36929 25.375 2.625 22.6307 2.625 19.25V8.75C2.625 5.36929 5.36929 2.625 8.75 2.625ZM14 19.25C16.8995 19.25 19.25 16.8995 19.25 14C19.25 11.1005 16.8995 8.75 14 8.75C11.1005 8.75 8.75 11.1005 8.75 14C8.75 16.8995 11.1005 19.25 14 19.25ZM20.5625 8.3125C21.3564 8.3125 22 7.66893 22 6.875C22 6.08107 21.3564 5.4375 20.5625 5.4375C19.7686 5.4375 19.125 6.08107 19.125 6.875C19.125 7.66893 19.7686 8.3125 20.5625 8.3125Z" fill="#C1A0FD"/>
              </svg>
            </a>
            {/* TikTok */}
            <a href="#" className="w-[28px] h-[28px] cursor-pointer hover:opacity-80 transition-opacity" aria-label="TikTok">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48Z" fill="#C1A0FD"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
