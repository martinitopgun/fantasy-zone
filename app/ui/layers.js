// Things that open on top of the tabs, and the Back button (plan B1.5).
//   Layers: a game (later a player, and Sunday Story). On a phone a game covers the tabs and pages but keeps
//           the app bar and the game chips usable; on a wide screen it covers only the last column.
//   Sheets: clock, live, Find, settings. A bottom sheet (a centered dialog on wide screens) over everything.
// Each one that opens adds a Back-button step (history.pushState with { fz: 1, depth }), so the browser's
// Back, Android's back and the iPhone edge swipe close it instead of leaving the app. Tabs never add steps
// (they use H.replace). Every history call is wrapped in try/catch: the published preview runs in a frame
// where history may be off limits, and then the in-app ‹, × and Esc still close everything.

// True when the app runs inside another page (the claude.ai preview).
export const framed = (() => { try { return window.top !== window.self; } catch { return true; } })();

export const H = {
  ok: true, // set false if Back turns out to leave the preview: layers then open without a history step
  push(state, hash) { if (!H.ok) return false; try { history.pushState(state, "", hash); return true; } catch { return false; } },
  replace(hash) { try { history.replaceState(history.state, "", hash); } catch { /* history unavailable */ } },
};
const histState = () => { try { return history.state; } catch { return null; } };

// The stack of open layers and sheets, oldest first, kept on `ui` (ui.stack, ui.depth) so the app and the
// console can see it. An entry is { kind, show(), hide(), state? }; `state` is saved in its Back step (e.g. which
// sheet), so Forward can bring it back. open() adds viaHistory (did it add a Back step).
//   const layers = createLayers({ ui, onForward })   onForward(hash, state): the Forward button reached a
//                                                      layer's step; reopen it (open() then adopts the step)
//   layers.open(entry, hash)    show it, with a Back step (hash: the address while it's open)
//   layers.back(then)           close the top one (via history when it has a step), then run `then`
//   layers.closeAll(then)       close everything in one go (one history jump), then run `then`
//   layers.swapTop(entry, hash) replace the top one in the same Back step (Find picking a result)
//   layers.top()  layers.has(kind)
const WAIT_MS = 600; // a history jump that never reports back (blocked in a frame) is finished by hand

export function createLayers({ ui, onForward }) {
  ui.stack = []; ui.depth = 0; ui.afterPop = null;
  let adopt = null; // depth of a step the Forward button just moved to: open() uses it instead of pushing
  let waiting = 0;

  function open(entry, hash) {
    if (adopt != null) { entry.viaHistory = true; ui.depth = adopt; adopt = null; }
    else {
      entry.viaHistory = H.push({ ...entry.state, fz: 1, depth: ui.depth + 1 }, hash ?? location.hash);
      if (entry.viaHistory) ui.depth++; // count only steps that really exist
    }
    ui.stack.push(entry);
    entry.show();
  }

  // Close by hand, without history (no step of ours on top, or history didn't answer).
  function drop(until) {
    while (ui.stack.length > until) {
      const top = ui.stack.pop();
      if (top.viaHistory) ui.depth = Math.max(0, ui.depth - 1);
      top.hide();
    }
  }

  function runAfter() { clearTimeout(waiting); const then = ui.afterPop; ui.afterPop = null; then?.(); }

  // Wait for the popstate a history jump causes; if it never comes, finish the job by hand.
  function jump(n, until, then) {
    ui.afterPop = then ?? null;
    clearTimeout(waiting);
    try { history.go(n); } catch { drop(until); return runAfter(); }
    waiting = setTimeout(() => { drop(until); runAfter(); }, WAIT_MS);
  }

  // In-app ‹, ×, Esc, a backdrop tap: close the top one. Never history.back() without our own step on top:
  // it would leave the page.
  function back(then) {
    const top = ui.stack.at(-1);
    if (!top) return then?.();
    const st = histState();
    if (top.viaHistory && st?.fz && st.depth === ui.depth) return jump(-1, ui.stack.length - 1, then);
    drop(ui.stack.length - 1);
    then?.();
  }

  // The scorebug, "All games ›", switching Live/Replay: close every layer and sheet in one step. Never
  // history.go(0): it reloads the page.
  function closeAll(then) {
    const st = histState();
    if (ui.depth > 0 && st?.fz && st.depth === ui.depth) return jump(-ui.depth, 0, then);
    drop(0);
    ui.depth = 0;
    then?.();
  }

  function swapTop(entry, hash) {
    const top = ui.stack.at(-1);
    if (!top) return open(entry, hash);
    top.hide();
    entry.viaHistory = top.viaHistory;
    ui.stack[ui.stack.length - 1] = entry;
    if (top.viaHistory) { try { history.replaceState({ ...entry.state, fz: 1, depth: ui.depth }, "", hash ?? location.hash); } catch { /* history unavailable */ } }
    else if (hash) H.replace(hash);
    entry.show();
  }

  addEventListener("popstate", (e) => {
    const d = e.state?.fz ? e.state.depth : 0;
    if (d > ui.depth) { // Forward: reopen from the address
      adopt = d;
      try { onForward?.(location.hash, e.state); } finally {
        // Nothing reopened (a sheet's step, or a game that's gone): this step now counts as where we are.
        if (adopt != null) { adopt = null; try { history.replaceState({ fz: 1, depth: ui.depth }, "", location.hash); } catch { /* history unavailable */ } }
      }
      return;
    }
    // history.go(-n) fires ONE popstate, so close everything above the new depth here.
    while (ui.stack.length && (ui.depth > d || !ui.stack.at(-1).viaHistory)) {
      const top = ui.stack.pop();
      if (top.viaHistory) ui.depth--;
      top.hide();
    }
    if (!ui.stack.length) ui.depth = Math.min(ui.depth, d);
    runAfter();
  });

  return {
    open, back, closeAll, swapTop,
    top: () => ui.stack.at(-1) ?? null,
    has: (kind) => ui.stack.some((x) => x.kind === kind),
  };
}

