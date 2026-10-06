import { useNavigate } from 'react-router-dom';

const discoverLinks = [
  { label: 'Notre histoire', path: '/a-propos' },
  { label: 'Les avantages Weekook', path: '/avantages' },
  { label: 'Garantie et Confiance', path: '/confiance' },
  { label: 'Tarification', path: '/tarification' },
];

const helpLinks = [
  { label: 'FAQ', path: '/faq' },
  { label: 'Contact', path: '/contact' },
  { label: 'CGU', path: '#' },
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

          {/* Copyright */}
          <p className="font-bold text-[12px] text-[#828294] leading-[1.5] tracking-[-0.24px] text-center">
            &copy; 2026 Weekook, Tous droits réservés.
          </p>

          {/* Social Icons */}
          <div className="flex items-center gap-[16px]">
            {/* Facebook */}
            <a href="#" className="w-[28px] h-[28px] cursor-pointer hover:opacity-80 transition-opacity" aria-label="Facebook">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 2H17.5C15.8424 2 14.2527 2.65848 13.0806 3.83058C11.9085 5.00269 11.25 6.59239 11.25 8.25V11.75H7.75V16.25H11.25V25.25H15.75V16.25H19.25L21 11.75H15.75V8.25C15.75 7.91848 15.8817 7.60054 16.1161 7.36612C16.3505 7.1317 16.6685 7 17 7H21V2Z" fill="#C1A0FD"/>
              </svg>
            </a>
            {/* Instagram */}
            <a href="#" className="w-[28px] h-[28px] cursor-pointer hover:opacity-80 transition-opacity" aria-label="Instagram">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M8.75 2.625H19.25C22.6307 2.625 25.375 5.36929 25.375 8.75V19.25C25.375 22.6307 22.6307 25.375 19.25 25.375H8.75C5.36929 25.375 2.625 22.6307 2.625 19.25V8.75C2.625 5.36929 5.36929 2.625 8.75 2.625ZM14 19.25C16.8995 19.25 19.25 16.8995 19.25 14C19.25 11.1005 16.8995 8.75 14 8.75C11.1005 8.75 8.75 11.1005 8.75 14C8.75 16.8995 11.1005 19.25 14 19.25ZM20.5625 8.3125C21.3564 8.3125 22 7.66893 22 6.875C22 6.08107 21.3564 5.4375 20.5625 5.4375C19.7686 5.4375 19.125 6.08107 19.125 6.875C19.125 7.66893 19.7686 8.3125 20.5625 8.3125Z" fill="#C1A0FD"/>
              </svg>
            </a>
            {/* X / Twitter */}
            <a href="#" className="w-[28px] h-[28px] cursor-pointer hover:opacity-80 transition-opacity" aria-label="X (Twitter)">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21.285 2.625H25.144L16.713 12.262L26.631 25.375H18.865L12.781 17.421L5.822 25.375H1.96L10.974 15.068L1.463 2.625H9.427L14.925 9.895L21.285 2.625ZM19.928 23.065H22.067L8.264 4.814H5.97L19.928 23.065Z" fill="#C1A0FD"/>
              </svg>
            </a>
            {/* LinkedIn */}
            <a href="#" className="w-[28px] h-[28px] cursor-pointer hover:opacity-80 transition-opacity" aria-label="LinkedIn">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M4.375 2.625C3.40851 2.625 2.625 3.40851 2.625 4.375C2.625 5.34149 3.40851 6.125 4.375 6.125C5.34149 6.125 6.125 5.34149 6.125 4.375C6.125 3.40851 5.34149 2.625 4.375 2.625ZM2.625 9.625H6.125V25.375H2.625V9.625ZM18.375 9.625C16.4587 9.625 14.6209 10.3862 13.2661 11.7411C11.9112 13.0959 11.25 14.9337 11.25 16.85V25.375H14.75V16.85C14.75 15.8835 15.1339 14.9564 15.8201 14.2701C16.5064 13.5839 17.4335 13.2 18.4 13.2C19.3665 13.2 20.2936 13.5839 20.9799 14.2701C21.6661 14.9564 22.05 15.8835 22.05 16.85V25.375H25.55V16.85C25.55 14.9337 24.7888 13.0959 23.4339 11.7411C22.0791 10.3862 20.2413 9.625 18.375 9.625Z" fill="#C1A0FD"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
