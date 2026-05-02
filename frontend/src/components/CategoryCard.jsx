import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

// Inline SVGs — kept simple and self-contained so each card can ship its own
// graphics without an asset pipeline. They animate via CSS classes on the
// parent card (see styles/category.css).
const SVG = {
  heart: (
    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  ),
  trophy: (
    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9V3h12v6"/>
      <path d="M18 9a4 4 0 0 0 4-4h-4M6 9a4 4 0 0 1-4-4h4"/>
      <path d="M12 15a6 6 0 0 0 6-6V3H6v6a6 6 0 0 0 6 6Z"/>
      <path d="M9 21h6M12 17v4"/>
    </svg>
  ),
  wrench: (
    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8a2.83 2.83 0 1 1-4-4l8-8z"/>
      <path d="M8.5 12 3 17.5"/>
    </svg>
  ),
  briefcase: (
    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="7"  width="20" height="14" rx="2"/>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
      <path d="M2 13h20"/>
    </svg>
  ),
  video: (
    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="6" width="14" height="12" rx="2"/>
      <path d="m22 8-6 4 6 4V8Z"/>
    </svg>
  ),
  sparkles: (
    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z"/>
      <path d="M19 14v4M17 16h4M5 5v3M3.5 6.5h3"/>
    </svg>
  ),
};

const ANIM_CLASS = {
  pulse:  'cat-icon-pulse',
  bounce: 'cat-icon-bounce',
  float:  'cat-icon-float',
  glow:   'cat-icon-glow',
  wrench: 'cat-icon-wrench',
};

export default function CategoryCard({ category }) {
  const icon = SVG[category.iconKey] || SVG.sparkles;

  return (
    <Link
      to={category.route}
      className={`cat-card border border-ink-100 group`}
      aria-label={`Browse ${category.title} services`}
    >
      {/* Background image (always visible, before AND on hover) */}
      {category.image && (
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
          style={{ backgroundImage: `url(${category.image})` }}
        />
      )}
      {/* Static dim so the title is readable over the photo */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
      {/* Hover dim — extra darkening when revealed content appears */}
      <div className={`absolute inset-0 bg-gradient-to-br ${category.gradient} opacity-0 group-hover:opacity-80 transition-opacity duration-300`} />
      {/* shimmer sweep on hover */}
      <div className="cat-shine" />

      <div className="relative z-10 p-6 sm:p-7 aspect-[4/3] flex flex-col justify-between text-white">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl sm:text-2xl font-bold drop-shadow-md">
            {category.title}
          </h3>
          <div
            className={`cat-icon ${ANIM_CLASS[category.animation] || ''} p-3 rounded-2xl bg-white/95 group-hover:bg-white shadow-soft`}
            style={{ color: category.accent }}
          >
            {icon}
          </div>
        </div>

        {/* Hover-revealed content */}
        <div className="cat-overlay">
          <p className="text-sm leading-relaxed text-white/95 drop-shadow">
            {category.description}
          </p>
          <span
            className="inline-flex items-center gap-1.5 mt-4 px-3.5 py-1.5 rounded-full bg-white text-sm font-semibold shadow-soft"
            style={{ color: category.accent }}
          >
            Check it out <ArrowRight size={14} />
          </span>
        </div>
      </div>
    </Link>
  );
}
