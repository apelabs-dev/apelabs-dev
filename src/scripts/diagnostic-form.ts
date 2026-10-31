// Progressive enhancement for the diagnostic form. Without this script the form still posts natively
// and the server answers with a page. With it: inline errors, Turnstile loaded only when the form is
// near the viewport or focused, a JSON post, and the deck's confirmation shown in place.
import { isEmail } from '../lib/email';

interface Turnstile {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  reset(id?: string): void;
  getResponse(id?: string): string | undefined;
}
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
type FieldName = 'name' | 'email' | 'business' | 'tools' | 'problem';
type FieldError = 'required' | 'email';
type FormError = 'spam' | 'send';
const FIELDS: FieldName[] = ['name', 'email', 'business', 'tools', 'problem'];

let turnstileLoad: Promise<Turnstile> | null = null;
function loadTurnstile(): Promise<Turnstile> {
  turnstileLoad ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TURNSTILE_SRC;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('no turnstile')));
    s.onerror = () => reject(new Error('turnstile failed to load'));
    document.head.append(s);
  });
  return turnstileLoad;
}

function enhance(form: HTMLFormElement) {
  const shell = form.closest<HTMLElement>('[data-form-shell]')!;
  const confirm = shell.querySelector<HTMLElement>('[data-confirm]')!;
  const submit = form.querySelector<HTMLButtonElement>('[data-submit]')!;
  const slot = form.querySelector<HTMLElement>('[data-turnstile-slot]')!;
  const siteKey = form.dataset.siteKey ?? '';
  const formErrors = {
    spam: form.querySelector<HTMLElement>('[data-form-error="spam"]')!,
    send: form.querySelector<HTMLElement>('[data-form-error="send"]')!,
  };
  form.noValidate = true;

  const value = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | null)?.value.trim() ?? '';
  const toolsChecked = () => form.querySelectorAll('input[name="tools"]:checked').length > 0 || value('tools_other') !== '';

  function check(field: FieldName): FieldError | null {
    if (field === 'tools') return toolsChecked() ? null : 'required';
    const v = value(field);
    if (!v) return 'required';
    if (field === 'email' && !isEmail(v)) return 'email';
    return null;
  }

  function errorId(field: FieldName, code: FieldError) {
    return code === 'email' ? 'f-email-invalid' : `f-${field}-required`;
  }

  /** Show one field's error (or clear it). Only visible errors are referenced by aria-describedby. */
  function setFieldError(field: FieldName, code: FieldError | null) {
    const wrap = form.querySelector<HTMLElement>(`[data-field="${field}"]`)!;
    wrap.querySelectorAll<HTMLElement>('.error').forEach((p) => (p.hidden = p.id !== (code && errorId(field, code))));
    if (field === 'tools') {
      if (code) wrap.setAttribute('aria-describedby', errorId(field, code));
      else wrap.removeAttribute('aria-describedby');
      return;
    }
    const input = wrap.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#f-${field}`)!;
    const help = `f-${field}-help`;
    if (code) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', `${help} ${errorId(field, code)}`);
    } else {
      input.removeAttribute('aria-invalid');
      input.setAttribute('aria-describedby', help);
    }
  }

  function focusField(field: FieldName) {
    const target =
      field === 'tools'
        ? form.querySelector<HTMLInputElement>('input[name="tools"]')
        : form.querySelector<HTMLInputElement>(`#f-${field}`);
    target?.focus();
  }

  function showFormError(which: FormError | null) {
    formErrors.spam.hidden = which !== 'spam' && !!siteKey;
    formErrors.send.hidden = which !== 'send';
    if (which) {
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
      formErrors[which].scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
    }
  }

  function applyFieldErrors(errors: Partial<Record<FieldName, FieldError>>) {
    for (const f of FIELDS) setFieldError(f, errors[f] ?? null);
    const first = FIELDS.find((f) => errors[f]);
    if (first) focusField(first);
    return !!first;
  }

  // Clear an error as soon as the field becomes valid; never add errors while typing.
  form.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    const field = (el.closest<HTMLElement>('[data-field]')?.dataset.field ?? '') as FieldName;
    if (!FIELDS.includes(field)) return;
    const shown = form.querySelector(`[data-field="${field}"] .error:not([hidden])`);
    if (shown && !check(field)) setFieldError(field, null);
  });

  // Turnstile: load on approach or first focus, never at page load.
  let widgetId: string | undefined;
  let started = false;
  const start = () => {
    if (started || !siteKey) return;
    started = true;
    io?.disconnect();
    loadTurnstile()
      .then((ts) => {
        widgetId = ts.render(slot, {
          sitekey: siteKey,
          theme: 'dark',
          size: 'flexible',
          'error-callback': () => showFormError('spam'),
          'expired-callback': () => ts.reset(widgetId),
        });
      })
      .catch(() => showFormError('spam'));
  };
  const io =
    siteKey && 'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && start(), {
          rootMargin: '600px 0px',
        })
      : null;
  io?.observe(form);
  form.addEventListener('focusin', start, { once: true });

  async function token(timeoutMs = 8000): Promise<string> {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      const t = window.turnstile?.getResponse(widgetId);
      if (t) return t;
      await new Promise((r) => setTimeout(r, 250));
    }
    return '';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submit.disabled) return;
    showFormError(null);
    const errors: Partial<Record<FieldName, FieldError>> = {};
    for (const f of FIELDS) {
      const code = check(f);
      if (code) errors[f] = code;
    }
    if (applyFieldErrors(errors)) return;
    if (!siteKey) return showFormError('spam');

    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    let done = false;
    try {
      start();
      if (!(await token())) return showFormError('spam');
      const body = new URLSearchParams(new FormData(form) as unknown as Record<string, string>);
      const res = await fetch(form.action, { method: 'POST', body, headers: { Accept: 'application/json' } });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        fields?: Partial<Record<FieldName, FieldError>>;
        error?: FormError;
      };
      if (data.ok) {
        done = true;
        form.hidden = true;
        confirm.hidden = false;
        confirm.focus();
      } else if (data.fields) {
        applyFieldErrors(data.fields);
      } else {
        showFormError(data.error === 'spam' ? 'spam' : 'send');
      }
    } catch {
      showFormError('send');
    } finally {
      submit.disabled = false;
      submit.removeAttribute('aria-busy');
      // Turnstile tokens are single use.
      if (!done && widgetId !== undefined) window.turnstile?.reset(widgetId);
    }
  });
}

document.querySelectorAll<HTMLFormElement>('form[data-diagnostic-form]').forEach(enhance);
