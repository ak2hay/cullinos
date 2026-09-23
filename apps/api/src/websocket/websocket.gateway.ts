import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { JwtService } from "@nestjs/jwt";
import { Logger } from "@nestjs/common";
import { Server, Socket } from "socket.io";
import { PrismaService } from "../prisma/prisma.service";
import { parseCorsOrigins, socketIoCorsConfig } from "../common/cors.util";
import { getJwtSecret } from "../common/jwt-secret.util";

type SocketUser = {
  userId: string;
  organizationId: string;
  isSuperAdmin: boolean;
};

function resolveAllowedOrigins(): string[] {
  const configured = parseCorsOrigins(process.env.CORS_ORIGINS);
  if (configured.length > 0) return configured;
  if (process.env.NODE_ENV === "production") return [];
  return [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5177",
    "http://localhost:5178",
    "http://localhost:5180",
    "http://localhost:5183",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
  ];
}

@WebSocketGateway({
  cors: socketIoCorsConfig(new Set(resolveAllowedOrigins())),
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayInit {
  private readonly logger = new Logger(WebsocketGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private jwt: JwtService,
    private prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    const origins = resolveAllowedOrigins();
    server.engine.on("initial_headers", (_headers, req) => {
      void req;
    });
    this.logger.log(`WebSocket CORS origins: ${origins.join(", ") || "(none)"}`);
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.emit("error", { message: "Missing authentication token" });
        client.disconnect(true);
        return;
      }

      const payload = this.jwt.verify<{
        sub: string;
        organizationId?: string;
        isSuperAdmin?: boolean;
        type?: string;
      }>(token, {
        secret: getJwtSecret(),
      });

      if (payload.type === "refresh" || payload.type === "otp_challenge") {
        client.emit("error", { message: "Invalid token type" });
        client.disconnect(true);
        return;
      }

      if (!payload.sub || !payload.organizationId) {
        client.emit("error", { message: "Invalid token claims" });
        client.disconnect(true);
        return;
      }

      const user: SocketUser = {
        userId: payload.sub,
        organizationId: payload.organizationId,
        isSuperAdmin: Boolean(payload.isSuperAdmin),
      };
      (client.data as { user?: SocketUser }).user = user;
    } catch (err) {
      this.logger.debug(`WebSocket auth failed: ${String(err)}`);
      client.emit("error", { message: "Unauthorized" });
      client.disconnect(true);
    }
  }

  @SubscribeMessage("join_outlet")
  async handleJoinOutlet(
    @ConnectedSocket() client: Socket,
    @MessageBody() outletId: string,
  ) {
    const user = this.requireUser(client);
    if (!user || !outletId) return;

    const allowed = await this.canJoinOutlet(user, outletId);
    if (!allowed) {
      client.emit("error", { message: "Not allowed to join outlet room" });
      return;
    }
    await client.join(`outlet:${outletId}`);
  }

  @SubscribeMessage("leave_outlet")
  handleLeaveOutlet(
    @ConnectedSocket() client: Socket,
    @MessageBody() outletId: string,
  ) {
    if (outletId) void client.leave(`outlet:${outletId}`);
  }

  @SubscribeMessage("join_org")
  async handleJoinOrg(
    @ConnectedSocket() client: Socket,
    @MessageBody() _orgId: string,
  ) {
    const user = this.requireUser(client);
    if (!user) return;
    // Always join the token organization — never trust client-supplied org IDs.
    await client.join(`org:${user.organizationId}`);
  }

  emitToOutlet(outletId: string, event: string, data: unknown) {
    this.server?.to(`outlet:${outletId}`).emit(event, data);
    const legacy = event.replace(".", ":");
    if (legacy !== event) {
      this.server?.to(`outlet:${outletId}`).emit(legacy, data);
    }
  }

  emitToOrg(orgId: string, event: string, data: unknown) {
    this.server?.to(`org:${orgId}`).emit(event, data);
  }

  private extractToken(client: Socket): string | null {
    const authToken = (client.handshake.auth as { token?: unknown } | undefined)?.token;
    if (typeof authToken === "string" && authToken.trim()) {
      return authToken.trim();
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === "string" && header.startsWith("Bearer ")) {
      return header.slice(7).trim();
    }

    const queryToken = client.handshake.query.token;
    if (typeof queryToken === "string" && queryToken.trim()) {
      return queryToken.trim();
    }

    return null;
  }

  private requireUser(client: Socket): SocketUser | null {
    const user = (client.data as { user?: SocketUser }).user;
    if (!user) {
      client.emit("error", { message: "Unauthorized" });
      client.disconnect(true);
      return null;
    }
    return user;
  }

  private async canJoinOutlet(user: SocketUser, outletId: string): Promise<boolean> {
    const outlet = await this.prisma.outlet.findFirst({
      where: {
        id: outletId,
        ...(user.isSuperAdmin ? {} : { organizationId: user.organizationId }),
      },
      select: { id: true, organizationId: true },
    });
    if (!outlet) return false;
    if (user.isSuperAdmin) return true;

    if (outlet.organizationId !== user.organizationId) return false;

    const outletAssignments = await this.prisma.outletUser.count({
      where: { userId: user.userId },
    });

    // No outlet assignments → org-wide access (owners / unscoped staff).
    if (outletAssignments === 0) return true;

    const membership = await this.prisma.outletUser.findUnique({
      where: {
        userId_outletId: { userId: user.userId, outletId },
      },
      select: { id: true },
    });
    return Boolean(membership);
  }
}
