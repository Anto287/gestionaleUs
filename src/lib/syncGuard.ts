/** Una lettura remota non può cancellare modifiche locali ancora in viaggio. */
export class SyncGuard {
  private revisions = new Map<string, number>()
  private pending = new Map<string, number>()
  private failed = new Set<string>()

  snapshot(): Map<string, number> {
    return new Map(this.revisions)
  }

  changed(collection: string): void {
    this.revisions.set(collection, (this.revisions.get(collection) ?? 0) + 1)
  }

  async write<T>(collection: string, task: () => Promise<T>): Promise<T> {
    this.pending.set(collection, (this.pending.get(collection) ?? 0) + 1)
    try {
      return await task()
    } catch (error) {
      // Un'altra scrittura riuscita non dimostra che quella fallita sia salvata.
      this.failed.add(collection)
      throw error
    } finally {
      this.pending.set(collection, (this.pending.get(collection) ?? 1) - 1)
    }
  }

  confirmed(collection: string): void {
    this.failed.delete(collection)
  }

  canApply(collection: string, snapshot: Map<string, number>): boolean {
    return (
      !this.pending.get(collection) &&
      !this.failed.has(collection) &&
      (this.revisions.get(collection) ?? 0) === (snapshot.get(collection) ?? 0)
    )
  }
}
