import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

export const OUTLET_ROOM_PREFIX = 'outlet:';

@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(WebsocketGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket): void {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_outlet')
  handleJoinOutlet(client: Socket, outletId: string): { event: string; data: { outletId: string } } {
    const room = `${OUTLET_ROOM_PREFIX}${outletId}`;
    client.join(room);
    return { event: 'joined_outlet', data: { outletId } };
  }

  @SubscribeMessage('leave_outlet')
  handleLeaveOutlet(client: Socket, outletId: string): { event: string; data: { outletId: string } } {
    const room = `${OUTLET_ROOM_PREFIX}${outletId}`;
    client.leave(room);
    return { event: 'left_outlet', data: { outletId } };
  }

  emitOrderUpdate(outletId: string, payload: Record<string, unknown>): void {
    this.server.to(`${OUTLET_ROOM_PREFIX}${outletId}`).emit('order:updated', payload);
  }

  emitOrderCreated(outletId: string, payload: Record<string, unknown>): void {
    this.server.to(`${OUTLET_ROOM_PREFIX}${outletId}`).emit('order:created', payload);
  }

  emitKotUpdate(outletId: string, payload: Record<string, unknown>): void {
    this.server.to(`${OUTLET_ROOM_PREFIX}${outletId}`).emit('kot:updated', payload);
  }

  emitKotCreated(outletId: string, payload: Record<string, unknown>): void {
    this.server.to(`${OUTLET_ROOM_PREFIX}${outletId}`).emit('kot:created', payload);
  }
}
