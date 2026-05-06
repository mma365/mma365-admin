import Link from 'next/link';
import React from 'react';

type Props = {
  page: number;
  totalPages: number;
  buildHref: (p: number) => string;
};

export default function Pagination({ page, totalPages, buildHref }: Props) {
  if (totalPages <= 1) return null;

  const pages = [
    ...new Set([
      1,
      ...Array.from({ length: 5 }, (_, i) => page - 2 + i).filter((p) => p > 1 && p < totalPages),
      totalPages,
    ]),
  ].sort((a, b) => a - b);

  const btnBase = 'px-3 py-1.5 rounded-lg text-sm transition-colors';
  const btnActive = `${btnBase} bg-red-600 text-white font-semibold`;
  const btnIdle = `${btnBase} text-gray-400 hover:bg-gray-800 hover:text-white`;
  const btnDisabled = `${btnBase} text-gray-700 cursor-default pointer-events-none`;

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      {page > 1 ? (
        <Link href={buildHref(page - 1)} className={btnIdle}>← Préc</Link>
      ) : (
        <span className={btnDisabled}>← Préc</span>
      )}

      {pages.map((p, i) => {
        const prev = pages[i - 1];
        return (
          <React.Fragment key={p}>
            {prev && p - prev > 1 && (
              <span className="text-gray-600 px-1">…</span>
            )}
            <Link href={buildHref(p)} className={p === page ? btnActive : btnIdle}>
              {p}
            </Link>
          </React.Fragment>
        );
      })}

      {page < totalPages ? (
        <Link href={buildHref(page + 1)} className={btnIdle}>Suiv →</Link>
      ) : (
        <span className={btnDisabled}>Suiv →</span>
      )}
    </div>
  );
}
