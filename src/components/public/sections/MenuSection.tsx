import { WarningAlert } from '@/components/public/Alert';
import { MenuDays, type MenuMealLabel } from '@/components/public/MenuDays';
import { PagePhoto } from '@/components/public/PagePhoto';
import { getMenu, getPageCopy, getPageImages, getSiteSettings } from '@/content';
import { isMenuCurrent } from '@/content/derive';
import {
  formatMenuHeadingDates,
  formatMenuWeekLabel,
  formatTime12h,
  formatWeekdayDate,
  karachiDateKey,
} from '@/lib/format';
import { buildWhatsAppLink } from '@/lib/whatsapp';

export async function MenuSection() {
  const [week, settings, copy, pageImages] = await Promise.all([
    getMenu(),
    getSiteSettings(),
    getPageCopy(),
    getPageImages(),
  ]);
  const link = buildWhatsAppLink(settings.whatsappNumber);
  // The database says whether the released week covers the current calendar week; mock content derives it.
  const current = week ? (week.isCurrent ?? isMenuCurrent(week, karachiDateKey())) : false;
  const meals: MenuMealLabel[] = (['breakfast', 'lunch', 'dinner'] as const).map((key) => ({
    key,
    label: `${settings.meals[key].label} · ${formatTime12h(settings.meals[key].deliveredBy)}`,
  }));

  return (
    <div className="t-band">
      <div className="t-wrap">
        <span className="t-kick">{copy.menu.eyebrow}</span>
        {week ? (
          <>
            <h1>Menu for {formatMenuHeadingDates(week.weekStart, week.weekEnd)}</h1>
            <p className="t-lead">{copy.menu.intro}</p>
            {current ? null : (
              <div style={{ marginTop: 18 }}>
                <WarningAlert title="This week's menu is not up yet.">
                  Below is our last menu ({formatMenuWeekLabel(week.weekStart, week.weekEnd)},
                  updated {formatWeekdayDate(week.publishedAt)}). Message us on WhatsApp to ask what
                  is cooking.
                  <div className="alert-actions">
                    <a href={link.href}>Ask on WhatsApp</a>
                  </div>
                </WarningAlert>
              </div>
            )}
            <MenuDays days={week.days} meals={meals} defaultIndex={0} />
          </>
        ) : (
          <>
            <h1>This week&apos;s menu</h1>
            <div style={{ marginTop: 18 }}>
              <WarningAlert title="The menu is not published yet.">
                We have not published a menu yet. Message us on WhatsApp to ask what is cooking.
                <div className="alert-actions">
                  <a href={link.href}>Ask on WhatsApp</a>
                </div>
              </WarningAlert>
            </div>
          </>
        )}
        {copy.menu.note ? <p className="t-note">{copy.menu.note}</p> : null}
        <p style={{ marginTop: 14 }}>
          <a className="t-btn t-line" href="#customize">
            {copy.menu.customizeLink}
          </a>
        </p>
        <PagePhoto image={pageImages.menuHeader} shape="wide" className="mt-8" />
      </div>
    </div>
  );
}
