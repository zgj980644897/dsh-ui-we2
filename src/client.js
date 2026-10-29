/* Factory body. `scripts/build.mjs` wraps this module into a client bundle and
   substitutes the stylesheet placeholder below. Runs inside the browser module
   table, never as an ES module.

   Failure posture: this skin is pure decoration, so no DOM failure may reach the
   Cordis fiber. Every mount is guarded, reports once, and leaves a no-op
   disposer; the rest of the application keeps running unchanged. */

const WE2_CSS = __WE2_CSS__

const CHROME_CLASS = 'we2-chrome'

const CHROME_MARKUP = [
  '<div class="we2-frame"></div>',
  '<span class="we2-corner we2-corner-tl"></span>',
  '<span class="we2-corner we2-corner-tr"></span>',
  '<span class="we2-corner we2-corner-bl"></span>',
  '<span class="we2-corner we2-corner-br"></span>',
  '<div class="we2-ticks we2-ticks-left"></div>',
  '<div class="we2-ticks we2-ticks-right"></div>',
  '<div class="we2-plate">',
  '<span class="we2-dot"></span>',
  '<span>WE2 // OPS CONSOLE</span>',
  '<span class="we2-sep"></span>',
  '<span>550W</span>',
  '<span class="we2-sep"></span>',
  '<span data-we2-clock>--:--:--</span>',
  '</div>',
].join('')

/** Report a degraded skin without letting reporting itself throw. */
function report(ctx, phase, error) {
  const message = `dsh-ui-we2: ${phase} failed, so that layer of the skin is off`
  if (typeof ctx?.logger?.warn === 'function') ctx.logger.warn(message, error)
  else if (typeof console !== 'undefined') console.warn(message, error)
}

/** Remove a node this plugin mounted earlier, so a reload cannot stack skin layers. */
function clearStale(selector) {
  for (const node of document.querySelectorAll(selector)) node.remove()
}

function mountStyles() {
  clearStale('style[data-dsh-we2="theme"]')
  const tag = document.createElement('style')
  tag.dataset.dshWe2 = 'theme'
  tag.textContent = WE2_CSS
  document.head.appendChild(tag)
  return () => { tag.remove() }
}

function mountChrome() {
  const parent = document.body ?? document.documentElement
  if (parent === null) throw new Error('document has no root to attach the console chrome')
  clearStale(`.${CHROME_CLASS}[data-dsh-we2="chrome"]`)

  const host = document.createElement('div')
  host.className = CHROME_CLASS
  host.dataset.dshWe2 = 'chrome'
  host.setAttribute('aria-hidden', 'true')
  host.innerHTML = CHROME_MARKUP
  parent.appendChild(host)

  const clock = host.querySelector('[data-we2-clock]')
  const pad = (value) => String(value).padStart(2, '0')
  const tick = () => {
    if (clock === null) return
    const now = new Date()
    clock.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  }
  tick()
  const timer = setInterval(() => {
    try {
      tick()
    } catch {
      // A detached chrome node ends the clock; the interval is cleared on dispose.
      clearInterval(timer)
    }
  }, 1000)
  return () => {
    clearInterval(timer)
    host.remove()
  }
}

function mountFlag() {
  const root = document.documentElement
  const previous = root.getAttribute('data-dsh-we2')
  root.setAttribute('data-dsh-we2', 'on')
  return () => {
    if (previous === null) root.removeAttribute('data-dsh-we2')
    else root.setAttribute('data-dsh-we2', previous)
  }
}

/** Register one guarded mount; a throwing mount reports and contributes nothing. */
function install(ctx, phase, mount) {
  try {
    ctx.effect(() => {
      try {
        return mount(ctx)
      } catch (error) {
        report(ctx, phase, error)
        return () => {}
      }
    }, `ui-we2: ${phase}`)
  } catch (error) {
    report(ctx, phase, error)
  }
}

/** One printed reasoning line's height, used by the scrolling window. */
const TICKER_LINE_HEIGHT = 19
/** How many printed lines the window keeps visible. */
const TICKER_VISIBLE_LINES = 6
/** Character cadence of the typewriter. */
const TICKER_TICK_MS = 22
/** Silence after which the newest line is reported complete. */
const TICKER_IDLE_DONE_MS = 1500
/** Coalescing delay for session and snapshot updates. */
const TICKER_SYNC_DELAY_MS = 120

