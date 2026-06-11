import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Employee, Shift, Schedule, PunchRecord, AttendanceException,
  MakeupRecord, LeaveRecord, OvertimeRecord, SocialHousingFund,
  Payroll, Payslip, DepartmentSummary,
} from '../types';
import { generateMockData } from '../utils/mockData';

interface AppState {
  employees: Employee[];
  shifts: Shift[];
  schedules: Schedule[];
  punchRecords: PunchRecord[];
  exceptions: AttendanceException[];
  makeupRecords: MakeupRecord[];
  leaveRecords: LeaveRecord[];
  overtimeRecords: OvertimeRecord[];
  socialFunds: SocialHousingFund[];
  payrolls: Payroll[];
  payslips: Payslip[];
  currentMonth: string;
  lockedMonths: string[];
  setCurrentMonth: (m: string) => void;
  lockMonth: (month: string) => void;
  unlockMonth: (month: string) => void;
  isMonthLocked: (month: string) => boolean;

  addEmployee: (e: Employee) => void;
  updateEmployee: (id: string, e: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;

  addShift: (s: Shift) => void;
  updateShift: (id: string, s: Partial<Shift>) => void;
  deleteShift: (id: string) => void;

  addSchedule: (s: Schedule) => void;
  updateSchedule: (id: string, s: Partial<Schedule>) => void;
  deleteSchedule: (id: string) => void;
  batchAddSchedules: (list: Schedule[]) => void;

  batchImportPunch: (list: PunchRecord[]) => void;
  addPunch: (p: PunchRecord) => void;
  updatePunch: (id: string, p: Partial<PunchRecord>) => void;
  deletePunch: (id: string) => void;

  addException: (e: AttendanceException) => void;
  updateException: (id: string, e: Partial<AttendanceException>) => void;
  batchAddExceptions: (list: AttendanceException[]) => void;

  addMakeup: (m: MakeupRecord) => void;
  updateMakeup: (id: string, m: Partial<MakeupRecord>) => void;
  approveMakeup: (id: string) => void;

  addLeave: (l: LeaveRecord) => void;
  updateLeave: (id: string, l: Partial<LeaveRecord>) => void;
  approveLeave: (id: string) => void;
  deleteLeave: (id: string) => void;

  addOvertime: (o: OvertimeRecord) => void;
  updateOvertime: (id: string, o: Partial<OvertimeRecord>) => void;
  approveOvertime: (id: string) => void;
  deleteOvertime: (id: string) => void;

  addSocialFund: (s: SocialHousingFund) => void;
  updateSocialFund: (id: string, s: Partial<SocialHousingFund>) => void;
  batchAddSocialFunds: (list: SocialHousingFund[]) => void;

  addPayroll: (p: Payroll) => void;
  updatePayroll: (id: string, p: Partial<Payroll>) => void;
  batchAddPayrolls: (list: Payroll[]) => void;
  reviewPayroll: (id: string, reviewer: string) => void;
  confirmPayroll: (id: string) => void;

  addPayslip: (p: Payslip) => void;
  updatePayslip: (id: string, p: Partial<Payslip>) => void;
  batchAddPayslips: (list: Payslip[]) => void;
}

const initialMock = generateMockData();

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialMock,
      currentMonth: initialMock.currentMonth,
      lockedMonths: [],

      setCurrentMonth: (m) => set({ currentMonth: m }),
      lockMonth: (month) => set((s) => ({ lockedMonths: s.lockedMonths.includes(month) ? s.lockedMonths : [...s.lockedMonths, month] })),
      unlockMonth: (month) => set((s) => ({ lockedMonths: s.lockedMonths.filter((m) => m !== month) })),
      isMonthLocked: (month) => get().lockedMonths.includes(month),

      addEmployee: (e) => set((s) => ({ employees: [...s.employees, e] })),
      updateEmployee: (id, e) => set((s) => ({
        employees: s.employees.map((x) => x.id === id ? { ...x, ...e } : x),
      })),
      deleteEmployee: (id) => set((s) => ({
        employees: s.employees.filter((x) => x.id !== id),
      })),

