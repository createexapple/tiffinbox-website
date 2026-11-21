'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { monthlyPriceCheck } from '@/admin/ledger';
import type { PlanDraft, PricingRules } from '@/admin/types';
import { parsePositiveRupees } from '@/admin/validation/common';
import {
  priceUnitLabel,
  validatePlan,
  validatePricingRules,
  type PlanField,
  type PlanInput,
  type PlanValue,
  type PricingRulesField,
  type PricingRulesInput,
} from '@/admin/validation/content';
import { formatRs } from '@/lib/format';
import { useAdmin, useQuery } from '../AdminProvider';
import { CheckField, ErrorSummary, TextAreaField, TextField } from '../fields';
import { useToast } from '../Toast';
import { PageHead, QueryBoundary } from '../ui';

/** A-04 (FR-16): plans, prices and pricing rules, saved as drafts. */
export function PlansScreen() {
  const { state, reload } = useQuery(async (repo) => ({
    plans: await repo.listPlans(),
    rules: await repo.getPricingRules(),
  }));

  return (
    <>
      <PageHead
        title="Plans & pricing"
        sub="Changes are saved as drafts until you publish. Existing subscriptions keep the price they were created with."
      />
      <QueryBoundary query={state} reload={reload}>
        {({ plans, rules }) => <PlansForm plans={plans} rules={rules} />}
      </QueryBoundary>
    </>
  );
}

type PlanState = PlanInput;

function toInput(plan: PlanDraft): PlanState {
  return {
    name: plan.name,
    audience: plan.audience,
    mealsIncluded: plan.mealsIncluded,
    unitPrice: plan.unitPrice === null ? '' : String(plan.unitPrice),
    weeklyPrice: plan.weeklyPrice === null ? '' : String(plan.weeklyPrice),
    sortOrder: String(plan.sortOrder),
    isActive: plan.isActive,
  };
}

