'use client';

import { useAppState, useAppDispatch } from '@/lib/store';
import { T } from '@/lib/i18n';

export default function AptScreen() {
  const { lang } = useAppState();
  const dispatch = useAppDispatch();
  const t = T[lang];

  const comingSoon = lang === 'ar' ? 'قريباً' : 'Coming soon';
  const desc = lang === 'ar'
    ? 'صفحة إدارة الشقة ستكون متاحة قريباً. ستتضمن إدارة الحجوزات، التقويم، والتقارير المالية الخاصة بالشقة.'
    : 'Apartment management will be available soon. It will include bookings, calendar, and financial reports for the apartment.';

  return (
    <div>
      <div className="page-h reveal in">{t.aptTitle ?? (lang === 'ar' ? 'الشقة' : 'Apartment')}</div>
      <div className="page-sub reveal in">{t.aptSub ?? (lang === 'ar' ? 'إدارة حجوزات الشقة' : 'Manage apartment bookings')}</div>

      <div className="prop-coming reveal in">
        <div className="prop-coming-icon">🏢</div>
        <div className="prop-coming-label">{comingSoon}</div>
        <p className="prop-coming-desc">{desc}</p>
        <button
          className="btn gold"
          onClick={() => dispatch({ type: 'SET_PAGE', payload: 'board' })}
        >
          {lang === 'ar' ? 'العودة إلى اللوحة' : 'Back to Board'}
        </button>
      </div>
    </div>
  );
}
