import {
  buildFundingTimeline,
  calculate24HourHistoryChanges,
  calculateLatestHourlyHistoryChanges,
  formatFundingSnapshotAge,
  formatFundingClockTime,
  formatFundingTimestamp,
  formatCitizenDelta,
  formatFundingDelta,
  getFundingTimelineScale,
  getFundingHistoryFallback,
  FUNDING_HISTORY_REFRESH_MS,
  FUNDING_HISTORY_REQUEST,
  FUNDING_YEARLY_REQUEST,
  type FundingHistoryEntry,
  type FundingHistoryResponse,
  type FundingYearlyTotal,
  type FundingYearlyTotalsResponse,
} from '../shared/funding-stats.ts';

type FundingWindow = Pick<Window, 'setTimeout' | 'clearTimeout'> & {
  MutationObserver: typeof MutationObserver;
  addEventListener?: Window['addEventListener'];
  removeEventListener?: Window['removeEventListener'];
};

const COUNTER_ID = 'funds_raised_counter';
const CITIZEN_COUNTER_ID = 'fans_counter';
const OWN_CLASS = 'rsi-funding-change';
const OWN_UPDATED_CLASS = 'rsi-funding-updated';
const OWN_RANGE_CLASS = 'rsi-funding-range';
const OWN_CHART_CLASS = 'rsi-funding-extended-chart';
const OWN_SELECTOR = `.${OWN_CLASS}, .${OWN_UPDATED_CLASS}, .${OWN_RANGE_CLASS}, .${OWN_CHART_CLASS}`;
const SVG_NS = 'http://www.w3.org/2000/svg';
type ExtendedRange = 'quarter' | 'year';

/** Avoids observer-triggering attribute writes when the selected range is unchanged. */
export function setFundingTimelineRange(
  target: Pick<HTMLElement, 'dataset'>,
  range: ExtendedRange,
): boolean {
  if (target.dataset.rsiFundingRange === range) return false;
  target.dataset.rsiFundingRange = range;
  return true;
}

