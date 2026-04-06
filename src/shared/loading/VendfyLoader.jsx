import React from 'react';

const styles = `
  @keyframes vendfy-breathe {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.06); }
  }
  @keyframes vendfy-sparkFloat {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    25% { transform: translateY(-3px) rotate(8deg); }
    50% { transform: translateY(1px) rotate(0deg); }
    75% { transform: translateY(2px) rotate(-8deg); }
  }
  @keyframes vendfy-dotBounce {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
    40% { transform: translateY(-8px); opacity: 1; }
  }
  @keyframes vendfy-fadeIn {
    0% { opacity: 0; transform: translateY(6px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  @keyframes vendfy-shimmer {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }

  .vendfy-loader {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0;
    position: fixed;
    inset: 0;
    z-index: 9999;
    animation: vendfy-fadeIn 0.3s ease-out;
  }
  .vendfy-loader--light {
    background: rgba(255, 255, 255, 0.95);
  }
  .vendfy-loader--dark {
    background: rgba(15, 23, 42, 0.97);
  }
  .vendfy-loader--inline {
    position: relative;
    min-height: 200px;
  }

  .vendfy-loader__icon {
    animation: vendfy-breathe 2.4s ease-in-out infinite;
    transform-origin: center;
  }
  .vendfy-loader__spark {
    animation: vendfy-sparkFloat 3s ease-in-out infinite;
    transform-origin: 98px 25px;
  }
  .vendfy-loader__spark-glow {
    animation: vendfy-shimmer 2s ease-in-out infinite;
  }

  .vendfy-loader__brand {
    display: flex;
    align-items: center;
    gap: 1px;
    margin-top: 14px;
  }
  .vendfy-loader__brand-vend {
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-size: 18px;
    font-weight: 700;
  }
  .vendfy-loader__brand-fy {
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-size: 18px;
    font-weight: 700;
  }

  .vendfy-loader__dots {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 16px;
  }
  .vendfy-loader__dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #10B981;
    animation: vendfy-dotBounce 1.4s ease-in-out infinite;
  }
  .vendfy-loader__dot:nth-child(2) {
    animation-delay: 0.16s;
  }
  .vendfy-loader__dot:nth-child(3) {
    animation-delay: 0.32s;
  }

  .vendfy-loader__message {
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-size: 13px;
    margin-top: 12px;
  }

  @media (prefers-reduced-motion: reduce) {
    .vendfy-loader__icon,
    .vendfy-loader__spark,
    .vendfy-loader__spark-glow,
    .vendfy-loader__dot {
      animation: none;
    }
  }
`;

/**
 * Vendfy Loader — Breathe + Dots
 *
 * @param {'light'|'dark'} theme - Tema del loader
 * @param {number} size - Tamaño del ícono en px (default: 56)
 * @param {string} message - Mensaje opcional debajo de los dots
 * @param {boolean} fullscreen - true = fixed fullscreen, false = inline
 * @param {string} className - Clases CSS adicionales
 */
const VendfyLoader = ({
  theme = 'dark',
  size = 56,
  message = '',
  fullscreen = true,
  className = '',
}) => {
  const isDark = theme === 'dark';
  const awningColor = isDark ? '#ffffff' : '#0F172A';
  const doorInner = isDark ? '#0F172A' : '#ECFDF5';
  const handleColor = isDark ? '#ffffff' : '#0F172A';
  const vendColor = isDark ? '#ffffff' : '#0F172A';
  const fyColor = isDark ? '#10B981' : '#059669';
  const msgColor = isDark ? '#64748B' : '#94A3B8';

  const modeClass = isDark ? 'vendfy-loader--dark' : 'vendfy-loader--light';
  const inlineClass = fullscreen ? '' : 'vendfy-loader--inline';

  return (
    <>
      <style>{styles}</style>
      <div className={`vendfy-loader ${modeClass} ${inlineClass} ${className}`}>
        <svg
          className="vendfy-loader__icon"
          viewBox="0 0 120 120"
          width={size}
          height={size}
          fill="none"
        >
          {/* Store body */}
          <rect x="13" y="48" width="82" height="58" rx="5" fill="#10B981" />

          {/* Awning */}
          <rect x="8" y="34" width="92" height="16" rx="4" fill={awningColor} />
          <path
            d="M8 50 Q18 60, 28 50 Q38 60, 48 50 Q58 60, 68 50 Q78 60, 88 50 Q96 60, 100 50"
            fill={awningColor}
          />

          {/* Door */}
          <rect x="38" y="62" width="32" height="44" rx="5" fill={awningColor} />
          <rect x="41" y="65" width="26" height="41" rx="3.5" fill={doorInner} />
          <circle cx="61" cy="86" r="2.2" fill={handleColor} />

          {/* AI Sparkles */}
          <g className="vendfy-loader__spark">
            <path
              d="M98 12 L101 22 L111 25 L101 28 L98 38 L95 28 L85 25 L95 22Z"
              fill="#34D399"
            />
            <path
              className="vendfy-loader__spark-glow"
              d="M112 4 L114 9 L119 11 L114 13 L112 18 L110 13 L105 11 L110 9Z"
              fill="#34D399"
              opacity="0.55"
            />
            <circle
              className="vendfy-loader__spark-glow"
              cx="84"
              cy="16"
              r="2"
              fill="#34D399"
              opacity="0.3"
            />
          </g>
        </svg>

        {/* Brand text */}
        <div className="vendfy-loader__brand">
          <span className="vendfy-loader__brand-vend" style={{ color: vendColor }}>
            Vend
          </span>
          <span className="vendfy-loader__brand-fy" style={{ color: fyColor }}>
            fy
          </span>
        </div>

        {/* Bouncing dots */}
        <div className="vendfy-loader__dots">
          <span className="vendfy-loader__dot" />
          <span className="vendfy-loader__dot" />
          <span className="vendfy-loader__dot" />
        </div>

        {/* Optional message */}
        {message && (
          <span className="vendfy-loader__message" style={{ color: msgColor }}>
            {message}
          </span>
        )}
      </div>
    </>
  );
};

export default VendfyLoader;
