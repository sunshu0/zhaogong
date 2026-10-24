// The 找工 mark (#328, logo option A「告示卡」, user 10-20): a notice taped to the window, with 工 on it. Inline, so
// the header needs no extra request and the mark scales with the text. The source is public/brand/mark.svg; the
// options are in docs/design/logo-options.html. #375: the card's teal is visual A's brand colour (--brand).
export function BrandMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={className}>
      <g transform="rotate(-6 50 52)">
        <rect x="18" y="16" width="64" height="72" rx="6" fill="#fff" stroke="#0f5e57" strokeWidth="4" />
        <g transform="translate(26 30) scale(0.48)" fill="#0f5e57">
          <rect x="24" y="22" width="52" height="13" rx="2" />
          <rect x="43.5" y="22" width="13" height="56" />
          <rect x="14" y="66" width="72" height="13" rx="2" />
        </g>
      </g>
      <rect
        x="38"
        y="9"
        width="24"
        height="11"
        rx="2"
        fill="#fef3e2"
        stroke="#b45309"
        strokeWidth="1.5"
        transform="rotate(4 50 14)"
      />
    </svg>
  );
}
