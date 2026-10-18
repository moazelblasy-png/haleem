import React from 'react';

interface ClubLogoProps {
  branchId: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

/**
 * Liverpool Gaming - Transparent HD Club & Stadium Crests
 * Completely transparent background, sharp vector/SVG rendering with zero pixelation or ugly boxes.
 * Supports: Liverpool FC, Chelsea FC, and Anfield (replacing Arsenal per user request).
 */
export const ClubLogo: React.FC<ClubLogoProps> = ({ branchId, size = 'md', className = '' }) => {
  const sizeMap = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  };

  const dim = sizeMap[size] || sizeMap.md;
  const normalizedId = branchId.toLowerCase();

  // 1. Liverpool FC Crest (Transparent Vector)
  if (normalizedId.includes('liverpool') || normalizedId === 'liv') {
    return (
      <div className={`relative flex items-center justify-center select-none ${dim} ${className}`}>
        <svg viewBox="0 0 100 120" className="w-full h-full drop-shadow-[0_4px_12px_rgba(220,38,38,0.4)]" fill="none">
          {/* Outer Shield Border */}
          <path
            d="M50 6 C28 6 16 18 16 36 C16 74 50 114 50 114 C50 114 84 74 84 36 C84 18 72 6 50 6 Z"
            fill="#d0001f"
            stroke="#f5a623"
            strokeWidth="3"
          />
          {/* Inner Crest Line */}
          <path
            d="M50 14 C33 14 24 23 24 38 C24 70 50 104 50 104 C50 104 76 70 76 38 C76 23 67 14 50 14 Z"
            fill="#9b0014"
            stroke="#ffffff"
            strokeWidth="1.2"
          />
          {/* Shankly Gates Top Bar (YNWA) */}
          <rect x="26" y="22" width="48" height="11" rx="2" fill="#00a398" stroke="#ffffff" strokeWidth="0.8" />
          <text x="50" y="30" fill="#ffffff" fontSize="6.5" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">
            L.F.C.
          </text>
          {/* Liver Bird Silhouette */}
          <path
            d="M48 42 C44 42 40 45 42 50 C43 53 46 54 45 58 C44 62 40 64 38 68 C39 72 44 76 50 78 C56 76 61 72 62 68 C60 64 56 62 55 58 C54 54 57 53 58 50 C60 45 56 42 52 42 Z"
            fill="#f5a623"
          />
          {/* Twin Eternal Flames */}
          <path d="M12 40 Q 15 32 18 42 Q 15 48 12 40 Z" fill="#f5a623" />
          <path d="M88 40 Q 85 32 82 42 Q 85 48 88 40 Z" fill="#f5a623" />
          {/* Gold banner year */}
          <text x="50" y="94" fill="#f5a623" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
            1892
          </text>
        </svg>
      </div>
    );
  }

  // 2. Chelsea FC Crest (Transparent Vector)
  if (normalizedId.includes('chelsea') || normalizedId === 'che') {
    return (
      <div className={`relative flex items-center justify-center select-none ${dim} ${className}`}>
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_4px_12px_rgba(3,70,148,0.5)]" fill="none">
          {/* Outer Royal Blue Circle */}
          <circle cx="50" cy="50" r="46" fill="#034694" stroke="#ffffff" strokeWidth="3" />
          {/* Inner Ring */}
          <circle cx="50" cy="50" r="38" fill="#ffffff" stroke="#dba111" strokeWidth="2" />
          {/* Inner Blue Shield */}
          <circle cx="50" cy="50" r="26" fill="#034694" />
          {/* Chelsea Rampant Lion Figure */}
          <path
            d="M48 30 C45 30 42 34 44 38 C42 40 38 42 36 46 C34 50 36 56 40 58 C38 62 38 66 42 70 C46 72 52 70 54 66 C56 68 62 68 64 64 C62 60 58 58 56 52 C58 48 56 42 52 38 C54 34 51 30 48 30 Z"
            fill="#dba111"
          />
          {/* Staff in hand */}
          <line x1="56" y1="34" x2="62" y2="68" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
          {/* Circular Text */}
          <path id="chelseaTextPath" d="M 18,50 A 32,32 0 1,1 82,50 A 32,32 0 1,1 18,50" fill="none" />
          <text fill="#034694" fontSize="7" fontWeight="bold" letterSpacing="2">
            <textPath href="#chelseaTextPath" startOffset="50%" textAnchor="middle">
              CHELSEA FC
            </textPath>
          </text>
        </svg>
      </div>
    );
  }

  // 3. Anfield Crest / Stadium Gates (Replacing Arsenal per User Request!)
  return (
    <div className={`relative flex items-center justify-center select-none ${dim} ${className}`}>
      <svg viewBox="0 0 100 110" className="w-full h-full drop-shadow-[0_4px_12px_rgba(220,38,38,0.5)]" fill="none">
        {/* Stadium Gates Arch */}
        <path
          d="M15 45 C15 20 85 20 85 45 L85 96 C85 100 80 104 75 104 L25 104 C20 104 15 100 15 96 Z"
          fill="#161824"
          stroke="#dc2626"
          strokeWidth="3"
        />
        {/* Famous "THIS IS ANFIELD" Plaque */}
        <rect x="22" y="48" width="56" height="36" rx="4" fill="#dc2626" stroke="#ffffff" strokeWidth="2" />
        <rect x="25" y="51" width="50" height="30" rx="2" fill="#ffffff" />
        <rect x="27" y="53" width="46" height="26" rx="1.5" fill="#11131a" />
        
        <text x="50" y="62" fill="#ffffff" fontSize="5.5" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">
          THIS IS
        </text>
        <text x="50" y="73" fill="#dc2626" fontSize="8" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">
          ANFIELD
        </text>

        {/* Shankly Top Crest */}
        <path d="M25 35 C25 24 75 24 75 35 Z" fill="#f5a623" stroke="#ffffff" strokeWidth="1" />
        <text x="50" y="32" fill="#11131a" fontSize="4.5" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
          YOU'LL NEVER WALK ALONE
        </text>

        {/* Iconic Gates Bars */}
        <line x1="20" y1="90" x2="20" y2="102" stroke="#dc2626" strokeWidth="2" />
        <line x1="80" y1="90" x2="80" y2="102" stroke="#dc2626" strokeWidth="2" />
        <line x1="50" y1="88" x2="50" y2="102" stroke="#f5a623" strokeWidth="1.5" />
      </svg>
    </div>
  );
};
