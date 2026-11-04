// Journey board: the business's own tools as product UI (a quote form, the CRM's lead list, the owner's phone).
//
// The rest state of every scene is CSS (Journey.astro, keyed off the section's data-scene). This renderer only
// plays the moment that leads into a scene: the lead being sent, the packet that dies on the wire, the
// reconnect, the three test leads. It drives GSAP timelines and short-lived `u-*` classes on the view; when a
// timeline ends or is cut short, every class and inline style it set is removed, so the CSS rest state is always
// what's left. With reduced motion it does nothing at all and the rest states show directly.

import type { Renderer } from './engine';

type Gsap = typeof import('gsap').gsap;
type Timeline = ReturnType<Gsap['timeline']>;
type Target = Element | null | undefined;

const FLAGS = ['u-sending', 'u-no-toast', 'u-no-row', 'u-no-note', 'u-no-skel', 'u-wire-live', 'u-connecting', 'u-no-bf', 'u-tog-off', 'u-no-tests', 'u-no-cards'];
const CLEAR = 'transform,opacity,visibility,display,height,backgroundColor,borderColor,color';
const EASE = 'expo.out';

export interface Ui extends Renderer {
  destroy(): void;
}

export function createUi(view: HTMLElement, { gsap, reduced }: { gsap: Gsap; reduced: boolean }): Ui {
  const motion = !reduced;
  const $ = <T extends Element = HTMLElement>(s: string) => view.querySelector<T>(s);
  const $$ = <T extends Element = HTMLElement>(s: string) => [...view.querySelectorAll<T>(s)];

  const el = {
    send: $('.ui-send'),
    toast: $('.ui-toast'),
    hop1: $('.ui-hop-1')!,
    hop2: $('.ui-hop-2')!,
    pk1: $$('.ui-hop-1 .ui-pk'),
    pk2: $$('.ui-hop-2 .ui-pk'),
    alex: $('.ui-r-alex'),
    skel: $('.ui-r-skel'),
    noteAlex: $('.ui-n-alex'),
    noteFix: $('.ui-n-fix'),
    phone: $('.ui-phone'),
    int: $('.ui-int'),
    bf: $$('.ui-r-bf'),
    tests: $$('.ui-r-test'), // newest first in the DOM
    testNotes: $$('.ui-n-test'),
    logRows: $$('.jx-card-log .jx-log li'),
    noteRows: $$('.jx-card-note .jx-card-title, .jx-card-note .jx-card-dl > div'),
    approve: $('.jx-approve'),
    check: $('.jx-card-check'),
    checkRows: $$('.jx-card-check .jx-tests li'),
    ticks: $$('.jx-card-check .jx-ticks i'),
    readout: $('.ui-ro-v'),
  };

  let tl: Timeline | null = null;
  let touched = new Set<Element>();
  let paused = false;
  let greeted = false; // the first time the board is seen at step 0, one lead flows through
  let scene: string | null = null;

  const flag = (name: string, on: boolean) => view.classList.toggle(name, on);
  const T = (targets: Target | Target[]) => {
    [targets].flat().forEach((t) => t && touched.add(t));
    return targets;
  };

  function settle(): void {
    if (tl) {
      tl.kill();
      tl = null;
    }
    FLAGS.forEach((f) => view.classList.remove(f));
    el.approve?.classList.remove('is-pending');
    touched.forEach((t) => t.classList.remove('is-dead', 'is-lit'));
    if (touched.size) gsap.set([...touched], { clearProps: CLEAR });
    touched = new Set();
  }

  function timeline(): Timeline {
    settle();
    tl = gsap.timeline({ paused, onComplete: settle });
    return tl;
  }

  // A packet runs a hop: along x for the webhook, along y for the push.
  function packet(
    t: Timeline,
    at: number,
    pk: HTMLElement | undefined,
    hop: HTMLElement,
    { to = 1, white = false, dur = 0.5, die = false } = {},
  ): void {
    if (!pk) return;
    T(pk);
    const axis = hop.clientWidth > hop.clientHeight ? 'x' : 'y';
    const len = () => (axis === 'x' ? hop.clientWidth : hop.clientHeight);
    t.call(() => pk.classList.toggle('is-white', white), undefined, at);
    t.fromTo(pk, { [axis]: 0, opacity: 1 }, { [axis]: () => len() * to, duration: dur, ease: 'power2.inOut', immediateRender: false }, at);
    if (die) {
      // The packet greys out (CSS: .is-dead, a 120 ms colour transition), then falls off the wire.
      t.call(() => pk.classList.add('is-dead'), undefined, at + dur);
      t.to(pk, { [axis === 'x' ? 'y' : 'x']: 14, rotation: 35, opacity: 0, duration: 0.5, ease: 'power2.in' }, at + dur + 0.25);
    } else {
      t.to(pk, { opacity: 0, duration: 0.15 }, at + dur);
    }
    t.call(() => pk.classList.remove('is-white', 'is-dead'), undefined, at + dur + 0.8);
  }

  function press(t: Timeline, at: number): void {
    if (!el.send) return;
    T(el.send);
    t.to(el.send, { scale: 0.97, duration: 0.08, ease: 'power1.out' }, at).to(el.send, { scale: 1, duration: 0.3, ease: EASE }, at + 0.08);
  }

  function buzz(t: Timeline, at: number): void {
    if (!el.phone) return;
    T(el.phone);
    t.fromTo(el.phone, { x: -2 }, { x: 2, duration: 0.05, repeat: 7, yoyo: true, ease: 'none', immediateRender: false }, at).to(
      el.phone,
      { x: 0, duration: 0.05 },
      at + 0.4,
    );
  }

  // The readout ("Owner sees …") changes only once the outcome is in.
  function verdict(t: Timeline, at: number): void {
    if (!el.readout) return;
    T(el.readout);
    t.fromTo(el.readout, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.6, ease: EASE }, at);
  }

  function rise(t: Timeline, targets: Target | Target[], at: number, { y = 8, x = 0, dur = 0.6, stagger = 0 } = {}): void {
    const list = [targets].flat().filter(Boolean) as Element[];
    if (!list.length) return;
    T(list);
    t.from(list, { y, x, opacity: 0, duration: dur, ease: EASE, stagger, immediateRender: false }, at);
  }

  // A lead is sent from the form. Shared start of the healthy and the broken run.
  function sendLead(t: Timeline): void {
    t.call(() => {
      flag('u-no-toast', true);
      flag('u-sending', false);
    }, undefined, 0);
    press(t, 0.15);
    t.call(() => flag('u-sending', true), undefined, 0.25);
    t.call(() => {
      flag('u-sending', false);
      flag('u-no-toast', false);
    }, undefined, 0.95);
    rise(t, el.toast, 0.95, { y: 6, dur: 0.5 });
  }

  const SCENES: Record<string, (t: Timeline) => void> = {
    ok(t) {
      flag('u-no-row', true);
      flag('u-no-note', true);
      sendLead(t);
      packet(t, 1.0, el.pk1[0], el.hop1);
      t.call(() => flag('u-no-row', false), undefined, 1.5);
      rise(t, el.alex, 1.5, { y: -10 });
      // The integration's border lights orange as the lead lands, then fades back (CSS: .is-lit, 800 ms).
      const int = el.int;
      if (int) {
        T(int);
        t.call(() => int.classList.add('is-lit'), undefined, 1.5);
        t.call(() => int.classList.remove('is-lit'), undefined, 1.55);
      }
      packet(t, 1.65, el.pk2[0], el.hop2, { dur: 0.4 });
      t.call(() => flag('u-no-note', false), undefined, 2.05);
      rise(t, el.noteAlex, 2.05, { y: -12, dur: 0.7 });
      buzz(t, 2.05);
      verdict(t, 2.1);
    },
    broken(t) {
      flag('u-no-skel', true);
      flag('u-wire-live', true);
      sendLead(t);
      packet(t, 1.0, el.pk1[0], el.hop1, { to: 0.56, dur: 0.45, die: true });
      t.call(() => flag('u-wire-live', false), undefined, 1.5);
      t.call(() => flag('u-no-skel', false), undefined, 1.55);
      rise(t, el.skel, 1.55, { y: -10 });
      verdict(t, 2.2);
    },
    // Run history, findings and quote are full-board screens over the tools: the CSS fades the screen in, so
    // only its rows move here.
    diag(t) {
      rise(t, el.logRows, 0.2, { y: 4, dur: 0.4, stagger: 0.12 });
    },
    find(t) {
      rise(t, el.noteRows, 0.15, { y: 6, dur: 0.5, stagger: 0.14 });
    },
    quote(t) {
      const approve = el.approve;
      if (!approve) return;
      t.call(() => approve.classList.add('is-pending'), undefined, 0);
      T(approve);
      t.to(approve, { scale: 0.97, duration: 0.08 }, 1.3).to(approve, { scale: 1, duration: 0.3, ease: EASE }, 1.38);
      t.call(() => approve.classList.remove('is-pending'), undefined, 1.38);
    },
    fix(t) {
      ['u-connecting', 'u-no-bf', 'u-tog-off', 'u-no-note'].forEach((f) => flag(f, true));
      flag('u-wire-live', false);
      t.call(() => flag('u-connecting', false), undefined, 0.9);
      if (el.int) {
        T(el.int);
        t.from(el.int, { scale: 0.92, duration: 0.5, ease: 'back.out(3)', immediateRender: false }, 0.9);
      }
      packet(t, 1.0, el.pk1[0], el.hop1, { white: true, dur: 0.6 });
      t.call(() => flag('u-no-bf', false), undefined, 1.4);
      rise(t, el.bf, 1.4, { y: -8, stagger: 0.14 });
      t.call(() => flag('u-tog-off', false), undefined, 1.8);
      packet(t, 2.0, el.pk2[0], el.hop2, { white: true, dur: 0.4 });
      t.call(() => flag('u-no-note', false), undefined, 2.4);
      rise(t, el.noteFix, 2.4, { y: -12, dur: 0.7 });
      buzz(t, 2.4);
    },
    done(t) {
      flag('u-no-cards', true);
      const rows = [...el.tests].reverse(); // Test lead 1 first
      T(rows);
      gsap.set(rows, { display: 'none' });
      flag('u-no-note', true);
      rows.forEach((row, i) => {
        const at = 0.15 + i * 0.6;
        packet(t, at, el.pk1[i], el.hop1, { dur: 0.4 });
        t.set(row, { display: 'grid' }, at + 0.4);
        t.from(row, { y: -10, opacity: 0, duration: 0.5, ease: EASE, immediateRender: false }, at + 0.4);
        packet(t, at + 0.45, el.pk2[i], el.hop2, { dur: 0.3 });
      });
      // The three alerts land as one stack, the way a lock screen groups them.
      t.call(() => flag('u-no-note', false), undefined, 1.7);
      rise(t, el.testNotes[0]?.parentElement, 1.7, { y: -12, dur: 0.7 });
      buzz(t, 1.7);
      t.call(() => flag('u-no-cards', false), undefined, 2.0);
      rise(t, el.check, 2.0, { y: 12, dur: 0.6 });
      rise(t, el.checkRows, 2.15, { y: 4, dur: 0.4, stagger: 0.1 });
      if (el.ticks.length) {
        T(el.ticks);
        t.from(el.ticks, { scaleY: 0, transformOrigin: '50% 100%', duration: 0.3, ease: EASE, stagger: 0.035, immediateRender: false }, 2.5);
      }
      verdict(t, 2.5);
    },
  };

  function play(name: string): void {
    const build = SCENES[name];
    if (!build) return settle();
    build(timeline());
  }

  return {
    set(next, info) {
      const prev = scene;
      scene = next;
      if (!motion) return;
      if (info.instant) return settle();
      // Back to the healthy board from a later step: no new lead, the board just lands. From the broken step
      // (scrolling back up) the lead flows through again.
      if (next === 'ok' && prev !== null && prev !== 'ok' && prev !== 'broken') return settle();
      play(next);
    },
    pause() {
      paused = true;
      tl?.pause();
    },
    resume() {
      paused = false;
      if (motion && !greeted && scene === 'ok' && !tl) {
        greeted = true;
        return play('ok');
      }
      greeted = true;
      tl?.resume();
    },
    destroy() {
      if (motion) settle();
      scene = null;
    },
  };
}
