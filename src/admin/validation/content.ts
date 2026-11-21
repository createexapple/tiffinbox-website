/** Validation for website content screens A-03..A-09 (FR-14..FR-21) and the account password (FR-13). */
import { isIsoDate } from '../dates';
import type { MealKey, MenuSlot, PriceUnit, SiteSettingsDraft } from '../types';
import {
  checkText,
  fail,
  hasErrors,
  isTime,
  parsePositiveRupees,
  parseWholeNumber,
  PRICE_ERROR,
  type FieldErrors,
  type Validation,
} from './common';

// ---------- Plans and pricing rules (FR-16) ----------

export interface PlanInput {
  name: string;
  audience: string;
  mealsIncluded: string;
  unitPrice: string;
  weeklyPrice: string;
  sortOrder: string;
  isActive: boolean;
}
export type PlanField = keyof PlanInput;

export interface PlanValue {
  name: string;
  audience: string;
  mealsIncluded: string;
  unitPrice: number;
  weeklyPrice: number;
  sortOrder: number;
  isActive: boolean;
}

export function validatePlan(input: PlanInput): Validation<PlanValue, PlanField> {
  const errors: FieldErrors<PlanField> = {};
  const nameError = checkText(input.name, 'the plan name', { required: true, max: 60 });
  if (nameError) errors.name = nameError;
  const audienceError = checkText(input.audience, 'who it is for', { max: 120 });
  if (audienceError) errors.audience = audienceError;
  const mealsError = checkText(input.mealsIncluded, 'meals included', { max: 200 });
  if (mealsError) errors.mealsIncluded = mealsError;
  const unit = parsePositiveRupees(input.unitPrice);
  if (unit === null) errors.unitPrice = PRICE_ERROR;
  const weekly = parsePositiveRupees(input.weeklyPrice);
  if (weekly === null) errors.weeklyPrice = PRICE_ERROR;
  const order = parseWholeNumber(input.sortOrder);
  if (order === null) errors.sortOrder = 'Enter a whole number, for example 1.';
  if (hasErrors(errors) || unit === null || weekly === null || order === null) return fail(errors);
  return {
    ok: true,
    value: {
      name: input.name.trim(),
      audience: input.audience.trim(),
      mealsIncluded: input.mealsIncluded.trim(),
      unitPrice: unit,
      weeklyPrice: weekly,
      sortOrder: order,
      isActive: input.isActive,
    },
  };
}

export interface PricingRulesInput {
  monthlySavingPercent: string;
  breakfastAddonPrice: string;
  teamDealText: string;
}
export type PricingRulesField = keyof PricingRulesInput;

export function validatePricingRules(
  input: PricingRulesInput,
): Validation<
  { monthlySavingPercent: number; breakfastAddonPrice: number; teamDealText: string },
  PricingRulesField
> {
  const errors: FieldErrors<PricingRulesField> = {};
  const saving = parseWholeNumber(input.monthlySavingPercent);
  if (saving === null || saving > 100)
    errors.monthlySavingPercent = 'Enter a whole number from 0 to 100.';
  const breakfast = parsePositiveRupees(input.breakfastAddonPrice);
  if (breakfast === null) errors.breakfastAddonPrice = PRICE_ERROR;
  const teamError = checkText(input.teamDealText, 'the team deal text', { max: 200 });
  if (teamError) errors.teamDealText = teamError;
  if (hasErrors(errors) || saving === null || breakfast === null) return fail(errors);
  return {
    ok: true,
    value: {
      monthlySavingPercent: saving,
      breakfastAddonPrice: breakfast,
      teamDealText: input.teamDealText.trim(),
    },
  };
}

/** Which price unit label to show in the plan form ("Price per meal" / "Price per day"). */
export function priceUnitLabel(unit: PriceUnit): string {
  return unit === 'per_day' ? 'Price per day (Rs)' : 'Price per meal (Rs)';
}

// ---------- Dishes, add-ons, FAQ (FR-17..19) ----------

