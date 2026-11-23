import { cookies, draftMode } from 'next/headers';
import { redirect } from 'next/navigation';
import { PREVIEW_WEEK_COOKIE } from '@/content/reader';
import { getAdmin } from '@/lib/auth/session';

/**
 * Turns the framework's draft mode on or off for the signed-in admin (FR-22, architecture sec. 8.2).
 *   GET /admin/preview?to=/menu[&week=<menu week uuid>]   enable, then go to a public page
 *   GET /admin/preview?disable=1[&to=/admin/publish]      disable
 * The draft-mode cookie alone gives nothing: the draft data is fetched with the admin's own session and the
 * database refuses anyone else. `to` must be one of a fixed list of local paths (no open redirect).
 */
export const dynamic = 'force-dynamic';

const PUBLIC_TARGETS = ['/', '/menu', '/plans', '/customize', '/about', '/how-it-works'];
const ADMIN_TARGETS = ['/admin/publish', '/admin/menu'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const to = params.get('to') ?? '';
  const mode = await draftMode();
  const store = await cookies();

  if (params.get('disable') === '1') {
    mode.disable();
    store.delete(PREVIEW_WEEK_COOKIE);
    redirect(ADMIN_TARGETS.includes(to) ? to : '/admin/publish');
  }

  if (!(await getAdmin())) redirect('/admin/login');

  const week = params.get('week') ?? '';
  mode.enable();
  if (UUID.test(week)) {
    store.set(PREVIEW_WEEK_COOKIE, week, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60,
    });
  } else {
    store.delete(PREVIEW_WEEK_COOKIE);
  }
  redirect(PUBLIC_TARGETS.includes(to) ? to : '/');
}
