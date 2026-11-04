// No-JS error states for /diagnostic/. A native form post that fails comes back as
// /diagnostic/?error=…; this reveals the matching pre-rendered messages in the static page and wires
// aria-invalid / aria-describedby. Only whitelisted codes are read (errorsFromQuery) and nothing from
// the query is ever written into the page, so no submitted text can be echoed.
import { errorsFromQuery, FORM_PATH } from '../../src/lib/intake.ts';

interface Element {
  removeAttribute(name: string): Element;
  setAttribute(name: string, value: string): Element;
}
declare class HTMLRewriter {
  on(selector: string, handlers: { element(el: Element): void }): HTMLRewriter;
  transform(response: Response): Response;
}

interface Context {
  request: Request;
  next(): Promise<Response>;
}

export const onRequestGet = async ({ request, next }: Context): Promise<Response> => {
  const url = new URL(request.url);
  const response = await next();
  if (url.pathname !== FORM_PATH || !url.searchParams.has('error')) return response;
  if (!(response.headers.get('Content-Type') ?? '').includes('text/html')) return response;

  const { form, fields } = errorsFromQuery(url.searchParams);
  let rewriter = new HTMLRewriter();
  const unhide = { element: (el: Element) => void el.removeAttribute('hidden') };

  if (form) rewriter = rewriter.on(`[data-form-error="${form}"]`, unhide);
  for (const [field, code] of Object.entries(fields)) {
    const errorId = code === 'email' ? 'f-email-invalid' : `f-${field}-required`;
    rewriter = rewriter.on(`#${errorId}`, unhide);
    if (field === 'tools') {
      rewriter = rewriter.on('fieldset[data-field="tools"]', {
        element: (el) => void el.setAttribute('aria-describedby', errorId),
      });
    } else {
      rewriter = rewriter.on(`#f-${field}`, {
        element: (el) => {
          el.setAttribute('aria-invalid', 'true');
          el.setAttribute('aria-describedby', `f-${field}-help ${errorId}`);
        },
      });
    }
  }

  const out = rewriter.transform(response);
  const headers = new Headers(out.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(out.body, { status: out.status, headers });
};
