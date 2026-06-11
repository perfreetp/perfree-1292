export interface Employee {
  id: string;
  employeeNo: string;
  name: string;
  gender: '男' | '女';
  idCard: string;
  phone: string;
  department: string;
  position: string;
  hireDate: string;
  leaveDate?: string;
  status: '在职' | '离职' | '试用期';
  baseSalary: number;
  socialBase: number;
  housingFundBase: number;
  bankCard: string;
  email: string;
  address: string;
  remark?: string;
  avatar?: string;
}

export interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  restStart?: string;
  restEnd?: string;
  lateThreshold: number;
  earlyThreshold: number;
  workHours: number;
  color: string;
}

export interface Schedule {
  id: string;
  employeeId: string;
  date: string;
  shiftId: string;
  type: 'normal' | 'overtime' | 'leave' | 'rest';
  remark?: string;
}

export interface PunchRecord {
  id: string;
  employeeId: string;
  date: string;
  punchIn?: string;
  punchOut?: string;
  source: 'import' | 'manual';
  remark?: string;
}

export interface AttendanceException {
  id: string;
  employeeId: string;
  date: string;
  type: 'late' | 'early' | 'absent' | 'missing_punch' | 'overtime';
  minutes: number;
  handled: boolean;
  handleType?: 'makeup' | 'deduct' | 'ignore';
  remark?: string;
}

export interface MakeupRecord {
  id: string;
  employeeId: string;
  date: string;
  punchType: 'in' | 'out';
  originalTime?: string;
  correctedTime: string;
  reason: string;
  approved: boolean;
  approver?: string;
  createTime: string;
}

export interface LeaveRecord {
  id: string;
  employeeId: string;
  type: '年假' | '事假' | '病假' | '婚假' | '产假' | '丧假' | '调休';
  startDate: string;
  endDate: string;
  days: number;
  hours: number;
  deductAmount: number;
  reason: string;
  approved: boolean;
  approver?: string;
  createTime: string;
}

export interface OvertimeRecord {
  id: string;
  employeeId: string;
  date: string;
  startHour: number;
  endHour: number;
  hours: number;
  type: 'normal' | 'weekend' | 'holiday';
  rate: number;
  convertedHours: number;
  payAmount: number;
  reason?: string;
  approved: boolean;
  createTime: string;
}

export interface SocialHousingFund {
  id: string;
  employeeId: string;
  month: string;
  pensionPersonal: number;
  pensionCompany: number;
  medicalPersonal: number;
  medicalCompany: number;
  unemploymentPersonal: number;
  unemploymentCompany: number;
  injuryCompany: number;
  maternityCompany: number;
  housingFundPersonal: number;
  housingFundCompany: number;
  totalPersonal: number;
  totalCompany: number;
}

export interface SalaryItem {
  name: string;
  amount: number;
  type: 'income' | 'deduction';
  category: string;
}

export interface Payroll {
  id: string;
  employeeId: string;
  month: string;
  baseSalary: number;
  performanceSalary: number;
  overtimePay: number;
  bonus: number;
  allowance: number;
  otherIncome: number;
  totalIncome: number;
  socialPersonal: number;
  housingFundPersonal: number;
  personalTax: number;
  leaveDeduction: number;
  lateDeduction: number;
  otherDeduction: number;
  totalDeduction: number;
  netSalary: number;
  items: SalaryItem[];
  confirmed: boolean;
  confirmTime?: string;
  reviewed: boolean;
  reviewer?: string;
  reviewTime?: string;
  createTime: string;
  updateTime: string;
}

export interface Payslip {
  id: string;
  payrollId: string;
  employeeId: string;
  month: string;
  status: '未发送' | '已发送' | '已查看' | '已确认' | '有异议';
  sendTime?: string;
  viewTime?: string;
  confirmTime?: string;
  objection?: string;
}

export interface DepartmentSummary {
  department: string;
  headcount: number;
  totalBaseSalary: number;
  totalOvertimePay: number;
  totalBonus: number;
  totalAllowance: number;
  totalIncome: number;
  totalSocialCompany: number;
  totalHousingFundCompany: number;
  totalCost: number;
  avgSalary: number;
}

export interface TaxBracket {
  min: number;
  max: number;
  rate: number;
  deduction: number;
}
