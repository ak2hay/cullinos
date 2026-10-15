import { Injectable, Logger } from "@nestjs/common";

export type MenuItemAvailabilityChange = {
  id: string;
  /** Item can be sold online (onlineAvailable && isActive). */
  availableOnline: boolean;
};

export type MenuChangeListener = {
  onMenuItemsAvailability?(orgId: string, changes: MenuItemAvailabilityChange[]): Promise<void> | void;
  onMenuChanged?(orgId: string): Promise<void> | void;
};

/** Lets other modules react to menu edits without MenuModule depending on them. */
@Injectable()
export class MenuChangeNotifier {
  private readonly logger = new Logger(MenuChangeNotifier.name);
  private readonly listeners: MenuChangeListener[] = [];

  register(listener: MenuChangeListener) {
    this.listeners.push(listener);
  }

  itemsAvailabilityChanged(orgId: string, changes: MenuItemAvailabilityChange[]) {
    if (!changes.length) return;
    for (const l of this.listeners) {
      this.run(() => l.onMenuItemsAvailability?.(orgId, changes));
    }
  }

  menuChanged(orgId: string) {
    for (const l of this.listeners) {
      this.run(() => l.onMenuChanged?.(orgId));
    }
  }

  private run(fn: () => Promise<void> | void | undefined) {
    try {
      void Promise.resolve(fn()).catch((err) =>
        this.logger.warn(`Menu change listener failed: ${err instanceof Error ? err.message : String(err)}`),
      );
    } catch (err) {
      this.logger.warn(`Menu change listener failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