export interface DishInput {
  name: string;
  comesWith: string;
  price: string;
  isHidden: boolean;
}
export type DishField = keyof DishInput;

export function validateDish(
  input: DishInput,
): Validation<{ name: string; comesWith: string; price: number; isHidden: boolean }, DishField> {
  const errors: FieldErrors<DishField> = {};
  const nameError = checkText(input.name, 'the dish name', { required: true, max: 80 });
  if (nameError) errors.name = nameError;
  const comesError = checkText(input.comesWith, 'what it comes with', { max: 80 });
  if (comesError) errors.comesWith = comesError;
  const price = parsePositiveRupees(input.price);
  if (price === null) errors.price = PRICE_ERROR;
  if (hasErrors(errors) || price === null) return fail(errors);
  return {
    ok: true,
    value: {
      name: input.name.trim(),
      comesWith: input.comesWith.trim(),
      price,
      isHidden: input.isHidden,
    },
  };
}

export interface AddonInput {
  name: string;
  price: string;
  isHidden: boolean;
}
export type AddonField = keyof AddonInput;

export function validateAddon(
  input: AddonInput,
): Validation<{ name: string; price: number; isHidden: boolean }, AddonField> {
  const errors: FieldErrors<AddonField> = {};
  const nameError = checkText(input.name, 'the add-on name', { required: true, max: 80 });
  if (nameError) errors.name = nameError;
  const price = parsePositiveRupees(input.price);
  if (price === null) errors.price = PRICE_ERROR;
  if (hasErrors(errors) || price === null) return fail(errors);
  return { ok: true, value: { name: input.name.trim(), price, isHidden: input.isHidden } };
}

export interface FaqInput {
  question: string;
  answer: string;
  isHidden: boolean;
}
export type FaqField = keyof FaqInput;

export function validateFaq(
  input: FaqInput,
): Validation<{ question: string; answer: string; isHidden: boolean }, FaqField> {
  const errors: FieldErrors<FaqField> = {};
  const q = checkText(input.question, 'the question', { required: true, max: 200 });
  if (q) errors.question = q;
  const a = checkText(input.answer, 'the answer', { required: true, max: 1000 });
  if (a) errors.answer = a;
  if (hasErrors(errors)) return fail(errors);
  return {
    ok: true,
    value: {
      question: input.question.trim(),
      answer: input.answer.trim(),
      isHidden: input.isHidden,
    },
  };
}

// ---------- Settings (FR-20, FR-27) ----------

export interface SettingsInput {
  businessName: string;
  tagline: string;
  areaServed: string;
  deliveryBoundaryText: string;
  legalNameAndAddress: string;
  /** Comma or new-line separated, for example "JazzCash, Easypaisa, bank transfer". */
  paymentMethods: string;
  whatsappNumber: string;
  instagramHandle: string;
  orderHours: string;
  lastOrderTime: string;
  deliveryAreaText: string;
  deliveryTimes: Record<MealKey, string>;
  skipCutoffs: Record<MealKey, string>;
  skipsPerWeek: string;
  renewalWindowDays: string;
  overdueGraceDays: string;
}

/** Field keys for settings errors: top-level names plus "deliveryTimes.lunch" and "skipCutoffs.lunch". */
export type SettingsField =
  | 'businessName'
  | 'tagline'
  | 'areaServed'
  | 'deliveryBoundaryText'
  | 'legalNameAndAddress'
  | 'paymentMethods'
  | 'whatsappNumber'
  | 'instagramHandle'
  | 'orderHours'
  | 'lastOrderTime'
  | 'deliveryAreaText'
  | `deliveryTimes.${MealKey}`
  | `skipCutoffs.${MealKey}`
  | 'skipsPerWeek'
  | 'renewalWindowDays'
  | 'overdueGraceDays';

export const MEALS: readonly MealKey[] = ['breakfast', 'lunch', 'dinner'];

export const PAYMENT_METHODS_MAX = 8;

