import { useMemo, useState } from 'react';
import {
  Table, Button, Input, Select, Tabs, Space, Tag, Card, Row, Col, Statistic,
  message, Modal, Form, DatePicker, InputNumber, Popconfirm, Divider, Radio,
} from 'antd';
import {
  CalendarOutlined, PlusOutlined, SearchOutlined, EditOutlined,
  DeleteOutlined, ClockCircleOutlined, DollarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAppStore } from '../store/useAppStore';
import {
  genId, LEAVE_DEDUCT_RATES, OVERTIME_RATES,
  calculateDailyWage, calculateHourlyWage, round2,
} from '../utils/calculations';
import type { LeaveRecord, OvertimeRecord } from '../types';

const LEAVE_TYPES = ['年假', '事假', '病假', '婚假', '产假', '丧假', '调休'] as const;

const LeaveOvertime = () => {
  const store = useAppStore();
  const { addLeave, updateLeave, approveLeave, deleteLeave, addOvertime, updateOvertime, approveOvertime, deleteOvertime, isMonthLocked } = store;
  const employees: any[] = (store as any).employees || [];
  const leaveRecords: any[] = (store as any).leaveRecords || [];
  const overtimeRecords: any[] = (store as any).overtimeRecords || [];
  const currentMonth: string = (store as any).currentMonth || dayjs().subtract(1, 'month').format('YYYY-MM');
  const locked = isMonthLocked(currentMonth);

  const empMap = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const departments = useMemo(() => Array.from(new Set(employees.map((e) => e.department))), [employees]);

  const [leaveDept, setLeaveDept] = useState('全部');
  const [leaveKw, setLeaveKw] = useState('');
  const [leaveType, setLeaveType] = useState<string>('all');
  const [leaveApproved, setLeaveApproved] = useState<string>('all');

  const [otDept, setOtDept] = useState('全部');
  const [otKw, setOtKw] = useState('');
  const [otType, setOtType] = useState<string>('all');
  const [otApproved, setOtApproved] = useState<string>('all');

  const [leaveModal, setLeaveModal] = useState(false);
  const [leaveEditing, setLeaveEditing] = useState<LeaveRecord | null>(null);
  const [leaveForm] = Form.useForm();

  const [otModal, setOtModal] = useState(false);
  const [otEditing, setOtEditing] = useState<OvertimeRecord | null>(null);
  const [otForm] = Form.useForm();

  const leaveStats = useMemo(() => {
    const list = leaveRecords.filter((l) => l.startDate.startsWith(currentMonth.slice(0, 7)));
    const totalDays = list.reduce((s, l) => s + l.days, 0);
    const deduct = list.reduce((s, l) => s + l.deductAmount, 0);
    const pending = list.filter((l) => !l.approved).length;
    return { total: list.length, totalDays, deduct, pending };
  }, [leaveRecords, currentMonth]);

  const otStats = useMemo(() => {
    const list = overtimeRecords.filter((o) => o.date.startsWith(currentMonth.slice(0, 7)));
    const hours = list.filter((o) => o.approved).reduce((s, o) => s + o.hours, 0);
    const converted = list.filter((o) => o.approved).reduce((s, o) => s + o.convertedHours, 0);
    const pay = list.filter((o) => o.approved).reduce((s, o) => s + o.payAmount, 0);
    const pending = list.filter((o) => !o.approved).length;
    return { total: list.length, hours, converted, pay, pending };
  }, [overtimeRecords, currentMonth]);

  const filteredLeaves = useMemo(() => {
    let list = leaveRecords;
    if (leaveType !== 'all') list = list.filter((l) => l.type === leaveType);
    if (leaveApproved === 'yes') list = list.filter((l) => l.approved);
    if (leaveApproved === 'no') list = list.filter((l) => !l.approved);
    if (leaveDept !== '全部' || leaveKw) {
      list = list.filter((l) => {
        const e = empMap.get(l.employeeId);
        if (!e) return false;
        if (leaveDept !== '全部' && e.department !== leaveDept) return false;
        if (leaveKw) {
          const kw = leaveKw.toLowerCase();
          if (!e.name.toLowerCase().includes(kw) && !e.employeeNo.toLowerCase().includes(kw)) return false;
        }
        return true;
      });
    }
    return [...list].sort((a, b) => a.startDate < b.startDate ? 1 : -1);
  }, [leaveRecords, leaveType, leaveApproved, leaveDept, leaveKw, empMap]);

  const filteredOt = useMemo(() => {
    let list = overtimeRecords;
    if (otType !== 'all') list = list.filter((o) => o.type === otType);
    if (otApproved === 'yes') list = list.filter((o) => o.approved);
    if (otApproved === 'no') list = list.filter((o) => !o.approved);
    if (otDept !== '全部' || otKw) {
      list = list.filter((o) => {
        const e = empMap.get(o.employeeId);
        if (!e) return false;
        if (otDept !== '全部' && e.department !== otDept) return false;
        if (otKw) {
          const kw = otKw.toLowerCase();
          if (!e.name.toLowerCase().includes(kw) && !e.employeeNo.toLowerCase().includes(kw)) return false;
        }
        return true;
      });
    }
    return [...list].sort((a, b) => a.date < b.date ? 1 : -1);
  }, [overtimeRecords, otType, otApproved, otDept, otKw, empMap]);

  const openLeaveAdd = () => {
    if (locked) { message.warning(`${currentMonth} 已结账，不能新增请假`); return; }
    setLeaveEditing(null);
    leaveForm.resetFields();
    leaveForm.setFieldsValue({ type: '事假', approved: false });
    setLeaveModal(true);
  };

  const openLeaveEdit = (l: LeaveRecord) => {
    if (locked) { message.warning(`${currentMonth} 已结账，不能编辑请假`); return; }
    setLeaveEditing(l);
    leaveForm.setFieldsValue({
      ...l,
      startDate: dayjs(l.startDate),
      endDate: dayjs(l.endDate),
    });
    setLeaveModal(true);
  };

  const submitLeave = async () => {
    if (locked) { message.warning(`${currentMonth} 已结账，不能保存请假`); return; }
    try {
      const v = await leaveForm.validateFields();
      const emp = employees.find((e) => e.id === v.employeeId);
      if (!emp) return;
      const start = dayjs(v.startDate);
      const end = dayjs(v.endDate);
      const days = end.diff(start, 'day') + 1;
      const hours = days * 8;
      const rate = LEAVE_DEDUCT_RATES[v.type as keyof typeof LEAVE_DEDUCT_RATES] || 1;
      const daily = calculateDailyWage(emp.baseSalary);
      const deductAmount = round2(daily * days * rate);

      const data: LeaveRecord = {
        ...v,
        startDate: start.format('YYYY-MM-DD'),
        endDate: end.format('YYYY-MM-DD'),
        days,
        hours,
        deductAmount,
        createTime: new Date().toISOString(),
      };
      if (leaveEditing) {
        updateLeave(leaveEditing.id, data);
        message.success('请假记录已更新');
      } else {
        addLeave({ ...data, id: genId('lv') });
        message.success('请假申请已提交');
      }
      setLeaveModal(false);
    } catch (e) {
      //
    }
  };

  const openOtAdd = () => {
    if (locked) { message.warning(`${currentMonth} 已结账，不能登记加班`); return; }
    setOtEditing(null);
    otForm.resetFields();
    otForm.setFieldsValue({ type: 'normal', approved: false });
    setOtModal(true);
  };

  const openOtEdit = (o: OvertimeRecord) => {
    if (locked) { message.warning(`${currentMonth} 已结账，不能编辑加班`); return; }
    setOtEditing(o);
    otForm.setFieldsValue({ ...o, date: dayjs(o.date) });
    setOtModal(true);
  };

  const submitOt = async () => {
    if (locked) { message.warning(`${currentMonth} 已结账，不能保存加班`); return; }
    try {
      const v = await otForm.validateFields();
      const emp = employees.find((e) => e.id === v.employeeId);
      if (!emp) return;
      const hours = v.endHour - v.startHour;
      if (hours <= 0) {
        message.error('结束时间必须大于开始时间');
        return;
      }
      const rate = OVERTIME_RATES[v.type as keyof typeof OVERTIME_RATES] || 1;
      const hourly = calculateHourlyWage(emp.baseSalary);
      const data: OvertimeRecord = {
        ...v,
        date: dayjs(v.date).format('YYYY-MM-DD'),
        hours: round2(hours),
        rate,
        convertedHours: round2(hours * rate),
        payAmount: round2(hourly * hours * rate),
        createTime: new Date().toISOString(),
      };
      if (otEditing) {
        updateOvertime(otEditing.id, data);
        message.success('加班记录已更新');
      } else {
        addOvertime({ ...data, id: genId('ot') });
        message.success('加班申请已提交');
      }
      setOtModal(false);
    } catch (e) {
      //
    }
  };

  const leaveColumns = [
    { title: '请假类型', dataIndex: 'type', width: 100,
      render: (v: string) => {
        const colorMap: Record<string, string> = { '年假': 'green', '事假': 'orange', '病假': 'blue', '婚假': 'magenta', '产假': 'purple', '丧假': 'default', '调休': 'cyan' };
        return <Tag color={colorMap[v]}>{v}</Tag>;
      } },
    { title: '员工', width: 100, render: (_: any, r: LeaveRecord) => empMap.get(r.employeeId)?.name },
    { title: '部门', width: 120, render: (_: any, r: LeaveRecord) => {
      const e = empMap.get(r.employeeId); return e ? <Tag color="blue">{e.department}</Tag> : '-';
    } },
    { title: '开始日期', dataIndex: 'startDate', width: 120 },
    { title: '结束日期', dataIndex: 'endDate', width: 120 },
    { title: '请假天数', dataIndex: 'days', width: 90, render: (v: number) => `${v} 天` },
    { title: '折合小时', dataIndex: 'hours', width: 100, render: (v: number) => `${v} h` },
    { title: '扣薪金额', width: 110,
      render: (_: any, r: LeaveRecord) => r.deductAmount > 0
        ? <span style={{ color: '#ff4d4f', fontWeight: 600 }}>-¥{r.deductAmount}</span>
        : <Tag color="green">带薪</Tag> },
    { title: '审批状态', width: 100,
      render: (_: any, r: LeaveRecord) => r.approved ? <Tag color="success">已通过</Tag> : <Tag color="warning">待审批</Tag> },
    { title: '原因', dataIndex: 'reason', ellipsis: true },
    { title: '操作', width: 180, fixed: 'right' as const,
      render: (_: any, r: LeaveRecord) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EditOutlined />} disabled={locked} onClick={() => { if (locked) return message.warning('本月已结账'); openLeaveEdit(r); }}>编辑</Button>
          {!r.approved && <Button size="small" type="primary" disabled={locked} onClick={() => { if (locked) return message.warning('本月已结账'); approveLeave(r.id); message.success('已通过'); }}>通过</Button>}
          <Popconfirm title="确定删除?" onConfirm={() => { if (locked) { message.warning('本月已结账'); return; } deleteLeave(r.id); message.success('已删除'); }} disabled={locked}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={locked}>删除</Button>
          </Popconfirm>
        </Space>
      ) },
  ];

  const otColumns = [
    { title: '日期', dataIndex: 'date', width: 120 },
    { title: '员工', width: 100, render: (_: any, r: OvertimeRecord) => empMap.get(r.employeeId)?.name },
    { title: '部门', width: 120, render: (_: any, r: OvertimeRecord) => {
      const e = empMap.get(r.employeeId); return e ? <Tag color="blue">{e.department}</Tag> : '-';
    } },
    { title: '加班类型', dataIndex: 'type', width: 100,
      render: (v: string) => {
        const map: Record<string, { label: string; color: string }> = {
          normal: { label: '平时加班', color: 'blue' }, weekend: { label: '周末加班', color: 'orange' }, holiday: { label: '节假日', color: 'red' },
        };
        return <Tag color={map[v]?.color}>{map[v]?.label}</Tag>;
      } },
    { title: '加班时段', width: 140, render: (_: any, r: OvertimeRecord) => `${r.startHour.toFixed(1)}:00 - ${r.endHour.toFixed(1)}:00` },
    { title: '实际时长', dataIndex: 'hours', width: 100, render: (v: number) => `${v} h` },
    { title: '折算系数', dataIndex: 'rate', width: 90, render: (v: number) => `x${v}` },
    { title: '折算工时', dataIndex: 'convertedHours', width: 100, render: (v: number) => `${v} h` },
    { title: '加班费', width: 110,
      render: (_: any, r: OvertimeRecord) => <span style={{ color: '#52c41a', fontWeight: 600 }}>+¥{r.payAmount}</span> },
    { title: '审批状态', width: 100,
      render: (_: any, r: OvertimeRecord) => r.approved ? <Tag color="success">已通过</Tag> : <Tag color="warning">待审批</Tag> },
    { title: '操作', width: 180, fixed: 'right' as const,
      render: (_: any, r: OvertimeRecord) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EditOutlined />} disabled={locked} onClick={() => { if (locked) return message.warning('本月已结账'); openOtEdit(r); }}>编辑</Button>
          {!r.approved && <Button size="small" type="primary" disabled={locked} onClick={() => { if (locked) return message.warning('本月已结账'); approveOvertime(r.id); message.success('已通过'); }}>通过</Button>}
          <Popconfirm title="确定删除?" onConfirm={() => { if (locked) { message.warning('本月已结账'); return; } deleteOvertime(r.id); message.success('已删除'); }} disabled={locked}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={locked}>删除</Button>
          </Popconfirm>
        </Space>
      ) },
  ];

  return (
    <Tabs
      defaultActiveKey="leave"
      items={[
        {
          key: 'leave',
          label: <Space><CalendarOutlined /> 请假管理</Space>,
          children: (
            <div>
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={6}>
                  <Card bordered>
                    <Statistic title={<span><CalendarOutlined style={{ color: '#1677ff' }} /> 本月申请数</span>} value={leaveStats.total} />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card bordered>
                    <Statistic title="请假总天数" value={leaveStats.totalDays} suffix="天" />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card bordered>
                    <Statistic title={<span style={{ color: '#ff4d4f' }}>预计扣薪总额</span>} value={leaveStats.deduct} prefix="¥" valueStyle={{ color: '#ff4d4f' }} />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card bordered>
                    <Statistic title="待审批" value={leaveStats.pending} valueStyle={{ color: '#fa8c16' }} />
                  </Card>
                </Col>
              </Row>
              <div className="page-card">
                <div className="toolbar">
                  <div className="toolbar-left">
                    <Input prefix={<SearchOutlined />} placeholder="搜索姓名/工号" style={{ width: 200 }} value={leaveKw} onChange={(e) => setLeaveKw(e.target.value)} allowClear />
                    <Select style={{ width: 150 }} value={leaveDept} onChange={setLeaveDept} options={[{ label: '全部部门', value: '全部' }, ...departments.map((d) => ({ label: d, value: d }))]} />
                    <Select style={{ width: 130 }} value={leaveType} onChange={setLeaveType} options={[{ label: '全部类型', value: 'all' }, ...LEAVE_TYPES.map((t) => ({ label: t, value: t }))]} />
                    <Select style={{ width: 120 }} value={leaveApproved} onChange={setLeaveApproved} options={[{ label: '全部', value: 'all' }, { label: '已通过', value: 'yes' }, { label: '待审批', value: 'no' }]} />
                  </div>
                  <div className="toolbar-right">
                    <Button type="primary" icon={<PlusOutlined />} disabled={locked} onClick={() => { if (locked) return message.warning('本月已结账'); openLeaveAdd(); }}>新增请假</Button>
                  </div>
                </div>
                <Divider style={{ margin: '4px 0 12px' }} />
                <div style={{ marginBottom: 12, padding: 12, background: '#f6ffed', borderRadius: 6, border: '1px solid #b7eb8f', fontSize: 12 }}>
                  <strong>扣薪规则参考：</strong>
                  {Object.entries(LEAVE_DEDUCT_RATES).map(([k, v]) => (
                    <Tag key={k} style={{ marginLeft: 8 }}>
                      {k}: {v === 0 ? '带薪' : `扣${v * 100}%日薪`}
                    </Tag>
                  ))}
                </div>
                <Table
                  rowKey="id"
                  columns={leaveColumns}
                  dataSource={filteredLeaves}
                  scroll={{ x: 1400 }}
                  pagination={{ pageSize: 12, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
                />
              </div>
            </div>
          ),
        },
        {
          key: 'ot',
          label: <Space><ClockCircleOutlined /> 加班管理</Space>,
          children: (
            <div>
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={5}>
                  <Card bordered>
                    <Statistic title={<span><ClockCircleOutlined style={{ color: '#722ed1' }} /> 本月加班申请</span>} value={otStats.total} />
                  </Card>
                </Col>
                <Col span={5}>
                  <Card bordered>
                    <Statistic title="实际加班时长" value={otStats.hours} suffix="h" />
                  </Card>
                </Col>
                <Col span={5}>
                  <Card bordered>
                    <Statistic title="折算标准工时" value={otStats.converted} suffix="h" valueStyle={{ color: '#722ed1' }} />
                  </Card>
                </Col>
                <Col span={5}>
                  <Card bordered>
                    <Statistic title={<span style={{ color: '#52c41a' }}>加班费合计</span>} prefix="¥" value={otStats.pay} valueStyle={{ color: '#52c41a' }} />
                  </Card>
                </Col>
                <Col span={4}>
                  <Card bordered>
                    <Statistic title="待审批" value={otStats.pending} valueStyle={{ color: '#fa8c16' }} />
                  </Card>
                </Col>
              </Row>
              <div className="page-card">
                <div className="toolbar">
                  <div className="toolbar-left">
                    <Input prefix={<SearchOutlined />} placeholder="搜索姓名/工号" style={{ width: 200 }} value={otKw} onChange={(e) => setOtKw(e.target.value)} allowClear />
                    <Select style={{ width: 150 }} value={otDept} onChange={setOtDept} options={[{ label: '全部部门', value: '全部' }, ...departments.map((d) => ({ label: d, value: d }))]} />
                    <Select style={{ width: 140 }} value={otType} onChange={setOtType}
                      options={[{ label: '全部类型', value: 'all' }, { label: '平时加班', value: 'normal' }, { label: '周末加班', value: 'weekend' }, { label: '节假日加班', value: 'holiday' }]} />
                    <Select style={{ width: 120 }} value={otApproved} onChange={setOtApproved} options={[{ label: '全部', value: 'all' }, { label: '已通过', value: 'yes' }, { label: '待审批', value: 'no' }]} />
                  </div>
                  <div className="toolbar-right">
                    <Button type="primary" icon={<PlusOutlined />} disabled={locked} onClick={() => { if (locked) return message.warning('本月已结账'); openOtAdd(); }}>登记加班</Button>
                  </div>
                </div>
                <Divider style={{ margin: '4px 0 12px' }} />
                <div style={{ marginBottom: 12, padding: 12, background: '#f9f0ff', borderRadius: 6, border: '1px solid #d3adf7', fontSize: 12 }}>
                  <strong>加班折算规则：</strong>
                  {Object.entries(OVERTIME_RATES).map(([k, v]) => {
                    const m: Record<string, string> = { normal: '平时', weekend: '周末', holiday: '节假日' };
                    return (
                      <Tag key={k} style={{ marginLeft: 8 }}>
                        {m[k]}: x{v} 倍时薪
                      </Tag>
                    );
                  })}
                </div>
                <Table
                  rowKey="id"
                  columns={otColumns}
                  dataSource={filteredOt}
                  scroll={{ x: 1500 }}
                  pagination={{ pageSize: 12, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
                />
              </div>
            </div>
          ),
        },
      ]}
    />
  );
};

export default LeaveOvertime;
