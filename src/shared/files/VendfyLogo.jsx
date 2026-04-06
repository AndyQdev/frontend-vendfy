import React from 'react';

/**
 * Vendfy Logo - Store + AI Sparkle
 * 
 * @param {object} props
 * @param {'icon'|'full'|'full-white'} props.variant - Logo variant
 * @param {number} props.size - Size in pixels (applies to icon height)
 * @param {string} props.className - Additional CSS classes
 */
export const VendfyLogo = ({ variant = 'full', size = 40, className = '' }) => {
  // Icon only
  if (variant === 'icon') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 120 120"
        fill="none"
        height={size}
        width={size}
        className={className}
      >
        <rect x="13" y="48" width="82" height="58" rx="5" fill="#10B981" />
        <rect x="8" y="34" width="92" height="16" rx="4" fill="#0F172A" />
        <path d="M8 50 Q18 60, 28 50 Q38 60, 48 50 Q58 60, 68 50 Q78 60, 88 50 Q96 60, 100 50" fill="#0F172A" />
        <rect x="38" y="62" width="32" height="44" rx="5" fill="#0F172A" />
        <rect x="41" y="65" width="26" height="41" rx="3.5" fill="#ECFDF5" />
        <circle cx="61" cy="86" r="2.2" fill="#0F172A" />
        <path d="M98 12 L101 22 L111 25 L101 28 L98 38 L95 28 L85 25 L95 22Z" fill="#34D399" />
        <path d="M112 4 L114 9 L119 11 L114 13 L112 18 L110 13 L105 11 L110 9Z" fill="#34D399" opacity="0.5" />
        <circle cx="84" cy="16" r="2" fill="#34D399" opacity="0.3" />
      </svg>
    );
  }

  const isWhite = variant === 'full-white';
  const textColor = isWhite ? '#ffffff' : '#0F172A';
  const accentColor = isWhite ? '#10B981' : '#059669';
  const awningColor = isWhite ? '#ffffff' : '#0F172A';
  const doorInner = isWhite ? '#0F172A' : '#ECFDF5';
  const handleColor = isWhite ? '#ffffff' : '#0F172A';

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 280 60"
      fill="none"
      height={size}
      className={className}
    >
      <g transform="translate(0, 2) scale(0.48)">
        <rect x="13" y="48" width="82" height="58" rx="5" fill="#10B981" />
        <rect x="8" y="34" width="92" height="16" rx="4" fill={awningColor} />
        <path d="M8 50 Q18 60, 28 50 Q38 60, 48 50 Q58 60, 68 50 Q78 60, 88 50 Q96 60, 100 50" fill={awningColor} />
        <rect x="38" y="62" width="32" height="44" rx="5" fill={awningColor} />
        <rect x="41" y="65" width="26" height="41" rx="3.5" fill={doorInner} />
        <circle cx="61" cy="86" r="2.2" fill={handleColor} />
        <path d="M98 12 L101 22 L111 25 L101 28 L98 38 L95 28 L85 25 L95 22Z" fill="#34D399" />
        <path d="M112 4 L114 9 L119 11 L114 13 L112 18 L110 13 L105 11 L110 9Z" fill="#34D399" opacity="0.5" />
        <circle cx="84" cy="16" r="2" fill="#34D399" opacity="0.3" />
      </g>
      <text x="68" y="42" fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif" fontSize="32" fontWeight="700" fill={textColor}>Vend</text>
      <text x="137" y="42" fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif" fontSize="32" fontWeight="700" fill={accentColor}>fy</text>
    </svg>
  );
};

/**
 * Vendfy Icon - Solo el ícono de la tienda (para favicon, tab, etc.)
 */
export const VendfyIcon = ({ size = 32, className = '' }) => (
  <VendfyLogo variant="icon" size={size} className={className} />
);

export default VendfyLogo;
