/** Placeholder hero (modem + phone + Wi-Fi arcs) until the XD 3D render is exported. */
export function NoServiceHero() {
  return (
    <svg className="no-service-hero" viewBox="0 0 240 180" aria-hidden="true" focusable="false">
      <circle className="no-service-hero__glow" cx="120" cy="96" r="78" />
      <path className="no-service-hero__arc" d="M70 58a72 72 0 0 1 100 0" />
      <path className="no-service-hero__arc" d="M84 72a52 52 0 0 1 72 0" />
      <path className="no-service-hero__arc" d="M98 86a32 32 0 0 1 44 0" />
      <rect className="no-service-hero__modem" x="62" y="96" width="76" height="62" rx="18" />
      <circle className="no-service-hero__led" cx="100" cy="146" r="3" />
      <rect className="no-service-hero__phone" x="148" y="82" width="42" height="76" rx="8" />
      <rect className="no-service-hero__screen" x="153" y="90" width="32" height="58" rx="4" />
      <circle className="no-service-hero__led" cx="169" cy="112" r="6" />
    </svg>
  );
}
