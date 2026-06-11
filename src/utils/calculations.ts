import dayjs from 'dayjs';
import type { TaxBracket } from '../types';

const TAX_BRACKETS: TaxBracket[] = [
  { min: 0, max: 36000, rate: 0.03, deduction: 0 },
  { min: 36000, max: 144000, rate: 0.10, deduction: 2520 },
  { min: 144000, max: 300000, rate: 0.20, deduction: 16920 },
  { min: 300000, max: 420000, rate: 0.25, deduction: 31920 },
  { min: 420000, max: 660000, rate: 0.30, deduction: 52920 },
  { min: 660000, max: 960000, rate: 0.35, deduction: 85920 },
  { min: 960000, max: Infinity, rate: 0.45, deduction: 181920 },
];

export function calculateTax(yearlyTaxableIncome: number): number {
  for (const bracket of TAX_BRACKETS) {
    if (yearlyTaxableIncome > bracket.min && yearlyTaxableIncome <= bracket.max) {
      return Math.max(0, Math.round(yearlyTaxableIncome * bracket.rate - bracket.deduction));
    }
  }
  return 0;
}

export function calculateMonthlyTax(
  monthlyTaxable: number,
  previousCumulativeTaxable: number,
  previousCumulativeTax: number,
): number {
  const totalCumulativeTaxable = previousCumulativeTaxable + monthlyTaxable;
  const totalCumulativeTax = calculateTax(totalCumulativeTaxable);
  return Math.max(0, totalCumulativeTax - previousCumulativeTax);
}

export const SOCIAL_RATES = {
  pension: { personal: 0.08, company: 0.16 },
  medical: { personal: 0.02, company: 0.095 },
  unemployment: { personal: 0.005, company: 0.005 },
  injury: { personal: 0, company: 0.002 },
  maternity: { personal: 0, company: 0.008 },
  housingFund: { personal: 0.12, company: 0.12 },
};

export function calculateSocialFund(base: number) {
  const b = Math.max(0, base);
  const result = {
    pensionPersonal: Math.round(b * SOCIAL_RATES.pension.personal),
    pensionCompany: Math.round(b * SOCIAL_RATES.pension.company),
    medicalPersonal: Math.round(b * SOCIAL_RATES.medical.personal),
    medicalCompany: Math.round(b * SOCIAL_RATES.medical.company),
    unemploymentPersonal: Math.round(b * SOCIAL_RATES.unemployment.personal),
    unemploymentCompany: Math.round(b * SOCIAL_RATES.unemployment.company),
    injuryCompany: Math.round(b * SOCIAL_RATES.injury.company),
    maternityCompany: Math.round(b * SOCIAL_RATES.maternity.company),
  };
  return {
    ...result,
    totalPersonal: result.pensionPersonal + result.medicalPersonal + result.unemploymentPersonal,
    totalCompany: result.pensionCompany + result.medicalCompany + result.unemploymentCompany + result.injuryCompany + result.maternityCompany,
  };
}

export function calculateHousingFund(base: number) {
  const b = Math.max(0, base);
  return {
    housingFundPersonal: Math.round(b * SOCIAL_RATES.housingFund.personal),
    housingFundCompany: Math.round(b * SOCIAL_RATES.housingFund.company),
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function genId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTimeStr(mins: number): string {
  const sign = mins < 0 ? '-' : '';
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function diffMinutes(start: string, end: string): number {
  return parseTimeToMinutes(end) - parseTimeToMinutes(start);
}

export function getDaysInMonth(month: string): number {
  return dayjs(month + '-01').daysInMonth();
}

export function getDateList(month: string): string[] {
  const days = getDaysInMonth(month);
  const list: string[] = [];
  for (let i = 1; i <= days; i++) {
    list.push(dayjs(month + '-01').date(i).format('YYYY-MM-DD'));
  }
  return list;
}

export function isWeekend(dateStr: string): boolean {
  const d = dayjs(dateStr);
  return d.day() === 0 || d.day() === 6;
}

export const LEAVE_DEDUCT_RATES: Record<string, number> = {
  '年假': 0,
  '事假': 1,
  '病假': 0.4,
  '婚假': 0,
  '产假': 0,
  '丧假': 0,
  '调休': 0,
};

export const OVERTIME_RATES: Record<string, number> = {
  'normal': 1.5,
  'weekend': 2,
  'holiday': 3,
};

export function calculateDailyWage(baseSalary: number, workDays = 21.75): number {
  return round2(baseSalary / workDays);
}

export function calculateHourlyWage(baseSalary: number, workDays = 21.75, dailyHours = 8): number {
  return round2(calculateDailyWage(baseSalary, workDays) / dailyHours);
}

export function parseExcelDate(value: any): dayjs.Dayjs | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    const t = value.getTime();
    return isNaN(t) ? null : dayjs(value);
  }
  if (typeof value === 'number') {
    if (value < 1000) return null;
    if (value > 25000 && value < 80000) {
      const ms = Math.round((value - 25569) * 86400 * 1000);
      const d = new Date(ms);
      return isNaN(d.getTime()) ? null : dayjs(d);
    }
    if (value > 80000) {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : dayjs(d);
    }
    return null;
  }
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return null;
    if (/^\d{5}(\.\d+)?$/.test(s)) {
      const n = parseFloat(s);
      return parseExcelDate(n);
    }
    const d = dayjs(s);
    return d.isValid() ? d : null;
  }
  return null;
}

