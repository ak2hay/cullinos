import { WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server } from "socket.io";

@WebSocketGateway({ cors: { origin: true } })
export class WebsocketGateway {
  @WebSocketServer()
  server!: Server;

  emitToOutlet(outletId: string, event: string, data: unknown) {
    this.server?.to(`outlet:${outletId}`).emit(event, data);
  }

  emitToOrg(orgId: string, event: string, data: unknown) {
    this.server?.to(`org:${orgId}`).emit(event, data);
  }
}
