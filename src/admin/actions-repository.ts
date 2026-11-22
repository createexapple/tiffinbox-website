/**
 * The real `AdminRepository`: every method calls a Supabase-backed server action (src/admin/server/*, grouped as in
 * architecture sec. 4). It runs in the browser but holds no Supabase client, key or token: the browser only sends
 * action requests to this app, and each action re-checks the admin session on the server before it touches data.
 *
 * Failures arrive as plain results (Next.js hides thrown messages in production) and are turned back into
 * `RepoError` here, which is what the screens already handle. A lost or expired session sends the browser to the
 * login page (`?reason=expired`).
 */
import { RepoError, type AdminRepository, type OrderedCollection } from './repository';
import type { ActionResult } from './server/result';
import { changePasswordAction, getSessionAction, signInAction, signOutAction } from './server/auth';
import {
  getPricingRulesAction,
  getSettingsAction,
  listAddonsAction,
  listDishesAction,
  listFaqAction,
  listPlansAction,
  moveAddonAction,
  moveDishAction,
  moveFaqAction,
  removeAddonAction,
  removeDishAction,
  removeFaqAction,
  saveAddonAction,
  saveDishAction,
  saveFaqAction,
  savePlansAction,
  savePricingRulesAction,
  saveSettingsAction,
} from './server/content';
import {
  archiveCustomerAction,
  createCustomerAction,
  findDuplicatePhoneAction,
  getCustomerDetailAction,
  listCustomersAction,
  restoreCustomerAction,
  updateCustomerAction,
} from './server/customers';
import {
  deleteMediaAction,
  listMediaAction,
  setPageImageAction,
  uploadMediaAction,
} from './server/media';
import {
  cancelMenuScheduleAction,
  copyMenuWeekAction,
  listMenuWeeksAction,
  publishMenuNowAction,
  saveMenuWeekAction,
  scheduleMenuWeekAction,
} from './server/menu';
import { getClockAction, getOverviewAction } from './server/overview';
import {
  createPaymentAction,
  findDuplicateReferenceAction,
  getPaymentAction,
  listDuesAction,
  listPaymentsAction,
  updatePaymentAction,
  voidPaymentAction,
} from './server/payments';
import {
  getPublishOverviewAction,
  listAuditAction,
  publishAction,
  rollbackAction,
} from './server/publishing';
import {
  createSubscriptionAction,
  findOverlapAction,
  getSubscriptionAction,
  updateSubscriptionAction,
} from './server/subscriptions';

const UNREACHABLE = 'The server could not be reached. Check your connection and try again.';

export const LOGIN_EXPIRED_URL = '/admin/login?reason=expired';

/** Unwraps an action result; throws `RepoError` for failures. Exported for unit tests. */
export async function unwrapResult<T>(
  call: Promise<ActionResult<T>>,
  onSignedOut: () => void = () => {
    // A full page load on purpose: it drops all client state of the expired session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (typeof window !== 'undefined') window.location.assign(LOGIN_EXPIRED_URL);
  },
): Promise<T> {
  let result: ActionResult<T>;
  try {
    result = await call;
  } catch {
    // Network failure, or the proxy answered a signed-out action with something that is not an action response.
    throw new RepoError('load_failed', UNREACHABLE);
  }
  if (result.ok) return result.data;
  if (result.error.code === 'unauthenticated') {
    onSignedOut();
    throw new RepoError('unauthenticated', result.error.message);
  }
  throw new RepoError(result.error.code, result.error.message, result.error.fields);
}

export class ActionsAdminRepository implements AdminRepository {
  private version = 0;
  private listeners = new Set<() => void>();

  // ---------- external store plumbing (React useSyncExternalStore), as the mock does ----------
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getVersion = (): number => this.version;
  private touch(): void {
    this.version += 1;
    this.listeners.forEach((l) => l());
  }

  private read = <T>(call: Promise<ActionResult<T>>): Promise<T> => unwrapResult(call);
  /** A write: on success every mounted query re-reads. */
  private write = async <T>(call: Promise<ActionResult<T>>): Promise<T> => {
    const data = await unwrapResult(call);
    this.touch();
    return data;
  };

  private collection<Row extends { id: string }, Values>(actions: {
    list: () => Promise<ActionResult<Row[]>>;
    save: (id: string | null, values: Values) => Promise<ActionResult<Row>>;
    remove: (id: string) => Promise<ActionResult<void>>;
    move: (
      id: string,
      direction: 'up' | 'down',
    ) => Promise<ActionResult<{ position: number; total: number }>>;
  }): OrderedCollection<Row, Values> {
    return {
      list: () => this.read(actions.list()),
      save: (id, values) => this.write(actions.save(id, values)),
      remove: async (id) => {
        await this.write(actions.remove(id));
      },
      move: (id, direction) => this.write(actions.move(id, direction)),
    };
  }

  // ---------- session ----------
  getToday = async () => (await this.read(getClockAction())).today;
  getNow = async () => (await this.read(getClockAction())).now;
  getSession = () => this.read(getSessionAction());
  signIn = async (email: string, password: string) => {
    await this.read(signInAction(email, password));
  };
  signOut = async () => {
    await this.read(signOutAction());
  };
  changePassword = async (current: string, next: string, repeat: string) => {
    await this.read(changePasswordAction(current, next, repeat));
  };