export function parseExcelDateToStr(value: any, format = 'YYYY-MM-DD'): string {
  const d = parseExcelDate(value);
  return d ? d.format(format) : '';
}

export function parseExcelTimeToStr(value: any): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') {
    if (value >= 0 && value < 2) {
      const totalMinutes = Math.round(value * 24 * 60);
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    if (value > 25000) {
      const d = parseExcelDate(value);
      return d ? d.format('HH:mm') : '';
    }
    return '';
  }
  if (value instanceof Date) {
    return dayjs(value).format('HH:mm');
  }
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return '';
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
      const parts = s.split(':');
      return `${String(Number(parts[0])).padStart(2, '0')}:${parts[1]}`;
    }
    const d = parseExcelDate(s);
    return d ? d.format('HH:mm') : '';
  }
  return '';
}

import type { PunchRecord, Schedule, Shift, AttendanceException } from '../types';

export interface AttendanceAnalyzeInput {
  punchRecords: PunchRecord[];
  schedules: Schedule[];
  shifts: Shift[];
  month?: string;
}

export function analyzeAttendanceExceptions(input: AttendanceAnalyzeInput): AttendanceException[] {
  const { punchRecords, schedules, shifts, month } = input;
  const shiftMap = new Map(shifts.map((s) => [s.id, s]));
  const punchMap = new Map<string, PunchRecord>();
  punchRecords.forEach((p) => punchMap.set(`${p.employeeId}_${p.date}`, p));
  const exceptions: AttendanceException[] = [];
  const excKeySet = new Set<string>();
  const add = (e: Omit<AttendanceException, 'id'>) => {
    const key = `${e.employeeId}_${e.date}_${e.type}`;
    if (excKeySet.has(key)) return;
    excKeySet.add(key);
    exceptions.push({ ...e, id: genId('exc') });
  };
  schedules.forEach((sch) => {
    if (month && !sch.date.startsWith(month)) return;
    if (sch.type !== 'normal') return;
    const shift = shiftMap.get(sch.shiftId);
    if (!shift) return;
    const punch = punchMap.get(`${sch.employeeId}_${sch.date}`);
    const threshold = shift.lateThreshold ?? 0;
    const earlyTh = shift.earlyThreshold ?? 0;
    const startMin = parseTimeToMinutes(shift.startTime);
    const endMin = parseTimeToMinutes(shift.endTime);
    if (!punch || (!punch.punchIn && !punch.punchOut)) {
      add({
        employeeId: sch.employeeId, date: sch.date, type: 'absent', minutes: 0, handled: false,
      });
      return;
    }
    if (!punch.punchIn) {
      add({
        employeeId: sch.employeeId, date: sch.date, type: 'missing_punch', minutes: 0, handled: false,
      });
    } else {
      const inMin = parseTimeToMinutes(punch.punchIn);
      if (inMin > startMin + threshold) {
        add({
          employeeId: sch.employeeId, date: sch.date, type: 'late',
          minutes: inMin - startMin, handled: false,
        });
      }
    }
    if (!punch.punchOut) {
      add({
        employeeId: sch.employeeId, date: sch.date, type: 'missing_punch', minutes: 0, handled: false,
      });
    } else {
      const outMin = parseTimeToMinutes(punch.punchOut);
      if (outMin < endMin - earlyTh && outMin > startMin) {
        add({
          employeeId: sch.employeeId, date: sch.date, type: 'early',
          minutes: endMin - outMin, handled: false,
        });
      }
    }
  });
  return exceptions;
}

export function calcLateEarlyDeduction(minutes: number): number {
  if (minutes <= 10) return 0;
  if (minutes <= 30) return 50;
  if (minutes <= 60) return 100;
  return 200;
}