// A bottom sheet (a centered dialog on wide screens) with a backdrop. While it's open everything else is
// inert. The backdrop, any [data-close="sheet"] button and dragging the handle down call onDismiss() (the
// app sends that through layers.back(), so the Back step goes too); Esc is handled by the app.
//   const sheet = createSheet({ sheet, backdrop, others, onDismiss })   others(): the elements to make inert
//   sheet.open(kind, html)  sheet.close()  sheet.kind  sheet.body
export function createSheet({ sheet, backdrop, others, onDismiss }) {
  let kind = null, opener = null, saved = [];
  const dismiss = () => (onDismiss ? onDismiss() : close());

  function open(k, html) {
    if (kind) close({ refocus: false });
    else opener = document.activeElement;
    kind = k;
    sheet.innerHTML = `<div class="handle" data-handle aria-hidden="true"><span></span></div>${html}`;
    sheet.dataset.kind = k;
    sheet.style.translate = "";
    sheet.hidden = false; backdrop.hidden = false;
    saved = others().map((el) => [el, el.inert]);
    for (const [el] of saved) el.inert = true;
    sheet.scrollTop = 0;
    (sheet.querySelector("[data-autofocus]") ?? sheet.querySelector("button, input, [tabindex]"))?.focus({ preventScroll: true });
  }

  function close({ refocus = true } = {}) {
    if (!kind) return;
    kind = null;
    sheet.hidden = true; backdrop.hidden = true;
    sheet.innerHTML = "";
    for (const [el, was] of saved) el.inert = was;
    saved = [];
    if (refocus && opener?.isConnected) opener.focus({ preventScroll: true });
    if (refocus) opener = null;
  }

  backdrop.addEventListener("click", () => dismiss());
  sheet.addEventListener("click", (e) => { if (e.target.closest('[data-close="sheet"]')) dismiss(); });

  // Drag the handle down to close.
  let y0 = null, dy = 0;
  sheet.addEventListener("pointerdown", (e) => {
    if (!e.target.closest("[data-handle]")) return;
    y0 = e.clientY; dy = 0;
    sheet.setPointerCapture(e.pointerId);
  });
  sheet.addEventListener("pointermove", (e) => {
    if (y0 == null) return;
    dy = Math.max(0, e.clientY - y0);
    sheet.style.translate = `0 ${dy}px`;
  });
  const end = () => {
    if (y0 == null) return;
    y0 = null;
    if (dy > 80) dismiss(); else sheet.style.translate = "";
  };
  sheet.addEventListener("pointerup", end);
  sheet.addEventListener("pointercancel", end);

  return {
    open, close,
    get kind() { return kind; },
    get body() { return sheet; },
  };
}
