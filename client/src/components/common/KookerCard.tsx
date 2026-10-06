import { useNavigate } from 'react-router-dom';

interface KookerCardProps {
  id: number;
  name: string;
  imageUrl: string;
  city: string;
  specialties: string[];
  price: number;
  avatarUrl?: string;
  types?: string[];
  onClick?: () => void;
}

export default function KookerCard({
  id,
  name,
  imageUrl,
  city,
  specialties,
  price,
  avatarUrl,
  types,
  onClick,
}: KookerCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/kooker/${id}`);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="group cursor-pointer w-full max-w-[320px] sm:max-w-[286px] h-[429px] bg-[#f8f9fc] rounded-[20px] overflow-hidden flex flex-col transition-transform duration-300 hover:scale-[1.02]"
    >
      {/* Image Area */}
      <div className="relative w-full h-[240px] p-[10px]">
        <div className="w-full h-full rounded-[24px] overflow-hidden bg-[#f3ecff]">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M36 72C55.8823 72 72 55.8823 72 36C72 16.1177 55.8823 0 36 0C16.1177 0 0 16.1177 0 36C0 55.8823 16.1177 72 36 72Z" fill="rgba(218, 198, 254, 1)"/>
              </svg>
            </div>
          )}
        </div>

        {/* Type badges */}
        {types && types.length > 0 && (
          <div className="absolute top-[18px] right-[18px] flex flex-col gap-1">
            {types.includes('COURS') && (
              <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-bold bg-[#c1a0fd] text-white shadow-sm">COURS</span>
            )}
            {types.includes('KOOK') && (
              <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-bold bg-[#7c5cbf] text-white shadow-sm">KOOK</span>
            )}
          </div>
        )}

        {/* Avatar overlay */}
        <div className="absolute bottom-[-20px] left-[26px] w-[60px] h-[60px] rounded-full bg-white flex items-center justify-center">
          <div className="w-[50px] h-[50px] rounded-full bg-[#ece2fe] overflow-hidden flex items-center justify-center">
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
            ) : (
              <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M25 26.25V23.75C25 22.4239 24.4732 21.1521 23.5355 20.2145C22.5979 19.2768 21.3261 18.75 20 18.75H10C8.67392 18.75 7.40215 19.2768 6.46447 20.2145C5.52678 21.1521 5 22.4239 5 23.75V26.25" stroke="#303044" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M15 13.75C17.7614 13.75 20 11.5114 20 8.75C20 5.98858 17.7614 3.75 15 3.75C12.2386 3.75 10 5.98858 10 8.75C10 11.5114 12.2386 13.75 15 13.75Z" stroke="#303044" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex flex-col flex-1 px-[23px] pt-[16px] pb-[12px]">
        {/* Name */}
        <p className="font-semibold text-[20px] text-black leading-[1.2] tracking-[-0.4px] truncate">
          {name}
        </p>

        {/* City */}
        <p className="text-[12px] text-[#828294] leading-[1.5] tracking-[-0.24px] mt-[4px]">
          {city}
        </p>

        {/* Specialty Badges */}
        <div className="flex flex-wrap gap-[8px] mt-[8px]">
          {specialties.slice(0, 2).map((spec, index) => (
            <span
              key={index}
              className="inline-flex items-center px-[12px] py-[4px] rounded-[12px] bg-[rgba(218,198,254,0.48)] text-[12px] text-violet-600 leading-[1.5] tracking-[-0.24px]"
            >
              {spec}
            </span>
          ))}
        </div>

        {/* Price + CTA */}
        <div className="mt-auto flex items-center justify-between">
          <div className="flex items-center gap-[8px]">
            <span className="text-[14px] text-black leading-[1.5] tracking-[-0.28px]">
              À partir de {price}&euro;
            </span>
          </div>
          <span className="text-[16px] font-medium text-black underline decoration-solid hover:text-[#c1a0fd] transition-colors tracking-[-0.32px]">
            Voir le profil
          </span>
        </div>
      </div>
    </div>
  );
}