export function calcExceptionDeduction(excList: any[], baseSalary: number): { lateDeduct: number; absentDeduct: number; missingDeduct: number; earlyDeduct: number; perItem: Array<{ id: string; amount: number }>; typeOfId: Record<string, string> } {
  let lateDeduct = 0;
  let absentDeduct = 0;
  let missingDeduct = 0;
  let earlyDeduct = 0;
  const perItem: Array<{ id: string; amount: number }> = [];
  const typeOfId: Record<string, string> = {};
  const dailyWage = calculateDailyWage(baseSalary);
  excList.forEach((e: any) => {
    typeOfId[e.id] = e.type;
    if (e.handled) { perItem.push({ id: e.id, amount: 0 }); return; }
    if (e.type === 'late') {
      const d = calcLateEarlyDeduction(e.minutes);
      lateDeduct += d; perItem.push({ id: e.id, amount: d });
    } else if (e.type === 'early') {
      const d = calcLateEarlyDeduction(e.minutes);
      earlyDeduct += d; perItem.push({ id: e.id, amount: d });
    } else if (e.type === 'absent') {
      absentDeduct += dailyWage; perItem.push({ id: e.id, amount: dailyWage });
    } else {
      perItem.push({ id: e.id, amount: 0 });
    }
  });
  return {
    lateDeduct: round2(lateDeduct),
    absentDeduct: round2(absentDeduct),
    missingDeduct: round2(missingDeduct),
    earlyDeduct: round2(earlyDeduct),
    perItem,
    typeOfId,
  };
}

import type { Employee, SalaryItem } from '../types';

export function recalcOnePayroll(input: {
  payroll: any;
  employee: Employee;
  socialFund: any;
  monthLeaveDeduct: number;
  monthOTPay: number;
  monthExceptions: any[];
  monthStr: string;
  priorCumTax?: { taxable: number; tax: number };
}): any {
  const { payroll, employee, socialFund, monthLeaveDeduct, monthOTPay, monthExceptions, monthStr, priorCumTax } = input;
  const personalSocial = socialFund ? (socialFund.pensionPersonal + socialFund.medicalPersonal + socialFund.unemploymentPersonal) : 0;
  const personalHF = socialFund ? socialFund.housingFundPersonal : 0;
  const socialPersonal = round2(personalSocial + personalHF);
  const exc = calcExceptionDeduction(monthExceptions, employee.baseSalary);
  const lateDeduction = round2(exc.lateDeduct + exc.absentDeduct + exc.earlyDeduct);
  const leaveDeduction = round2(monthLeaveDeduct);
  const overtimePay = round2(monthOTPay);
  const bonus = payroll.bonus ?? 0;
  const allowance = payroll.allowance ?? 0;
  const otherIncome = payroll.otherIncome ?? 0;
  const otherDeduction = payroll.otherDeduction ?? 0;
  const performance = payroll.performanceSalary ?? round2(employee.baseSalary * 0.85);
  const totalIncome = round2(employee.baseSalary + performance + overtimePay + bonus + allowance + otherIncome);

  const taxableBase = totalIncome - socialPersonal - leaveDeduction - lateDeduction - otherDeduction;
  const monthlyTaxable = Math.max(0, taxableBase - 5000);
  const prev = priorCumTax || { taxable: 0, tax: 0 };
  const personalTax = calculateMonthlyTax(monthlyTaxable, prev.taxable, prev.tax);

  const totalDeduction = round2(socialPersonal + personalTax + leaveDeduction + lateDeduction + otherDeduction);
  const netSalary = round2(totalIncome - totalDeduction);

  const items: SalaryItem[] = [
    { name: '基本工资', amount: employee.baseSalary, type: 'income', category: '固定工资' },
    { name: '绩效工资', amount: performance, type: 'income', category: '绩效奖金' },
    { name: '加班费', amount: overtimePay, type: 'income', category: '加班补贴' },
    { name: '奖金', amount: bonus, type: 'income', category: '绩效奖金' },
    { name: '岗位津贴', amount: allowance, type: 'income', category: '补贴津贴' },
    { name: '其他收入', amount: otherIncome, type: 'income', category: '其他' },
    { name: '养老保险个人', amount: socialFund?.pensionPersonal || 0, type: 'deduction', category: '社保公积金' },
    { name: '医疗保险个人', amount: socialFund?.medicalPersonal || 0, type: 'deduction', category: '社保公积金' },
    { name: '失业保险个人', amount: socialFund?.unemploymentPersonal || 0, type: 'deduction', category: '社保公积金' },
    { name: '住房公积金个人', amount: personalHF, type: 'deduction', category: '社保公积金' },
    { name: '个人所得税', amount: personalTax, type: 'deduction', category: '个人税' },
    { name: '请假扣款', amount: leaveDeduction, type: 'deduction', category: '考勤扣款' },
    { name: '迟到早退扣款', amount: lateDeduction, type: 'deduction', category: '考勤扣款' },
    { name: '其他扣款', amount: otherDeduction, type: 'deduction', category: '其他' },
  ];
  return {
    ...payroll,
    baseSalary: employee.baseSalary,
    performanceSalary: performance,
    overtimePay,
    totalIncome,
    socialPersonal,
    housingFundPersonal: personalHF,
    personalTax,
    leaveDeduction,
    lateDeduction,
    totalDeduction,
    netSalary,
    items,
    updateTime: new Date().toISOString(),
  };
}
