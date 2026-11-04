import { ForbiddenException, Injectable } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { randomUUID } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import {
  REALTIME_EVENTS,
  type AuthenticatedUser,
  type NotificationItemDto,
  type RealtimeEventName,
} from '@school-mdm/contracts';
import { ClassScopeService } from '../rbac/class-scope.service';
import { SchoolRepositoryPort } from '../school/school.repository';

export interface RealtimeEmittedEventRecord {
  id: string;
  event: RealtimeEventName;
  room: string;
  payload: Record<string, unknown>;
  emittedAt: string;
}

@WebSocketGateway({
  namespace: '/mdm-realtime',
  cors: {
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  },
})
@Injectable()
export class RealtimeGateway {
  @WebSocketServer()
  server?: Server;

  private readonly emittedEvents: RealtimeEmittedEventRecord[] = [];
  private readonly notificationsByUser = new Map<string, NotificationItemDto[]>();
  private readonly socketRoomSubscriptions = new Map<string, Set<string>>();

  constructor(
    private readonly classScope: ClassScopeService,
    private readonly schoolRepo: SchoolRepositoryPort,
  ) {}

  /**
   * Authorizes a client socket/user to subscribe to a class-scoped room (`class:<classId>`).
   * Enforces backend RBAC: TEACHER can only subscribe to rooms of classes they are assigned to.
   */
  async subscribeToClassRoom(
    actor: AuthenticatedUser,
    classId: string,
    socket?: Pick<Socket, 'id' | 'join'>,
  ): Promise<{ room: string; subscribed: boolean }> {
    if (!this.classScope.isAdmin(actor)) {
      const teacherClassIds = await this.schoolRepo.getActiveClassIdsForTeacher(actor.id);
      if (!teacherClassIds.includes(classId)) {
        throw new ForbiddenException(
          'Giáo viên không có quyền nhận sự kiện thời gian thực của lớp học ngoài phạm vi phân công.',
        );
      }
    }

    const room = `class:${classId}`;
    if (socket) {
      await socket.join(room);
      const rooms = this.socketRoomSubscriptions.get(socket.id) ?? new Set<string>();
      rooms.add(room);
      this.socketRoomSubscriptions.set(socket.id, rooms);
    }

    return { room, subscribed: true };
  }

  emitDeviceStatusUpdated(payload: {
    deviceId: string;
    classId: string | null;
    status: string;
    lastSeenAt: string | null;
  }): RealtimeEmittedEventRecord {
    const room = payload.classId ? `class:${payload.classId}` : 'role:ADMIN';
    return this.emitToRoom(REALTIME_EVENTS.DEVICE_STATUS_UPDATED, room, payload);
  }

  emitDeviceHeartbeatReceived(payload: {
    deviceId: string;
    classId: string | null;
    batteryLevel: number | null;
    receivedAt: string;
  }): RealtimeEmittedEventRecord {
    const room = payload.classId ? `class:${payload.classId}` : 'role:ADMIN';
    return this.emitToRoom(REALTIME_EVENTS.DEVICE_HEARTBEAT_RECEIVED, room, payload);
  }

  emitCommandStatusUpdated(payload: {
    commandId: string;
    deviceId: string;
    classId: string | null;
    commandType: string;
    status: string;
    failureReason: string | null;
  }): RealtimeEmittedEventRecord {
    const room = payload.classId ? `class:${payload.classId}` : 'role:ADMIN';
    return this.emitToRoom(REALTIME_EVENTS.COMMAND_STATUS_UPDATED, room, payload);
  }

  emitSessionStatusUpdated(payload: {
    sessionId: string;
    classId: string;
    status: string;
    updatedAt: string;
  }): RealtimeEmittedEventRecord {
    return this.emitToRoom(
      REALTIME_EVENTS.SESSION_STATUS_UPDATED,
      `class:${payload.classId}`,
      payload,
    );
  }

  emitSessionDeviceUpdated(payload: {
    sessionId: string;
    classId: string;
    deviceId: string;
    syncState: string;
    lastError: string | null;
  }): RealtimeEmittedEventRecord {
    return this.emitToRoom(
      REALTIME_EVENTS.SESSION_DEVICE_UPDATED,
      `class:${payload.classId}`,
      payload,
    );
  }

  createAndEmitNotification(input: {
    recipientUserId: string;
    title: string;
    message: string;
    severity: 'INFO' | 'WARNING' | 'ERROR';
  }): NotificationItemDto {
    const notification: NotificationItemDto = {
      id: randomUUID(),
      recipientUserId: input.recipientUserId,
      title: input.title,
      message: input.message,
      severity: input.severity,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    const existing = this.notificationsByUser.get(input.recipientUserId) ?? [];
    existing.unshift(notification);
    this.notificationsByUser.set(input.recipientUserId, existing);

    this.emitToRoom(REALTIME_EVENTS.NOTIFICATION_CREATED, `user:${input.recipientUserId}`, {
      ...notification,
    });

    return { ...notification };
  }

  listNotificationsForUser(userId: string): NotificationItemDto[] {
    return (this.notificationsByUser.get(userId) ?? []).map((n) => ({ ...n }));
  }

  getEmittedEvents(): readonly RealtimeEmittedEventRecord[] {
    return this.emittedEvents;
  }

  private emitToRoom(
    event: RealtimeEventName,
    room: string,
    payload: Record<string, unknown>,
  ): RealtimeEmittedEventRecord {
    const record: RealtimeEmittedEventRecord = {
      id: randomUUID(),
      event,
      room,
      payload: { ...payload },
      emittedAt: new Date().toISOString(),
    };
    this.emittedEvents.push(record);

    if (this.server) {
      this.server.to(room).emit(event, payload);
    }

    return record;
  }
}
