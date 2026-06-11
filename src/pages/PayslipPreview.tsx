import { useMemo, useState } from 'react';
import {
  Table, Button, Input, Select, Space, Tag, Card, Row, Col, Statistic,
  message, Modal, Divider, Radio, Empty, DatePicker, Steps, Tooltip,
  Avatar, Badge, List, Descriptions,
} from 'antd';
import {
  FileTextOutlined, SearchOutlined, MailOutlined, EyeOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined, UnorderedListOutlined,
  PrinterOutlined, SendOutlined, SyncOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAppStore } from '../store/useAppStore';
import { genId } from '../utils/calculations';
import type { Payroll, Payslip, Employee } from '../types';

const PayslipPreview = () => {
  const store = useAppStore();
  const { updatePayslip, batchAddPayslips, updatePayroll, confirmPayroll, setCurrentMonth } = store;
  const employees: Employee[] = (store as any).employees || [];
  const payrolls: Payroll[] = (store as any).payrolls || [];
  const payslips: Payslip[] = (store as any).payslips || [];
  const currentMonth: string = (store as any).currentMonth || dayjs().subtract(1, 'month').format('YYYY-MM');

  const [dept, setDept] = useState('全部');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('all');
  const [previewModal, setPreviewModal] = useState(false);
  const [currentP, setCurrentP] = useState<{ payroll: Payroll; payslip?: Payslip; emp: Employee } | null>(null);

  const empMap = useMemo(() => new Map(employees.map((e: Employee) => [e.id, e])), [employees]);
  const departments = useMemo(() => Array.from(new Set(employees.map((e: Employee) => e.department))), [employees]);

  const monthPayrolls = useMemo(() => payrolls.filter((p: Payroll) => p.month === currentMonth), [payrolls, currentMonth]);
  const monthPayslips = useMemo(() => payslips.filter((p: Payslip) => p.month === currentMonth), [payslips, currentMonth]);
  const payslipMap = useMemo(() => new Map(monthPayslips.map((p: Payslip) => [p.employeeId, p])), [monthPayslips]);

  const combinedData = useMemo(() => {
    const list: Array<{ payroll: Payroll; payslip?: Payslip; emp: Employee }> = [];
    monthPayrolls.forEach((p: Payroll) => {
      const emp = empMap.get(p.employeeId);
      if (emp) list.push({ payroll: p, payslip: payslipMap.get(p.employeeId), emp });
    });
    return list;
  }, [monthPayrolls, payslipMap, empMap]);

  const stats = useMemo(() => {
    const total = combinedData.length;
    const sent = combinedData.filter((x) => x.payslip && x.payslip.status !== '未发送').length;
    const viewed = combinedData.filter((x) => x.payslip && (x.payslip.status === '已查看' || x.payslip.status === '已确认' || x.payslip.status === '有异议')).length;
    const confirmed = combinedData.filter((x) => x.payslip && x.payslip.status === '已确认').length;
    const objected = combinedData.filter((x) => x.payslip && x.payslip.status === '有异议').length;
    return { total, sent, viewed, confirmed, objected };
  }, [combinedData]);

  const filtered = useMemo(() => {
    let list = combinedData;
    if (status !== 'all') {
      list = list.filter((x) => (x.payslip?.status || '未发送') === status);
    }
    if (dept !== '全部') list = list.filter((x) => x.emp.department === dept);
    if (keyword) {
      const kw = keyword.toLowerCase();
      list = list.filter((x) => x.emp.name.toLowerCase().includes(kw) || x.emp.employeeNo.toLowerCase().includes(kw));
    }
    return list;
  }, [combinedData, status, dept, keyword]);

  const generatePayslips = () => {
    const now = new Date().toISOString();
    const existingEmpIds = new Set(monthPayslips.map((p: Payslip) => p.employeeId));
    const newPayslips: Payslip[] = [];
    monthPayrolls.forEach((p: Payroll) => {
      if (existingEmpIds.has(p.employeeId)) return;
      newPayslips.push({
        id: genId('ps'),
        payrollId: p.id,
        employeeId: p.employeeId,
        month: currentMonth,
        status: '未发送',
      });
      void now;
    });
    if (newPayslips.length) batchAddPayslips(newPayslips);
    message.success(`已生成 ${newPayslips.length} 份工资单`);
  };

  const sendAll = () => {
    let count = 0;
    combinedData.forEach((x) => {
      if (x.payslip && x.payslip.status === '未发送') {
        updatePayslip(x.payslip.id, { status: '已发送', sendTime: new Date().toISOString() });
        count++;
      } else if (!x.payslip) {
        const newPs: Payslip = {
          id: genId('ps'),
          payrollId: x.payroll.id,
          employeeId: x.emp.id,
          month: currentMonth,
          status: '已发送',
          sendTime: new Date().toISOString(),
        };
        batchAddPayslips([newPs]);
        count++;
      }
    });
    message.success(`已发送 ${count} 份工资单`);
  };

  const sendOne = (ps?: Payslip) => {
    if (ps) {
      updatePayslip(ps.id, { status: '已发送', sendTime: new Date().toISOString() });
    } else if (currentP) {
      const newPs: Payslip = {
        id: genId('ps'),
        payrollId: currentP.payroll.id,
        employeeId: currentP.emp.id,
        month: currentMonth,
        status: '已发送',
        sendTime: new Date().toISOString(),
      };
      batchAddPayslips([newPs]);
    }
    message.success('工资单已发送');
  };

  const markViewed = (ps: Payslip) => {
    updatePayslip(ps.id, { status: '已查看', viewTime: new Date().toISOString() });
  };

  const markConfirmed = (ps: Payslip, payrollId: string) => {
    updatePayslip(ps.id, { status: '已确认', confirmTime: new Date().toISOString() });
    confirmPayroll(payrollId);
    message.success('工资单已确认');
  };

  const openPreview = (item: { payroll: Payroll; payslip?: Payslip; emp: Employee }) => {
    setCurrentP(item);
    if (item.payslip && item.payslip.status === '已发送') {
      markViewed(item.payslip);
    }
    setPreviewModal(true);
  };

  const statusTag = (st: string) => {
    const map: Record<string, { color: string; icon?: any }> = {
      '未发送': { color: 'default' },
      '已发送': { color: 'blue' },
      '已查看': { color: 'cyan', icon: <EyeOutlined /> },
      '已确认': { color: 'success', icon: <CheckCircleOutlined /> },
      '有异议': { color: 'error', icon: <ExclamationCircleOutlined /> },
    };
    const cfg = map[st] || { color: 'default' };
    return <Tag color={cfg.color} icon={cfg.icon}>{st}</Tag>;
  };

  const columns = [
    { title: '工号', width: 100, render: (_: any, r: any) => r.emp.employeeNo },
    { title: '姓名', width: 100, render: (_: any, r: any) => (
      <Space>
        <Avatar size={24} style={{ background: r.emp.gender === '男' ? '#91caff' : '#ffadd2' }}>{r.emp.name[0]}</Avatar>
        {r.emp.name}
      </Space>
    ) },
    { title: '部门', width: 120, render: (_: any, r: any) => <Tag color="blue">{r.emp.department}</Tag> },
    { title: '职位', dataIndex: ['emp', 'position'], width: 120 },
    { title: '应发工资', width: 110, render: (_: any, r: any) => <span style={{ fontWeight: 600 }}>¥{r.payroll.totalIncome.toLocaleString()}</span> },
    { title: '扣款合计', width: 110, render: (_: any, r: any) => <span style={{ color: '#ff4d4f' }}>-¥{r.payroll.totalDeduction.toLocaleString()}</span> },
    { title: '实发工资', width: 110, render: (_: any, r: any) => <span style={{ color: '#1677ff', fontWeight: 700, fontSize: 15 }}>¥{r.payroll.netSalary.toLocaleString()}</span> },
    { title: '状态', width: 100, render: (_: any, r: any) => statusTag(r.payslip?.status || '未发送') },
    { title: '发送时间', width: 160, render: (_: any, r: any) => r.payslip?.sendTime ? dayjs(r.payslip.sendTime).format('YYYY-MM-DD HH:mm') : '-' },
    { title: '确认时间', width: 160, render: (_: any, r: any) => r.payslip?.confirmTime ? dayjs(r.payslip.confirmTime).format('YYYY-MM-DD HH:mm') : '-' },
    { title: '操作', width: 200, fixed: 'right' as const,
      render: (_: any, r: any) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openPreview(r)}>预览</Button>
          {(r.payslip?.status === '未发送' || !r.payslip) && (
            <Button size="small" type="primary" icon={<SendOutlined />} onClick={() => sendOne(r.payslip)}>发送</Button>
          )}
          {r.payslip?.status === '已查看' && (
            <Button type="link" size="small" onClick={() => markConfirmed(r.payslip, r.payroll.id)}>标记确认</Button>
          )}
        </Space>
      ) },
  ];

  const renderPreview = () => {
    if (!currentP) return null;
    const { payroll, payslip, emp } = currentP;
    const incomes = payroll.items.filter((i) => i.type === 'income');
    const deductions = payroll.items.filter((i) => i.type === 'deduction');
    return (
      <div className="payroll-preview" id="print-area">
        <h2>员工工资单</h2>
        <div className="sub">{payroll.month.replace('-', '年')}月 · 请于签收后仔细核对，如有异议请于3个工作日内反馈</div>

        <Descriptions column={2} size="small" style={{ marginBottom: 24 }}>
          <Descriptions.Item label="工号">{emp.employeeNo}</Descriptions.Item>
          <Descriptions.Item label="姓名">{emp.name}</Descriptions.Item>
          <Descriptions.Item label="部门">{emp.department}</Descriptions.Item>
          <Descriptions.Item label="职位">{emp.position}</Descriptions.Item>
          <Descriptions.Item label="入职日期">{emp.hireDate}</Descriptions.Item>
          <Descriptions.Item label="身份证号">{emp.idCard.slice(0, 6)}********{emp.idCard.slice(-4)}</Descriptions.Item>
        </Descriptions>

        <Divider style={{ margin: '12px 0' }} />

        <div className="payroll-section">
          <h3>收入明细</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: '#fafafa' }}>
              <tr>
                <th style={{ padding: '8px 12px', textAlign: 'left', border: '1px solid #f0f0f0', width: '60%' }}>项目</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', border: '1px solid #f0f0f0' }}>金额(元)</th>
              </tr>
            </thead>
            <tbody>
              {incomes.map((it, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '8px 12px', border: '1px solid #f0f0f0' }}>{it.name}</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #f0f0f0', textAlign: 'right' }}>
                    <span style={{ color: '#52c41a' }}>+{it.amount.toLocaleString()}</span>
                  </td>
                </tr>
              ))}
              <tr style={{ background: '#fafafa', fontWeight: 600 }}>
                <td style={{ padding: '10px 12px', border: '1px solid #f0f0f0' }}>应发工资合计</td>
                <td style={{ padding: '10px 12px', border: '1px solid #f0f0f0', textAlign: 'right' }}>¥{payroll.totalIncome.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="payroll-section">
          <h3>扣款明细</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: '#fafafa' }}>
              <tr>
                <th style={{ padding: '8px 12px', textAlign: 'left', border: '1px solid #f0f0f0', width: '60%' }}>项目</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', border: '1px solid #f0f0f0' }}>金额(元)</th>
              </tr>
            </thead>
            <tbody>
              {deductions.map((it, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '8px 12px', border: '1px solid #f0f0f0' }}>{it.name}</td>
                  <td style={{ padding: '8px 12px', border: '1px solid #f0f0f0', textAlign: 'right' }}>
                    {it.amount > 0 ? <span style={{ color: '#ff4d4f' }}>-{it.amount.toLocaleString()}</span> : '0'}
                  </td>
                </tr>
              ))}
              <tr style={{ background: '#fafafa', fontWeight: 600 }}>
                <td style={{ padding: '10px 12px', border: '1px solid #f0f0f0' }}>扣款合计</td>
                <td style={{ padding: '10px 12px', border: '1px solid #f0f0f0', textAlign: 'right', color: '#ff4d4f' }}>¥{payroll.totalDeduction.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="payroll-net-row">
          <span>本月实发工资（大写）：</span>
          <span>¥{payroll.netSalary.toLocaleString()}</span>
        </div>

        <div style={{ marginTop: 24, padding: 16, background: '#fafafa', borderRadius: 6, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: 'rgba(0,0,0,0.45)' }}>工资单状态: {statusTag(payslip?.status || '未发送')}</span>
            <span style={{ color: 'rgba(0,0,0,0.45)' }}>打印时间: {dayjs().format('YYYY-MM-DD HH:mm')}</span>
          </div>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ marginBottom: 4 }}>员工签收：</div>
              <div style={{ width: 200, borderBottom: '1px solid #000', marginTop: 32, fontSize: 11, textAlign: 'center', color: 'rgba(0,0,0,0.45)' }}>签名 / 日期</div>
            </div>
            <div>
              <div style={{ marginBottom: 4 }}>公司盖章：</div>
              <div style={{ width: 200, borderBottom: '1px solid #000', marginTop: 32, fontSize: 11, textAlign: 'center', color: 'rgba(0,0,0,0.45)' }}>财务专用章</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card bordered>
            <Statistic title={<span><UnorderedListOutlined style={{ color: '#1677ff' }} /> 工资单总数</span>} value={stats.total} suffix="份" />
          </Card>
        </Col>
        <Col span={4}>
          <Card bordered>
            <Statistic title={<span><MailOutlined style={{ color: '#1677ff' }} /> 已发送</span>} value={stats.sent} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card bordered>
            <Statistic title={<span><EyeOutlined style={{ color: '#13c2c2' }} /> 已查看</span>} value={stats.viewed} valueStyle={{ color: '#13c2c2' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card bordered>
            <Statistic title={<span><CheckCircleOutlined style={{ color: '#52c41a' }} /> 已确认</span>} value={stats.confirmed} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card bordered>
            <Statistic title={<span><ExclamationCircleOutlined style={{ color: '#ff4d4f' }} /> 有异议</span>} value={stats.objected} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card bordered>
            <Statistic title={<span><Badge status="default" /> 未发送</span>} value={stats.total - stats.sent} />
          </Card>
        </Col>
      </Row>

      <div className="page-card">
        <div className="toolbar">
          <div className="toolbar-left">
            <Space>
              <span style={{ fontSize: 16, fontWeight: 600 }}>工资月份：</span>
              <DatePicker picker="month" value={dayjs(currentMonth)} onChange={(v) => v && setCurrentMonth(v.format('YYYY-MM'))} />
            </Space>
            <Input prefix={<SearchOutlined />} placeholder="搜索姓名/工号" style={{ width: 200 }} value={keyword} onChange={(e) => setKeyword(e.target.value)} allowClear />
            <Select style={{ width: 150 }} value={dept} onChange={setDept} options={[{ label: '全部部门', value: '全部' }, ...departments.map((d) => ({ label: d, value: d }))]} />
            <Select style={{ width: 140 }} value={status} onChange={setStatus}
              options={['all', '未发送', '已发送', '已查看', '已确认', '有异议'].map((v) => ({ label: v === 'all' ? '全部状态' : v, value: v }))} />
          </div>
          <div className="toolbar-right">
            <Tooltip title="自动为已核算薪资的员工创建工资单">
              <Button icon={<SyncOutlined />} onClick={generatePayslips}>生成工资单</Button>
            </Tooltip>
            <Button icon={<SendOutlined />} type="primary" onClick={sendAll} disabled={stats.sent === stats.total && stats.total > 0}>
              全部发送 ({stats.total - stats.sent})
            </Button>
            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>打印</Button>
          </div>
        </div>

        <Steps
          size="small"
          style={{ marginBottom: 20 }}
          current={
            (stats.total > 0 ? 1 : 0) +
            (stats.sent === stats.total && stats.total > 0 ? 1 : 0) +
            (stats.viewed === stats.total && stats.total > 0 ? 1 : 0) +
            (stats.confirmed === stats.total && stats.total > 0 ? 1 : 0)
          }
          items={[
            { title: '薪资核算', description: stats.total > 0 ? '已完成' : '待处理', status: stats.total > 0 ? 'finish' : 'process' },
            { title: '生成工资单', description: stats.total > 0 ? `${stats.total}份` : '待生成', status: stats.total > 0 ? 'finish' : 'wait' },
            { title: '发送员工', description: `${stats.sent}/${stats.total}`, status: stats.sent === stats.total && stats.total > 0 ? 'finish' : stats.sent > 0 ? 'process' : 'wait' },
            { title: '员工查看', description: `${stats.viewed}/${stats.total}`, status: stats.viewed === stats.total && stats.total > 0 ? 'finish' : stats.viewed > 0 ? 'process' : 'wait' },
            { title: '员工确认', description: `${stats.confirmed}/${stats.total}`, status: stats.confirmed === stats.total && stats.total > 0 ? 'finish' : stats.confirmed > 0 ? 'process' : 'wait' },
          ]}
        />

        {filtered.length ? (
          <Table
            rowKey={(r) => r.payroll.id}
            columns={columns}
            dataSource={filtered}
            scroll={{ x: 1500 }}
            pagination={{ pageSize: 12, showSizeChanger: true, showTotal: (t) => `共 ${t} 份` }}
          />
        ) : (
          <Empty description="暂无工资单数据，请先在薪资核算模块完成计算，再点击「生成工资单」" />
        )}
      </div>

      <Modal
        title="工资单预览"
        open={previewModal}
        onCancel={() => setPreviewModal(false)}
        width={820}
        footer={currentP && (
          <Space>
            {(currentP.payslip?.status === '未发送' || !currentP.payslip) && (
              <Button type="primary" icon={<SendOutlined />} onClick={() => sendOne(currentP.payslip)}>发送给员工</Button>
            )}
            {currentP.payslip?.status === '已查看' && (
              <Button type="primary" onClick={() => { markConfirmed(currentP.payslip!, currentP.payroll.id); setPreviewModal(false); }}>确认无误</Button>
            )}
            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>打印工资单</Button>
            <Button onClick={() => setPreviewModal(false)}>关闭</Button>
          </Space>
        )}
      >
        {renderPreview()}
      </Modal>
    </div>
  );
};

export default PayslipPreview;
