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
        return mount()
      } catch (error) {
        report(ctx, phase, error)
        return () => {}
      }
    }, `ui-we2: ${phase}`)
  } catch (error) {
    report(ctx, phase, error)
  }
}

/** Console status lines for the sidebar ticker: the skin's idle telemetry. */
const TICKER_LINES = [
  ['SYS.01', '加载中…'],
  ['SYS.02', '权限获取中…'],
  ['SYS.03', '同步会话索引…'],
  ['SYS.04', '解析上下文窗口…'],
  ['SYS.05', '校验签名…'],
  ['SYS.06', '预热模型缓存…'],
  ['SYS.07', '扫描工作区…'],
  ['SYS.08', '校准时钟漂移…'],
  ['SYS.09', '建立安全信道…'],
  ['SYS.10', '等待指令…'],
]

const TICKER_LINE_HEIGHT = 19
const TICKER_VISIBLE_LINES = 6

/**
 * Mount the transparent status console into the sidebar's free area.
 *
 * Each line types itself out character by character: its marker is red while
 * typing, turns green when the line completes, and the reel then slides up by
 * one line for the next entry. Inter-character and inter-line delays are
 * jittered so no two lines take the same time.
 *
 * The console is decoration only: it takes no pointer input, paints no
 * background, and hides itself whenever the session list reaches the footer or
 * the sidebar is collapsed to the icon rail.
 */
function mountTicker() {
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
  let index = 0

  const timers = new Set()
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id)
      if (!stopped) fn()
    }, ms)
    timers.add(id)
    return id
  }

  const schedule = () => {
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

  /** `HH:MM:SS` stamp for one log line. */
  function clockText(date = new Date()) {
    const pad = (value) => String(value).padStart(2, '0')
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  }

  /** One log line: timestamp, marker, counter, typed body, ellipsis, caret. */
  function buildLine(code, time) {
    const line = document.createElement('div')
    line.className = 'we2-ticker-line'

    const stamp = document.createElement('span')
    stamp.className = 'we2-ticker-time'
    stamp.textContent = time

    const dot = document.createElement('span')
    dot.className = 'we2-ticker-dot'
    dot.dataset.state = 'typing'

    const label = document.createElement('span')
    label.className = 'we2-ticker-code'
    label.textContent = code

    const body = document.createElement('span')
    body.className = 'we2-ticker-text'

    const ellipsis = document.createElement('span')
    ellipsis.className = 'we2-ticker-ellipsis'
    ellipsis.textContent = '…'
    ellipsis.dataset.state = 'hidden'

    const caret = document.createElement('span')
    caret.className = 'we2-ticker-caret'

    line.append(stamp, dot, label, body, ellipsis, caret)
    return { line, dot, body, ellipsis, caret }
  }

  /** Slide the reel up one line after a completed entry, then drop the oldest. */
  function slide() {
    if (track.children.length <= TICKER_VISIBLE_LINES) return
    track.style.transition = 'transform 190ms cubic-bezier(0.2, 0.7, 0.2, 1)'
    void track.offsetHeight
    track.style.transform = `translateY(-${TICKER_LINE_HEIGHT}px)`
    later(() => {
      track.removeChild(track.firstElementChild)
      track.style.transition = 'none'
      track.style.transform = 'translateY(0)'
      void track.offsetHeight
    }, 220)
  }

  /** Type the next entry, then blink its ellipsis for an uneven exec time. */
  function typeLine() {
    if (stopped) return
    const [code, full] = TICKER_LINES[index % TICKER_LINES.length]
    index += 1
    const text = full.replace(/…$/u, '')

    const built = buildLine(code, clockText())
    track.appendChild(built.line)
    slide()

    const charDelay = 14 + Math.random() * 22
    const jitter = () => charDelay * (0.55 + Math.random() * 1.1)
    let cursor = 0

    const executing = () => {
      built.caret.remove()
      built.ellipsis.dataset.state = 'blinking'
      // Different instructions take different time: 0.6–3.2 s of blinking
      // before the marker reports the result.
      later(() => {
        built.ellipsis.dataset.state = 'idle'
        built.dot.dataset.state = 'done'
        later(typeLine, 320 + Math.random() * 420)
      }, 600 + Math.random() * 2600)
    }

    const step = () => {
      cursor += 1
      built.body.textContent = text.slice(0, cursor)
      if (cursor < text.length) later(step, jitter())
      else executing()
    }

    later(step, 200 + Math.random() * 300)
  }

  const reducedMotion = document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  const seeded = reducedMotion ? TICKER_VISIBLE_LINES : TICKER_VISIBLE_LINES - 1
  for (let i = 0; i < seeded; i += 1) {
    const [code, full] = TICKER_LINES[index % TICKER_LINES.length]
    index += 1
    const built = buildLine(code, clockText(new Date(Date.now() - (seeded - i) * 4200)))
    built.body.textContent = full.replace(/…$/u, '')
    built.ellipsis.dataset.state = 'idle'
    built.caret.remove()
    built.dot.dataset.state = 'done'
    track.appendChild(built.line)
  }
  if (!reducedMotion) typeLine()

  const bind = () => {
    const next = document.querySelector('[class*="sidebarCol"]')
    if (next === null) {
      host.remove()
      return
    }
    if (next !== column) {
      resize?.disconnect()
      column = next
      resize = new ResizeObserver(schedule)
      resize.observe(column)
    }
    if (host.parentElement !== column) column.appendChild(host)
    schedule()
  }

  bind()
  const keep = setInterval(bind, 1500)
  const onScroll = () => schedule()
  document.addEventListener('scroll', onScroll, true)

  return () => {
    stopped = true
    for (const id of timers) clearTimeout(id)
    timers.clear()
    clearInterval(keep)
    document.removeEventListener('scroll', onScroll, true)
    resize?.disconnect()
    if (frame !== 0) cancelAnimationFrame(frame)
    host.remove()
  }
}

function apply(ctx) {
  if (typeof document === 'undefined') return
  install(ctx, 'document flag', mountFlag)
  install(ctx, 'theme stylesheet', mountStyles)
  install(ctx, 'console chrome', mountChrome)
  install(ctx, 'sidebar status reel', mountTicker)
}

return { name: 'dsh-ui-we2', apply }