/**
 * Mount the transparent reasoning console into the sidebar's free area.
 *
 * The console mirrors the live reasoning text of the conversation on screen.
 * Lines are printed one at a time, character by character; a line's marker is
 * red while it prints and turns green once the line completes. A line that
 * would overflow the rail stops printing and ends in a blinking ellipsis
 * instead of wrapping. The layer paints no background and takes no pointer
 * input, and it hides itself whenever the session list reaches the footer or
 * the sidebar is collapsed to the icon rail.
 *
 * @param ctx - owning Cordis context; `uiConversation` is read optionally.
 */
function mountTicker(ctx) {
  const host = document.createElement('div')
  host.className = 'we2-ticker'
  host.dataset.dshWe2 = 'ticker'
  host.setAttribute('aria-hidden', 'true')
  host.dataset.visible = 'no'

  const viewport = document.createElement('div')
  viewport.className = 'we2-ticker-viewport'
  const track = document.createElement('div')
  track.className = 'we2-ticker-track'
  viewport.appendChild(track)
  host.appendChild(viewport)

  clearStale('.we2-ticker[data-dsh-we2="ticker"]')

  let column = null
  let resize = null
  let frame = 0
  let stopped = false
  let syncTimer = 0
  let typingTimer = 0
  let observer = null
  let unsubscribe = null
  let source = null
  let sessionId = null
  let parsed = []
  let rendered = []
  let renderIndex = 0
  let active = null
  let lastGrowth = 0

  const timers = new Set()
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id)
      if (!stopped) fn()
    }, ms)
    timers.add(id)
    return id
  }

  /** `HH:MM:SS` stamp for one printed line. */
  function clockText(date = new Date()) {
    const pad = (value) => String(value).padStart(2, '0')
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  }

  /** One console line: timestamp, marker, typed body, ellipsis, caret. */
  function buildLine(time) {
    const line = document.createElement('div')
    line.className = 'we2-ticker-line'

    const stamp = document.createElement('span')
    stamp.className = 'we2-ticker-time'
    stamp.textContent = time

    const dot = document.createElement('span')
    dot.className = 'we2-ticker-dot'
    dot.dataset.state = 'typing'

    const body = document.createElement('span')
    body.className = 'we2-ticker-text'

    const ellipsis = document.createElement('span')
    ellipsis.className = 'we2-ticker-ellipsis'
    ellipsis.textContent = '…'
    ellipsis.dataset.state = 'hidden'

    const caret = document.createElement('span')
    caret.className = 'we2-ticker-caret'

    line.append(stamp, dot, body, ellipsis, caret)
    return { index: -1, line, dot, body, ellipsis, caret, target: '', printed: 0, truncated: false, done: false }
  }

  function ensureCaret(entry) {
    if (entry.caret !== null) return
    entry.caret = document.createElement('span')
    entry.caret.className = 'we2-ticker-caret'
    entry.line.appendChild(entry.caret)
  }

  /** Slide the reel up one line, dropping the oldest rendered entry. */
  function slide() {
    if (track.children.length <= TICKER_VISIBLE_LINES) return
    const removed = track.firstElementChild
    track.style.transition = 'transform 190ms cubic-bezier(0.2, 0.7, 0.2, 1)'
    void track.offsetHeight
    track.style.transform = `translateY(-${TICKER_LINE_HEIGHT}px)`
    later(() => {
      if (removed !== null) {
        track.removeChild(removed)
        for (let i = 0; i < rendered.length; i += 1) {
          if (rendered[i] !== undefined && rendered[i].line === removed) rendered[i] = undefined
        }
      }
      track.style.transition = 'none'
      track.style.transform = 'translateY(0)'
      void track.offsetHeight
    }, 220)
  }

  /** Clear every printed line; used when a new reasoning text starts. */
  function reset() {
    parsed = []
    rendered = []
    renderIndex = 0
    active = null
    lastGrowth = 0
    track.replaceChildren()
    track.style.transition = 'none'
    track.style.transform = 'translateY(0)'
  }

  /** Split reasoning markdown into printable, non-empty lines. */
  function parse(text) {
    const lines = []
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.replace(/\s+/g, ' ').trim()
      if (line !== '') lines.push(line)
    }
    return lines
  }

  /** Latest reasoning text of the chat target, or null when there is none. */
  function reasoningText(snapshot) {
    if (snapshot === null || snapshot === undefined) return null
    const order = snapshot.order
    const nodes = snapshot.nodes
    if (!Array.isArray(order) || nodes === null || nodes === undefined || typeof nodes.get !== 'function') return null
    for (let i = order.length - 1; i >= 0; i -= 1) {
      const node = nodes.get(order[i])
      const blocks = node?.data?.blocks
      if (!Array.isArray(blocks)) continue
      for (let j = blocks.length - 1; j >= 0; j -= 1) {
        const block = blocks[j]
        if (block?.kind !== 'reasoning') continue
        const text = typeof block.text === 'string' ? block.text : ''
        if (text.trim() !== '') return text
      }
    }
    return null
  }

  /** Adopt the newest reasoning text, resuming a finished tail that grew. */
  function adopt(text) {
    if (text === null) return
    const next = parse(text)
    if (next.length === 0) return
    if (parsed.length > 0 && next[0] !== rendered[0]?.target && next[0] !== parsed[0]) reset()
    if (rendered[0] !== undefined && next[0] !== rendered[0].target) reset()
    parsed = next

    const last = rendered[rendered.length - 1]
    if (last !== undefined && last.done && !last.truncated) {
      const target = next[last.index]
      if (target !== undefined && target.length > last.target.length) {
        last.done = false
        last.target = target
        last.dot.dataset.state = 'typing'
        ensureCaret(last)
        renderIndex = last.index
        active = null
        lastGrowth = Date.now()
      }
    }
  }

  /** Print one character of the active line, then settle it when done. */
  function tick() {
    if (stopped) return
    if (active === null) {
      if (renderIndex >= parsed.length) return
      const existing = rendered[renderIndex]
      if (existing !== undefined) {
        active = existing
        ensureCaret(existing)
        existing.dot.dataset.state = 'typing'
      } else {
        const built = buildLine(clockText())
        built.index = renderIndex
        built.target = parsed[renderIndex]
        built.printed = 0
        track.appendChild(built.line)
        rendered[renderIndex] = built
        active = built
        slide()
      }
      lastGrowth = Date.now()
    }

    const line = active
    const target = parsed[line.index] ?? line.target
    line.target = target

    if (!line.truncated && line.printed < target.length) {
      line.printed += 1
      line.body.textContent = target.slice(0, line.printed)
      lastGrowth = Date.now()
      if (line.body.scrollWidth > line.body.clientWidth + 1) line.truncated = true
    }

    const isLast = line.index === parsed.length - 1
    if (line.truncated) finish(line)
    else if (line.printed >= target.length) {
      if (!isLast) finish(line)
      else if (Date.now() - lastGrowth > TICKER_IDLE_DONE_MS) finish(line)
    }
  }

  /** Report a printed line as complete: green marker, settled ellipsis. */
  function finish(line) {
    line.done = true
    line.dot.dataset.state = 'done'
    if (line.caret !== null) {
      line.caret.remove()
      line.caret = null
    }
    line.ellipsis.dataset.state = line.truncated ? 'blinking' : 'idle'
    if (active === line) {
      active = null
      renderIndex = line.index + 1
    }
  }

  /** Read the conversation on screen and follow its chat snapshot. */
  function bindSession() {
    const node = document.querySelector('[data-conversation-session]')
    const id = node === null ? null : node.getAttribute('data-conversation-session')
    if (id === sessionId && source !== null) return

    if (unsubscribe !== null) {
      unsubscribe()
      unsubscribe = null
    }
    source = null
    sessionId = id
    if (id === null) return

    const uiConversation = ctx.get('uiConversation')
    if (uiConversation === undefined) return
    try {
      const binding = uiConversation.binding(id)
      source = binding.target('chat')
      unsubscribe = source.subscribe(() => scheduleSync())
      scheduleSync()
    } catch {
      source = null
    }
  }

  function scheduleSync() {
    if (stopped || syncTimer !== 0) return
    syncTimer = setTimeout(() => {
      syncTimer = 0
      if (stopped) return
      bindSession()
      if (source === null) return
      adopt(reasoningText(source.getSnapshot()))
    }, TICKER_SYNC_DELAY_MS)
  }

  const scheduleLayout = () => {
    if (frame !== 0) return
    frame = requestAnimationFrame(layout)
  }

  function layout() {
    frame = 0
    if (column === null || !column.isConnected) return
    const columnRect = column.getBoundingClientRect()
    if (columnRect.width < 180) {
      host.dataset.visible = 'no'
      return
    }
    const footer = column.querySelector('[class*="footArea"]')
    const footerHeight = footer === null ? 96 : footer.getBoundingClientRect().height
    let lowest = columnRect.top
    for (const row of column.querySelectorAll(
      '[class*="sessionRow"], [class*="projectRow"], [class*="panelRow"]',
    )) {
      const rect = row.getBoundingClientRect()
      if (rect.height === 0) continue
      lowest = Math.max(lowest, rect.bottom)
    }
    const free = columnRect.bottom - footerHeight - lowest - 28
    const height = Math.min(128, Math.round(free))
    host.style.bottom = `${Math.round(footerHeight + 10)}px`
    host.style.height = `${Math.max(0, height)}px`
    host.dataset.visible = height >= 96 ? 'yes' : 'no'
  }

  const attach = () => {
    const next = document.querySelector('[class*="sidebarCol"]')
    if (next === null) {
      host.remove()
      return
    }
    if (next !== column) {
      resize?.disconnect()
      column = next
      resize = new ResizeObserver(scheduleLayout)
      resize.observe(column)
    }
    if (host.parentElement !== column) column.appendChild(host)
    scheduleLayout()
  }

  attach()
  bindSession()
  typingTimer = setInterval(tick, TICKER_TICK_MS)
  const keep = setInterval(() => {
    attach()
    scheduleSync()
  }, 1500)

  observer = new MutationObserver((records) => {
    if (records.every((record) => host.contains(record.target))) return
    scheduleSync()
  })
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-conversation-session'],
  })

  const onScroll = () => scheduleLayout()
  document.addEventListener('scroll', onScroll, true)

  return () => {
    stopped = true
    for (const id of timers) clearTimeout(id)
    timers.clear()
    clearInterval(typingTimer)
    clearInterval(keep)
    if (syncTimer !== 0) clearTimeout(syncTimer)
    observer?.disconnect()
    unsubscribe?.()
    document.removeEventListener('scroll', onScroll, true)
    resize?.disconnect()
    if (frame !== 0) cancelAnimationFrame(frame)
    host.remove()
  }
}

