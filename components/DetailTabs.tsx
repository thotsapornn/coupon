'use client';

import { useState, type ReactNode } from 'react';

export interface DetailTab {
  key: string;
  label: string;
  content: ReactNode;
}

export function DetailTabs({
  tabs,
  initialTab,
}: {
  tabs: DetailTab[];
  initialTab?: string;
}) {
  const fallback = tabs[0]?.key ?? '';
  const [active, setActive] = useState(() =>
    tabs.some((tab) => tab.key === initialTab) ? (initialTab as string) : fallback,
  );

  function select(key: string) {
    setActive(key);
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (key === fallback) url.searchParams.delete('tab');
    else url.searchParams.set('tab', key);
    window.history.replaceState(null, '', url);
  }

  const current = tabs.find((tab) => tab.key === active) ?? tabs[0];

  return (
    <div className="detail-tabs-wrap">
      <div className="tabs detail-tabs" role="tablist" aria-label="เนื้อหาคูปอง">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            className="tab"
            aria-selected={tab.key === active}
            aria-controls={`detail-panel-${tab.key}`}
            id={`detail-tab-${tab.key}`}
            onClick={() => select(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        className="detail-tab-content"
        role="tabpanel"
        id={`detail-panel-${current.key}`}
        aria-labelledby={`detail-tab-${current.key}`}
      >
        {current.content}
      </div>
    </div>
  );
}