      addShift: (s) => set((st) => ({ shifts: [...st.shifts, s] })),
      updateShift: (id, sh) => set((st) => ({
        shifts: st.shifts.map((x) => x.id === id ? { ...x, ...sh } : x),
      })),
      deleteShift: (id) => set((st) => ({
        shifts: st.shifts.filter((x) => x.id !== id),
      })),

      addSchedule: (sc) => {
        const st = get();
        const month = dayjs(sc.date).format('YYYY-MM');
        if (st.lockedMonths.includes(month)) return;
        set({ schedules: [...st.schedules, sc] });
      },
      updateSchedule: (id, sc) => {
        const st = get();
        const old = st.schedules.find((x) => x.id === id);
        if (!old) return;
        const month = dayjs(old.date).format('YYYY-MM');
        if (st.lockedMonths.includes(month)) return;
        set({ schedules: st.schedules.map((x) => x.id === id ? { ...x, ...sc } : x) });
      },
      deleteSchedule: (id) => {
        const st = get();
        const old = st.schedules.find((x) => x.id === id);
        if (!old) return;
        const month = dayjs(old.date).format('YYYY-MM');
        if (st.lockedMonths.includes(month)) return;
        set({ schedules: st.schedules.filter((x) => x.id !== id) });
      },
      batchAddSchedules: (list) => {
        const st = get();
        const existingKeys = new Set(st.schedules.map((x) => `${x.employeeId}_${x.date}`));
        const filtered = list.filter((x) => !existingKeys.has(`${x.employeeId}_${x.date}`) && !st.lockedMonths.includes(dayjs(x.date).format('YYYY-MM')));
        set({ schedules: [...st.schedules, ...filtered] });
      },

      batchImportPunch: (list) => {
        const st = get();
        const existingKeys = new Set(st.punchRecords.map((x) => `${x.employeeId}_${x.date}`));
        const filtered = list.filter((x) => !existingKeys.has(`${x.employeeId}_${x.date}`) && !st.lockedMonths.includes(dayjs(x.date).format('YYYY-MM')));
        set({ punchRecords: [...st.punchRecords, ...filtered] });
      },
      addPunch: (p) => {
        const st = get();
        const month = dayjs(p.date).format('YYYY-MM');
        if (st.lockedMonths.includes(month)) return;
        set({ punchRecords: [...st.punchRecords, p] });
      },
      updatePunch: (id, p) => {
        const st = get();
        const old = st.punchRecords.find((x) => x.id === id);
        if (!old) return;
        const month = dayjs(old.date).format('YYYY-MM');
        if (st.lockedMonths.includes(month)) return;
        set({ punchRecords: st.punchRecords.map((x) => x.id === id ? { ...x, ...p } : x) });
      },
      deletePunch: (id) => {
        const st = get();
        const old = st.punchRecords.find((x) => x.id === id);
        if (!old) return;
        const month = dayjs(old.date).format('YYYY-MM');
        if (st.lockedMonths.includes(month)) return;
        set({ punchRecords: st.punchRecords.filter((x) => x.id !== id) });
      },

      addException: (e) => {
        const st = get();
        const month = dayjs(e.date).format('YYYY-MM');
        if (st.lockedMonths.includes(month)) return;
        set({ exceptions: [...st.exceptions, e] });
      },
      updateException: (id, e) => {
        const st = get();
        const old = st.exceptions.find(x => x.id === id);
        if (!old) return;
        const month = dayjs(old.date).format('YYYY-MM');
        if (st.lockedMonths.includes(month)) return;
        set({ exceptions: st.exceptions.map((x) => x.id === id ? { ...x, ...e } : x) });
        if (e.handled) get().recalcPayrollForEmployee(old.employeeId, month);
      },
      batchAddExceptions: (list) => set((s) => ({ exceptions: [...s.exceptions, ...list] })),