  // ---------- website content ----------
  getSettings = () => this.read(getSettingsAction());
  saveSettings: AdminRepository['saveSettings'] = async (site, ops) => {
    await this.write(saveSettingsAction(site, ops));
  };
  listPlans = () => this.read(listPlansAction());
  savePlans: AdminRepository['savePlans'] = async (values, mostPopularId) => {
    await this.write(savePlansAction(values, mostPopularId));
  };
  getPricingRules = () => this.read(getPricingRulesAction());
  savePricingRules: AdminRepository['savePricingRules'] = async (rules) => {
    await this.write(savePricingRulesAction(rules));
  };
  dishes = this.collection({
    list: listDishesAction,
    save: saveDishAction,
    remove: removeDishAction,
    move: moveDishAction,
  });
  addons = this.collection({
    list: listAddonsAction,
    save: saveAddonAction,
    remove: removeAddonAction,
    move: moveAddonAction,
  });
  faq = this.collection({
    list: listFaqAction,
    save: saveFaqAction,
    remove: removeFaqAction,
    move: moveFaqAction,
  });

  listMedia = () => this.read(listMediaAction());
  uploadMedia: AdminRepository['uploadMedia'] = (file, altText) => {
    const form = new FormData();
    form.set('file', file);
    form.set('alt', altText);
    return this.write(uploadMediaAction(form));
  };
  deleteMedia = async (id: string) => {
    await this.write(deleteMediaAction(id));
  };
  setPageImage: AdminRepository['setPageImage'] = async (slot, mediaId) => {
    await this.write(setPageImageAction(slot, mediaId));
  };

  // ---------- menu ----------
  listMenuWeeks = () => this.read(listMenuWeeksAction());
  saveMenuWeek: AdminRepository['saveMenuWeek'] = (weekStart, slots) =>
    this.write(saveMenuWeekAction(weekStart, slots));
  copyMenuWeek: AdminRepository['copyMenuWeek'] = (from, to) =>
    this.write(copyMenuWeekAction(from, to));
  scheduleMenuWeek: AdminRepository['scheduleMenuWeek'] = (weekStart, goLiveAt) =>
    this.write(scheduleMenuWeekAction(weekStart, goLiveAt));
  cancelMenuSchedule: AdminRepository['cancelMenuSchedule'] = (weekStart) =>
    this.write(cancelMenuScheduleAction(weekStart));
  publishMenuNow: AdminRepository['publishMenuNow'] = (weekStart) =>
    this.write(publishMenuNowAction(weekStart));

  // ---------- publish ----------
  getPublishOverview = () => this.read(getPublishOverviewAction());
  publish = () => this.write(publishAction());
  rollback = async (version: number) => {
    await this.write(rollbackAction(version));
  };

  // ---------- history ----------
  listAudit: AdminRepository['listAudit'] = (filter) => this.read(listAuditAction(filter));

  // ---------- customers ----------
  getOverview = () => this.read(getOverviewAction());
  listCustomers: AdminRepository['listCustomers'] = (filter) =>
    this.read(listCustomersAction(filter));
  getCustomerDetail = (id: string) => this.read(getCustomerDetailAction(id));
  createCustomer: AdminRepository['createCustomer'] = (values) =>
    this.write(createCustomerAction(values));
  updateCustomer: AdminRepository['updateCustomer'] = (id, values) =>
    this.write(updateCustomerAction(id, values));
  archiveCustomer = async (id: string) => {
    await this.write(archiveCustomerAction(id));
  };
  restoreCustomer = async (id: string) => {
    await this.write(restoreCustomerAction(id));
  };
  findDuplicatePhone: AdminRepository['findDuplicatePhone'] = (phone, exclude) =>
    this.read(findDuplicatePhoneAction(phone, exclude));

  // ---------- subscriptions ----------
  getSubscription = (id: string) => this.read(getSubscriptionAction(id));
  createSubscription: AdminRepository['createSubscription'] = (customerId, value, renewedFromId) =>
    this.write(createSubscriptionAction(customerId, value, renewedFromId));
  updateSubscription: AdminRepository['updateSubscription'] = (id, value) =>
    this.write(updateSubscriptionAction(id, value));
  findOverlap: AdminRepository['findOverlap'] = (customerId, start, end, exclude) =>
    this.read(findOverlapAction(customerId, start, end, exclude));

  // ---------- payments ----------
  listDues: AdminRepository['listDues'] = (filter) => this.read(listDuesAction(filter));
  listPayments: AdminRepository['listPayments'] = (filter) => this.read(listPaymentsAction(filter));
  getPayment = (id: string) => this.read(getPaymentAction(id));
  createPayment: AdminRepository['createPayment'] = (customerId, value) =>
    this.write(createPaymentAction(customerId, value));
  updatePayment: AdminRepository['updatePayment'] = (id, value) =>
    this.write(updatePaymentAction(id, value));
  voidPayment: AdminRepository['voidPayment'] = (id, reason) =>
    this.write(voidPaymentAction(id, reason));
  findDuplicateReference: AdminRepository['findDuplicateReference'] = (
    method,
    reference,
    exclude,
  ) => this.read(findDuplicateReferenceAction(method, reference, exclude));
}
