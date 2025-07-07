import React from 'react';

/**
 * ResponsiveScroll
 * -----------------
 * A lightweight wrapper that ensures its children get horizontal scroll on small
 * screens while expanding naturally on large screens.
 *
 * Props:
 * - minWidth (string | number): Optional.  Applied to an inner div so that the
 *   content has enough breathing room before scrollbars kick in. Useful for
 *   charts where each bar needs fixed space. Can be any valid CSS width value
 *   like '800px' or `${items * 120}px`.
 * - children: ReactNode – the content to render.
 */
const ResponsiveScroll = ({ minWidth, children }) => (
  <div className="w-full overflow-x-auto">
    <div style={minWidth ? { minWidth } : undefined}>{children}</div>
  </div>
);

export default ResponsiveScroll;