      recalcPayrollForEmployee: (employeeId: string, monthStr: string) => {
        const s = get();
        const payroll = s.payrolls.find(p => p.employeeId === employeeId && p.month === monthStr);
        if (!payroll) return;
        const emp = s.employees.find(e => e.id === employeeId);
        if (!emp || !emp.active || dayjs(emp.joinDate).isAfter(monthStr + '-31')) return;
        if (emp.leaveDate && dayjs(emp.leaveDate).isBefore(monthStr + '-01')) return;
        const exc = s.exceptions.filter(e => e.employeeId === employeeId && e.date.startsWith(monthStr));
        const lvDeduct = s.leaveRecords
          .filter(r => r.employeeId === employeeId && r.approved && dayjs(r.startDate).format('YYYY-MM') === monthStr)
          .reduce((sum, r) => sum + (r.deductAmount || 0), 0);
        const otPay = s.overtimeRecords
          .filter(r => r.employeeId === employeeId && r.approved && dayjs(r.overtimeDate || r.date).format('YYYY-MM') === monthStr)
          .reduce((sum, r) => sum + (r.amount || 0), 0);
        const sf = s.socialFunds.find(f => f.employeeId === employeeId && f.month === monthStr);
        const updated = recalcOnePayroll({ payroll, employee: emp, socialFund: sf, monthLeaveDeduct: lvDeduct, monthOTPay: otPay, monthExceptions: exc, monthStr });
        set({ payrolls: s.payrolls.map(p => p.id === payroll.id ? updated : p) });
      },