/**
 * Mirror context usage onto the portaled stat dialogs so the meter and its bar
 * can report the near-full state at 90% and above.
 * @returns the disposer stopping the watch.
 */
function watchContextUsage() {
  const HOT = 90
  const update = () => {
    for (const node of document.querySelectorAll('[role="dialog"] [class*="_percent"]')) {
      const value = Number.parseInt(node.textContent ?? '', 10)
      const panel = node.closest('[role="dialog"]')
      if (panel === null || !Number.isFinite(value)) continue
      panel.dataset.we2Context = value >= HOT ? 'hot' : 'normal'
    }
    for (const button of document.querySelectorAll('button[aria-label*="%"]')) {
      const match = /(\d+)\s*%/.exec(button.getAttribute('aria-label') ?? '')
      if (match === null) continue
      button.dataset.we2Context = Number.parseInt(match[1], 10) >= HOT ? 'hot' : 'normal'
    }
  }
  update()
  const timer = setInterval(update, 400)
  return () => clearInterval(timer)
}

function apply(ctx) {
  if (typeof document === 'undefined') return
  install(ctx, 'document flag', mountFlag)
  install(ctx, 'theme stylesheet', mountStyles)
  install(ctx, 'console chrome', mountChrome)
  install(ctx, 'sidebar status reel', mountTicker)
  install(ctx, 'context usage', watchContextUsage)
}

return { name: 'dsh-ui-we2', apply }