export function syncFundingTimelineButtonState(
  range: ExtendedRange | null,
  extendedButtons: Iterable<Pick<HTMLButtonElement, 'dataset' | 'classList' | 'setAttribute'>>,
  nativeButtons: Iterable<Pick<HTMLElement, 'classList'>>,
): void {
  for (const button of extendedButtons) {
    const selected = button.dataset.range === range;
    button.classList.toggle('on', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
  if (range !== null) {
    for (const button of nativeButtons) button.classList.remove('on');
  }
}

export function installFundingStatsDeltas(
  enabled: () => boolean,
  win: FundingWindow = window as FundingWindow,
  doc: Document = document,
): () => void {
  let active = false;
  let region: HTMLElement | null = null;
  let regionObserver: MutationObserver | null = null;
  let discoveryObserver: MutationObserver | null = null;
  let readTimer: number | null = null;
  let historyTimer: number | null = null;
  let historyRequestPending = false;
  let historyGeneration = 0;
  let yearlyRequestPending = false;
  let yearlyGeneration = 0;
  let historyEntries: FundingHistoryEntry[] = [];
  let yearlyTotals: FundingYearlyTotal[] = [];
  let yearlyFetchedAt: number | null = null;
  let yearlyStale = false;
  let yearlyState: 'idle' | 'loading' | 'ready' | 'unavailable' = 'idle';
  let latestFundingDelta: number | null = null;
  let latestCitizenDelta: number | null = null;
  let latestFundingHourDelta: number | null = null;
  let latestCitizenHourDelta: number | null = null;
  let historyState: 'loading' | 'ready' | 'unavailable' = 'loading';
  let historyStale = false;
  let historyAsOf: number | null = null;
  let historyFetchedAt: number | null = null;
  let selectedExtendedRange: ExtendedRange | null = null;
  let filters: HTMLElement | null = null;
  let timelineBody: HTMLElement | null = null;
  let resumeListenersInstalled = false;

  function deltaNode(counter: HTMLElement): HTMLElement | null {
    const block = counter.closest<HTMLElement>('.number-block');
    if (!block) return null;
    let node = block.querySelector<HTMLElement>(`:scope > .${OWN_CLASS}`);
    if (!node) {
      node = doc.createElement('div');
      node.className = OWN_CLASS;
      node.setAttribute('aria-live', 'off');
      node.title = 'Change calculated from the hourly funding history';
      counter.insertAdjacentElement('afterend', node);
    }
    return node;
  }

  function renderHistoryUpdated(): void {
    const header = doc.querySelector<HTMLElement>('.column.numbers > .header');
    if (!header) return;
    let node = header.parentElement?.querySelector<HTMLElement>(`:scope > .${OWN_UPDATED_CLASS}`);
    if (!node) {
      node = doc.createElement('div');
      node.className = OWN_UPDATED_CLASS;
      node.setAttribute('aria-live', 'off');
      header.insertAdjacentElement('afterend', node);
    } else if (node.previousElementSibling !== header) {
      header.insertAdjacentElement('afterend', node);
    }
    let label: string;
    if (historyState === 'loading') {
      label = 'Checking hourly funding sheet…';
    } else if (historyAsOf === null) {
      label = 'Sheet update unavailable';
    } else {
      const checked = historyFetchedAt === null ? '' : formatFundingClockTime(historyFetchedAt);
      const snapshot = formatFundingTimestamp(historyAsOf);
      const snapshotAge = formatFundingSnapshotAge(historyAsOf);
      label = historyStale
        ? `Saved data${checked ? ` · last successful check ${checked}` : ''} · latest snapshot ${snapshot} (${snapshotAge})`
        : `Sheet checked${checked ? ` ${checked}` : ''} · latest snapshot ${snapshot} (${snapshotAge})`;
    }
    if (node.textContent !== label) node.textContent = label;
    node.dataset.stale = String(historyStale);
    node.title = historyAsOf === null
      ? 'Timestamp from the hourly funding sheet (UTC)'
      : `Latest sheet row: ${new Date(historyAsOf).toISOString()}${historyFetchedAt === null ? '' : `\nLast successful check: ${new Date(historyFetchedAt).toISOString()}`}`;
  }

  function renderDelta(
    counter: HTMLElement,
    hourDelta: number | null,
    dayDelta: number | null,
    isCitizens: boolean,
  ): void {
    const node = deltaNode(counter);
    if (!node) return;
    node.title = historyAsOf === null
      ? 'Change calculated from the hourly funding history'
      : `Hourly sheet data through ${formatFundingTimestamp(historyAsOf)}${historyStale ? ' (saved copy)' : ''}`;
    const state = historyState;
    const hourValue = hourDelta === null ? '' : String(hourDelta);
    const dayValue = dayDelta === null ? '' : String(dayDelta);
    const asOf = historyAsOf === null ? '' : String(historyAsOf);
    if (node.dataset.state === state && node.dataset.hourValue === hourValue
      && node.dataset.dayValue === dayValue
      && node.dataset.sourceStale === String(historyStale)
      && node.dataset.asOf === asOf) return;
    node.dataset.state = state;
    node.dataset.hourValue = hourValue;
    node.dataset.dayValue = dayValue;
    node.dataset.sourceStale = String(historyStale);
    node.dataset.asOf = asOf;
    node.replaceChildren();
    if (state === 'loading') {
      node.textContent = 'Loading hourly history…';
      return;
    }
    const appendChange = (delta: number | null, periodLabel: string): void => {
      const row = doc.createElement('div');
      row.className = 'rsi-funding-change__item';
      if (delta === null) {
        row.classList.add('is-unavailable');
        row.textContent = `${periodLabel} change unavailable`;
        node.append(row);
        return;
      }
      row.dataset.value = String(delta);
      const arrow = doc.createElement('span');
      arrow.className = 'rsi-funding-change__arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
      const amount = doc.createElement('strong');
      amount.className = 'rsi-funding-change__value';
      amount.textContent = isCitizens ? formatCitizenDelta(delta) : formatFundingDelta(delta);
      const period = doc.createElement('span');
      period.className = 'rsi-funding-change__period';
      period.textContent = historyStale ? `${periodLabel} · saved` : periodLabel;
      row.append(arrow, amount, period);
      node.append(row);
    };
    appendChange(hourDelta, 'last hour');
    appendChange(dayDelta, 'last 24h');
  }

  function renderCounters(): void {
    renderHistoryUpdated();
    const funds = doc.getElementById(COUNTER_ID);
    const citizens = doc.getElementById(CITIZEN_COUNTER_ID);
    if (funds) renderDelta(funds, latestFundingHourDelta, latestFundingDelta, false);
    if (citizens) renderDelta(citizens, latestCitizenHourDelta, latestCitizenDelta, true);
  }

  function createSvgElement<T extends keyof SVGElementTagNameMap>(name: T): SVGElementTagNameMap[T] {
    return doc.createElementNS(SVG_NS, name);
  }

  function createExtendedChart(): HTMLElement | null {
    if (!timelineBody) return null;
    let chart = timelineBody.querySelector<HTMLElement>(`:scope > .${OWN_CHART_CLASS}`);
    if (!chart) {
      chart = doc.createElement('div');
      chart.className = OWN_CHART_CLASS;
      chart.setAttribute('aria-live', 'polite');
      timelineBody.append(chart);
    }
    return chart;
  }

  function renderExtendedChart(range: ExtendedRange): void {
    if (!timelineBody) return;
    const chart = createExtendedChart();
    if (!chart) return;
    setFundingTimelineRange(timelineBody, range);
    chart.replaceChildren();
    const points = buildFundingTimeline(historyEntries, range, Date.now(), yearlyTotals);
    const values = points.flatMap(point => point.amount === null ? [] : [point.amount]);
    if (values.length === 0) {
      if (range === 'year' && yearlyState === 'loading') chart.textContent = 'Loading yearly funding totals…';
      else if (range === 'year' && yearlyState === 'unavailable') chart.textContent = 'Yearly funding data is unavailable.';
      else if (range === 'quarter' && historyState === 'loading') chart.textContent = 'Loading quarterly funding…';
      else chart.textContent = `No historical funding data is available for ${range === 'quarter' ? 'this year’s quarters' : 'this range'}.`;
      return;
    }

    const width = 800;
    const height = 270;
    const left = 86;
    const right = 784;
    const top = 20;
    const bottom = 224;
    const { min, max } = getFundingTimelineScale(values);
    const span = max - min || 1;
    const xFor = (index: number): number => points.length <= 1 ? (left + right) / 2 : left + (right - left) * index / (points.length - 1);
    const yFor = (value: number): number => bottom - ((value - min) / span) * (bottom - top);
    const svg = createSvgElement('svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('class', 'rsi-funding-chart__animate');
    svg.setAttribute('role', 'img');
    const description = range === 'quarter'
      ? `Quarterly funding totals for ${new Date().getUTCFullYear()}`
      : 'Annual funding totals by year';
    svg.setAttribute('aria-label', description);

    for (let index = 0; index <= 4; index += 1) {
      const value = max - span * index / 4;
      const y = yFor(value);
      const line = createSvgElement('line');
      line.setAttribute('x1', String(left));
      line.setAttribute('x2', String(right));
      line.setAttribute('y1', String(y));
      line.setAttribute('y2', String(y));
      line.setAttribute('class', 'rsi-funding-chart__grid');
      svg.append(line);
      const label = createSvgElement('text');
      label.setAttribute('x', String(left - 10));
      label.setAttribute('y', String(y + 4));
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('class', 'rsi-funding-chart__axis');
      const rounded = Math.round(value);
      label.textContent = `${rounded < 0 ? '−' : ''}$${Math.abs(rounded).toLocaleString('en-US')}`;
      svg.append(label);
    }

    let pathData = '';
    let hasPrevious = false;
    points.forEach((point, index) => {
      if (point.amount === null) {
        hasPrevious = false;
        return;
      }
      const command = hasPrevious ? 'L' : 'M';
      pathData += `${command}${xFor(index)},${yFor(point.amount)}`;
      hasPrevious = true;
    });
    if (pathData) {
      const path = createSvgElement('path');
      path.setAttribute('d', pathData);
      path.setAttribute('class', 'rsi-funding-chart__line');
      svg.append(path);
    }
    points.forEach((point, index) => {
      if (point.amount === null) return;
      const circle = createSvgElement('circle');
      circle.setAttribute('cx', String(xFor(index)));
      circle.setAttribute('cy', String(yFor(point.amount)));
      circle.setAttribute('r', '3');
      circle.setAttribute('class', 'rsi-funding-chart__point');
      const title = createSvgElement('title');
      title.textContent = `${point.label}: ${formatFundingDelta(point.amount)}`;
      circle.append(title);
      svg.append(circle);
    });
    points.forEach((point, index) => {
      const label = createSvgElement('text');
      label.setAttribute('x', String(xFor(index)));
      label.setAttribute('y', '252');
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('class', 'rsi-funding-chart__axis rsi-funding-chart__date');
      label.textContent = point.label;
      svg.append(label);
    });
    chart.append(svg);
    const status = doc.createElement('div');
    status.className = 'rsi-funding-chart__status';
    if (range === 'year' && yearlyFetchedAt !== null) {
      const updated = formatFundingTimestamp(yearlyFetchedAt);
      const currentYear = new Date().getUTCFullYear();
      status.textContent = `${yearlyStale ? 'Saved annual totals' : 'Yearly funding'} · ${currentYear} year to date · updated ${updated}`;
    } else if (range === 'quarter' && historyAsOf !== null) {
      const updated = formatFundingTimestamp(historyAsOf);
      const asOf = new Date(historyAsOf);
      const currentYear = asOf.getUTCFullYear();
      const currentQuarter = Math.floor(asOf.getUTCMonth() / 3) + 1;
      status.textContent = `${historyStale ? 'Saved quarterly data' : 'Quarterly funding'} · ${currentYear} · Q${currentQuarter} to date · updated ${updated}`;
    } else {
      status.textContent = range === 'quarter' ? 'Quarterly funding by calendar year' : 'Yearly funding totals';
    }
    chart.append(status);
  }

  function requestYearlyFunding(): void {
    if (!active || !enabled() || yearlyRequestPending) return;
    yearlyRequestPending = true;
    if (yearlyTotals.length === 0) yearlyState = 'loading';
    const generation = yearlyGeneration;
    void Promise.resolve().then(() => chrome.runtime.sendMessage({ type: FUNDING_YEARLY_REQUEST })).then((response: FundingYearlyTotalsResponse | { error?: string } | undefined) => {
      if (!active || generation !== yearlyGeneration) return;
      if (!response || 'error' in response || !('totals' in response)
        || !Array.isArray(response.totals) || response.totals.length === 0) {
        throw new Error('Invalid yearly funding totals response');
      }
      yearlyTotals = response.totals;
      yearlyFetchedAt = response.fetchedAt;
      yearlyStale = response.stale;
      yearlyState = 'ready';
      if (selectedExtendedRange === 'year') renderExtendedChart('year');
    }).catch(() => {
      if (!active || generation !== yearlyGeneration) return;
      yearlyState = yearlyTotals.length ? 'ready' : 'unavailable';
      yearlyStale ||= yearlyTotals.length > 0;
      if (selectedExtendedRange === 'year') renderExtendedChart('year');
    }).finally(() => {
      if (generation === yearlyGeneration) yearlyRequestPending = false;
    });
  }

  function setExtendedButtonState(range: ExtendedRange | null): void {
    selectedExtendedRange = range;
    syncFundingTimelineButtonState(
      range,
      doc.querySelectorAll<HTMLButtonElement>(`.${OWN_RANGE_CLASS}`),
      filters?.querySelectorAll<HTMLElement>('.filter[data-type]') ?? [],
    );
  }

  function onNativeFilterClick(event: Event): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('.filter[data-type]')) {
      timelineBody?.removeAttribute('data-rsi-funding-range');
      setExtendedButtonState(null);
    }
  }

  function onFilterClick(event: Event): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>(`.${OWN_RANGE_CLASS}[data-range]`);
    if (!button) return;
    const range = button.dataset.range;
    if (range !== 'quarter' && range !== 'year') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    setExtendedButtonState(range);
    if (range === 'year') requestYearlyFunding();
    renderExtendedChart(range);
  }

  function bindTimeline(): void {
    const nextFilters = doc.querySelector<HTMLElement>('.column.timeline .filters');
    const nextBody = doc.querySelector<HTMLElement>('.column.timeline > .body');
    if (filters !== nextFilters) {
      filters?.removeEventListener('click', onFilterClick, true);
      filters?.removeEventListener('click', onNativeFilterClick, true);
      filters = nextFilters;
      filters?.addEventListener('click', onFilterClick, true);
      filters?.addEventListener('click', onNativeFilterClick, true);
    }
    timelineBody = nextBody;
    if (!filters || !timelineBody) return;
    for (const [range, label] of [['quarter', 'Quarter'], ['year', 'Year']] as const) {
      let button = filters.querySelector<HTMLButtonElement>(`.${OWN_RANGE_CLASS}[data-range="${range}"]`);
      if (!button) {
        button = doc.createElement('button');
        button.type = 'button';
        button.className = OWN_RANGE_CLASS;
        button.dataset.range = range;
        button.setAttribute('aria-pressed', 'false');
        button.title = `${label} funding history`;
        button.textContent = label;
        filters.append(button);
      }
      button.classList.add('trans-03s');
    }
    if (selectedExtendedRange) renderExtendedChart(selectedExtendedRange);
  }

  function updateHistory(response: FundingHistoryResponse): void {
    historyEntries = response.entries;
    historyStale = response.stale;
    historyFetchedAt = response.fetchedAt;
    historyAsOf = historyEntries.filter(entry => entry.timestamp <= Date.now()).at(-1)?.timestamp ?? null;
    const hourlyChanges = calculateLatestHourlyHistoryChanges(historyEntries);
    const changes = calculate24HourHistoryChanges(historyEntries);
    latestFundingHourDelta = hourlyChanges?.fundingDelta ?? null;
    latestCitizenHourDelta = hourlyChanges?.citizenDelta ?? null;
    latestFundingDelta = changes?.fundingDelta ?? null;
    latestCitizenDelta = changes?.citizenDelta ?? null;
    historyState = 'ready';
    renderCounters();
    if (selectedExtendedRange) renderExtendedChart(selectedExtendedRange);
  }

  function requestHistory(): void {
    if (!active || !enabled() || historyRequestPending) return;
    historyRequestPending = true;
    const generation = historyGeneration;
    void Promise.resolve().then(() => chrome.runtime.sendMessage({ type: FUNDING_HISTORY_REQUEST })).then((response: FundingHistoryResponse | { error?: string } | undefined) => {
      if (!active || generation !== historyGeneration) return;
      if (!response || 'error' in response || !('entries' in response) || !Array.isArray(response.entries)) {
        throw new Error('Invalid funding history response');
      }
      updateHistory(response);
    }).catch(() => {
      if (!active || generation !== historyGeneration) return;
      const fallback = getFundingHistoryFallback(historyEntries);
      if (fallback) {
        historyStale = fallback.stale;
        historyState = 'ready';
        const hourlyChanges = calculateLatestHourlyHistoryChanges(historyEntries);
        latestFundingHourDelta = hourlyChanges?.fundingDelta ?? null;
        latestCitizenHourDelta = hourlyChanges?.citizenDelta ?? null;
        const changes = fallback.changes;
        latestFundingDelta = changes?.fundingDelta ?? null;
        latestCitizenDelta = changes?.citizenDelta ?? null;
      } else {
        historyState = 'unavailable';
        latestFundingHourDelta = null;
        latestCitizenHourDelta = null;
        latestFundingDelta = null;
        latestCitizenDelta = null;
      }
      renderCounters();
      if (selectedExtendedRange) renderExtendedChart(selectedExtendedRange);
    }).finally(() => {
      if (generation === historyGeneration) historyRequestPending = false;
    });
  }

  function scheduleHistoryRefresh(): void {
    if (!active || !enabled() || historyTimer !== null) return;
    historyTimer = win.setTimeout(() => {
      historyTimer = null;
      requestHistory();
      if (selectedExtendedRange === 'year') requestYearlyFunding();
      scheduleHistoryRefresh();
    }, FUNDING_HISTORY_REFRESH_MS);
  }

  function read(): void {
    if (!active || !enabled()) return;
    renderCounters();
    bindTimeline();
  }

  function scheduleRead(): void {
    if (readTimer !== null) win.clearTimeout(readTimer);
    readTimer = win.setTimeout(() => {
      readTimer = null;
      read();
    }, 350);
  }

  function findRegion(): HTMLElement | null {
    return doc.querySelector<HTMLElement>('.wrapper > .column.numbers')?.parentElement ?? null;
  }

  function bindRegion(): boolean {
    const candidate = findRegion();
    if (!candidate) {
      regionObserver?.disconnect();
      regionObserver = null;
      region = null;
      return false;
    }
    if (region === candidate && regionObserver) return true;
    regionObserver?.disconnect();
    region = candidate;
    regionObserver = new win.MutationObserver(records => {
      const pageChanged = records.some(record => {
        const target = record.target.nodeType === 1 ? record.target as Element : record.target.parentElement;
        if (target?.closest(OWN_SELECTOR)) return false;
        if (record.addedNodes.length && Array.from(record.addedNodes).every(node =>
          node.nodeType === 1 && ((node as Element).matches(OWN_SELECTOR) || Boolean((node as Element).closest(OWN_SELECTOR))),
        )) return false;
        return true;
      });
      if (pageChanged) scheduleRead();
      if (!doc.documentElement?.contains(region)) {
        regionObserver?.disconnect();
        regionObserver = null;
        region = null;
        startDiscovery();
      }
    });
    regionObserver.observe(candidate, { attributes: true, childList: true, characterData: true, subtree: true });
    scheduleRead();
    return true;
  }

  function startDiscovery(): void {
    if (!active || discoveryObserver || !doc.documentElement) return;
    discoveryObserver = new win.MutationObserver(records => {
      if (!active) return;
      if (region) {
        const removedRegion = records.some(record => Array.from(record.removedNodes).some(node =>
          node === region || (node.nodeType === 1 && (node as Element).contains(region)),
        ));
        if (!removedRegion) return;
      } else {
        const addedNumbers = records.some(record => Array.from(record.addedNodes).some(node => {
          if (node.nodeType !== 1) return false;
          const element = node as Element;
          return element.matches('.column.numbers') || Boolean(element.querySelector('.column.numbers'));
        }));
        if (!addedNumbers) return;
      }
      bindRegion();
    });
    discoveryObserver.observe(doc.documentElement, { childList: true, subtree: true });
  }

  function stop(): void {
    active = false;
    historyGeneration += 1;
    historyRequestPending = false;
    yearlyGeneration += 1;
    yearlyRequestPending = false;
    historyEntries = [];
    yearlyTotals = [];
    yearlyFetchedAt = null;
    yearlyStale = false;
    yearlyState = 'idle';
    latestFundingDelta = null;
    latestCitizenDelta = null;
    latestFundingHourDelta = null;
    latestCitizenHourDelta = null;
    historyState = 'loading';
    historyStale = false;
    historyAsOf = null;
    historyFetchedAt = null;
    selectedExtendedRange = null;
    filters?.removeEventListener('click', onFilterClick, true);
    filters?.removeEventListener('click', onNativeFilterClick, true);
    filters = null;
    timelineBody?.removeAttribute('data-rsi-funding-range');
    timelineBody?.querySelector(`:scope > .${OWN_CHART_CLASS}`)?.remove();
    timelineBody = null;
    for (const button of doc.querySelectorAll(`.${OWN_RANGE_CLASS}`)) button.remove();
    if (resumeListenersInstalled) {
      doc.removeEventListener?.('visibilitychange', onResume);
      win.removeEventListener?.('pageshow', onResume);
      resumeListenersInstalled = false;
    }
    regionObserver?.disconnect();
    regionObserver = null;
    region = null;
    discoveryObserver?.disconnect();
    discoveryObserver = null;
    if (readTimer !== null) win.clearTimeout(readTimer);
    readTimer = null;
    if (historyTimer !== null) win.clearTimeout(historyTimer);
    historyTimer = null;
    for (const node of doc.querySelectorAll(`.${OWN_CLASS}`)) node.remove();
  }

  function onResume(): void {
    if (!active || !enabled()) return;
    if (doc.visibilityState === 'hidden') return;
    scheduleRead();
    requestHistory();
    if (selectedExtendedRange === 'year') requestYearlyFunding();
  }

  const refresh = (): void => {
    if (!enabled()) {
      if (active) stop();
      return;
    }
    if (!active) active = true;
    if (!resumeListenersInstalled) {
      doc.addEventListener?.('visibilitychange', onResume);
      win.addEventListener?.('pageshow', onResume);
      resumeListenersInstalled = true;
    }
    bindRegion();
    startDiscovery();
    renderCounters();
    requestHistory();
    scheduleHistoryRefresh();
  };

  refresh();
  return refresh;
}
