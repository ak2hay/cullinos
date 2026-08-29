import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DomainEvent, DomainEventType } from '@cullinos/events';

export interface PublishEventInput<T = Record<string, unknown>> {
  type: DomainEventType;
  organizationId: string;
  outletId?: string;
  payload: T;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private readonly events: DomainEvent[] = [];

  async publish<T = Record<string, unknown>>(input: PublishEventInput<T>): Promise<DomainEvent<T>> {
    const event: DomainEvent<T> = {
      id: uuidv4(),
      type: input.type,
      organizationId: input.organizationId,
      outletId: input.outletId,
      payload: input.payload,
      timestamp: new Date(),
      metadata: input.metadata,
    };

    this.events.push(event as DomainEvent);
    this.logger.log(
      `[Event] ${event.type} org=${event.organizationId} outlet=${event.outletId ?? 'n/a'} id=${event.id}`,
    );

    return event;
  }

  getRecentEvents(limit = 100): DomainEvent[] {
    return this.events.slice(-limit);
  }
}
