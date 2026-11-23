'use server';

/**
 * Website content actions (A-03..A-09: settings, plans, pricing rules, dishes, add-ons, FAQ; FR-14..FR-20, FR-27).
 * Everything here edits the DRAFT tables with the admin's own session; visitors see nothing until Publish.
 * Server-side validation reuses the modules the forms use, so the browser is never trusted.
 */
import { createSessionClient } from '@/lib/supabase/server';
import { validatePlan, validatePricingRules, validateSettings } from '../validation/content';
import type { AddonValues, DishValues, FaqValues, PlanValues } from '../repository';
import type { OpsSettings, PricingRules, SiteSettingsDraft } from '../types';
import * as collections from './collections';
import {
  mapOpsSettings,
  mapPlan,
  mapPricingRules,
  mapSiteSettings,
  siteSettingsToDb,
  type OpsSettingsDb,
  type PlanDb,
  type PricingRulesDb,
  type SiteSettingsDb,
} from './mappers';
import type { ActionResult } from './result';
import { READ, WRITE, assertUuid, check, runAction, stop, unwrap } from './run';

function fieldErrors(errors: Record<string, string | undefined>): never {
  const fields = Object.fromEntries(
    Object.entries(errors).filter((e): e is [string, string] => typeof e[1] === 'string'),
  );
  stop('invalid', Object.values(fields).join(' '), fields);
}

// ---------- Settings ----------

export async function getSettingsAction(): Promise<
  ActionResult<{ site: SiteSettingsDraft; ops: OpsSettings }>
> {
  return runAction('getSettings', 'load_failed', async () => {
    const db = await createSessionClient();
    const [site, ops] = await Promise.all([
      db.from('site_settings').select('*').eq('id', 1).single(),
      db.from('ops_settings').select('*').eq('id', 1).single(),
    ]);
    return {
      site: mapSiteSettings(unwrap<SiteSettingsDb>(site, READ)),
      ops: mapOpsSettings(unwrap<OpsSettingsDb>(ops, READ)),
    };
  });
}

export async function saveSettingsAction(
  site: SiteSettingsDraft,
  ops: OpsSettings,
): Promise<ActionResult<null>> {
  return runAction('saveSettings', 'save_failed', async () => {
    const result = validateSettings({
      businessName: site.businessName,
      tagline: site.tagline,
      areaServed: site.areaServed,
      deliveryBoundaryText: site.deliveryBoundaryText,
      legalNameAndAddress: site.legalNameAndAddress,
      paymentMethods: site.paymentMethods.join(', '),
      whatsappNumber: site.whatsappNumber,
      instagramHandle: site.instagramHandle,
      orderHours: site.orderHours,
      lastOrderTime: site.lastOrderTime,
      deliveryAreaText: site.deliveryAreaText,
      deliveryTimes: site.deliveryTimes,
      skipCutoffs: site.skipCutoffs,
      skipsPerWeek: String(site.skipsPerWeek),
      renewalWindowDays: String(ops.renewalWindowDays),
      overdueGraceDays: String(ops.overdueGraceDays),
    });
    if (!result.ok) fieldErrors(result.errors);
    const db = await createSessionClient();
    check(
      (await db.from('site_settings').update(siteSettingsToDb(result.value.site)).eq('id', 1))
        .error,
      WRITE,
    );
    check(
      (
        await db
          .from('ops_settings')
          .update({
            renewal_window_days: result.value.renewalWindowDays,
            overdue_grace_days: result.value.overdueGraceDays,
          })
          .eq('id', 1)
      ).error,
      WRITE,
    );
    return null;
  });
}

// ---------- Plans and pricing rules ----------

export async function listPlansAction() {
  return runAction('listPlans', 'load_failed', async () => {
    const db = await createSessionClient();
    const [plans, draft] = await Promise.all([
      db.from('plans').select('*').order('sort_order').order('id'),
      // The monthly price is computed by the database (Q-10); the app only displays it.
      db.rpc('get_draft_content', { menu_week_id: null }),
    ]);
    const rows = unwrap<PlanDb[] | null>(plans, READ) ?? [];
    const doc = (draft.error ? null : draft.data) as {
      plans?: { id: string; monthly_price: number | null }[];
    } | null;
    const derived = new Map((doc?.plans ?? []).map((p) => [p.id, p.monthly_price]));
    return rows.map((row) => mapPlan(row, derived.get(row.id) ?? null));
  });
}

