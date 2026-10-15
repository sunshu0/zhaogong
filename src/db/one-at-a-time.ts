// A libSQL client that runs one statement, batch or transaction at a time within this server process.
// A local SQLite file has one writer: when two requests write at once, the second fails with SQLITE_BUSY
// ("database is locked"), which a busy browser test run reliably triggers. Queuing here keeps them apart;
// the queue is per process, which is what a dev server or a single Worker instance is.
import type { Client, Transaction } from "@libsql/client";

type Release = () => void;

export function oneAtATime(client: Client): Client {
  let tail: Promise<void> = Promise.resolve();

  /** Waits for everything queued before, then holds the queue until release() is called. */
  function acquire(): Promise<Release> {
    let release!: Release;
    const previous = tail;
    tail = new Promise<void>((resolve) => (release = resolve));
    return previous.then(() => release);
  }

  async function queued<T>(run: () => Promise<T>): Promise<T> {
    const release = await acquire();
    try {
      return await run();
    } finally {
      release();
    }
  }

  return new Proxy(client, {
    get(target, prop) {
      if (prop === "execute" || prop === "batch" || prop === "migrate" || prop === "executeMultiple") {
        const method = Reflect.get(target, prop, target) as (...args: unknown[]) => Promise<unknown>;
        return (...args: unknown[]) => queued(() => method.apply(target, args));
      }
      if (prop === "transaction") {
        // The queue is held from the start of a transaction until it is committed, rolled back or closed.
        return async (...args: Parameters<Client["transaction"]>) => {
          const release = await acquire();
          try {
            return releasedOnEnd(await target.transaction(...args), release);
          } catch (error) {
            release();
            throw error;
          }
        };
      }
      // The client keeps its state in private fields: read and call everything else on the client itself.
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

function releasedOnEnd(tx: Transaction, release: Release): Transaction {
  let released = false;
  const once = () => {
    if (!released) {
      released = true;
      release();
    }
  };
  return new Proxy(tx, {
    get(target, prop) {
      if (prop === "commit" || prop === "rollback") {
        const method = Reflect.get(target, prop, target) as () => Promise<void>;
        return async () => {
          try {
            await method.call(target);
          } finally {
            once();
          }
        };
      }
      if (prop === "close") {
        return () => {
          try {
            target.close();
          } finally {
            once();
          }
        };
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
