import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface CreateEmployeeInput {
  outletId?: string;
  userId?: string;
  employeeCode?: string;
  designation?: string;
  department?: string;
  hireDate?: Date;
}

export interface UpdateEmployeeInput {
  outletId?: string;
  employeeCode?: string;
  designation?: string;
  department?: string;
  hireDate?: Date;
  isActive?: boolean;
}

export interface OpenShiftInput {
  outletId: string;
  employeeId: string;
  openingCash: number;
  notes?: string;
}

export interface CloseShiftInput {
  closingCash: number;
  notes?: string;
}

export interface CashMovementInput {
  shiftId: string;
  type: string;
  amount: number;
  reason?: string;
  reference?: string;
}

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Employees ---

  async findAllEmployees(organizationId: string, outletId?: string) {
    return this.prisma.client.employee.findMany({
      where: {
        organizationId,
        ...(outletId ? { outletId } : {}),
      },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findEmployee(id: string, organizationId: string) {
    const employee = await this.prisma.client.employee.findFirst({
      where: { id, organizationId },
      include: { user: true, outlet: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async createEmployee(
    organizationId: string,
    userId: string,
    input: CreateEmployeeInput,
  ) {
    const employee = await this.prisma.client.employee.create({
      data: { organizationId, ...input },
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: input.outletId,
      action: 'EMPLOYEE_CREATED',
      entityType: 'Employee',
      entityId: employee.id,
    });

    return employee;
  }

  async updateEmployee(
    id: string,
    organizationId: string,
    userId: string,
    input: UpdateEmployeeInput,
  ) {
    await this.findEmployee(id, organizationId);
    const employee = await this.prisma.client.employee.update({
      where: { id },
      data: input,
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: input.outletId,
      action: 'EMPLOYEE_UPDATED',
      entityType: 'Employee',
      entityId: id,
    });

    return employee;
  }

  async deleteEmployee(id: string, organizationId: string, userId: string) {
    await this.findEmployee(id, organizationId);
    await this.prisma.client.employee.update({
      where: { id },
      data: { isActive: false },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'EMPLOYEE_DEACTIVATED',
      entityType: 'Employee',
      entityId: id,
    });

    return { success: true };
  }

  // --- Attendance ---

  async checkIn(employeeId: string, organizationId: string, userId: string) {
    await this.findEmployee(employeeId, organizationId);

    const open = await this.prisma.client.attendance.findFirst({
      where: { employeeId, checkOutAt: null },
    });
    if (open) {
      throw new BadRequestException('Employee already checked in');
    }

    const attendance = await this.prisma.client.attendance.create({
      data: { employeeId, checkInAt: new Date() },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'ATTENDANCE_CHECK_IN',
      entityType: 'Attendance',
      entityId: attendance.id,
    });

    return attendance;
  }

  async checkOut(employeeId: string, organizationId: string, userId: string) {
    await this.findEmployee(employeeId, organizationId);

    const open = await this.prisma.client.attendance.findFirst({
      where: { employeeId, checkOutAt: null },
      orderBy: { checkInAt: 'desc' },
    });
    if (!open) {
      throw new BadRequestException('No active check-in found');
    }

    const attendance = await this.prisma.client.attendance.update({
      where: { id: open.id },
      data: { checkOutAt: new Date() },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'ATTENDANCE_CHECK_OUT',
      entityType: 'Attendance',
      entityId: attendance.id,
    });

    return attendance;
  }

  async getAttendance(employeeId: string, organizationId: string) {
    await this.findEmployee(employeeId, organizationId);
    return this.prisma.client.attendance.findMany({
      where: { employeeId },
      orderBy: { checkInAt: 'desc' },
      take: 30,
    });
  }

  // --- Cashier Shifts ---

  async findShifts(outletId: string, status?: string) {
    return this.prisma.client.cashierShift.findMany({
      where: {
        outletId,
        ...(status ? { status } : {}),
      },
      include: {
        employee: true,
        cashMovements: true,
      },
      orderBy: { openedAt: 'desc' },
    });
  }

  async openShift(
    organizationId: string,
    userId: string,
    input: OpenShiftInput,
  ) {
    await this.findEmployee(input.employeeId, organizationId);

    const openShift = await this.prisma.client.cashierShift.findFirst({
      where: {
        outletId: input.outletId,
        employeeId: input.employeeId,
        status: 'OPEN',
      },
    });
    if (openShift) {
      throw new BadRequestException('Employee already has an open shift');
    }

    const shift = await this.prisma.client.cashierShift.create({
      data: {
        outletId: input.outletId,
        employeeId: input.employeeId,
        openingCash: input.openingCash,
        notes: input.notes,
        status: 'OPEN',
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: input.outletId,
      action: 'SHIFT_OPENED',
      entityType: 'CashierShift',
      entityId: shift.id,
      newValue: { openingCash: input.openingCash },
    });

    return shift;
  }

  async closeShift(
    shiftId: string,
    organizationId: string,
    userId: string,
    input: CloseShiftInput,
  ) {
    const shift = await this.prisma.client.cashierShift.findUnique({
      where: { id: shiftId },
      include: { employee: true, cashMovements: true },
    });
    if (!shift || shift.employee.organizationId !== organizationId) {
      throw new NotFoundException('Shift not found');
    }
    if (shift.status !== 'OPEN') {
      throw new BadRequestException('Shift is not open');
    }

    const movementTotal = shift.cashMovements.reduce((sum, m) => {
      return m.type === 'IN' ? sum + m.amount : sum - m.amount;
    }, 0);

    const expectedCash = shift.openingCash + movementTotal;
    const variance = input.closingCash - expectedCash;

    const updated = await this.prisma.client.cashierShift.update({
      where: { id: shiftId },
      data: {
        closingCash: input.closingCash,
        expectedCash,
        variance,
        status: 'CLOSED',
        closedAt: new Date(),
        notes: input.notes ?? shift.notes,
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: shift.outletId,
      action: 'SHIFT_CLOSED',
      entityType: 'CashierShift',
      entityId: shiftId,
      newValue: { closingCash: input.closingCash, variance },
    });

    return updated;
  }

  async recordCashMovement(
    organizationId: string,
    userId: string,
    input: CashMovementInput,
  ) {
    const shift = await this.prisma.client.cashierShift.findUnique({
      where: { id: input.shiftId },
      include: { employee: true },
    });
    if (!shift || shift.employee.organizationId !== organizationId) {
      throw new NotFoundException('Shift not found');
    }
    if (shift.status !== 'OPEN') {
      throw new BadRequestException('Cannot record movement on closed shift');
    }

    const movement = await this.prisma.client.cashMovement.create({
      data: input,
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: shift.outletId,
      action: 'CASH_MOVEMENT_RECORDED',
      entityType: 'CashMovement',
      entityId: movement.id,
      newValue: { type: input.type, amount: input.amount },
    });

    return movement;
  }
}
