import { useMemo, useState } from 'react';
import {
  Card, Row, Col, Statistic, Tabs, Table, Button, Select, DatePicker,
  Space, message, Divider, Progress, List, Tag, Tooltip, Radio,
  Descriptions, Empty,
} from 'antd';
import {
  BarChartOutlined, ExportOutlined, CalendarOutlined, TeamOutlined,
  DollarOutlined, FileExcelOutlined, HistoryOutlined, PieChartOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import dayjs from 'dayjs';
import { useAppStore, computeDepartmentSummary } from '../store/useAppStore';
import * as XLSX from 'xlsx';
import type { Payroll, SocialHousingFund, Employee } from '../types';

const COLORS = ['#1677ff', '#52c41a', '#fa8c16', '#722ed1', '#13c2c2', '#eb2f96', '#faad14', '#2f54eb'];

const SummaryExport = () => {
  const store = useAppStore();
  const { setCurrentMonth } = store;
  const employees: Employee[] = (store as any).employees || [];
  const payrolls: Payroll[] = (store as any).payrolls || [];
  const socialFunds: SocialHousingFund[] = (store as any).socialFunds || [];
  const currentMonth: string = (store as any).currentMonth || dayjs().subtract(1, 'month').format('YYYY-MM');
  const empMap = useMemo(() => new Map(employees.map((e: Employee) => [e.id, e])), [employees]);

  const [viewMonth, setViewMonth] = useState(currentMonth);
  const [historyMonth, setHistoryMonth] = useState<string[]>([]);
  const [deptFilter, setDeptFilter] = useState('全部');
  const [historyView, setHistoryView] = useState(false);

  const departments = useMemo(() => Array.from(new Set(employees.map((e: Employee) => e.department))), [employees]);

  const monthPayrolls = useMemo(() =>
    payrolls.filter((p: Payroll) => p.month === (historyView ? (historyMonth[historyMonth.length - 1] || currentMonth) : viewMonth)),
  [payrolls, historyView, historyMonth, viewMonth, currentMonth]);

  const monthSocials = useMemo(() =>
    socialFunds.filter((s: SocialHousingFund) => s.month === (historyView ? (historyMonth[historyMonth.length - 1] || currentMonth) : viewMonth)),
  [socialFunds, historyView, historyMonth, viewMonth, currentMonth]);

  const activeMonth = historyView ? (historyMonth[historyMonth.length - 1] || currentMonth) : viewMonth;

  const deptSummary = useMemo(() => {
    const list = computeDepartmentSummary(monthPayrolls, monthSocials, employees);
    return deptFilter === '全部' ? list : list.filter((d) => d.department === deptFilter);
  }, [monthPayrolls, monthSocials, employees, deptFilter]);

  const allDeptSummary = useMemo(() => computeDepartmentSummary(monthPayrolls, monthSocials, employees), [monthPayrolls, monthSocials, employees]);

  const overview = useMemo(() => {
    const totalCost = deptSummary.reduce((s, d) => s + d.totalCost, 0);
    const totalIncome = deptSummary.reduce((s, d) => s + d.totalIncome, 0);
    const totalCompany = deptSummary.reduce((s, d) => s + d.totalSocialCompany + d.totalHousingFundCompany, 0);
    const totalHeadcount = deptSummary.reduce((s, d) => s + d.headcount, 0);
    const avgPerCapita = totalHeadcount ? Math.round(totalCost / totalHeadcount) : 0;
    const maxDept = [...deptSummary].sort((a, b) => b.totalCost - a.totalCost)[0];
    return { totalCost, totalIncome, totalCompany, totalHeadcount, avgPerCapita, maxDept };
  }, [deptSummary]);

  const chartBarData = useMemo(() => allDeptSummary.map((d) => ({
    name: d.department.slice(0, 4),
    fullName: d.department,
    工资总额: d.totalIncome,
    社保公积: Math.round(d.totalSocialCompany + d.totalHousingFundCompany),
    总成本: d.totalCost,
  })), [allDeptSummary]);

  const pieData = useMemo(() => allDeptSummary.map((d, idx) => ({
    name: d.department,
    value: d.totalCost,
    color: COLORS[idx % COLORS.length],
  })), [allDeptSummary]);

  const historyTrend = useMemo(() => {
    const months: string[] = [];
    const base = dayjs(activeMonth);
    for (let i = 5; i >= 0; i--) {
      months.push(base.subtract(i, 'month').format('YYYY-MM'));
    }
    return months.map((m) => {
      const mPay = payrolls.filter((p: Payroll) => p.month === m);
      const mSoc = socialFunds.filter((s: SocialHousingFund) => s.month === m);
      const sum = computeDepartmentSummary(mPay, mSoc, employees);
      const tc = sum.reduce((s, d) => s + d.totalCost, 0);
      const ti = sum.reduce((s, d) => s + d.totalIncome, 0);
      const hc = sum.reduce((s, d) => s + d.headcount, 0);
      return {
        month: m.slice(2),
        工资总额: ti,
        人力总成本: tc,
        核算人数: hc,
      };
    });
  }, [payrolls, socialFunds, employees, activeMonth]);

  const availableHistoryMonths = useMemo(() => {
    const set = new Set<string>();
    payrolls.forEach((p: Payroll) => set.add(p.month));
    return Array.from(set).sort().reverse();
  }, [payrolls]);

  const exportDeptSummary = () => {
    const data = allDeptSummary.map((d) => ({
      部门: d.department,
      人数: d.headcount,
      基本工资总额: d.totalBaseSalary,
      加班费总额: d.totalOvertimePay,
      奖金总额: d.totalBonus,
      津贴总额: d.totalAllowance,
      应发工资合计: d.totalIncome,
      企业社保: d.totalSocialCompany,
      企业公积金: d.totalHousingFundCompany,
      人力总成本: d.totalCost,
      人均工资: d.avgSalary,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '部门汇总');
    XLSX.writeFile(wb, `${activeMonth}部门成本汇总表.xlsx`);
    message.success('已导出部门汇总表');
  };

  const exportFullReport = () => {
    const wb = XLSX.utils.book_new();

    const empData = employees.map((e: Employee) => ({
      工号: e.employeeNo, 姓名: e.name, 性别: e.gender, 部门: e.department,
      职位: e.position, 入职日期: e.hireDate, 状态: e.status,
      基本工资: e.baseSalary, 社保基数: e.socialBase, 公积金基数: e.housingFundBase,
      联系电话: e.phone,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(empData), '员工档案');

    const payrollData = monthPayrolls.map((p: Payroll) => {
      const emp = empMap.get(p.employeeId);
      return {
        工号: emp?.employeeNo, 姓名: emp?.name, 部门: emp?.department, 职位: emp?.position,
        基本工资: p.baseSalary, 绩效工资: p.performanceSalary, 加班费: p.overtimePay,
        奖金: p.bonus, 津贴: p.allowance, 应发合计: p.totalIncome,
        社保个人: p.socialPersonal - p.housingFundPersonal, 公积金个人: p.housingFundPersonal,
        个税: p.personalTax, 请假扣款: p.leaveDeduction, 迟到扣款: p.lateDeduction,
        扣款合计: p.totalDeduction, 实发工资: p.netSalary, 复核状态: p.reviewed ? '已复核' : '未复核',
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(payrollData), `${activeMonth}薪资明细`);

    const deptData = allDeptSummary.map((d) => ({
      部门: d.department, 人数: d.headcount, 应发合计: d.totalIncome,
      企业社保: d.totalSocialCompany, 企业公积金: d.totalHousingFundCompany,
      人力总成本: d.totalCost, 人均工资: d.avgSalary,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(deptData), '部门汇总');

    XLSX.writeFile(wb, `${activeMonth}人力资源月度报表.xlsx`);
    message.success('已导出完整月度报表');
  };

  const summaryColumns = [
    {
      title: '部门', dataIndex: 'department', width: 140, fixed: 'left' as const,
      render: (v: string, _: any, idx: number) => (
        <Space>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[idx % COLORS.length] }} />
          <span style={{ fontWeight: 600 }}>{v}</span>
        </Space>
      ),
    },
    { title: '在职人数', dataIndex: 'headcount', width: 100, render: (v: number) => `${v} 人` },
    {
      title: '基本工资', dataIndex: 'totalBaseSalary', width: 120,
      render: (v: number) => `¥${v.toLocaleString()}`,
    },
    {
      title: '加班费', dataIndex: 'totalOvertimePay', width: 110,
      render: (v: number) => v > 0 ? <span style={{ color: '#52c41a' }}>¥{v.toLocaleString()}</span> : '-',
    },
    {
      title: '奖金', dataIndex: 'totalBonus', width: 110,
      render: (v: number) => v > 0 ? <span style={{ color: '#fa8c16' }}>¥{v.toLocaleString()}</span> : '-',
    },
    {
      title: '应发工资合计', dataIndex: 'totalIncome', width: 130,
      render: (v: number) => <span style={{ fontWeight: 600 }}>¥{v.toLocaleString()}</span>,
    },
    {
      title: '企业社保', dataIndex: 'totalSocialCompany', width: 120,
      render: (v: number) => `¥${v.toLocaleString()}`,
    },
    {
      title: '企业公积金', dataIndex: 'totalHousingFundCompany', width: 120,
      render: (v: number) => `¥${v.toLocaleString()}`,
    },
    {
      title: '人力总成本', dataIndex: 'totalCost', width: 140, fixed: 'right' as const,
      render: (v: number) => <span style={{ color: '#1677ff', fontWeight: 700, fontSize: 14 }}>¥{v.toLocaleString()}</span>,
      sorter: (a: any, b: any) => a.totalCost - b.totalCost,
    },
    {
      title: '人均成本', width: 120, fixed: 'right' as const,
      render: (_: any, r: any) => `¥${Math.round(r.totalCost / (r.headcount || 1)).toLocaleString()}`,
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card bordered>
            <Statistic
              title={<span><TeamOutlined style={{ color: '#1677ff' }} /> 核算总人数</span>}
              value={overview.totalHeadcount} suffix="人"
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card bordered>
            <Statistic
              title={<span><DollarOutlined style={{ color: '#52c41a' }} /> 应发工资总额</span>}
              value={overview.totalIncome} prefix="¥" valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card bordered>
            <Statistic
              title={<span><BarChartOutlined style={{ color: '#fa8c16' }} /> 企业社保公积</span>}
              value={overview.totalCompany} prefix="¥" valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card bordered>
            <Statistic
              title={<span><PieChartOutlined style={{ color: '#1677ff' }} /> 人力总成本</span>}
              value={overview.totalCost} prefix="¥" valueStyle={{ color: '#1677ff', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card bordered>
            <Statistic
              title={<span><FileExcelOutlined style={{ color: '#722ed1' }} /> 人均月成本</span>}
              value={overview.avgPerCapita} prefix="¥"
              suffix={overview.maxDept ? <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.45)' }}>最高: {overview.maxDept.department}</span> : undefined}
            />
          </Card>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="overview"
        items={[
          {
            key: 'overview',
            label: <Space><BarChartOutlined /> 成本总览</Space>,
            children: (
              <div className="page-card">
                <div className="toolbar">
                  <div className="toolbar-left">
                    <Space>
                      <Radio.Group
                        value={historyView ? 'history' : 'current'}
                        onChange={(e) => {
                          setHistoryView(e.target.value === 'history');
                          if (e.target.value === 'history' && availableHistoryMonths.length) {
                            setHistoryMonth([availableHistoryMonths[0]]);
                          }
                        }}
                      >
                        <Radio.Button value="current">当前月份</Radio.Button>
                        <Radio.Button value="history" disabled={!availableHistoryMonths.length}>
                          <HistoryOutlined /> 历史回查
                        </Radio.Button>
                      </Radio.Group>
                      {!historyView ? (
                        <DatePicker
                          picker="month"
                          value={dayjs(viewMonth)}
                          onChange={(v) => v && setViewMonth(v.format('YYYY-MM'))}
                          style={{ width: 160 }}
                        />
                      ) : (
                        <Select
                          mode="multiple"
                          style={{ width: 420 }}
                          placeholder="选择月份进行对比（可多选）"
                          value={historyMonth}
                          onChange={setHistoryMonth}
                          options={availableHistoryMonths.map((m) => ({ label: `${m.slice(0, 4)}年${m.slice(5)}月`, value: m }))}
                          maxTagCount={4}
                        />
                      )}
                      <Select style={{ width: 150 }} value={deptFilter} onChange={setDeptFilter}
                        options={[{ label: '全部部门', value: '全部' }, ...departments.map((d: string) => ({ label: d, value: d }))]} />
                    </Space>
                  </div>
                  <div className="toolbar-right">
                    <Button icon={<DownloadOutlined />} onClick={exportDeptSummary}>导出部门汇总</Button>
                    <Button type="primary" icon={<ExportOutlined />} onClick={exportFullReport}>导出完整报表</Button>
                  </div>
                </div>

                <Divider style={{ margin: '4px 0 20px' }} />

                <Row gutter={16}>
                  <Col span={14}>
                    <Card title={<Space><BarChartOutlined style={{ color: '#1677ff' }} /> 各部门人力成本对比</Space>} size="small" bordered>
                      {chartBarData.length ? (
                        <ResponsiveContainer width="100%" height={360}>
                          <BarChart data={chartBarData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v} />
                            <ReTooltip formatter={(v: number) => `¥${v.toLocaleString()}`} labelFormatter={(l, p: any) => p?.[0]?.payload?.fullName || l} />
                            <Legend />
                            <Bar dataKey="工资总额" fill="#1677ff" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="社保公积" fill="#fa8c16" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : <Empty />}
                    </Card>
                  </Col>
                  <Col span={10}>
                    <Card title={<Space><PieChartOutlined style={{ color: '#722ed1' }} /> 成本占比</Space>} size="small" bordered>
                      {pieData.length ? (
                        <ResponsiveContainer width="100%" height={360}>
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%" cy="50%"
                              outerRadius={110} innerRadius={60}
                              paddingAngle={1}
                              dataKey="value"
                              label={({ name, percent }) => `${name.length > 4 ? name.slice(0, 4) + '..' : name} ${(percent * 100).toFixed(0)}%`}
                              labelLine={{ stroke: '#d9d9d9' }}
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={index} fill={entry.color} />
                              ))}
                            </Pie>
                            <ReTooltip formatter={(v: number) => `¥${v.toLocaleString()}`} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : <Empty />}
                    </Card>
                  </Col>
                </Row>

                <Divider />

                <Card title={<Space><CalendarOutlined style={{ color: '#1677ff' }} /> 近6个月趋势</Space>} size="small" bordered style={{ marginTop: 16 }}>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={historyTrend} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" />
                      <YAxis yAxisId="left" tickFormatter={(v) => v >= 10000 ? `${(v / 10000).toFixed(0)}万` : v} />
                      <YAxis yAxisId="right" orientation="right" />
                      <ReTooltip formatter={(v: number, name: string) => name === '核算人数' ? `${v}人` : `¥${v.toLocaleString()}`} />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="工资总额" stroke="#1677ff" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      <Line yAxisId="left" type="monotone" dataKey="人力总成本" stroke="#722ed1" strokeWidth={2} dot={{ r: 4 }} />
                      <Line yAxisId="right" type="monotone" dataKey="核算人数" stroke="#52c41a" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>

                <Divider />

                <Card title={<Space><FileExcelOutlined /> 部门详细汇总</Space>} size="small" bordered style={{ marginTop: 16 }}>
                  <Table
                    rowKey="department"
                    columns={summaryColumns}
                    dataSource={deptSummary}
                    scroll={{ x: 1300 }}
                    pagination={false}
                    summary={(pageData) => {
                      const tc = pageData.reduce((s, d: any) => s + d.totalCost, 0);
                      const ti = pageData.reduce((s, d: any) => s + d.totalIncome, 0);
                      const tSoc = pageData.reduce((s, d: any) => s + d.totalSocialCompany, 0);
                      const tHf = pageData.reduce((s, d: any) => s + d.totalHousingFundCompany, 0);
                      const hc = pageData.reduce((s, d: any) => s + d.headcount, 0);
                      return (
                        <Table.Summary fixed>
                          <Table.Summary.Row style={{ background: '#e6f4ff', fontWeight: 700 }}>
                            <Table.Summary.Cell index={0}>合计</Table.Summary.Cell>
                            <Table.Summary.Cell index={1}>{hc} 人</Table.Summary.Cell>
                            <Table.Summary.Cell index={2} colSpan={3}>
                              <span style={{ color: '#1677ff' }}>应发: ¥{ti.toLocaleString()} · 企业社保公积: ¥{(tSoc + tHf).toLocaleString()}</span>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={5}>¥{ti.toLocaleString()}</Table.Summary.Cell>
                            <Table.Summary.Cell index={6}>¥{tSoc.toLocaleString()}</Table.Summary.Cell>
                            <Table.Summary.Cell index={7}>¥{tHf.toLocaleString()}</Table.Summary.Cell>
                            <Table.Summary.Cell index={8} style={{ color: '#cf1322' }}>¥{tc.toLocaleString()}</Table.Summary.Cell>
                            <Table.Summary.Cell index={9}>¥{Math.round(tc / (hc || 1)).toLocaleString()}</Table.Summary.Cell>
                          </Table.Summary.Row>
                        </Table.Summary>
                      );
                    }}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: 'analysis',
            label: <Space><PieChartOutlined /> 结构分析</Space>,
            children: (
              <div className="page-card">
                <div className="toolbar">
                  <div className="toolbar-left">
                    <DatePicker
                      picker="month"
                      value={dayjs(activeMonth)}
                      onChange={(v) => v && (historyView ? setHistoryMonth([v.format('YYYY-MM')]) : setViewMonth(v.format('YYYY-MM')))}
                    />
                    <Tag color="blue">核算月度: {activeMonth}</Tag>
                  </div>
                </div>
                <Divider style={{ margin: '4px 0 16px' }} />
                <Row gutter={16}>
                  <Col span={12}>
                    <Card title="薪资结构分析" size="small">
                      <Descriptions column={2} size="small" bordered>
                        <Descriptions.Item label="基本工资占比" span={2}>
                          {overview.totalIncome ? (
                            <Progress percent={Math.round((deptSummary.reduce((s, d) => s + d.totalBaseSalary, 0) / overview.totalIncome) * 100)}
                              status="active" strokeColor="#1677ff" />
                          ) : '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label="绩效/加班费占比">
                          {overview.totalIncome ? (
                            <Progress percent={Math.round(((deptSummary.reduce((s, d) => s + d.totalOvertimePay, 0)) / overview.totalIncome) * 100)}
                              strokeColor="#52c41a" />
                          ) : '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label="奖金占比">
                          {overview.totalIncome ? (
                            <Progress percent={Math.round((deptSummary.reduce((s, d) => s + d.totalBonus, 0) / overview.totalIncome) * 100)}
                              strokeColor="#fa8c16" />
                          ) : '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label="人均工资" span={2}>
                          <span style={{ fontSize: 18, fontWeight: 700, color: '#1677ff' }}>
                            ¥{overview.avgPerCapita.toLocaleString()}
                          </span>
                        </Descriptions.Item>
                        <Descriptions.Item label="社保公积金企业成本占工资比">
                          {overview.totalIncome ? `${Math.round((overview.totalCompany / overview.totalIncome) * 100)}%` : '-'}
                        </Descriptions.Item>
                        <Descriptions.Item label="社保公积金企业成本">
                          <span style={{ color: '#fa8c16' }}>¥{overview.totalCompany.toLocaleString()}</span>
                        </Descriptions.Item>
                      </Descriptions>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card title="各部门人均成本排名" size="small">
                      <List
                        dataSource={[...deptSummary].sort((a, b) => Math.round(b.totalCost / (b.headcount || 1)) - Math.round(a.totalCost / (a.headcount || 1)))}
                        renderItem={(item, idx) => {
                          const per = Math.round(item.totalCost / (item.headcount || 1));
                          const max = deptSummary.length ? Math.round([...deptSummary].sort((a, b) => Math.round(b.totalCost / (b.headcount || 1)) - Math.round(a.totalCost / (a.headcount || 1)))[0].totalCost / ([...deptSummary].sort((a, b) => Math.round(b.totalCost / (b.headcount || 1)) - Math.round(a.totalCost / (a.headcount || 1)))[0].headcount || 1)) : 1;
                          return (
                            <List.Item>
                              <Space style={{ width: '100%' }}>
                                <Tag color={idx < 3 ? ['#cf1322', '#fa8c16', '#faad14'][idx] : 'default'} style={{ minWidth: 40, textAlign: 'center' }}>
                                  TOP {idx + 1}
                                </Tag>
                                <span style={{ minWidth: 120, fontWeight: 600 }}>{item.department}</span>
                                <Progress
                                  style={{ flex: 1, margin: 0 }}
                                  percent={Math.round((per / max) * 100)}
                                  showInfo={false}
                                  strokeColor={COLORS[idx % COLORS.length]}
                                  size="small"
                                />
                                <span style={{ minWidth: 110, textAlign: 'right', fontWeight: 700, color: COLORS[idx % COLORS.length] }}>
                                  ¥{per.toLocaleString()}/人
                                </span>
                              </Space>
                            </List.Item>
                          );
                        }}
                      />
                    </Card>
                  </Col>
                </Row>

                <Divider style={{ margin: '20px 0' }} />

                <Card title="薪资等级分布（应发工资）" size="small">
                  {(() => {
                    const buckets = [
                      { label: '< 8000', min: 0, max: 8000, count: 0 },
                      { label: '8000 ~ 12000', min: 8000, max: 12000, count: 0 },
                      { label: '12000 ~ 18000', min: 12000, max: 18000, count: 0 },
                      { label: '18000 ~ 25000', min: 18000, max: 25000, count: 0 },
                      { label: '25000 ~ 35000', min: 25000, max: 35000, count: 0 },
                      { label: '> 35000', min: 35000, max: Infinity, count: 0 },
                    ];
                    monthPayrolls.forEach((p: Payroll) => {
                      for (const b of buckets) {
                        if (p.totalIncome >= b.min && p.totalIncome < b.max) { b.count++; break; }
                      }
                    });
                    const max = Math.max(1, ...buckets.map((b) => b.count));
                    return (
                      <Row gutter={12}>
                        {buckets.map((b, idx) => (
                          <Col span={4} key={b.label}>
                            <Card size="small" style={{ textAlign: 'center', background: '#fafafa' }}>
                              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 4 }}>{b.label}</div>
                              <div style={{ fontSize: 24, fontWeight: 700, color: COLORS[idx % COLORS.length] }}>{b.count}</div>
                              <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.45)' }}>人</div>
                              <Progress percent={Math.round((b.count / max) * 100)} showInfo={false} strokeColor={COLORS[idx % COLORS.length]} style={{ marginTop: 8 }} />
                            </Card>
                          </Col>
                        ))}
                      </Row>
                    );
                  })()}
                </Card>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};

export default SummaryExport;