      addMakeup: (m) => {
        const st = get();
        const alreadyLocked = st.lockedMonths.includes(dayjs(m.date).format('YYYY-MM'));
        if (!m.approved) {
          set({ makeupRecords: [...st.makeupRecords, m] });
          return;
        }
        if (alreadyLocked) return;
        const newMakeup = [...st.makeupRecords, m];
        const punchIndex = st.punchRecords.findIndex((p) => p.employeeId === m.employeeId && p.date === m.date);
        let newPunches = st.punchRecords;
        if (punchIndex >= 0) {
          const existing = st.punchRecords[punchIndex];
          const upd = m.punchType === 'in'
            ? { ...existing, punchIn: m.correctedTime }
            : { ...existing, punchOut: m.correctedTime };
          newPunches = st.punchRecords.map((p, i) => i === punchIndex ? upd : p);
        } else {
          newPunches = [
            ...st.punchRecords,
            {
              id: `punch_mk_${m.id}`,
              employeeId: m.employeeId,
              date: m.date,
              punchIn: m.punchType === 'in' ? m.correctedTime : undefined,
              punchOut: m.punchType === 'out' ? m.correctedTime : undefined,
              source: 'manual' as const,
              remark: `补卡登记:${m.punchType === 'in' ? '上班' : '下班'}`,
            } as any,
          ];
        }
        const mkRemark = `补卡通过(${m.punchType === 'in' ? '上班' : '下班'}卡:${m.correctedTime})`;
        const newExceptions = st.exceptions.map((e) => {
          if (e.employeeId !== m.employeeId || e.date !== m.date) return e;
          if (e.type === 'missing_punch') return { ...e, handled: true, handleType: 'makeup' as const, remark: e.remark ? `${e.remark};${mkRemark}` : mkRemark };
          if (e.type === 'absent') {
            const punchNow = newPunches.find((p) => p.employeeId === m.employeeId && p.date === m.date);
            if (punchNow && punchNow.punchIn && punchNow.punchOut) {
              return { ...e, handled: true, handleType: 'makeup' as const, remark: e.remark ? `${e.remark};${mkRemark}` : mkRemark };
            }
          }
          return e;
        });
        const monthStr = dayjs(m.date).format('YYYY-MM');
        set({ makeupRecords: newMakeup, punchRecords: newPunches, exceptions: newExceptions });
        get().recalcPayrollForEmployee(m.employeeId, monthStr);
      },
      updateMakeup: (id, m) => {
        const st = get();
        const old = st.makeupRecords.find((x) => x.id === id);
        if (!old) return;
        const wasApproved = old.approved;
        const updated = { ...old, ...m };
        const newMakeup = st.makeupRecords.map((x) => x.id === id ? updated : x);
        const monthStr = dayjs(updated.date).format('YYYY-MM');
        if (wasApproved && updated.approved) {
          set({ makeupRecords: newMakeup });
          return;
        }
        const locked = st.lockedMonths.includes(monthStr);
        if (!wasApproved && updated.approved && !locked) {
          const punchIndex = st.punchRecords.findIndex((p) => p.employeeId === updated.employeeId && p.date === updated.date);
          let newPunches = st.punchRecords;
          if (punchIndex >= 0) {
            const existing = st.punchRecords[punchIndex];
            const upd = updated.punchType === 'in'
              ? { ...existing, punchIn: updated.correctedTime }
              : { ...existing, punchOut: updated.correctedTime };
            newPunches = st.punchRecords.map((p, i) => i === punchIndex ? upd : p);
          } else {
            newPunches = [
              ...st.punchRecords,
              {
                id: `punch_mk_${id}`,
                employeeId: updated.employeeId,
                date: updated.date,
                punchIn: updated.punchType === 'in' ? updated.correctedTime : undefined,
                punchOut: updated.punchType === 'out' ? updated.correctedTime : undefined,
                source: 'manual' as const,
                remark: `补卡登记:${updated.punchType === 'in' ? '上班' : '下班'}`,
              } as any,
            ];
          }
          const mkRemark = `补卡通过(${updated.punchType === 'in' ? '上班' : '下班'}卡:${updated.correctedTime})`;
          const newExceptions = st.exceptions.map((e) => {
            if (e.employeeId !== updated.employeeId || e.date !== updated.date) return e;
            if (e.type === 'missing_punch') return { ...e, handled: true, handleType: 'makeup' as const, remark: e.remark ? `${e.remark};${mkRemark}` : mkRemark };
            if (e.type === 'absent') {
              const punchNow = newPunches.find((p) => p.employeeId === updated.employeeId && p.date === updated.date);
              if (punchNow && punchNow.punchIn && punchNow.punchOut) {
                return { ...e, handled: true, handleType: 'makeup' as const, remark: e.remark ? `${e.remark};${mkRemark}` : mkRemark };
              }
            }
            return e;
          });
          set({ makeupRecords: newMakeup, punchRecords: newPunches, exceptions: newExceptions });
          get().recalcPayrollForEmployee(updated.employeeId, monthStr);
          return;
        }
        if (!wasApproved && updated.approved && locked) return;
        set({ makeupRecords: newMakeup });
      },
      approveMakeup: (id) => {
        const st = get();
        const mk = st.makeupRecords.find((x) => x.id === id);
        if (!mk || mk.approved) return;
        const monthStr = dayjs(mk.date).format('YYYY-MM');
        if (st.lockedMonths.includes(monthStr)) return;
        const newMakeup = st.makeupRecords.map((x) => x.id === id ? { ...x, approved: true } : x);
        const punchIndex = st.punchRecords.findIndex((p) => p.employeeId === mk.employeeId && p.date === mk.date);
        let newPunches = st.punchRecords;
        if (punchIndex >= 0) {
          const existing = st.punchRecords[punchIndex];
          const upd = mk.punchType === 'in'
            ? { ...existing, punchIn: mk.correctedTime }
            : { ...existing, punchOut: mk.correctedTime };
          newPunches = st.punchRecords.map((p, i) => i === punchIndex ? upd : p);
        } else {
          newPunches = [
            ...st.punchRecords,
            {
              id: `punch_mk_${id}`,
              employeeId: mk.employeeId,
              date: mk.date,
              punchIn: mk.punchType === 'in' ? mk.correctedTime : undefined,
              punchOut: mk.punchType === 'out' ? mk.correctedTime : undefined,
              source: 'manual' as const,
              remark: `补卡登记:${mk.punchType === 'in' ? '上班' : '下班'}`,
            } as any,
          ];
        }
        const mkRemark = `补卡通过(${mk.punchType === 'in' ? '上班' : '下班'}卡:${mk.correctedTime})`;
        const newExceptions = st.exceptions.map((e) => {
          if (e.employeeId !== mk.employeeId || e.date !== mk.date) return e;
          if (e.type === 'missing_punch') return { ...e, handled: true, handleType: 'makeup' as const, remark: e.remark ? `${e.remark};${mkRemark}` : mkRemark };
          if (e.type === 'absent') {
            const punchNow = newPunches.find((p) => p.employeeId === mk.employeeId && p.date === mk.date);
            if (punchNow && punchNow.punchIn && punchNow.punchOut) {
              return { ...e, handled: true, handleType: 'makeup' as const, remark: e.remark ? `${e.remark};${mkRemark}` : mkRemark };
            }
          }
          return e;
        });
        set({ makeupRecords: newMakeup, punchRecords: newPunches, exceptions: newExceptions });
        get().recalcPayrollForEmployee(mk.employeeId, monthStr);
      },

