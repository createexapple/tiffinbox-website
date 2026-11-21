import type { Metadata } from 'next';
import Link from 'next/link';
import { WarningAlert } from '@/components/public/Alert';
import { MenuTable } from '@/components/public/MenuTable';
import { NoteBox } from '@/components/public/NoteBox';
import { PhotoPlaceholder } from '@/components/public/PhotoPlaceholder';
import { getMenu, getPageCopy, getSiteSettings } from '@/content';
import { isMenuCurrent } from '@/content/derive';
import { formatMenuWeekLabel, formatWeekdayDate, karachiDateKey } from '@/lib/format';
import { pageMetadata } from '@/lib/seo';
import { buildWhatsAppLink } from '@/lib/whatsapp';

export const metadata: Metadata = pageMetadata({
  title: 'This week’s menu',
  description:
    'Tiffin Box weekly menu: breakfast, lunch and dinner for every day, updated every Sunday evening.',
  path: '/menu',
});

export default async function MenuPage() {
  const [week, settings, copy] = await Promise.all([getMenu(), getSiteSettings(), getPageCopy()]);
  const link = buildWhatsAppLink(settings.whatsappNumber);
  const current = week ? isMenuCurrent(week, karachiDateKey()) : false;

  return (
    <section className="section">
      <div className="wrap">
        <p className="eyebrow">Weekly menu</p>
        {week ? (
          <>
            <h1 className="h1-page">
              Menu for {formatMenuWeekLabel(week.weekStart, week.weekEnd)}
            </h1>
            <p className="lede">
              Updated {formatWeekdayDate(week.publishedAt)}. The menu changes every week.
            </p>
            {current ? null : (
              <WarningAlert title="This week’s menu is not up yet.">
                Below is our last menu ({formatMenuWeekLabel(week.weekStart, week.weekEnd)}, updated{' '}
                {formatWeekdayDate(week.publishedAt)}). Message us on WhatsApp to ask what is
                cooking.
                <div className="alert-actions">
                  <a href={link.href}>Ask on WhatsApp</a>
                </div>
              </WarningAlert>
            )}
            <p className={current ? undefined : 'mt-5'}>{copy.menuIntro}</p>
            <MenuTable week={week} settings={settings} />
          </>
        ) : (
          <>
            <h1 className="h1-page">This week’s menu</h1>
            <WarningAlert title="The menu is not published yet.">
              We have not published a menu yet. Message us on WhatsApp to ask what is cooking.
              <div className="alert-actions">
                <a href={link.href}>Ask on WhatsApp</a>
              </div>
            </WarningAlert>
          </>
        )}

        <div className="mt-6">
          <NoteBox title="Not your plan’s full menu?">
            {copy.planNote} <Link href="/plans">See what each plan includes</Link>.
          </NoteBox>
        </div>
        <div className="cta-row">
          <Link className="btn btn-primary btn-lg" href="/customize">
            Customize your meal
          </Link>
        </div>
        <PhotoPlaceholder shape="wide" className="mt-8" description="plated lunch (menu header)" />
      </div>
    </section>
  );
}
