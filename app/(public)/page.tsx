import type { Metadata } from 'next';
import { JsonLd } from '@/components/public/JsonLd';
import { SectionFocus } from '@/components/public/SectionFocus';
import { AboutSection } from '@/components/public/sections/AboutSection';
import { CustomizeSection } from '@/components/public/sections/CustomizeSection';
import { HomeSection } from '@/components/public/sections/HomeSection';
import { HowSection } from '@/components/public/sections/HowSection';
import { MenuSection } from '@/components/public/sections/MenuSection';
import { PlansSection } from '@/components/public/sections/PlansSection';
import { getMealsFromPrice, getSiteSettings } from '@/content';
import { formatRs } from '@/lib/format';
import { pageMetadata } from '@/lib/seo';
import { getSiteUrl, isSiteUrlConfigured } from '@/lib/site-url';
import { buildFoodEstablishmentJsonLd } from '@/lib/structured-data';

/** One canonical URL, one title, one description for the whole site (the design is a single page). */
export async function generateMetadata(): Promise<Metadata> {
  const mealsFrom = await getMealsFromPrice();
  return pageMetadata({
    title: 'Home',
    absoluteTitle: 'Tiffin Box | Ghar ka khana in Johar Town, Lahore',
    description: `Home-style meals for hostel students and offices in Johar Town, Lahore: weekly menu, plans and prices, customize a meal, how ordering works, contact and questions.${
      mealsFrom === null ? '' : ` Meals from ${formatRs(mealsFrom)}.`
    }`,
    path: '/',
  });
}

/**
 * The whole public site on one page (the operator's design "Tiffin Box Lahore"): six sections that are ALL rendered
 * on the server. The address hash picks the visible one (#menu, #plans, #customize, #how, #about; none = home) with
 * plain CSS (:target, see public.css), so there is no flash and no JavaScript is needed. Without JavaScript the
 * <noscript> rule shows every section stacked; the nav links are ordinary anchors either way.
 */
export default async function SitePage() {
  const settings = await getSiteSettings();
  return (
    <div className="t-sections">
      <JsonLd
        data={buildFoodEstablishmentJsonLd(settings, isSiteUrlConfigured() ? getSiteUrl() : null)}
      />
      <SectionFocus />
      <noscript>
        <style>{'.t-sections > .t-section { display: block !important; }'}</style>
      </noscript>
      <section id="home" className="t-section">
        <HomeSection />
      </section>
      <section id="menu" className="t-section">
        <MenuSection />
      </section>
      <section id="plans" className="t-section">
        <PlansSection />
      </section>
      <section id="customize" className="t-section">
        <CustomizeSection />
      </section>
      <section id="how" className="t-section">
        <HowSection />
      </section>
      <section id="about" className="t-section">
        <AboutSection />
      </section>
    </div>
  );
}
