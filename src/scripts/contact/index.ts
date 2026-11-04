import { reducedMotion } from '../lib/island';
import { isEmail } from '../../lib/email';
import { FORM_ERRORS } from '../../lib/copy';

type Widget = {
  render(slot: HTMLElement, options: Record<string, unknown>): string;
  reset(id: string): void;
  getResponse(id: string): string | undefined;
};
const widgetWindow = window as typeof window & { turnstile?: Widget };
const SOURCE = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading: Promise<Widget> | undefined;
function loadWidget() {
  if (widgetWindow.turnstile) return Promise.resolve(widgetWindow.turnstile);
  loading ??= new Promise<Widget>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SOURCE;
    script.async = true;
    script.onload = () => widgetWindow.turnstile ? resolve(widgetWindow.turnstile) : reject(new Error('Spam check unavailable'));
    script.onerror = () => reject(new Error('Spam check unavailable'));
    document.head.append(script);
  }).catch((error) => { loading = undefined; throw error; });
  return loading;
}

type Field = 'email' | 'business' | 'tools' | 'problem';
const FIELDS: Field[] = ['email', 'business', 'tools', 'problem'];
export function init(root: Element): void {
  const section = root as HTMLElement;
  if (section.dataset.step) return;
  const query = <T extends HTMLElement>(selector: string) => section.querySelector<T>(selector)!;
  const form = query<HTMLFormElement>('[data-contact-form]');
  const well = query<HTMLFormElement>('[data-email-well]');
  const email = query<HTMLInputElement>('#contact-start-email');
  const full = query<HTMLElement>('[data-full]');
  const panel = query<HTMLElement>('[data-panel]');
  const confirm = query<HTMLElement>('[data-confirm]');
  const send = query<HTMLButtonElement>('[data-send]');
  const sendLabel = query<HTMLElement>('[data-send-label]');
  const key = form.dataset.siteKey ?? '';
  const control = (name: string) => form.elements.namedItem(name) as HTMLInputElement;
  const value = (name: string) => control(name).value.trim();
  control('name').disabled = false;
  form.noValidate = true;
  full.hidden = true;
  well.hidden = false;
  section.dataset.step = 'well';
  let tried = false;
  let busy = false;
  let widgetId: string | undefined;
  let starting: Promise<void> | undefined;
  let widgetFailed = false;
  let motion: Animation | undefined;

  function change(step: 'form' | 'done', update: () => void) {
    motion?.cancel();
    const before = panel.getBoundingClientRect();
    update();
    section.dataset.step = step;
    if (reducedMotion()) return;
    const after = panel.getBoundingClientRect();
    motion = panel.animate([
      { width: `${before.width}px`, height: `${before.height}px` },
      { width: `${after.width}px`, height: `${after.height}px` },
    ], { duration: 620, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
  }
  function showError(which: 'spam' | 'send' | null) {
    for (const code of ['spam', 'send']) query<HTMLElement>(`[data-form-error="${code}"]`).hidden = code !== which;
  }
  function start(): Promise<void> {
    if (!key) { showError('spam'); return Promise.resolve(); }
    if (widgetId !== undefined) return Promise.resolve();
    starting ??= loadWidget().then((widget) => {
      widgetFailed = false;
      widgetId = widget.render(query('[data-turnstile-slot]'), {
        sitekey: key, theme: 'dark', size: 'flexible',
        callback: () => { widgetFailed = false; query('[data-form-error="spam"]').hidden = true; },
        'error-callback': () => { widgetFailed = true; showError('spam'); },
        'expired-callback': () => { if (widgetId !== undefined) widget.reset(widgetId); },
      });
    }).catch(() => { widgetFailed = true; showError('spam'); }).finally(() => { starting = undefined; });
    return starting;
  }
  const check = (field: Field): 'required' | 'email' | null => {
    if (field === 'tools') return form.querySelector('input[name="tools"]:checked') || value('tools_other') ? null : 'required';
    if (!value(field)) return 'required';
    return field === 'email' && !isEmail(value(field)) ? 'email' : null;
  };
  function fieldError(field: Field, error: 'required' | 'email' | null) {
    const message = query<HTMLElement>(`#contact-${field}-error`);
    message.textContent = error ? FORM_ERRORS[error] : '';
    message.hidden = !error;
    const targets = field === 'tools' ? form.querySelectorAll('input[name="tools"]') : [control(field)];
    for (const target of targets) {
      if (error) target.setAttribute('aria-invalid', 'true');
      else target.removeAttribute('aria-invalid');
    }
    query(`[data-field="${field}"]`).setAttribute('aria-invalid', String(!!error));
  }
  function focusField(field: Field) {
    (field === 'tools' ? form.querySelector<HTMLInputElement>('input[name="tools"]') : control(field))?.focus();
  }
  well.addEventListener('submit', (event) => {
    event.preventDefault();
    const error = !email.value.trim() ? 'required' : !isEmail(email.value.trim()) ? 'email' : null;
    const message = query<HTMLElement>('#contact-start-error');
    message.textContent = error ? FORM_ERRORS[error] : '';
    message.hidden = !error;
    if (error) { email.setAttribute('aria-invalid', 'true'); email.focus(); return; }
    email.removeAttribute('aria-invalid');
    control('email').value = email.value.trim();
    change('form', () => { well.hidden = true; full.hidden = false; });
    well.querySelector('button')!.setAttribute('aria-expanded', 'true');
    control('name').focus({ preventScroll: true });
    void start();
  });
  email.addEventListener('input', () => {
    if (isEmail(email.value.trim())) { email.removeAttribute('aria-invalid'); query('#contact-start-error').hidden = true; }
  });
  form.addEventListener('input', (event) => {
    if (!tried) return;
    const field = (event.target as HTMLElement).closest<HTMLElement>('[data-field]')?.dataset.field as Field;
    if (FIELDS.includes(field)) fieldError(field, check(field));
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    tried = true;
    showError(null);
    let first: Field | undefined;
    for (const field of FIELDS) { const error = check(field); fieldError(field, error); if (error) first ??= field; }
    if (first) { focusField(first); return; }
    if (!key) { showError('spam'); return; }
    busy = true;
    send.disabled = true;
    form.setAttribute('aria-busy', 'true');
    sendLabel.textContent = 'Sending…';
    let done = false;
    try {
      await start();
      const deadline = Date.now() + 8000;
      let token = '';
      while (!widgetFailed && widgetId !== undefined && Date.now() < deadline) {
        token = widgetWindow.turnstile?.getResponse(widgetId) ?? '';
        if (token) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      if (!token) { showError('spam'); return; }
      const body = new URLSearchParams();
      for (const [name, entry] of new FormData(form)) if (typeof entry === 'string') body.append(name, entry);
      body.set('name', value('name') || '(not provided)');
      body.set('cf-turnstile-response', token);
      const response = await fetch(form.action, { method: 'POST', body, headers: { Accept: 'application/json' } });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.ok === true) {
        done = true;
        change('done', () => { form.hidden = true; confirm.hidden = false; });
        confirm.focus();
      } else if (data?.fields && typeof data.fields === 'object') {
        let invalid: Field | undefined;
        for (const field of FIELDS) {
          const code = data.fields[field];
          if (code === 'required' || code === 'email') { fieldError(field, code); invalid ??= field; }
        }
        if (invalid) focusField(invalid); else showError('send');
      } else showError(data?.error === 'spam' ? 'spam' : 'send');
    } catch { showError('send'); }
    finally {
      busy = false;
      send.disabled = false;
      form.removeAttribute('aria-busy');
      sendLabel.textContent = 'Send my request';
      if (!done && widgetId !== undefined) widgetWindow.turnstile?.reset(widgetId);
    }
  });
}
