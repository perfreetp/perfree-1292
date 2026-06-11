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
