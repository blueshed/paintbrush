import { describe, test, expect } from "bun:test";
import { Signal, signal, effect, computed, batch } from "./signals";

describe("Signal", () => {
  test("get/set reads and writes", () => {
    const s = signal(1);
    expect(s.get()).toBe(1);
    s.set(2);
    expect(s.get()).toBe(2);
  });

  test("set ignores same value (Object.is)", () => {
    const s = signal(1);
    let runs = 0;
    effect(() => {
      s.get();
      runs++;
    });
    expect(runs).toBe(1);
    s.set(1); // same value
    expect(runs).toBe(1);
  });

  test("update transforms the current value", () => {
    const s = signal(5);
    s.update((v) => v * 2);
    expect(s.get()).toBe(10);
  });

  test("peek reads without tracking", () => {
    const s = signal(1);
    let runs = 0;
    effect(() => {
      s.peek();
      runs++;
    });
    expect(runs).toBe(1);
    s.set(2);
    expect(runs).toBe(1); // effect did not re-run
  });
});

describe("effect", () => {
  test("runs immediately", () => {
    let ran = false;
    effect(() => {
      ran = true;
    });
    expect(ran).toBe(true);
  });

  test("re-runs when a dependency changes", () => {
    const s = signal("a");
    const log: string[] = [];
    effect(() => {
      log.push(s.get());
    });
    s.set("b");
    s.set("c");
    expect(log).toEqual(["a", "b", "c"]);
  });

  test("dispose stops re-runs", () => {
    const s = signal(0);
    let runs = 0;
    const dispose = effect(() => {
      s.get();
      runs++;
    });
    expect(runs).toBe(1);
    dispose();
    s.set(1);
    expect(runs).toBe(1);
  });

  test("cleanup function is called before re-run and on dispose", () => {
    const s = signal(0);
    const log: string[] = [];
    const dispose = effect(() => {
      const val = s.get();
      log.push(`run:${val}`);
      return () => log.push(`cleanup:${val}`);
    });
    s.set(1);
    dispose();
    expect(log).toEqual(["run:0", "cleanup:0", "run:1", "cleanup:1"]);
  });

  test("drops stale dependencies", () => {
    const a = signal(1);
    const b = signal(2);
    const toggle = signal(true);
    let runs = 0;

    effect(() => {
      runs++;
      if (toggle.get()) a.get();
      else b.get();
    });
    expect(runs).toBe(1);

    // switch to reading b instead of a
    toggle.set(false);
    expect(runs).toBe(2);

    // a is no longer tracked — changing it should not trigger
    a.set(99);
    expect(runs).toBe(2);

    // b is now tracked
    b.set(99);
    expect(runs).toBe(3);
  });
});

describe("computed", () => {
  test("derives a value from signals", () => {
    const a = signal(2);
    const b = signal(3);
    const sum = computed(() => a.get() + b.get());
    expect(sum.get()).toBe(5);
  });

  test("updates when dependencies change", () => {
    const s = signal(1);
    const doubled = computed(() => s.get() * 2);
    expect(doubled.get()).toBe(2);
    s.set(5);
    expect(doubled.get()).toBe(10);
  });

  test("chains with other computeds", () => {
    const s = signal(1);
    const doubled = computed(() => s.get() * 2);
    const plusOne = computed(() => doubled.get() + 1);
    expect(plusOne.get()).toBe(3);
    s.set(4);
    expect(plusOne.get()).toBe(9);
  });
});

describe("batch", () => {
  test("defers effects until batch completes", () => {
    const a = signal(1);
    const b = signal(2);
    let runs = 0;

    effect(() => {
      a.get();
      b.get();
      runs++;
    });
    expect(runs).toBe(1);

    batch(() => {
      a.set(10);
      b.set(20);
    });
    expect(runs).toBe(2); // only one re-run, not two
  });

  test("nested batches flush only at outermost", () => {
    const s = signal(0);
    const log: number[] = [];
    effect(() => {
      log.push(s.get());
    });

    batch(() => {
      s.set(1);
      batch(() => {
        s.set(2);
      });
      // inner batch ends, but outer is still open — no flush yet
      s.set(3);
    });
    // only the final value should have triggered the effect
    expect(log).toEqual([0, 3]);
  });
});