      addLeave: (l) => {
        const st = get();
        const month = dayjs(l.startDate).format('YYYY-MM');
        if (st.lockedMonths.includes(month)) return;
        set({ leaveRecords: [...st.leaveRecords, l] });
      },
      updateLeave: (id, l) => {
        const st = get();
        const old = st.leaveRecords.find(x => x.id === id);
        if (!old) return;
        const month = dayjs(old.startDate).format('YYYY-MM');
        if (st.lockedMonths.includes(month)) return;
        set({ leaveRecords: st.leaveRecords.map((x) => x.id === id ? { ...x, ...l } : x) });
      },
      approveLeave: (id) => {
        const st = get();
        const old = st.leaveRecords.find(x => x.id === id);
        if (!old || old.approved) return;
        const month = dayjs(old.startDate).format('YYYY-MM');
        if (st.lockedMonths.includes(month)) return;
        set({ leaveRecords: st.leaveRecords.map((x) => x.id === id ? { ...x, approved: true } : x) });
        get().recalcPayrollForEmployee(old.employeeId, month);
      },
      deleteLeave: (id) => {
        const st = get();
        const old = st.leaveRecords.find(x => x.id === id);
        if (!old) return;
        const month = dayjs(old.startDate).format('YYYY-MM');
        if (st.lockedMonths.includes(month)) return;
        set({ leaveRecords: st.leaveRecords.filter((x) => x.id !== id) });
        get().recalcPayrollForEmployee(old.employeeId, month);
      },

      addOvertime: (o) => {
        const st = get();
        const month = dayjs(o.overtimeDate || o.date).format('YYYY-MM');
        if (st.lockedMonths.includes(month)) return;
        set({ overtimeRecords: [...st.overtimeRecords, o] });
      },
      updateOvertime: (id, o) => {
        const st = get();
        const old = st.overtimeRecords.find(x => x.id === id);
        if (!old) return;
        const month = dayjs(old.overtimeDate || old.date).format('YYYY-MM');
        if (st.lockedMonths.includes(month)) return;
        set({ overtimeRecords: st.overtimeRecords.map((x) => x.id === id ? { ...x, ...o } : x) });
      },
      approveOvertime: (id) => {
        const st = get();
        const old = st.overtimeRecords.find(x => x.id === id);
        if (!old || old.approved) return;
        const month = dayjs(old.overtimeDate || old.date).format('YYYY-MM');
        if (st.lockedMonths.includes(month)) return;
        set({ overtimeRecords: st.overtimeRecords.map((x) => x.id === id ? { ...x, approved: true } : x) });
        get().recalcPayrollForEmployee(old.employeeId, month);
      },
      deleteOvertime: (id) => {
        const st = get();
        const old = st.overtimeRecords.find(x => x.id === id);
        if (!old) return;
        const month = dayjs(old.overtimeDate || old.date).format('YYYY-MM');
        if (st.lockedMonths.includes(month)) return;
        set({ overtimeRecords: st.overtimeRecords.filter((x) => x.id !== id) });
        get().recalcPayrollForEmployee(old.employeeId, month);
      },

      addSocialFund: (sf) => {
        const st = get();
        if (st.lockedMonths.includes(sf.month)) return;
        set({ socialFunds: [...st.socialFunds, sf] });
        get().recalcPayrollForEmployee(sf.employeeId, sf.month);
      },
      updateSocialFund: (id, sf) => {
        const st = get();
        const old = st.socialFunds.find(x => x.id === id);
        if (!old) return;
        if (st.lockedMonths.includes(old.month)) return;
        set({ socialFunds: st.socialFunds.map((x) => x.id === id ? { ...x, ...sf } : x) });
        get().recalcPayrollForEmployee(old.employeeId, old.month);
      },
      batchAddSocialFunds: (list) => {
        const st = get();
        const filtered = list.filter(sf => !st.lockedMonths.includes(sf.month));
        if (filtered.length === 0) return;
        set({ socialFunds: [...st.socialFunds, ...filtered] });
        filtered.forEach(sf => get().recalcPayrollForEmployee(sf.employeeId, sf.month));
      },