export async function savePlansAction(
  values: { id: string; values: PlanValues }[],
  mostPopularId: string | null,
): Promise<ActionResult<null>> {
  return runAction('savePlans', 'save_failed', async () => {
    const db = await createSessionClient();
    const existing = new Set(
      (unwrap<{ id: string }[] | null>(await db.from('plans').select('id'), READ) ?? []).map(
        (r) => r.id,
      ),
    );
    if (mostPopularId !== null && !existing.has(mostPopularId))
      stop('not_found', 'This plan was not found.');

    const rows = values.map(({ id, values: v }) => {
      assertUuid(id, 'plan');
      if (!existing.has(id)) stop('not_found', 'This plan was not found.');
      const result = validatePlan({
        name: v.name,
        audience: v.audience,
        mealsIncluded: v.mealsIncluded,
        unitPrice: String(v.unitPrice),
        weeklyPrice: String(v.weeklyPrice),
        sortOrder: String(v.sortOrder),
        isActive: v.isActive,
      });
      if (!result.ok) fieldErrors({ [`${id}`]: Object.values(result.errors).join(' ') });
      return {
        id,
        name: result.value.name,
        audience: result.value.audience,
        meals_included: result.value.mealsIncluded,
        unit_price: result.value.unitPrice,
        weekly_price: result.value.weeklyPrice,
        sort_order: result.value.sortOrder,
        is_active: result.value.isActive,
        is_most_popular: mostPopularId === id,
      };
    });

    // One statement for all plans, so a failure leaves the draft exactly as it was.
    if (mostPopularId === null) {
      check(
        (await db.from('plans').update({ is_most_popular: false }).eq('is_most_popular', true))
          .error,
        WRITE,
      );
    }
    if (rows.length > 0)
      check((await db.from('plans').upsert(rows, { onConflict: 'id' })).error, WRITE);
    return null;
  });
}

export async function getPricingRulesAction(): Promise<ActionResult<PricingRules>> {
  return runAction('getPricingRules', 'load_failed', async () => {
    const db = await createSessionClient();
    return mapPricingRules(
      unwrap<PricingRulesDb>(await db.from('pricing_rules').select('*').eq('id', 1).single(), READ),
    );
  });
}

export async function savePricingRulesAction(
  rules: Omit<PricingRules, 'teamMinPeople'>,
): Promise<ActionResult<null>> {
  return runAction('savePricingRules', 'save_failed', async () => {
    const result = validatePricingRules({
      monthlySavingPercent: String(rules.monthlySavingPercent),
      breakfastAddonPrice: String(rules.breakfastAddonPrice),
      teamDealText: rules.teamDealText,
    });
    if (!result.ok) fieldErrors(result.errors);
    const db = await createSessionClient();
    check(
      (
        await db
          .from('pricing_rules')
          .update({
            monthly_saving_percent: result.value.monthlySavingPercent,
            breakfast_addon_price: result.value.breakfastAddonPrice,
            team_deal_text: result.value.teamDealText,
          })
          .eq('id', 1)
      ).error,
      WRITE,
    );
    return null;
  });
}

// ---------- Dishes, add-ons, FAQ ----------

export async function listDishesAction() {
  return runAction('listDishes', 'load_failed', async () =>
    collections.dishes.list(await createSessionClient()),
  );
}
export async function saveDishAction(id: string | null, values: DishValues) {
  return runAction('saveDish', 'save_failed', async () =>
    collections.dishes.save(await createSessionClient(), id, values),
  );
}
export async function removeDishAction(id: string) {
  return runAction('removeDish', 'save_failed', async () =>
    collections.dishes.remove(await createSessionClient(), id),
  );
}
export async function moveDishAction(id: string, direction: 'up' | 'down') {
  return runAction('moveDish', 'save_failed', async () =>
    collections.dishes.move(await createSessionClient(), id, direction),
  );
}

export async function listAddonsAction() {
  return runAction('listAddons', 'load_failed', async () =>
    collections.addons.list(await createSessionClient()),
  );
}
export async function saveAddonAction(id: string | null, values: AddonValues) {
  return runAction('saveAddon', 'save_failed', async () =>
    collections.addons.save(await createSessionClient(), id, values),
  );
}
export async function removeAddonAction(id: string) {
  return runAction('removeAddon', 'save_failed', async () =>
    collections.addons.remove(await createSessionClient(), id),
  );
}
export async function moveAddonAction(id: string, direction: 'up' | 'down') {
  return runAction('moveAddon', 'save_failed', async () =>
    collections.addons.move(await createSessionClient(), id, direction),
  );
}

export async function listFaqAction() {
  return runAction('listFaq', 'load_failed', async () =>
    collections.faq.list(await createSessionClient()),
  );
}
export async function saveFaqAction(id: string | null, values: FaqValues) {
  return runAction('saveFaq', 'save_failed', async () =>
    collections.faq.save(await createSessionClient(), id, values),
  );
}
export async function removeFaqAction(id: string) {
  return runAction('removeFaq', 'save_failed', async () =>
    collections.faq.remove(await createSessionClient(), id),
  );
}
export async function moveFaqAction(id: string, direction: 'up' | 'down') {
  return runAction('moveFaq', 'save_failed', async () =>
    collections.faq.move(await createSessionClient(), id, direction),
  );
}
