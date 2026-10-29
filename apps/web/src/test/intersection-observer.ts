// jsdom は描画しないため、IntersectionObserver がない。
// 監視中の要素が画面に入ったことを、テストから scrollIntoViewAll() で起こせる偽物に差し替える
const observers = new Set<FakeIntersectionObserver>();

class FakeIntersectionObserver {
  private readonly targets = new Set<Element>();

  constructor(private readonly callback: IntersectionObserverCallback) {
    observers.add(this);
  }

  observe(target: Element) {
    this.targets.add(target);
  }

  unobserve(target: Element) {
    this.targets.delete(target);
  }

  disconnect() {
    this.targets.clear();
    observers.delete(this);
  }

  takeRecords() {
    return [];
  }

  intersect() {
    const entries = [...this.targets].map(
      (target) =>
        ({ target, isIntersecting: true }) as IntersectionObserverEntry,
    );
    if (entries.length > 0) {
      this.callback(entries, this as unknown as IntersectionObserver);
    }
  }
}

export const installFakeIntersectionObserver = () => {
  globalThis.IntersectionObserver =
    FakeIntersectionObserver as unknown as typeof IntersectionObserver;
};

// 監視されているすべての要素が、画面に入ったことにする
export const scrollIntoViewAll = () => {
  for (const observer of observers) {
    observer.intersect();
  }
};
