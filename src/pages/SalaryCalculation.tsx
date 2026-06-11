import { useMemo, useState } from 'react';
import {
  Table, Button, Input, Select, Space, Tag, Card, Row, Col, Statistic,
  message, Modal, Form, InputNumber, Divider, Progress, DatePicker,
  Drawer, Descriptions, Tooltip, Steps, List,
} from 'antd';
import {
  CalculatorOutlined, PlusOutlined, SearchOutlined, EditOutlined,
  EyeOutlined, CheckCircleOutlined, SyncOutlined, ExportOutlined,
  UserOutlined, DollarOutlined, TeamOutlined, FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAppStore, computeDepartmentSummary } from '../store/useAppStore';
import {
  genId, calculateSocialFund, calculateHousingFund,
  round2, calculateMonthlyTax, calculateDailyWage,
} from '../utils/calculations';
import * as XLSX from 'xlsx';
import type { Payroll, SocialHousingFund, SalaryItem, Employee } from '../types';

const SalaryCalculation = () => {
  const store = useAppStore();
  const {
    batchAddPayrolls, updatePayroll, reviewPayroll, confirmPayroll,
    batchAddSocialFunds, updateSocialFund, setCurrentMonth,
  } = store;
  const employees: Employee[] = (store as any).employees || [];
  const socialFunds: SocialHousingFund[] = (store as any).socialFunds || [];
  const payrolls: Payroll[] = (store as any).payrolls || [];
  const leaveRecords: any[] = (store as any).leaveRecords || [];
  const exceptions: any[] = (store as any).exceptions || [];
  const overtimeRecords: any[] = (store as any).overtimeRecords || [];
  const currentMonth: string = (store as any).currentMonth || dayjs().subtract(1, 'month').format('YYYY-MM');

  const [dept, setDept] = useState('全部');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('all');
  const [detailDrawer, setDetailDrawer] = useState(false);
  const [currentPayroll, setCurrentPayroll] = useState<Payroll | null>(null);
  const [editModal, setEditModal] = useState(false);
  const [editPayroll, setEditPayroll] = useState<Payroll | null>(null);
  const [editForm] = Form.useForm();
  const [sfModal, setSfModal] = useState(false);
  const [editingSf, setEditingSf] = useState<SocialHousingFund | null>(null);
  const [sfContext, setSfContext] = useState<{ employeeId: string | null; payrollId: string | null }>({ employeeId: null, payrollId: null });
  const [sfForm] = Form.useForm();
  const [generating, setGenerating] = useState(false);

  const empMap = useMemo(() => new Map(employees.map((e: Employee) => [e.id, e])), [employees]);
  const sfMap = useMemo(() => new Map(socialFunds.map((s: SocialHousingFund) => [`${s.employeeId}_${s.month}`, s])), [socialFunds]);
  const departments = useMemo(() => Array.from(new Set(employees.map((e: Employee) => e.department))), [employees]);

  const monthPayrolls = useMemo(() => payrolls.filter((p: Payroll) => p.month === currentMonth), [payrolls, currentMonth]);
  const monthSocials = useMemo(() => socialFunds.filter((s: SocialHousingFund) => s.month === currentMonth), [socialFunds, currentMonth]);

  const stats = useMemo(() => {
    const total = monthPayrolls.reduce((s: number, p: Payroll) => s + p.totalIncome, 0);
    const totalNet = monthPayrolls.reduce((s: number, p: Payroll) => s + p.netSalary, 0);
    const totalTax = monthPayrolls.reduce((s: number, p: Payroll) => s + p.personalTax, 0);
    const totalSocial = monthSocials.reduce((s: number, p: SocialHousingFund) => s + p.totalCompany, 0);
    const reviewed = monthPayrolls.filter((p: Payroll) => p.reviewed).length;
    const confirmed = monthPayrolls.filter((p: Payroll) => p.confirmed).length;
    return { total, totalNet, totalTax, totalSocial, reviewed, confirmed, count: monthPayrolls.length };
  }, [monthPayrolls, monthSocials]);

  const filtered = useMemo(() => {
    let list = monthPayrolls;
    if (status === 'reviewed') list = list.filter((p: Payroll) => p.reviewed);
    if (status === 'unreviewed') list = list.filter((p: Payroll) => !p.reviewed);
    if (status === 'confirmed') list = list.filter((p: Payroll) => p.confirmed);
    if (dept !== '全部' || keyword) {
      list = list.filter((p: Payroll) => {
        const e = empMap.get(p.employeeId);
        if (!e) return false;
        if (dept !== '全部' && e.department !== dept) return false;
        if (keyword) {
          const kw = keyword.toLowerCase();
          if (!e.name.toLowerCase().includes(kw) && !e.employeeNo.toLowerCase().includes(kw)) return false;
        }
        return true;
      });
    }
    return list;
  }, [monthPayrolls, status, dept, keyword, empMap]);

  const deptSummary = useMemo(() => computeDepartmentSummary(monthPayrolls, monthSocials, employees), [monthPayrolls, monthSocials, employees]);

  const generatePayrolls = async () => {
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 800));
    try {
      const active = employees.filter((e: Employee) => e.status === '在职' || e.status === '试用期');
      const newSfs: SocialHousingFund[] = [];
      active.forEach((emp: Employee) => {
        const social = calculateSocialFund(emp.socialBase);
        const hf = calculateHousingFund(emp.housingFundBase);
        const existing = sfMap.get(`${emp.id}_${currentMonth}`);
        if (!existing) {
          newSfs.push({
            id: genId('sf'),
            employeeId: emp.id,
            month: currentMonth,
            ...social,
            ...hf,
            totalPersonal: social.totalPersonal + hf.housingFundPersonal,
            totalCompany: social.totalCompany + hf.housingFundCompany,
          });
        }
      });
      if (newSfs.length) batchAddSocialFunds(newSfs);

      const allSfs = [...monthSocials, ...newSfs];
      const sfMap2 = new Map(allSfs.map((s) => [`${s.employeeId}_${s.month}`, s]));

      const monthLeaveMap = new Map<string, number>();
      (leaveRecords || []).filter((l: any) => l.startDate.startsWith(currentMonth) && l.approved)
        .forEach((l: any) => {
          monthLeaveMap.set(l.employeeId, (monthLeaveMap.get(l.employeeId) || 0) + l.deductAmount);
        });

      const monthOtMap = new Map<string, number>();
      (overtimeRecords || []).filter((o: any) => o.date.startsWith(currentMonth) && o.approved)
        .forEach((o: any) => {
          monthOtMap.set(o.employeeId, (monthOtMap.get(o.employeeId) || 0) + o.payAmount);
        });

      const monthExcMap = new Map<string, number>();
      (exceptions || []).filter((e: any) => e.date.startsWith(currentMonth) && !e.handled)
        .forEach((e: any) => {
          if (e.type === 'late' || e.type === 'early') {
            const t = e.minutes;
            let d = 0;
            if (t > 10 && t <= 30) d = 50;
            else if (t > 30 && t <= 60) d = 100;
            else if (t > 60) d = 200;
            monthExcMap.set(e.employeeId, (monthExcMap.get(e.employeeId) || 0) + d);
          }
          if (e.type === 'absent') {
            const emp = empMap.get(e.employeeId);
            if (emp) monthExcMap.set(e.employeeId, (monthExcMap.get(e.employeeId) || 0) + calculateDailyWage(emp.baseSalary));
          }
        });

      let cumulativeTax: Record<string, { taxable: number; tax: number }> = {};
      const m = parseInt(currentMonth.split('-')[1], 10);
      for (let i = 1; i < m; i++) {
        active.forEach((emp: Employee) => {
          const sf = sfMap2.get(`${emp.id}_${currentMonth.slice(0, 5)}${String(i).padStart(2, '0')}`);
          const personal = sf ? sf.totalPersonal : (calculateSocialFund(emp.socialBase).totalPersonal + calculateHousingFund(emp.housingFundBase).housingFundPersonal);
          const monthlyTaxable = emp.baseSalary - personal - 5000;
          const prev = cumulativeTax[emp.id] || { taxable: 0, tax: 0 };
          const tax = calculateMonthlyTax(Math.max(0, monthlyTaxable), prev.taxable, prev.tax);
          cumulativeTax[emp.id] = { taxable: prev.taxable + Math.max(0, monthlyTaxable), tax: prev.tax + tax };
        });
      }

      const existingIds = new Set(monthPayrolls.map((p: Payroll) => p.employeeId));
      const newPayrolls: Payroll[] = [];

      active.forEach((emp: Employee) => {
        if (existingIds.has(emp.id)) return;
        const sf = sfMap2.get(`${emp.id}_${currentMonth}`);
        const personalSocial = sf ? (sf.pensionPersonal + sf.medicalPersonal + sf.unemploymentPersonal) : 0;
        const personalHF = sf ? sf.housingFundPersonal : 0;
        const socialPersonal = personalSocial + personalHF;

        const lvTotal = monthLeaveMap.get(emp.id) || 0;
        const otTotal = monthOtMap.get(emp.id) || 0;
        const lateDeduct = monthExcMap.get(emp.id) || 0;

        const performance = round2(emp.baseSalary * 0.85);
        const bonus = 0;
        const allowance = 500;
        const overtimePay = round2(otTotal);
        const totalIncome = round2(emp.baseSalary + performance + overtimePay + bonus + allowance);
        const leaveDeduction = round2(lvTotal);
        const lateDeduction = round2(lateDeduct);

        const taxableBase = totalIncome - socialPersonal - leaveDeduction - lateDeduction;
        const monthlyTaxable = Math.max(0, taxableBase - 5000);
        const prev = cumulativeTax[emp.id] || { taxable: 0, tax: 0 };
        const personalTax = calculateMonthlyTax(monthlyTaxable, prev.taxable, prev.tax);

        const totalDeduction = round2(socialPersonal + personalTax + leaveDeduction + lateDeduction);
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
        newPayrolls.push({
          id: genId('pr'),
          employeeId: emp.id,
          month: currentMonth,
          baseSalary: emp.baseSalary,
          performanceSalary: performance,
          overtimePay,
          bonus,
          allowance,
          otherIncome: 0,
          totalIncome,
          socialPersonal,
          housingFundPersonal: personalHF,
          personalTax,
          leaveDeduction,
          lateDeduction,
          otherDeduction: 0,
          totalDeduction,
          netSalary,
          items,
          confirmed: false,
          reviewed: false,
          createTime: now,
          updateTime: now,
        });
      });

      if (newPayrolls.length) batchAddPayrolls(newPayrolls);
      message.success(`薪资已生成：新增 ${newPayrolls.length} 条，已有 ${monthPayrolls.length} 条保留`);
    } catch (e: any) {
      message.error('生成失败: ' + e.message);
    } finally {
      setGenerating(false);
    }
  };

  const exportExcel = () => {
    const data = filtered.map((p: Payroll) => {
      const emp = empMap.get(p.employeeId);
      return {
        工号: emp?.employeeNo || '',
        姓名: emp?.name || '',
        部门: emp?.department || '',
        职位: emp?.position || '',
        基本工资: p.baseSalary,
        绩效工资: p.performanceSalary,
        加班费: p.overtimePay,
        奖金: p.bonus,
        津贴: p.allowance,
        应发合计: p.totalIncome,
        社保个人: p.socialPersonal - p.housingFundPersonal,
        公积金个人: p.housingFundPersonal,
        个税: p.personalTax,
        请假扣款: p.leaveDeduction,
        迟到扣款: p.lateDeduction,
        扣款合计: p.totalDeduction,
        实发工资: p.netSalary,
        复核: p.reviewed ? '已复核' : '未复核',
        确认: p.confirmed ? '已确认' : '未确认',
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${currentMonth}工资表`);
    XLSX.writeFile(wb, `${currentMonth}工资明细表.xlsx`);
    message.success('已导出Excel');
  };

  const openDetail = (p: Payroll) => {
    setCurrentPayroll(p);
    setDetailDrawer(true);
  };

  const openEdit = (p: Payroll) => {
    setEditPayroll(p);
    editForm.resetFields();
    editForm.setFieldsValue(p);
    setEditModal(true);
  };

  const openSfEdit = (p: Payroll) => {
    const sf = sfMap.get(`${p.employeeId}_${currentMonth}`);
    setEditingSf(sf || null);
    setSfContext({ employeeId: p.employeeId, payrollId: p.id });
    sfForm.resetFields();
    if (sf) {
      sfForm.setFieldsValue(sf);
    } else {
      const emp = empMap.get(p.employeeId);
      if (emp) {
        const social = calculateSocialFund(emp.socialBase);
        const hf = calculateHousingFund(emp.housingFundBase);
        sfForm.setFieldsValue({ ...social, ...hf, totalPersonal: social.totalPersonal + hf.housingFundPersonal, totalCompany: social.totalCompany + hf.housingFundCompany });
      }
    }
    setSfModal(true);
  };

  const submitEdit = async () => {
    try {
      const v = await editForm.validateFields();
      if (!editPayroll) return;
      const updated: Partial<Payroll> = { ...v };
      updated.totalIncome = round2(v.baseSalary + v.performanceSalary + v.overtimePay + v.bonus + v.allowance + v.otherIncome);
      updated.totalDeduction = round2(v.socialPersonal + v.personalTax + v.leaveDeduction + v.lateDeduction + v.otherDeduction);
      updated.netSalary = round2(updated.totalIncome - updated.totalDeduction);
      updatePayroll(editPayroll.id, updated);
      message.success('薪资已更新');
      setEditModal(false);
    } catch (e) {
      //
    }
  };

  const submitSf = async () => {
    try {
      const v = await sfForm.validateFields();
      const employeeId = sfContext.employeeId;
      if (!employeeId) {
        message.error('未找到对应员工');
        return;
      }
      const sf = sfMap.get(`${employeeId}_${currentMonth}`);
      const data = {
        ...v,
        employeeId,
        month: currentMonth,
        totalPersonal: v.pensionPersonal + v.medicalPersonal + v.unemploymentPersonal + v.housingFundPersonal,
        totalCompany: v.pensionCompany + v.medicalCompany + v.unemploymentCompany + v.injuryCompany + v.maternityCompany + v.housingFundCompany,
      };
      if (sf) {
        updateSocialFund(sf.id, data);
      } else {
        const { batchAddSocialFunds: addFn } = useAppStore.getState() as any;
        addFn([{ ...data, id: genId('sf') }]);
      }
      const personalSocial = data.pensionPersonal + data.medicalPersonal + data.unemploymentPersonal;
      const hfP = data.housingFundPersonal;
      const totalP = personalSocial + hfP;
      const prId = sfContext.payrollId;
      if (prId) {
        const pr = payrolls.find((x) => x.id === prId);
        if (pr) {
          const newItems = pr.items.map((it) => {
            if (it.category === '社保公积金') {
              if (it.name === '养老保险个人') return { ...it, amount: data.pensionPersonal };
              if (it.name === '医疗保险个人') return { ...it, amount: data.medicalPersonal };
              if (it.name === '失业保险个人') return { ...it, amount: data.unemploymentPersonal };
              if (it.name === '住房公积金个人') return { ...it, amount: data.housingFundPersonal };
            }
            return it;
          });
          const taxBase = pr.totalIncome - totalP - pr.leaveDeduction - pr.lateDeduction;
          const monthlyTaxable = Math.max(0, taxBase - 5000);
          const tax = calculateMonthlyTax(monthlyTaxable, 0, 0);
          const newTaxItem = newItems.map((it) => it.category === '个人税' ? { ...it, amount: tax } : it);
          const totalDed = round2(totalP + tax + pr.leaveDeduction + pr.lateDeduction + pr.otherDeduction);
          const net = round2(pr.totalIncome - totalDed);
          updatePayroll(prId, {
            socialPersonal: totalP,
            housingFundPersonal: hfP,
            personalTax: tax,
            totalDeduction: totalDed,
            netSalary: net,
            items: newTaxItem,
          });
        }
      }
      message.success('社保公积金已更新，工资明细同步调整');
      setSfModal(false);
    } catch (e) {
      //
    }
  };

  const columns = [
    { title: '工号', width: 100, fixed: 'left' as const, render: (_: any, r: Payroll) => empMap.get(r.employeeId)?.employeeNo },
    { title: '姓名', width: 100, fixed: 'left' as const, render: (_: any, r: Payroll) => (
      <Space>
        <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#bae0ff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
          {(empMap.get(r.employeeId)?.name || '?')[0]}
        </span>
        {empMap.get(r.employeeId)?.name}
      </Space>
    ) },
    { title: '部门', width: 120, render: (_: any, r: Payroll) => {
      const e = empMap.get(r.employeeId); return e ? <Tag color="blue">{e.department}</Tag> : '-';
    } },
    { title: '基本工资', dataIndex: 'baseSalary', width: 100, render: (v: number) => `¥${v.toLocaleString()}` },
    { title: '绩效工资', dataIndex: 'performanceSalary', width: 100, render: (v: number) => `¥${v.toLocaleString()}` },
    { title: '加班费', dataIndex: 'overtimePay', width: 90, render: (v: number) => v > 0 ? <span style={{ color: '#52c41a' }}>+¥{v}</span> : '-' },
    { title: '奖金', dataIndex: 'bonus', width: 90, render: (v: number) => v > 0 ? <span style={{ color: '#fa8c16' }}>+¥{v}</span> : '-' },
    { title: '应发合计', dataIndex: 'totalIncome', width: 110, render: (v: number) => <span style={{ fontWeight: 600 }}>¥{v.toLocaleString()}</span> },
    { title: '社保公积金', dataIndex: 'socialPersonal', width: 110, render: (v: number) => <span style={{ color: '#ff4d4f' }}>-¥{v.toLocaleString()}</span> },
    { title: '个税', dataIndex: 'personalTax', width: 90, render: (v: number) => v > 0 ? <span style={{ color: '#cf1322' }}>-¥{v}</span> : '-' },
    { title: '考勤扣款', width: 100,
      render: (_: any, r: Payroll) => {
        const total = r.leaveDeduction + r.lateDeduction;
        return total > 0 ? <span style={{ color: '#fa8c16' }}>-¥{total}</span> : '-';
      } },
    { title: '实发工资', dataIndex: 'netSalary', width: 110, fixed: 'right' as const,
      render: (v: number) => <span style={{ fontWeight: 700, color: '#1677ff', fontSize: 14 }}>¥{v.toLocaleString()}</span> },
    { title: '状态', width: 140, fixed: 'right' as const,
      render: (_: any, r: Payroll) => (
        <Space direction="vertical" size={2}>
          {r.reviewed ? <Tag color="success" icon={<CheckCircleOutlined />}>已复核</Tag> : <Tag color="warning">待复核</Tag>}
          {r.confirmed ? <Tag color="green">已确认</Tag> : <Tag color="default">未确认</Tag>}
        </Space>
      ) },
    { title: '操作', width: 220, fixed: 'right' as const,
      render: (_: any, r: Payroll) => (
        <Space size={4} wrap>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(r)}>详情</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>调整</Button>
          <Button type="link" size="small" onClick={() => openSfEdit(r)}>社保</Button>
          {!r.reviewed && (
            <Button size="small" type="primary" onClick={() => { reviewPayroll(r.id, '财务主管'); message.success('已复核'); }}>复核</Button>
          )}
        </Space>
      ) },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card bordered>
            <Statistic title={<span><TeamOutlined style={{ color: '#1677ff' }} /> 核算人数</span>} value={stats.count} suffix="人" />
          </Card>
        </Col>
        <Col span={5}>
          <Card bordered>
            <Statistic title={<span><DollarOutlined style={{ color: '#52c41a' }} /> 实发总额</span>} value={stats.totalNet} prefix="¥" valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card bordered>
            <Statistic title={<span><CalculatorOutlined style={{ color: '#722ed1' }} /> 应发总额</span>} value={stats.total} prefix="¥" />
          </Card>
        </Col>
        <Col span={5}>
          <Card bordered>
            <Statistic title={<span><FileTextOutlined style={{ color: '#cf1322' }} /> 代扣个税</span>} value={stats.totalTax} prefix="¥" valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card bordered>
            <Statistic title={<span><UserOutlined style={{ color: '#fa8c16' }} /> 企业社保公积</span>} value={stats.totalSocial} prefix="¥" valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
      </Row>

      <div className="page-card">
        <div className="toolbar">
          <div className="toolbar-left">
            <Space>
              <span style={{ fontSize: 16, fontWeight: 600 }}>薪资核算期间：</span>
              <DatePicker picker="month" value={dayjs(currentMonth)} onChange={(v) => v && setCurrentMonth(v.format('YYYY-MM'))} />
            </Space>
            <Input prefix={<SearchOutlined />} placeholder="搜索姓名/工号" style={{ width: 200 }} value={keyword} onChange={(e) => setKeyword(e.target.value)} allowClear />
            <Select style={{ width: 150 }} value={dept} onChange={setDept} options={[{ label: '全部部门', value: '全部' }, ...departments.map((d: string) => ({ label: d, value: d }))]} />
            <Select style={{ width: 140 }} value={status} onChange={setStatus}
              options={[{ label: '全部状态', value: 'all' }, { label: '已复核', value: 'reviewed' }, { label: '待复核', value: 'unreviewed' }, { label: '已确认', value: 'confirmed' }]} />
          </div>
          <div className="toolbar-right">
            <Button icon={<SyncOutlined spin={generating} />} onClick={generatePayrolls} loading={generating} type="primary">
              {generating ? '核算中...' : '一键核算薪资'}
            </Button>
            <Button icon={<ExportOutlined />} onClick={exportExcel}>导出Excel</Button>
          </div>
        </div>

        <Steps
          current={
            (stats.count > 0 ? 1 : 0) +
            (stats.reviewed === stats.count && stats.count > 0 ? 1 : 0) +
            (stats.confirmed === stats.count && stats.count > 0 ? 1 : 0)
          }
          size="small"
          style={{ margin: '12px 0 20px' }}
          items={[
            { title: '导入打卡数据', description: '已完成' },
            { title: '处理异常考勤', description: '已完成' },
            { title: '核算薪资', description: stats.count > 0 ? `${stats.count}人已核算` : '待处理', status: stats.count > 0 ? 'finish' : 'process' },
            { title: '财务复核', description: `${stats.reviewed}/${stats.count}人通过`, status: stats.reviewed === stats.count && stats.count > 0 ? 'finish' : stats.reviewed > 0 ? 'process' : 'wait' },
            { title: '员工确认', description: `${stats.confirmed}/${stats.count}人确认`, status: stats.confirmed === stats.count && stats.count > 0 ? 'finish' : stats.confirmed > 0 ? 'process' : 'wait' },
          ]}
        />

        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          scroll={{ x: 1800 }}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
          summary={(pageData) => {
            let totalInc = 0, totalNet = 0, totalTax = 0, totalSoc = 0;
            pageData.forEach((p: Payroll) => {
              totalInc += p.totalIncome; totalNet += p.netSalary; totalTax += p.personalTax; totalSoc += p.socialPersonal;
            });
            return (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 600 }}>
                  <Table.Summary.Cell index={0} colSpan={4}>本页合计</Table.Summary.Cell>
                  <Table.Summary.Cell index={4}>¥{totalInc.toLocaleString()}</Table.Summary.Cell>
                  <Table.Summary.Cell index={5}>¥{totalSoc.toLocaleString()}</Table.Summary.Cell>
                  <Table.Summary.Cell index={6}>¥{totalTax.toLocaleString()}</Table.Summary.Cell>
                  <Table.Summary.Cell index={7} colSpan={3}>
                    <span style={{ color: '#1677ff' }}>实发: ¥{totalNet.toLocaleString()}</span>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
        />
      </div>

      <Divider />

      <div className="page-card">
        <h3 style={{ margin: '0 0 16px' }}><CalculatorOutlined style={{ color: '#1677ff' }} /> 部门薪资汇总</h3>
        <Row gutter={16}>
          {deptSummary.map((d: any) => (
            <Col span={8} key={d.department} style={{ marginBottom: 16 }}>
              <Card size="small" style={{ background: '#fafafa' }}>
                <Card.Meta
                  title={<Space><Tag color="blue">{d.department}</Tag> <span style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>{d.headcount}人</span></Space>}
                  description={
                    <div style={{ fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                        <span style={{ color: 'rgba(0,0,0,0.45)' }}>应发总额</span>
                        <span style={{ fontWeight: 600 }}>¥{d.totalIncome.toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                        <span style={{ color: 'rgba(0,0,0,0.45)' }}>人均工资</span>
                        <span>¥{d.avgSalary.toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                        <span style={{ color: 'rgba(0,0,0,0.45)' }}>企业社保公积</span>
                        <span>¥{(d.totalSocialCompany + d.totalHousingFundCompany).toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 0', borderTop: '1px dashed #e8e8e8', marginTop: 4 }}>
                        <span style={{ color: '#1677ff' }}>人力总成本</span>
                        <span style={{ fontWeight: 700, color: '#1677ff' }}>¥{d.totalCost.toLocaleString()}</span>
                      </div>
                    </div>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      <Drawer title="薪资明细" placement="right" width={560} open={detailDrawer} onClose={() => setDetailDrawer(false)} extra={currentPayroll && (
        <Space>
          {!currentPayroll.reviewed && <Button type="primary" onClick={() => { reviewPayroll(currentPayroll.id, '财务主管'); message.success('已复核'); setDetailDrawer(false); }}>复核通过</Button>}
        </Space>
      )}>
        {currentPayroll && (() => {
          const emp = empMap.get(currentPayroll.employeeId);
          const sf = sfMap.get(`${currentPayroll.employeeId}_${currentMonth}`);
          const incomes = currentPayroll.items.filter((i) => i.type === 'income');
          const deductions = currentPayroll.items.filter((i) => i.type === 'deduction');
          return (
            <div>
              <Card type="inner" title="员工信息" size="small" style={{ marginBottom: 12 }}>
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="工号">{emp?.employeeNo}</Descriptions.Item>
                  <Descriptions.Item label="姓名">{emp?.name}</Descriptions.Item>
                  <Descriptions.Item label="部门">{emp?.department}</Descriptions.Item>
                  <Descriptions.Item label="职位">{emp?.position}</Descriptions.Item>
                  <Descriptions.Item label="入职日期">{emp?.hireDate}</Descriptions.Item>
                  <Descriptions.Item label="薪资月份">{currentPayroll.month}</Descriptions.Item>
                </Descriptions>
              </Card>
              <Card type="inner" title="收入明细" size="small" style={{ marginBottom: 12 }}>
                <List
                  size="small"
                  dataSource={incomes}
                  renderItem={(item) => (
                    <List.Item style={{ padding: '6px 0' }}>
                      <span>{item.name}</span>
                      <span style={{ color: '#52c41a', fontWeight: 600 }}>+¥{item.amount.toLocaleString()}</span>
                    </List.Item>
                  )}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', marginTop: 4, borderTop: '1px solid #f0f0f0', fontWeight: 600 }}>
                  <span>应发合计</span>
                  <span>¥{currentPayroll.totalIncome.toLocaleString()}</span>
                </div>
              </Card>
              <Card type="inner" title="扣款明细" size="small" style={{ marginBottom: 12 }}>
                <List
                  size="small"
                  dataSource={deductions}
                  renderItem={(item) => (
                    <List.Item style={{ padding: '6px 0' }}>
                      <span>{item.name}</span>
                      <span style={{ color: item.amount > 0 ? '#ff4d4f' : 'rgba(0,0,0,0.45)', fontWeight: 600 }}>
                        {item.amount > 0 ? `-¥${item.amount.toLocaleString()}` : '¥0'}
                      </span>
                    </List.Item>
                  )}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', marginTop: 4, borderTop: '1px solid #f0f0f0', fontWeight: 600 }}>
                  <span>扣款合计</span>
                  <span style={{ color: '#ff4d4f' }}>-¥{currentPayroll.totalDeduction.toLocaleString()}</span>
                </div>
              </Card>
              {sf && (
                <Card type="inner" title="社保公积金明细（企业缴纳）" size="small" style={{ marginBottom: 12 }}>
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="养老企业">¥{sf.pensionCompany}</Descriptions.Item>
                    <Descriptions.Item label="医疗企业">¥{sf.medicalCompany}</Descriptions.Item>
                    <Descriptions.Item label="失业企业">¥{sf.unemploymentCompany}</Descriptions.Item>
                    <Descriptions.Item label="工伤企业">¥{sf.injuryCompany}</Descriptions.Item>
                    <Descriptions.Item label="生育企业">¥{sf.maternityCompany}</Descriptions.Item>
                    <Descriptions.Item label="公积金企业">¥{sf.housingFundCompany}</Descriptions.Item>
                    <Descriptions.Item label="企业合计" span={2}>
                      <span style={{ color: '#fa8c16', fontWeight: 600 }}>¥{sf.totalCompany.toLocaleString()}</span>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              )}
              <div style={{ background: '#e6f4ff', padding: 20, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ color: 'rgba(0,0,0,0.45)', marginBottom: 6 }}>实发工资</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: '#1677ff' }}>¥{currentPayroll.netSalary.toLocaleString()}</div>
              </div>
            </div>
          );
        })()}
      </Drawer>

      <Modal title="调整薪资明细" open={editModal} onOk={submitEdit} onCancel={() => setEditModal(false)} okText="保存" cancelText="取消" width={680} destroyOnClose>
        <Form form={editForm} layout="vertical" preserve={false}>
          <Divider orientation="left">收入项</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="baseSalary" label="基本工资" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="performanceSalary" label="绩效工资">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="overtimePay" label="加班费">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="bonus" label="奖金">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="allowance" label="津贴补贴">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="otherIncome" label="其他收入">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Divider orientation="left">扣款项</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="socialPersonal" label="社保公积金">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="personalTax" label="个人所得税">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="leaveDeduction" label="请假扣款">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="lateDeduction" label="迟到早退扣款">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="otherDeduction" label="其他扣款">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Tooltip title="保存时将自动重新计算应发合计、扣款合计和实发工资">
            <Button type="dashed" block icon={<CalculatorOutlined />}>保存时将自动核算合计</Button>
          </Tooltip>
        </Form>
      </Modal>

      <Modal title="编辑社保公积金" open={sfModal} onOk={submitSf} onCancel={() => setSfModal(false)} okText="保存" cancelText="取消" width={680} destroyOnClose>
        <Form form={sfForm} layout="vertical" preserve={false}>
          <Divider orientation="left">社会保险</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="pensionPersonal" label="养老保险(个人)">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="pensionCompany" label="养老保险(企业)">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="medicalPersonal" label="医疗保险(个人)">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="medicalCompany" label="医疗保险(企业)">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="unemploymentPersonal" label="失业保险(个人)">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="unemploymentCompany" label="失业保险(企业)">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="injuryCompany" label="工伤保险(企业)">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="maternityCompany" label="生育保险(企业)">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Divider orientation="left">住房公积金</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="housingFundPersonal" label="住房公积金(个人)">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="housingFundCompany" label="住房公积金(企业)">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default SalaryCalculation;