function PlansForm({ plans, rules }: { plans: PlanDraft[]; rules: PricingRules }) {
  const { repo } = useAdmin();
  const toast = useToast();
  const [values, setValues] = useState<Record<string, PlanState>>(() =>
    Object.fromEntries(plans.map((p) => [p.id, toInput(p)])),
  );
  const [popular, setPopular] = useState<string | null>(
    () => plans.find((p) => p.isMostPopular)?.id ?? null,
  );
  const [ruleValues, setRuleValues] = useState<PricingRulesInput>({
    monthlySavingPercent: String(rules.monthlySavingPercent),
    breakfastAddonPrice: String(rules.breakfastAddonPrice),
    teamDealText: rules.teamDealText,
  });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const setPlan = (id: string, patch: Partial<PlanState>) =>
    setValues((v) => ({ ...v, [id]: { ...(v[id] as PlanState), ...patch } }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setServerError(null);
    const found: Record<string, string | undefined> = {};
    const valid: { id: string; values: PlanValue }[] = [];
    for (const plan of plans) {
      const result = validatePlan(values[plan.id] as PlanState);
      if (result.ok) valid.push({ id: plan.id, values: result.value });
      else {
        for (const [field, message] of Object.entries(result.errors)) {
          found[`${plan.id}.${field}`] = message;
        }
      }
    }
    const ruleResult = validatePricingRules(ruleValues);
    if (!ruleResult.ok) {
      for (const [field, message] of Object.entries(ruleResult.errors))
        found[`rules.${field}`] = message;
    }
    setErrors(found);
    if (Object.keys(found).length > 0 || !ruleResult.ok) return;
    try {
      await repo.savePlans(valid, popular);
      await repo.savePricingRules(ruleResult.value);
      toast({
        text: 'Plans saved as draft. Not live yet.',
        link: { href: '/admin/publish', label: 'Preview & publish' },
      });
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Please try again.');
    }
  }

  const errorLabels: Record<string, { id: string; label: string }> = {};
  for (const plan of plans) {
    const fieldLabel: Record<PlanField, string> = {
      name: 'plan name',
      audience: 'who it is for',
      mealsIncluded: 'meals included',
      unitPrice: priceUnitLabel(plan.priceUnit).replace(' (Rs)', '').toLowerCase(),
      weeklyPrice: 'weekly price',
      sortOrder: 'display order',
      isActive: 'show on the website',
    };
    for (const field of Object.keys(fieldLabel) as PlanField[]) {
      errorLabels[`${plan.id}.${field}`] = {
        id: `plan-${plan.id}-${field}`,
        label: `${plan.name}: ${fieldLabel[field]}`,
      };
    }
  }
  const ruleLabels: Record<PricingRulesField, string> = {
    monthlySavingPercent: 'Monthly saving',
    breakfastAddonPrice: 'Breakfast add-on price',
    teamDealText: 'Office team deal text',
  };
  for (const field of Object.keys(ruleLabels) as PricingRulesField[]) {
    errorLabels[`rules.${field}`] = { id: `rules-${field}`, label: ruleLabels[field] };
  }

  const mealPrices = plans
    .filter((p) => p.priceUnit === 'per_meal' && (values[p.id]?.isActive ?? false))
    .map((p) => parsePositiveRupees(values[p.id]?.unitPrice ?? ''))
    .filter((n): n is number => n !== null);
  const mealsFrom = mealPrices.length > 0 ? Math.min(...mealPrices) : null;
  const saving = Number(ruleValues.monthlySavingPercent);

  return (
    <form noValidate onSubmit={onSubmit}>
      <ErrorSummary errors={errors} labels={errorLabels} serverError={serverError} />
      <div className="form-grid c2" style={{ marginTop: 'var(--sp-3)' }}>
        {plans.map((plan) => {
          const v = values[plan.id] as PlanState;
          const e = (field: PlanField) => errors[`${plan.id}.${field}`];
          return (
            <fieldset className="fieldset" key={plan.id}>
              <legend>{plan.name}</legend>
              <div className="form-grid c2">
                <TextField
                  id={`plan-${plan.id}-name`}
                  label="Plan name"
                  required
                  value={v.name}
                  onChange={(name) => setPlan(plan.id, { name })}
                  error={e('name')}
                />
                <TextField
                  id={`plan-${plan.id}-audience`}
                  label="Who it is for"
                  value={v.audience}
                  onChange={(audience) => setPlan(plan.id, { audience })}
                  error={e('audience')}
                />
                <TextAreaField
                  id={`plan-${plan.id}-mealsIncluded`}
                  label="Meals included"
                  value={v.mealsIncluded}
                  onChange={(mealsIncluded) => setPlan(plan.id, { mealsIncluded })}
                  error={e('mealsIncluded')}
                />
                <div>
                  <TextField
                    id={`plan-${plan.id}-unitPrice`}
                    label={priceUnitLabel(plan.priceUnit)}
                    required
                    inputMode="numeric"
                    value={v.unitPrice}
                    onChange={(unitPrice) => setPlan(plan.id, { unitPrice })}
                    hint={plan.priceNote}
                    error={e('unitPrice')}
                  />
                  <TextField
                    id={`plan-${plan.id}-weeklyPrice`}
                    label="Weekly price (Rs)"
                    required
                    inputMode="numeric"
                    value={v.weeklyPrice}
                    onChange={(weeklyPrice) => setPlan(plan.id, { weeklyPrice })}
                    error={e('weeklyPrice')}
                  />
                </div>
              </div>
              <div className="seg" style={{ marginBottom: 'var(--sp-3)' }}>
                <label>
                  <input
                    type="radio"
                    name="popular"
                    checked={popular === plan.id}
                    onChange={() => setPopular(plan.id)}
                  />{' '}
                  Most popular
                </label>
              </div>
              <CheckField
                id={`plan-${plan.id}-isActive`}
                label="Show on the website"
                checked={v.isActive}
                onChange={(isActive) => setPlan(plan.id, { isActive })}
              />
              <TextField
                id={`plan-${plan.id}-sortOrder`}
                label="Display order"
                inputMode="numeric"
                maxWidth="6rem"
                value={v.sortOrder}
                onChange={(sortOrder) => setPlan(plan.id, { sortOrder })}
                error={e('sortOrder')}
              />
            </fieldset>
          );
        })}
      </div>

      <section className="panel" aria-labelledby="rules-h">
        <h2 id="rules-h">Pricing rules</h2>
        <div className="form-grid c2">
          <TextField
            id="rules-monthlySavingPercent"
            label="Monthly saving (%)"
            inputMode="numeric"
            value={ruleValues.monthlySavingPercent}
            onChange={(monthlySavingPercent) =>
              setRuleValues((r) => ({ ...r, monthlySavingPercent }))
            }
            hint="Shown as text, for example “save 5% monthly”. No monthly price is published."
            error={errors['rules.monthlySavingPercent']}
          />
          <TextField
            id="rules-breakfastAddonPrice"
            label="Breakfast add-on (Rs per day)"
            inputMode="numeric"
            value={ruleValues.breakfastAddonPrice}
            onChange={(breakfastAddonPrice) =>
              setRuleValues((r) => ({ ...r, breakfastAddonPrice }))
            }
            error={errors['rules.breakfastAddonPrice']}
          />
          <TextAreaField
            id="rules-teamDealText"
            label="Office team deal text"
            value={ruleValues.teamDealText}
            onChange={(teamDealText) => setRuleValues((r) => ({ ...r, teamDealText }))}
            hint="Discount amount not decided (Q-09), so only text is shown."
            error={errors['rules.teamDealText']}
          />
          <div className="field">
            <span className="lbl">“Meals from” (calculated)</span>
            <p style={{ margin: 0 }}>
              <b>{mealsFrom === null ? 'No active plan with a price' : formatRs(mealsFrom)}</b>{' '}
              <span className="muted small">= lowest active per-meal price; shown on Home.</span>
            </p>
          </div>
        </div>
        <h3 style={{ fontSize: 'var(--fs-base)', marginTop: 'var(--sp-4)' }}>
          Monthly price check <span className="tag">Q-10 pending</span>
        </h3>
        <p className="small muted">
          For you to verify before publishing, if the client confirms “4 weeks × weekly price −
          saving”. Sample figures only; not shown to visitors.
        </p>
        <table className="rt admin-table">
          <thead>
            <tr>
              <th scope="col">Plan</th>
              <th scope="col" className="num">
                Weekly
              </th>
              <th scope="col" className="num">
                × 4 − saving
              </th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => {
              const weekly = parsePositiveRupees(values[plan.id]?.weeklyPrice ?? '');
              return (
                <tr key={plan.id}>
                  <th scope="row">{values[plan.id]?.name || plan.name}</th>
                  <td data-label="Weekly" className="num">
                    {weekly === null ? 'not valid' : formatRs(weekly)}
                  </td>
                  <td data-label="Monthly check" className="num">
                    {weekly === null || Number.isNaN(saving) || saving > 100
                      ? 'not valid'
                      : formatRs(monthlyPriceCheck(weekly, saving))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <div className="actionbar">
        <button type="submit" className="btn btn-primary">
          Save draft
        </button>
        <Link className="btn btn-secondary" href="/admin/publish">
          Preview &amp; publish
        </Link>
      </div>
    </form>
  );
}