      addPayroll: (p) => set((s) => ({ payrolls: [...s.payrolls, p] })),
      updatePayroll: (id, p) => set((s) => ({
        payrolls: s.payrolls.map((x) => x.id === id ? { ...x, ...p, updateTime: new Date().toISOString() } : x),
      })),
      batchAddPayrolls: (list) => set((s) => ({ payrolls: [...s.payrolls, ...list] })),
      reviewPayroll: (id, reviewer) => set((s) => ({
        payrolls: s.payrolls.map((x) => x.id === id ? { ...x, reviewed: true, reviewer, reviewTime: new Date().toISOString(), updateTime: new Date().toISOString() } : x),
      })),
      confirmPayroll: (id) => set((s) => ({
        payrolls: s.payrolls.map((x) => x.id === id ? { ...x, confirmed: true, confirmTime: new Date().toISOString(), updateTime: new Date().toISOString() } : x),
      })),

      addPayslip: (p) => set((s) => ({ payslips: [...s.payslips, p] })),
      updatePayslip: (id, p) => set((s) => ({
        payslips: s.payslips.map((x) => x.id === id ? { ...x, ...p } : x),
      })),
      batchAddPayslips: (list) => set((s) => ({ payslips: [...s.payslips, ...list] })),
    }),
    {
      name: 'hrms-payroll-storage',
      partialize: (state) => ({
        employees: state.employees,
        shifts: state.shifts,
        schedules: state.schedules,
        punchRecords: state.punchRecords,
        exceptions: state.exceptions,
        makeupRecords: state.makeupRecords,
        leaveRecords: state.leaveRecords,
        overtimeRecords: state.overtimeRecords,
        socialFunds: state.socialFunds,
        payrolls: state.payrolls,
        payslips: state.payslips,
        currentMonth: state.currentMonth,
        lockedMonths: state.lockedMonths,
      }),
    },
  ),
);

export function computeDepartmentSummary(payrolls: Payroll[], socialFunds: SocialHousingFund[], employees: Employee[]): DepartmentSummary[] {
  const deptMap = new Map<string, DepartmentSummary>();
  const empMap = new Map(employees.map((e) => [e.id, e]));

  payrolls.forEach((p) => {
    const emp = empMap.get(p.employeeId);
    if (!emp) return;
    const dept = emp.department;
    if (!deptMap.has(dept)) {
      deptMap.set(dept, {
        department: dept,
        headcount: 0,
        totalBaseSalary: 0,
        totalOvertimePay: 0,
        totalBonus: 0,
        totalAllowance: 0,
        totalIncome: 0,
        totalSocialCompany: 0,
        totalHousingFundCompany: 0,
        totalCost: 0,
        avgSalary: 0,
      });
    }
    const d = deptMap.get(dept)!;
    d.headcount++;
    d.totalBaseSalary += p.baseSalary;
    d.totalOvertimePay += p.overtimePay;
    d.totalBonus += p.bonus;
    d.totalAllowance += p.allowance;
    d.totalIncome += p.totalIncome;
  });

  socialFunds.forEach((sf) => {
    const emp = empMap.get(sf.employeeId);
    if (!emp) return;
    const d = deptMap.get(emp.department);
    if (d) {
      d.totalSocialCompany += (sf.pensionCompany + sf.medicalCompany + sf.unemploymentCompany + sf.injuryCompany + sf.maternityCompany);
      d.totalHousingFundCompany += sf.housingFundCompany;
    }
  });

  deptMap.forEach((d) => {
    d.totalCost = d.totalIncome + d.totalSocialCompany + d.totalHousingFundCompany;
    d.avgSalary = d.headcount > 0 ? Math.round(d.totalIncome / d.headcount) : 0;
  });

  return Array.from(deptMap.values());
}