/** "JazzCash, Easypaisa\nbank transfer" becomes ["JazzCash", "Easypaisa", "bank transfer"] (empty items dropped). */
export function parsePaymentMethods(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

export function validateSettings(
  input: SettingsInput,
): Validation<
  { site: SiteSettingsDraft; renewalWindowDays: number; overdueGraceDays: number },
  SettingsField
> {
  const errors: FieldErrors<SettingsField> = {};

  const nameError = checkText(input.businessName, 'the business name', { required: true, max: 80 });
  if (nameError) errors.businessName = nameError;
  const taglineError = checkText(input.tagline, 'the tagline', { max: 160 });
  if (taglineError) errors.tagline = taglineError;
  const areaServedError = checkText(input.areaServed, 'the area served', { max: 120 });
  if (areaServedError) errors.areaServed = areaServedError;
  const boundaryError = checkText(input.deliveryBoundaryText, 'the delivery boundary text', {
    max: 300,
  });
  if (boundaryError) errors.deliveryBoundaryText = boundaryError;
  const legalError = checkText(input.legalNameAndAddress, 'the legal name and address', {
    max: 300,
  });
  if (legalError) errors.legalNameAndAddress = legalError;
  const methods = parsePaymentMethods(input.paymentMethods);
  if (methods.length > PAYMENT_METHODS_MAX) {
    errors.paymentMethods = `List at most ${PAYMENT_METHODS_MAX} payment methods.`;
  } else {
    const bad = methods.find((m) => checkText(m, 'a payment method', { max: 40 }) !== null);
    if (bad !== undefined) {
      errors.paymentMethods =
        checkText(bad, 'a payment method', { max: 40 }) ?? 'Check the payment methods.';
    }
  }

  const wa = input.whatsappNumber.trim();
  if (wa !== '' && !/^[1-9]\d{9,14}$/.test(wa)) {
    errors.whatsappNumber =
      'Use digits only with the country code, for example 92XXXXXXXXXX. No plus sign or spaces.';
  }
  const handle = input.instagramHandle.trim();
  if (handle !== '' && !/^[A-Za-z0-9._]{1,30}$/.test(handle)) {
    errors.instagramHandle = 'Letters, numbers, dots and underscores only. Leave out the @.';
  }
  const hoursError = checkText(input.orderHours, 'the order hours', { max: 80 });
  if (hoursError) errors.orderHours = hoursError;
  if (input.lastOrderTime !== '' && !isTime(input.lastOrderTime)) {
    errors.lastOrderTime = 'Enter a time, for example 8:00 PM.';
  }
  const areaError = checkText(input.deliveryAreaText, 'the delivery area text', { max: 300 });
  if (areaError) errors.deliveryAreaText = areaError;
  for (const meal of MEALS) {
    if (!isTime(input.deliveryTimes[meal])) {
      errors[`deliveryTimes.${meal}`] = 'Enter a time, for example 1:00 PM.';
    }
    if (!isTime(input.skipCutoffs[meal])) {
      errors[`skipCutoffs.${meal}`] = 'Enter a time, for example 10:00 AM.';
    }
  }
  const skips = parseWholeNumber(input.skipsPerWeek);
  if (skips === null || skips > 21) errors.skipsPerWeek = 'Enter a whole number from 0 to 21.';
  const renewal = parseWholeNumber(input.renewalWindowDays);
  if (renewal === null || renewal > 60)
    errors.renewalWindowDays = 'Enter a whole number of days, 0 to 60.';
  const grace = parseWholeNumber(input.overdueGraceDays);
  if (grace === null || grace > 30)
    errors.overdueGraceDays = 'Enter a whole number of days, 0 to 30.';

  if (hasErrors(errors) || skips === null || renewal === null || grace === null)
    return fail(errors);
  return {
    ok: true,
    value: {
      site: {
        businessName: input.businessName.trim(),
        tagline: input.tagline.trim(),
        areaServed: input.areaServed.trim(),
        deliveryBoundaryText: input.deliveryBoundaryText.trim(),
        legalNameAndAddress: input.legalNameAndAddress.trim(),
        paymentMethods: methods,
        whatsappNumber: wa,
        instagramHandle: handle,
        orderHours: input.orderHours.trim(),
        lastOrderTime: input.lastOrderTime,
        deliveryAreaText: input.deliveryAreaText.trim(),
        deliveryTimes: { ...input.deliveryTimes },
        skipCutoffs: { ...input.skipCutoffs },
        skipsPerWeek: skips,
      },
      renewalWindowDays: renewal,
      overdueGraceDays: grace,
    },
  };
}

export interface PasswordInput {
  current: string;
  next: string;
  repeat: string;
}
export type PasswordField = keyof PasswordInput;
export const MIN_PASSWORD_LENGTH = 12;

/** FR-13: change needs the current password; the new one must be long enough and typed twice. Values are never stored. */
export function validatePasswordChange(input: PasswordInput): FieldErrors<PasswordField> {
  const errors: FieldErrors<PasswordField> = {};
  if (input.current === '') errors.current = 'Enter your current password.';
  if (input.next.length < MIN_PASSWORD_LENGTH) {
    errors.next = `The new password needs at least ${MIN_PASSWORD_LENGTH} characters.`;
  } else if (input.next === input.current) {
    errors.next = 'Choose a password that is different from the current one.';
  }
  if (input.repeat !== input.next) errors.repeat = 'The two new passwords do not match.';
  return errors;
}

// ---------- Menu (FR-14, FR-15) ----------

export const MENU_SLOT_MAX = 120;
export const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export function slotKey(slot: Pick<MenuSlot, 'day' | 'meal'>): string {
  return `${slot.day}-${slot.meal}`;
}

/** Per-slot errors keyed "day-meal". An empty slot that is not marked "Not served" is ambiguous and refused (FR-14 AC 2). */
export function validateMenuSlots(slots: readonly MenuSlot[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const slot of slots) {
    if (slot.notServed) continue;
    const text = slot.dishText.trim();
    const dayName = DAY_NAMES[slot.day] ?? `Day ${slot.day + 1}`;
    if (text === '') {
      errors[slotKey(slot)] = `${dayName} ${slot.meal}: enter the dish or tick Not served.`;
    } else if (/[<>]/.test(text)) {
      errors[slotKey(slot)] = `${dayName} ${slot.meal}: remove < and > (plain text only).`;
    } else if (text.length > MENU_SLOT_MAX) {
      errors[slotKey(slot)] =
        `${dayName} ${slot.meal}: too long (max ${MENU_SLOT_MAX} characters). Remove extra text.`;
    }
  }
  return errors;
}

/** Go-live must be a valid future time (FR-15). Returns an error message or null. */
export function validateGoLive(date: string, time: string, nowIso: string): string | null {
  if (!isIsoDate(date)) return 'Choose the go-live date.';
  if (!isTime(time)) return 'Choose the go-live time.';
  const at = Date.parse(`${date}T${time}:00+05:00`);
  if (Number.isNaN(at) || at <= Date.parse(nowIso)) {
    return 'Choose a time in the future, or use Publish now.';
  }
  return null;
}

// ---------- Media (FR-21) ----------

export const MEDIA_MAX_BYTES = 8 * 1024 * 1024;
export const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export interface MediaFileInfo {
  name: string;
  type: string;
  size: number;
}

/** File-level errors for an upload; each one is shown and nothing is stored (FR-21 AC 2). */
export function validateMediaFile(file: MediaFileInfo | null): string[] {
  if (file === null) return ['Choose a photo to upload.'];
  const errors: string[] = [];
  if (!(MEDIA_TYPES as readonly string[]).includes(file.type)) {
    errors.push(`${file.name} is not supported. Use JPG, PNG or WebP. (Nothing was saved.)`);
  }
  if (file.size > MEDIA_MAX_BYTES) {
    const mb = Math.ceil(file.size / (1024 * 1024));
    errors.push(`${file.name} is ${mb} MB. The limit is 8 MB. (Nothing was saved.)`);
  }
  return errors;
}

export function validateAltText(alt: string): string | null {
  return checkText(alt, 'the alt text', { required: true, max: 200 });
}
