// Test-only browser instrumentation. addInitScript serializes this function, so it has no runtime imports.
export type TimingEntry = {
  name: string;
  interactionId: number;
  startTime: number;
  duration: number;
  processingStart: number;
  processingEnd: number;
};

type Marker = { name: string; startTime: number; trusted: boolean };
export type TimingWindow = {
  documentId: string;
  supported: boolean;
  error: string | null;
  armedAt: number;
  endedAt: number;
  markers: Marker[];
  entries: TimingEntry[];
};

type Collector = Omit<TimingWindow, "endedAt"> & {
  target: Element | null;
  observer: PerformanceObserver | null;
  arm: (target: Element) => void;
  read: () => TimingWindow;
};

declare global {
  interface Window {
    __zgInp?: Collector;
  }
}

export function installEventCollector() {
  const state: Collector = {
    documentId: `${performance.timeOrigin}-${Math.random()}`,
    supported:
      typeof PerformanceObserver !== "undefined" &&
      PerformanceObserver.supportedEntryTypes.includes("event") &&
      typeof PerformanceEventTiming !== "undefined" &&
      "interactionId" in PerformanceEventTiming.prototype,
    error: null,
    armedAt: 0,
    markers: [],
    entries: [],
    target: null,
    observer: null,
    arm(target) {
      state.observer?.takeRecords();
      state.entries = [];
      state.markers = [];
      state.target = target;
      state.armedAt = performance.now();
    },
    read() {
      if (state.observer) append(state.observer.takeRecords());
      return {
        documentId: state.documentId,
        supported: state.supported,
        error: state.error,
        armedAt: state.armedAt,
        endedAt: performance.now(),
        markers: [...state.markers],
        entries: [...state.entries],
      };
    },
  };
  function append(entries: PerformanceEntry[]) {
    // The installed TypeScript DOM library does not yet declare Chromium's interactionId.
    for (const entry of entries as (PerformanceEventTiming & { interactionId: number })[]) {
      if (entry.interactionId && entry.startTime >= state.armedAt) {
        state.entries.push({
          name: entry.name,
          interactionId: entry.interactionId,
          startTime: entry.startTime,
          duration: entry.duration,
          processingStart: entry.processingStart,
          processingEnd: entry.processingEnd,
        });
      }
    }
  }
  window.__zgInp = state;
  if (!state.supported) {
    state.error = "Event Timing with interactionId is unavailable.";
    return;
  }
  try {
    state.observer = new PerformanceObserver((list) => {
      try {
        append(list.getEntries());
      } catch (error) {
        state.error = String(error);
      }
    });
    state.observer.observe({ type: "event", durationThreshold: 16 } as PerformanceObserverInit);
    for (const name of ["pointerdown", "pointerup", "click"]) {
      document.addEventListener(
        name,
        (event) => {
          if (state.target && event.composedPath().includes(state.target)) {
            state.markers.push({ name, startTime: event.timeStamp, trusted: event.isTrusted });
          }
        },
        true,
      );
    }
  } catch (error) {
    state.error = String(error);
  }
}
