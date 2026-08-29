import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

@WebSocketGateway({ cors: { origin: true } })
export class WebsocketGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  handleConnection(_client: Socket) {
    // Clients join outlet/org rooms explicitly after connect.
  }

  @SubscribeMessage("join_outlet")
  handleJoinOutlet(
    @ConnectedSocket() client: Socket,
    @MessageBody() outletId: string,
  ) {
    if (outletId) client.join(`outlet:${outletId}`);
  }

  @SubscribeMessage("leave_outlet")
  handleLeaveOutlet(
    @ConnectedSocket() client: Socket,
    @MessageBody() outletId: string,
  ) {
    if (outletId) client.leave(`outlet:${outletId}`);
  }

  @SubscribeMessage("join_org")
  handleJoinOrg(
    @ConnectedSocket() client: Socket,
    @MessageBody() orgId: string,
  ) {
    if (orgId) client.join(`org:${orgId}`);
  }

  emitToOutlet(outletId: string, event: string, data: unknown) {
    this.server?.to(`outlet:${outletId}`).emit(event, data);
    // Legacy KDS event names
    const legacy = event.replace(".", ":");
    if (legacy !== event) {
      this.server?.to(`outlet:${outletId}`).emit(legacy, data);
    }
  }

  emitToOrg(orgId: string, event: string, data: unknown) {
    this.server?.to(`org:${orgId}`).emit(event, data);
  }
}
