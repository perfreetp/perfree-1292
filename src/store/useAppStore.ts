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
  setCurrentMonth: (m: string) => void;

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

      setCurrentMonth: (m) => set({ currentMonth: m }),

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

      addSchedule: (sc) => set((s) => ({ schedules: [...s.schedules, sc] })),
      updateSchedule: (id, sc) => set((s) => ({
        schedules: s.schedules.map((x) => x.id === id ? { ...x, ...sc } : x),
      })),
      deleteSchedule: (id) => set((s) => ({
        schedules: s.schedules.filter((x) => x.id !== id),
      })),
      batchAddSchedules: (list) => set((s) => {
        const existingKeys = new Set(s.schedules.map((x) => `${x.employeeId}_${x.date}`));
        const filtered = list.filter((x) => !existingKeys.has(`${x.employeeId}_${x.date}`));
        return { schedules: [...s.schedules, ...filtered] };
      }),

      batchImportPunch: (list) => set((s) => {
        const existingKeys = new Set(s.punchRecords.map((x) => `${x.employeeId}_${x.date}`));
        const filtered = list.filter((x) => !existingKeys.has(`${x.employeeId}_${x.date}`));
        return { punchRecords: [...s.punchRecords, ...filtered] };
      }),
      addPunch: (p) => set((s) => ({ punchRecords: [...s.punchRecords, p] })),
      updatePunch: (id, p) => set((s) => ({
        punchRecords: s.punchRecords.map((x) => x.id === id ? { ...x, ...p } : x),
      })),
      deletePunch: (id) => set((s) => ({
        punchRecords: s.punchRecords.filter((x) => x.id !== id),
      })),

      addException: (e) => set((s) => ({ exceptions: [...s.exceptions, e] })),
      updateException: (id, e) => set((s) => ({
        exceptions: s.exceptions.map((x) => x.id === id ? { ...x, ...e } : x),
      })),
      batchAddExceptions: (list) => set((s) => ({ exceptions: [...s.exceptions, ...list] })),

      addMakeup: (m) => set((s) => ({ makeupRecords: [...s.makeupRecords, m] })),
      updateMakeup: (id, m) => set((s) => ({
        makeupRecords: s.makeupRecords.map((x) => x.id === id ? { ...x, ...m } : x),
      })),
      approveMakeup: (id) => set((s) => ({
        makeupRecords: s.makeupRecords.map((x) => x.id === id ? { ...x, approved: true } : x),
      })),

      addLeave: (l) => set((s) => ({ leaveRecords: [...s.leaveRecords, l] })),
      updateLeave: (id, l) => set((s) => ({
        leaveRecords: s.leaveRecords.map((x) => x.id === id ? { ...x, ...l } : x),
      })),
      approveLeave: (id) => set((s) => ({
        leaveRecords: s.leaveRecords.map((x) => x.id === id ? { ...x, approved: true } : x),
      })),
      deleteLeave: (id) => set((s) => ({
        leaveRecords: s.leaveRecords.filter((x) => x.id !== id),
      })),

      addOvertime: (o) => set((s) => ({ overtimeRecords: [...s.overtimeRecords, o] })),
      updateOvertime: (id, o) => set((s) => ({
        overtimeRecords: s.overtimeRecords.map((x) => x.id === id ? { ...x, ...o } : x),
      })),
      approveOvertime: (id) => set((s) => ({
        overtimeRecords: s.overtimeRecords.map((x) => x.id === id ? { ...x, approved: true } : x),
      })),
      deleteOvertime: (id) => set((s) => ({
        overtimeRecords: s.overtimeRecords.filter((x) => x.id !== id),
      })),

      addSocialFund: (sf) => set((s) => ({ socialFunds: [...s.socialFunds, sf] })),
      updateSocialFund: (id, sf) => set((s) => ({
        socialFunds: s.socialFunds.map((x) => x.id === id ? { ...x, ...sf } : x),
      })),
      batchAddSocialFunds: (list) => set((s) => ({ socialFunds: [...s.socialFunds, ...list] })),

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
