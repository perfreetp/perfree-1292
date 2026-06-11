import dayjs from 'dayjs';
import type {
  Employee, Shift, Schedule, PunchRecord, AttendanceException,
  MakeupRecord, LeaveRecord, OvertimeRecord, SocialHousingFund,
  Payroll, Payslip, SalaryItem,
} from '../types';
import {
  genId, calculateSocialFund, calculateHousingFund,
  round2, parseTimeToMinutes, getDateList, isWeekend,
  LEAVE_DEDUCT_RATES, OVERTIME_RATES, calculateDailyWage, calculateHourlyWage,
  calculateMonthlyTax,
} from './calculations';

const DEPARTMENTS = ['技术研发部', '产品运营部', '市场销售部', '财务部', '行政人事部'];
const POSITIONS: Record<string, string[]> = {
  '技术研发部': ['高级工程师', '中级工程师', '初级工程师', '测试工程师', '技术主管'],
  '产品运营部': ['产品经理', '运营专员', 'UI设计师', '数据分析'],
  '市场销售部': ['销售经理', '销售代表', '市场专员', '客户成功'],
  '财务部': ['财务主管', '会计', '出纳'],
  '行政人事部': ['HRBP', '行政专员', '人事专员'],
};
const FIRST_NAMES = ['张', '李', '王', '赵', '陈', '刘', '杨', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡'];
const GIVEN_NAMES = ['伟', '芳', '娜', '敏', '静', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀英', '霞', '平', '刚'];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPhone(): string {
  return '1' + ['3', '5', '7', '8', '9'][randomInt(0, 4)] + String(randomInt(100000000, 999999999));
}

function randomIdCard(): string {
  let s = '';
  for (let i = 0; i < 17; i++) s += randomInt(0, 9);
  return s + (randomInt(0, 9) % 10);
}

function generateEmployees(): Employee[] {
  const list: Employee[] = [];
  for (let i = 0; i < 25; i++) {
    const dept = randomChoice(DEPARTMENTS);
    const pos = randomChoice(POSITIONS[dept]);
    const status = i < 22 ? '在职' : i < 24 ? '试用期' : '离职';
    const base = randomInt(6000, 25000);
    const gender = randomChoice(['男', '女'] as const);
    list.push({
      id: genId('emp'),
      employeeNo: `EMP${String(i + 1).padStart(4, '0')}`,
      name: randomChoice(FIRST_NAMES) + randomChoice(GIVEN_NAMES),
      gender,
      idCard: randomIdCard(),
      phone: randomPhone(),
      department: dept,
      position: pos,
      hireDate: dayjs('2022-01-01').add(randomInt(0, 1000), 'day').format('YYYY-MM-DD'),
      leaveDate: status === '离职' ? dayjs('2024-06-01').add(randomInt(0, 150), 'day').format('YYYY-MM-DD') : undefined,
      status,
      baseSalary: base,
      socialBase: Math.round(base * 0.85),
      housingFundBase: base,
      bankCard: '6222' + String(randomInt(100000000000, 999999999999)),
      email: `user${i + 1}@company.com`,
      address: `${['北京市', '上海市', '广州市', '深圳市'][randomInt(0, 3)]}朝阳区科技园${randomInt(1, 100)}号`,
      remark: status === '试用期' ? '试用期3个月，考核通过后转正' : undefined,
    });
  }
  return list;
}

function generateShifts(): Shift[] {
  return [
    { id: genId('shift'), name: '早班', startTime: '08:30', endTime: '17:30', restStart: '12:00', restEnd: '13:00', lateThreshold: 5, earlyThreshold: 5, workHours: 8, color: 'blue' },
    { id: genId('shift'), name: '中班', startTime: '09:00', endTime: '18:00', restStart: '12:30', restEnd: '13:30', lateThreshold: 5, earlyThreshold: 5, workHours: 8, color: 'green' },
    { id: genId('shift'), name: '晚班', startTime: '13:00', endTime: '21:30', lateThreshold: 5, earlyThreshold: 5, workHours: 8, color: 'purple' },
    { id: genId('shift'), name: '弹性班', startTime: '10:00', endTime: '19:00', restStart: '12:30', restEnd: '13:30', lateThreshold: 15, earlyThreshold: 5, workHours: 8, color: 'orange' },
  ];
}

function generateSchedules(employees: Employee[], shifts: Shift[], month: string): Schedule[] {
  const list: Schedule[] = [];
  const dates = getDateList(month);
  const activeEmps = employees.filter((e) => e.status === '在职' || e.status === '试用期');
  dates.forEach((d) => {
    const weekend = isWeekend(d);
    activeEmps.forEach((emp) => {
      if (weekend) {
        if (Math.random() < 0.08) {
          list.push({
            id: genId('sch'),
            employeeId: emp.id,
            date: d,
            shiftId: shifts[0].id,
            type: 'overtime',
          });
        }
      } else {
        let shift: Shift;
        if (emp.department === '技术研发部') {
          shift = Math.random() < 0.7 ? shifts[3] : shifts[1];
        } else if (emp.department === '市场销售部') {
          shift = Math.random() < 0.5 ? shifts[0] : shifts[1];
        } else {
          shift = shifts[0];
        }
        if (Math.random() < 0.03) {
          list.push({
            id: genId('sch'),
            employeeId: emp.id,
            date: d,
            shiftId: shift.id,
            type: 'leave',
            remark: '请假',
          });
        } else {
          list.push({
            id: genId('sch'),
            employeeId: emp.id,
            date: d,
            shiftId: shift.id,
            type: 'normal',
          });
        }
      }
    });
  });
  return list;
}

function generatePunchRecords(employees: Employee[], schedules: Schedule[], shifts: Shift[]): PunchRecord[] {
  const list: PunchRecord[] = [];
  const shiftMap = new Map(shifts.map((s) => [s.id, s]));
  const activeEmpIds = new Set(employees.filter((e) => e.status === '在职' || e.status === '试用期').map((e) => e.id));

  schedules.forEach((sch) => {
    if (!activeEmpIds.has(sch.employeeId)) return;
    if (sch.type === 'leave' || sch.type === 'rest') return;
    const shift = shiftMap.get(sch.shiftId);
    if (!shift) return;

    let punchIn: string | undefined;
    let punchOut: string | undefined;

    const inMins = parseTimeToMinutes(shift.startTime);
    const outMins = parseTimeToMinutes(shift.endTime);

    const rand = Math.random();
    if (rand < 0.78) {
      punchIn = formatMins(inMins + randomInt(-5, 3));
    } else if (rand < 0.92) {
      punchIn = formatMins(inMins + randomInt(6, 35));
    } else if (rand < 0.97) {
      punchIn = formatMins(inMins + randomInt(40, 90));
    }

    const rand2 = Math.random();
    if (rand2 < 0.78) {
      punchOut = formatMins(outMins + randomInt(0, 8));
    } else if (rand2 < 0.9) {
      punchOut = formatMins(outMins + randomInt(9, 60));
    } else if (rand2 < 0.96) {
      punchOut = formatMins(outMins - randomInt(5, 30));
    }

    if (punchIn || punchOut) {
      list.push({
        id: genId('punch'),
        employeeId: sch.employeeId,
        date: sch.date,
        punchIn,
        punchOut,
        source: 'import',
      });
    }
  });
  return list;
}

function formatMins(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function generateExceptions(
  employees: Employee[],
  schedules: Schedule[],
  shifts: Shift[],
  punchRecords: PunchRecord[],
): AttendanceException[] {
  const list: AttendanceException[] = [];
  const shiftMap = new Map(shifts.map((s) => [s.id, s]));
  const punchMap = new Map(punchRecords.map((p) => [`${p.employeeId}_${p.date}`, p]));
  const activeEmpIds = new Set(employees.filter((e) => e.status === '在职' || e.status === '试用期').map((e) => e.id));

  schedules.forEach((sch) => {
    if (!activeEmpIds.has(sch.employeeId)) return;
    if (sch.type === 'leave' || sch.type === 'rest') return;
    const shift = shiftMap.get(sch.shiftId);
    if (!shift) return;
    const punch = punchMap.get(`${sch.employeeId}_${sch.date}`);
    const key = `${sch.employeeId}_${sch.date}`;

    if (!punch) {
      list.push({
        id: genId('exc'),
        employeeId: sch.employeeId,
        date: sch.date,
        type: 'absent',
        minutes: shift.workHours * 60,
        handled: false,
      });
      return;
    }

    if (!punch.punchIn) {
      list.push({
        id: genId('exc'),
        employeeId: sch.employeeId,
        date: sch.date,
        type: 'missing_punch',
        minutes: 0,
        handled: false,
        remark: '缺上班打卡',
      });
    } else {
      const inDiff = parseTimeToMinutes(punch.punchIn) - parseTimeToMinutes(shift.startTime);
      if (inDiff > shift.lateThreshold) {
        list.push({
          id: genId('exc'),
          employeeId: sch.employeeId,
          date: sch.date,
          type: 'late',
          minutes: inDiff,
          handled: inDiff < 10,
          handleType: inDiff < 10 ? 'ignore' : undefined,
        });
      }
    }

    if (!punch.punchOut) {
      list.push({
        id: genId('exc'),
        employeeId: sch.employeeId,
        date: sch.date,
        type: 'missing_punch',
        minutes: 0,
        handled: false,
        remark: '缺下班打卡',
      });
    } else {
      const outDiff = parseTimeToMinutes(shift.endTime) - parseTimeToMinutes(punch.punchOut);
      if (outDiff > shift.earlyThreshold) {
        list.push({
          id: genId('exc'),
          employeeId: sch.employeeId,
          date: sch.date,
          type: 'early',
          minutes: outDiff,
          handled: false,
        });
      }
    }

    if (sch.type === 'overtime' && punch?.punchOut) {
      const otMins = parseTimeToMinutes(punch.punchOut) - parseTimeToMinutes(shift.endTime);
      if (otMins > 30) {
        list.push({
          id: genId('exc'),
          employeeId: sch.employeeId,
          date: sch.date,
          type: 'overtime',
          minutes: otMins,
          handled: false,
        });
      }
    }

    // suppress unused warning
    void key;
  });
  return list;
}

function generateMakeupRecords(employees: Employee[], exceptions: AttendanceException[]): MakeupRecord[] {
  const list: MakeupRecord[] = [];
  const missingExc = exceptions.filter((e) => e.type === 'missing_punch').slice(0, 8);
  const empMap = new Map(employees.map((e) => [e.id, e]));
  missingExc.forEach((exc, idx) => {
    const emp = empMap.get(exc.employeeId);
    if (!emp) return;
    list.push({
      id: genId('mk'),
      employeeId: exc.employeeId,
      date: exc.date,
      punchType: exc.remark?.includes('上班') ? 'in' : 'out',
      correctedTime: exc.remark?.includes('上班') ? '08:50' : '17:35',
      reason: ['忘记打卡', '设备故障', '外出办公', '临时出差'][idx % 4],
      approved: idx < 5,
      approver: idx < 5 ? '人事部-王芳' : undefined,
      createTime: dayjs(exc.date).add(1, 'day').add(randomInt(8, 18), 'hour').toISOString(),
    });
  });
  return list;
}

function generateLeaveRecords(employees: Employee[], schedules: Schedule[]): LeaveRecord[] {
  const list: LeaveRecord[] = [];
  const activeEmps = employees.filter((e) => e.status === '在职' || e.status === '试用期');
  const leaveSch = schedules.filter((s) => s.type === 'leave');
  const dailyEmpDates = new Map<string, string[]>();
  leaveSch.forEach((sch) => {
    if (!dailyEmpDates.has(sch.employeeId)) dailyEmpDates.set(sch.employeeId, []);
    dailyEmpDates.get(sch.employeeId)!.push(sch.date);
  });
  const leaveTypes: LeaveRecord['type'][] = ['年假', '事假', '病假', '调休'];
  let idx = 0;
  dailyEmpDates.forEach((dates, empId) => {
    const emp = employees.find((e) => e.id === empId);
    if (!emp) return;
    const type = leaveTypes[idx % leaveTypes.length];
    const days = dates.length;
    const hours = days * 8;
    const rate = LEAVE_DEDUCT_RATES[type];
    const daily = calculateDailyWage(emp.baseSalary);
    const deduct = round2(daily * days * rate);
    list.push({
      id: genId('lv'),
      employeeId: empId,
      type,
      startDate: dates[0],
      endDate: dates[dates.length - 1],
      days,
      hours,
      deductAmount: deduct,
      reason: ['家里有事', '身体不适', '年度休假', '调休补休'][idx % 4],
      approved: true,
      approver: '部门主管',
      createTime: dayjs(dates[0]).subtract(randomInt(1, 7), 'day').toISOString(),
    });
    idx++;
  });
  return list;
}

function generateOvertimeRecords(
  employees: Employee[],
  schedules: Schedule[],
  punchRecords: PunchRecord[],
  shifts: Shift[],
): OvertimeRecord[] {
  const list: OvertimeRecord[] = [];
  const shiftMap = new Map(shifts.map((s) => [s.id, s]));
  const punchMap = new Map(punchRecords.map((p) => [`${p.employeeId}_${p.date}`, p]));
  const otSch = schedules.filter((s) => s.type === 'overtime');
  otSch.forEach((sch, idx) => {
    const emp = employees.find((e) => e.id === sch.employeeId);
    if (!emp) return;
    const shift = shiftMap.get(sch.shiftId);
    if (!shift) return;
    const punch = punchMap.get(`${sch.employeeId}_${sch.date}`);
    const endHour = punch?.punchOut ? parseTimeToMinutes(punch.punchOut) / 60 : 20;
    const startHour = parseTimeToMinutes(shift.endTime) / 60;
    const hours = Math.max(0.5, round2(endHour - startHour));
    const weekend = isWeekend(sch.date);
    const type: OvertimeRecord['type'] = weekend ? 'weekend' : 'normal';
    const rate = OVERTIME_RATES[type];
    const hourly = calculateHourlyWage(emp.baseSalary);
    list.push({
      id: genId('ot'),
      employeeId: sch.employeeId,
      date: sch.date,
      startHour: round2(startHour),
      endHour: round2(endHour),
      hours,
      type,
      rate,
      convertedHours: round2(hours * rate),
      payAmount: round2(hourly * hours * rate),
      reason: ['项目上线', '客户需求', '临时任务', '版本迭代'][idx % 4],
      approved: idx < otSch.length - 2,
      createTime: dayjs(sch.date).add(1, 'day').toISOString(),
    });
  });
  return list;
}

function generateSocialFunds(employees: Employee[], month: string): SocialHousingFund[] {
  const list: SocialHousingFund[] = [];
  employees.filter((e) => e.status === '在职' || e.status === '试用期').forEach((emp) => {
    const social = calculateSocialFund(emp.socialBase);
    const hf = calculateHousingFund(emp.housingFundBase);
    list.push({
      id: genId('sf'),
      employeeId: emp.id,
      month,
      ...social,
      ...hf,
      totalPersonal: social.totalPersonal + hf.housingFundPersonal,
      totalCompany: social.totalCompany + hf.housingFundCompany,
    });
  });
  return list;
}

function generatePayrolls(
  employees: Employee[],
  month: string,
  socialFunds: SocialHousingFund[],
  leaveRecords: LeaveRecord[],
  overtimeRecords: OvertimeRecord[],
  exceptions: AttendanceException[],
): { payrolls: Payroll[]; payslips: Payslip[] } {
  const payrolls: Payroll[] = [];
  const payslips: Payslip[] = [];
  const activeEmps = employees.filter((e) => e.status === '在职' || e.status === '试用期');

  let cumulativeTax: Record<string, { taxable: number; tax: number }> = {};
  const m = parseInt(month.split('-')[1], 10);
  for (let i = 1; i < m; i++) {
    activeEmps.forEach((emp) => {
      const monthStr = month.slice(0, 5) + String(i).padStart(2, '0');
      const sf = socialFunds[0];
      const personal = sf ? sf.totalPersonal : (calculateSocialFund(emp.socialBase).totalPersonal + calculateHousingFund(emp.housingFundBase).housingFundPersonal);
      const monthlyTaxable = emp.baseSalary - personal - 5000;
      const prev = cumulativeTax[emp.id] || { taxable: 0, tax: 0 };
      const tax = calculateMonthlyTax(Math.max(0, monthlyTaxable), prev.taxable, prev.tax);
      cumulativeTax[emp.id] = {
        taxable: prev.taxable + Math.max(0, monthlyTaxable),
        tax: prev.tax + tax,
      };
      void monthStr;
    });
  }

  activeEmps.forEach((emp, idx) => {
    const sf = socialFunds.find((s) => s.employeeId === emp.id) || socialFunds[0];
    const personalSocial = sf ? (sf.pensionPersonal + sf.medicalPersonal + sf.unemploymentPersonal) : 0;
    const personalHF = sf ? sf.housingFundPersonal : 0;
    const socialPersonal = personalSocial + personalHF;

    const lvTotal = leaveRecords.filter((l) => l.employeeId === emp.id).reduce((sum, l) => sum + l.deductAmount, 0);

    const otTotal = overtimeRecords.filter((o) => o.employeeId === emp.id && o.approved).reduce((sum, o) => sum + o.payAmount, 0);

    const lateEarly = exceptions.filter((e) => e.employeeId === emp.id && (e.type === 'late' || e.type === 'early') && !e.handled);
    let lateDeduct = 0;
    lateEarly.forEach((e) => {
      const t = e.minutes;
      if (t <= 10) lateDeduct += 0;
      else if (t <= 30) lateDeduct += 50;
      else if (t <= 60) lateDeduct += 100;
      else lateDeduct += 200;
    });

    const absents = exceptions.filter((e) => e.employeeId === emp.id && e.type === 'absent' && !e.handled);
    const absentDeduct = absents.length * calculateDailyWage(emp.baseSalary);

    const performance = round2(emp.baseSalary * randomInt(60, 110) / 100);
    const bonus = randomInt(0, 3) === 0 ? round2(emp.baseSalary * randomInt(10, 50) / 100) : 0;
    const allowance = randomInt(200, 800);
    const otherIncome = 0;
    const overtimePay = round2(otTotal);

    const totalIncome = round2(emp.baseSalary + performance + overtimePay + bonus + allowance + otherIncome);

    const leaveDeduction = round2(lvTotal);
    const lateDeduction = round2(lateDeduct + absentDeduct);
    const otherDeduction = 0;

    const taxableBase = totalIncome - socialPersonal - leaveDeduction - lateDeduction - otherDeduction;
    const monthlyTaxable = Math.max(0, taxableBase - 5000);
    const prev = cumulativeTax[emp.id] || { taxable: 0, tax: 0 };
    const personalTax = calculateMonthlyTax(monthlyTaxable, prev.taxable, prev.tax);

    const totalDeduction = round2(socialPersonal + personalTax + leaveDeduction + lateDeduction + otherDeduction);
    const netSalary = round2(totalIncome - totalDeduction);

    const items: SalaryItem[] = [
      { name: '基本工资', amount: emp.baseSalary, type: 'income', category: '固定工资' },
      { name: '绩效工资', amount: performance, type: 'income', category: '绩效奖金' },
      { name: '加班费', amount: overtimePay, type: 'income', category: '加班补贴' },
      { name: '奖金', amount: bonus, type: 'income', category: '绩效奖金' },
      { name: '岗位津贴', amount: allowance, type: 'income', category: '补贴津贴' },
      { name: '养老保险个人', amount: sf?.pensionPersonal || 0, type: 'deduction', category: '社保公积金' },
      { name: '医疗保险个人', amount: sf?.medicalPersonal || 0, type: 'deduction', category: '社保公积金' },
      { name: '失业保险个人', amount: sf?.unemploymentPersonal || 0, type: 'deduction', category: '社保公积金' },
      { name: '住房公积金个人', amount: personalHF, type: 'deduction', category: '社保公积金' },
      { name: '个人所得税', amount: personalTax, type: 'deduction', category: '个人税' },
      { name: '请假扣款', amount: leaveDeduction, type: 'deduction', category: '考勤扣款' },
      { name: '迟到早退扣款', amount: lateDeduction, type: 'deduction', category: '考勤扣款' },
    ];

    const now = new Date().toISOString();
    const payroll: Payroll = {
      id: genId('pr'),
      employeeId: emp.id,
      month,
      baseSalary: emp.baseSalary,
      performanceSalary: performance,
      overtimePay,
      bonus,
      allowance,
      otherIncome,
      totalIncome,
      socialPersonal,
      housingFundPersonal: personalHF,
      personalTax,
      leaveDeduction,
      lateDeduction,
      otherDeduction,
      totalDeduction,
      netSalary,
      items,
      confirmed: idx < activeEmps.length - 5,
      confirmTime: idx < activeEmps.length - 5 ? now : undefined,
      reviewed: idx < activeEmps.length - 3,
      reviewer: idx < activeEmps.length - 3 ? '财务主管-李明' : undefined,
      reviewTime: idx < activeEmps.length - 3 ? now : undefined,
      createTime: now,
      updateTime: now,
    };
    payrolls.push(payroll);

    payslips.push({
      id: genId('ps'),
      payrollId: payroll.id,
      employeeId: emp.id,
      month,
      status: idx < 10 ? '已确认' : idx < 18 ? '已查看' : idx < 22 ? '已发送' : '未发送',
      sendTime: idx >= 10 && idx < 22 ? now : undefined,
      viewTime: idx < 18 ? now : undefined,
      confirmTime: idx < 10 ? now : undefined,
    });
  });

  return { payrolls, payslips };
}

export function generateMockData() {
  const month = dayjs().subtract(1, 'month').format('YYYY-MM');
  const employees = generateEmployees();
  const shifts = generateShifts();
  const schedules = generateSchedules(employees, shifts, month);
  const punchRecords = generatePunchRecords(employees, schedules, shifts);
  const exceptions = generateExceptions(employees, schedules, shifts, punchRecords);
  const makeupRecords = generateMakeupRecords(employees, exceptions);
  const leaveRecords = generateLeaveRecords(employees, schedules);
  const overtimeRecords = generateOvertimeRecords(employees, schedules, punchRecords, shifts);
  const socialFunds = generateSocialFunds(employees, month);
  const { payrolls, payslips } = generatePayrolls(employees, month, socialFunds, leaveRecords, overtimeRecords, exceptions);

  return {
    employees,
    shifts,
    schedules,
    punchRecords,
    exceptions,
    makeupRecords,
    leaveRecords,
    overtimeRecords,
    socialFunds,
    payrolls,
    payslips,
    currentMonth: month,
  };
}
