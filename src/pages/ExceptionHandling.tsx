import { useMemo, useState } from 'react';
import {
  Table, Button, Input, Select, Tabs, Space, Tag, Card, Row, Col, Statistic,
  message, Modal, Form, DatePicker, TimePicker, Popconfirm, Drawer, Descriptions,
  List, Badge, Divider, Radio,
} from 'antd';
import {
  WarningOutlined, CheckCircleOutlined, SearchOutlined, PlusOutlined,
  ClockCircleOutlined, ThunderboltOutlined, LogoutOutlined, EditOutlined,
  EyeOutlined, CloseCircleOutlined, CheckOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAppStore } from '../store/useAppStore';
import { genId } from '../utils/calculations';
import type { AttendanceException, MakeupRecord } from '../types';

const EXC_TYPE_LABEL: Record<string, { label: string; color: string; icon: any }> = {
  late: { label: '迟到', color: 'orange', icon: <ClockCircleOutlined /> },
  early: { label: '早退', color: 'orange', icon: <LogoutOutlined /> },
  absent: { label: '旷工', color: 'red', icon: <CloseCircleOutlined /> },
  missing_punch: { label: '缺卡', color: 'warning', icon: <ThunderboltOutlined /> },
  overtime: { label: '加班', color: 'blue', icon: <ClockCircleOutlined /> },
};

const ExceptionHandling = () => {
  const store = useAppStore();
  const { updateException, addMakeup, updateMakeup, approveMakeup, isMonthLocked } = store;
  const employees: any[] = (store as any).employees || [];
  const exceptions: any[] = (store as any).exceptions || [];
  const makeupRecords: any[] = (store as any).makeupRecords || [];
  const currentMonth: string = (store as any).currentMonth || dayjs().subtract(1, 'month').format('YYYY-MM');
  const locked = isMonthLocked(currentMonth);
  const [dept, setDept] = useState('全部');
  const [keyword, setKeyword] = useState('');
  const [type, setType] = useState('all');
  const [handled, setHandled] = useState<'all' | 'yes' | 'no'>('no');
  const [detailDrawer, setDetailDrawer] = useState(false);
  const [currentExc, setCurrentExc] = useState<AttendanceException | null>(null);
  const [makeupModal, setMakeupModal] = useState(false);
  const [editingMakeup, setEditingMakeup] = useState<MakeupRecord | null>(null);
  const [mkForm] = Form.useForm();
  const [excHandleModal, setExcHandleModal] = useState(false);
  const [handleForm] = Form.useForm();

  const empMap = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const departments = useMemo(() => Array.from(new Set(employees.map((e) => e.department))), [employees]);

  const stats = useMemo(() => {
    const list = exceptions.filter((e) => e.date.startsWith(currentMonth));
    return {
      total: list.length,
      unhandled: list.filter((e) => !e.handled).length,
      lateCount: list.filter((e) => e.type === 'late').length,
      absentCount: list.filter((e) => e.type === 'absent').length,
      missingCount: list.filter((e) => e.type === 'missing_punch').length,
    };
  }, [exceptions, currentMonth]);

  const filteredExceptions = useMemo(() => {
    let list = exceptions.filter((e) => e.date.startsWith(currentMonth));
    if (type !== 'all') list = list.filter((e) => e.type === type);
    if (handled === 'yes') list = list.filter((e) => e.handled);
    if (handled === 'no') list = list.filter((e) => !e.handled);
    if (dept !== '全部' || keyword) {
      list = list.filter((e) => {
        const emp = empMap.get(e.employeeId);
        if (!emp) return false;
        if (dept !== '全部' && emp.department !== dept) return false;
        if (keyword) {
          const kw = keyword.toLowerCase();
          if (!emp.name.toLowerCase().includes(kw) && !emp.employeeNo.toLowerCase().includes(kw)) return false;
        }
        return true;
      });
    }
    return [...list].sort((a, b) => a.date < b.date ? 1 : -1);
  }, [exceptions, currentMonth, type, handled, dept, keyword, empMap]);

  const makeupsForEmp = useMemo(() => {
    const m = new Map<string, MakeupRecord[]>();
    makeupRecords.forEach((mk) => {
      if (!m.has(mk.employeeId)) m.set(mk.employeeId, []);
      m.get(mk.employeeId)!.push(mk);
    });
    return m;
  }, [makeupRecords]);

  const viewDetail = (e: AttendanceException) => {
    setCurrentExc(e);
    setDetailDrawer(true);
  };

  const openHandle = (e: AttendanceException) => {
    setCurrentExc(e);
    handleForm.resetFields();
    handleForm.setFieldsValue({
      handleType: e.type === 'missing_punch' ? 'makeup' : e.type === 'late' && e.minutes <= 10 ? 'ignore' : 'deduct',
      remark: e.remark,
    });
    setExcHandleModal(true);
  };

  const confirmHandle = async () => {
    try {
      const v = await handleForm.validateFields();
      if (!currentExc) return;
      updateException(currentExc.id, { handled: true, handleType: v.handleType, remark: v.remark });
      message.success('异常已处理');
      setExcHandleModal(false);
    } catch (err) {
      //
    }
  };

  const openMakeupAdd = () => {
    setEditingMakeup(null);
    mkForm.resetFields();
    mkForm.setFieldsValue({
      date: dayjs(),
      approved: false,
      createTime: new Date().toISOString(),
    });
    setMakeupModal(true);
  };

  const openMakeupEdit = (mk: MakeupRecord) => {
    setEditingMakeup(mk);
    mkForm.setFieldsValue({
      ...mk,
      date: dayjs(mk.date),
      correctedTime: dayjs(mk.correctedTime, 'HH:mm'),
      originalTime: mk.originalTime ? dayjs(mk.originalTime, 'HH:mm') : null,
    });
    setMakeupModal(true);
  };

  const submitMakeup = async () => {
    try {
      const v = await mkForm.validateFields();
      const data = {
        ...v,
        date: v.date.format('YYYY-MM-DD'),
        correctedTime: v.correctedTime.format('HH:mm'),
        originalTime: v.originalTime ? v.originalTime.format('HH:mm') : undefined,
      };
      if (editingMakeup) {
        updateMakeup(editingMakeup.id, data);
        message.success('补卡记录已更新');
      } else {
        addMakeup({ ...data, id: genId('mk') });
        message.success('补卡申请已提交');
      }
      setMakeupModal(false);
    } catch (e) {
      //
    }
  };

  const excColumns = [
    { title: '日期', dataIndex: 'date', width: 120, fixed: 'left' as const },
    { title: '员工', width: 110, fixed: 'left' as const,
      render: (_: any, r: AttendanceException) => {
        const e = empMap.get(r.employeeId);
        return e ? (
          <Space>
            <span style={{
              width: 24, height: 24, borderRadius: '50%',
              background: e.gender === '男' ? '#bae0ff' : '#ffd6e7',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
            }}>{e.name[0]}</span>
            {e.name}
          </Space>
        ) : '-';
      } },
    { title: '部门', width: 120,
      render: (_: any, r: AttendanceException) => {
        const e = empMap.get(r.employeeId);
        return e ? <Tag color="blue">{e.department}</Tag> : '-';
      } },
    { title: '异常类型', dataIndex: 'type', width: 100,
      render: (v: string) => {
        const t = EXC_TYPE_LABEL[v];
        return t ? <Tag color={t.color} icon={t.icon}>{t.label}</Tag> : v;
      } },
    { title: '时长', dataIndex: 'minutes', width: 100,
      render: (v: number, r: AttendanceException) => r.type === 'missing_punch' ? '-' : `${v} 分钟` },
    { title: '处理状态', width: 100,
      render: (_: any, r: AttendanceException) => r.handled ? <Tag color="success" icon={<CheckOutlined />}>已处理</Tag> : <Badge status="processing" text="待处理" /> },
    { title: '处理方式', dataIndex: 'handleType', width: 100,
      render: (v?: string) => {
        if (!v) return '-';
        const map: Record<string, string> = { makeup: '补卡', deduct: '扣薪', ignore: '忽略' };
        return map[v] || v;
      } },
    { title: '备注', dataIndex: 'remark', render: (v: string) => v || '-' },
    { title: '操作', width: 180, fixed: 'right' as const,
      render: (_: any, r: AttendanceException) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => viewDetail(r)}>详情</Button>
          {!r.handled && (
            <Button size="small" type="primary" disabled={locked} onClick={() => { if (locked) return message.warning('本月已结账'); openHandle(r); }}>处理</Button>
          )}
        </Space>
      ) },
  ];

  const mkColumns = [
    { title: '申请日期', dataIndex: 'createTime', width: 160, render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm') },
    { title: '员工', width: 100, render: (_: any, r: MakeupRecord) => empMap.get(r.employeeId)?.name },
    { title: '补卡日期', dataIndex: 'date', width: 120 },
    { title: '打卡类型', dataIndex: 'punchType', width: 100, render: (v: string) => v === 'in' ? <Tag>上班</Tag> : <Tag>下班</Tag> },
    { title: '原始时间', dataIndex: 'originalTime', render: (v: string) => v || '-' },
    { title: '修正时间', dataIndex: 'correctedTime' },
    { title: '原因', dataIndex: 'reason' },
    { title: '审批状态', width: 100,
      render: (_: any, r: MakeupRecord) => r.approved ? <Tag color="success" icon={<CheckOutlined />}>已通过</Tag> : <Badge status="warning" text="待审批" /> },
    { title: '审批人', dataIndex: 'approver', render: (v: string) => v || '-' },
    { title: '操作', width: 180,
      render: (_: any, r: MakeupRecord) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EditOutlined />} disabled={locked} onClick={() => { if (locked) return message.warning('本月已结账'); openMakeupEdit(r); }}>编辑</Button>
          {!r.approved && (
            <Button size="small" type="primary" disabled={locked} onClick={() => { if (locked) return message.warning('本月已结账'); approveMakeup(r.id); message.success('已通过'); }}>通过</Button>
          )}
        </Space>
      ) },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={5}>
          <Card bordered>
            <Statistic title={<span><WarningOutlined style={{ color: '#fa8c16' }} /> 本月异常总数</span>} value={stats.total} />
          </Card>
        </Col>
        <Col span={5}>
          <Card bordered>
            <Statistic title={<span><Badge status="processing" /> 待处理</span>} value={stats.unhandled} valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card bordered>
            <Statistic title={<span>迟到</span>} value={stats.lateCount} />
          </Card>
        </Col>
        <Col span={5}>
          <Card bordered>
            <Statistic title={<span style={{ color: '#ff4d4f' }}>缺卡</span>} value={stats.missingCount} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col span={5}>
          <Card bordered>
            <Statistic title={<span style={{ color: '#cf1322' }}>旷工</span>} value={stats.absentCount} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="exc"
        items={[
          {
            key: 'exc',
            label: <Space><WarningOutlined /> 考勤异常</Space>,
            children: (
              <div className="page-card">
                <div className="toolbar">
                  <div className="toolbar-left">
                    <Input prefix={<SearchOutlined />} placeholder="搜索姓名/工号" style={{ width: 200 }} value={keyword} onChange={(e) => setKeyword(e.target.value)} allowClear />
                    <Select style={{ width: 150 }} value={dept} onChange={setDept} options={[{ label: '全部部门', value: '全部' }, ...departments.map((d) => ({ label: d, value: d }))]} />
                    <Select style={{ width: 140 }} value={type} onChange={setType}
                      options={[
                        { label: '全部类型', value: 'all' },
                        { label: '迟到', value: 'late' },
                        { label: '早退', value: 'early' },
                        { label: '旷工', value: 'absent' },
                        { label: '缺卡', value: 'missing_punch' },
                        { label: '加班', value: 'overtime' },
                      ]}
                    />
                    <Select style={{ width: 120 }} value={handled} onChange={setHandled}
                      options={[{ label: '全部', value: 'all' }, { label: '待处理', value: 'no' }, { label: '已处理', value: 'yes' }]}
                    />
                  </div>
                </div>
                <Table
                  rowKey="id"
                  columns={excColumns}
                  dataSource={filteredExceptions}
                  scroll={{ x: 1400 }}
                  pagination={{ pageSize: 12, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
                />
              </div>
            ),
          },
          {
            key: 'makeup',
            label: <Space><EditOutlined /> 补卡登记</Space>,
            children: (
              <div className="page-card">
                <div className="toolbar">
                  <div className="toolbar-left" />
                  <div className="toolbar-right">
                    <Button type="primary" icon={<PlusOutlined />} onClick={openMakeupAdd}>新增补卡申请</Button>
                  </div>
                </div>
                <Table
                  rowKey="id"
                  columns={mkColumns}
                  dataSource={[...makeupRecords].sort((a, b) => a.createTime < b.createTime ? 1 : -1)}
                  scroll={{ x: 1400 }}
                  pagination={{ pageSize: 12, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
                />
              </div>
            ),
          },
        ]}
      />

      <Drawer title="异常详情" placement="right" width={480} open={detailDrawer} onClose={() => setDetailDrawer(false)}>
        {currentExc && (
          <div>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="日期">{currentExc.date}</Descriptions.Item>
              <Descriptions.Item label="员工">
                {empMap.get(currentExc.employeeId)?.name} ({empMap.get(currentExc.employeeId)?.employeeNo})
              </Descriptions.Item>
              <Descriptions.Item label="部门">{empMap.get(currentExc.employeeId)?.department}</Descriptions.Item>
              <Descriptions.Item label="职位">{empMap.get(currentExc.employeeId)?.position}</Descriptions.Item>
              <Descriptions.Item label="异常类型">
                {(() => { const t = EXC_TYPE_LABEL[currentExc.type]; return t ? `${t.label}` : currentExc.type; })()}
              </Descriptions.Item>
              <Descriptions.Item label="异常时长">
                {currentExc.type === 'missing_punch' ? '无打卡记录' : `${currentExc.minutes} 分钟`}
              </Descriptions.Item>
              <Descriptions.Item label="处理状态">{currentExc.handled ? '已处理' : '待处理'}</Descriptions.Item>
              {currentExc.handleType && (
                <Descriptions.Item label="处理方式">
                  {(() => {
                    const m: Record<string, string> = { makeup: '已补卡', deduct: '扣薪处理', ignore: '忽略不计' };
                    return m[currentExc.handleType as string] || currentExc.handleType;
                  })()}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="备注">{currentExc.remark || '-'}</Descriptions.Item>
            </Descriptions>
            <Divider />
            <h4 style={{ marginBottom: 12 }}>相关补卡记录</h4>
            <List
              size="small"
              dataSource={makeupsForEmp.get(currentExc.employeeId)?.filter((m) => m.date === currentExc.date) || []}
              locale={{ emptyText: '暂无补卡记录' }}
              renderItem={(m) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <Tag>{m.punchType === 'in' ? '上班' : '下班'}卡</Tag>
                        修正为 {m.correctedTime}
                        {m.approved ? <Tag color="success">已通过</Tag> : <Tag color="warning">待审批</Tag>}
                      </Space>
                    }
                    description={`原因: ${m.reason}`}
                  />
                </List.Item>
              )}
            />
            {!currentExc.handled && (
              <Button type="primary" block style={{ marginTop: 20 }} onClick={() => openHandle(currentExc)}>立即处理</Button>
            )}
          </div>
        )}
      </Drawer>

      <Modal title="处理考勤异常" open={excHandleModal} onOk={confirmHandle} onCancel={() => setExcHandleModal(false)} okText="确认处理" cancelText="取消">
        {currentExc && (
          <div>
            <div style={{ background: '#fff7e6', padding: 12, borderRadius: 6, marginBottom: 16, border: '1px solid #ffd591' }}>
              <div style={{ fontWeight: 600, color: '#d46b08' }}>
                {empMap.get(currentExc.employeeId)?.name} - {currentExc.date}
              </div>
              <div style={{ marginTop: 4, fontSize: 13 }}>
                异常: {EXC_TYPE_LABEL[currentExc.type]?.label} {currentExc.minutes ? `(${currentExc.minutes}分钟)` : ''}
              </div>
            </div>
            <Form form={handleForm} layout="vertical">
              <Form.Item name="handleType" label="处理方式" rules={[{ required: true }]}>
                <Radio.Group>
                  <Radio value="makeup">补卡登记 (不计入扣款)</Radio>
                  <Radio value="deduct">扣薪处理 (按规则扣款)</Radio>
                  <Radio value="ignore">忽略不计 (特殊情况)</Radio>
                </Radio.Group>
              </Form.Item>
              <Form.Item name="remark" label="备注">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      <Modal title={editingMakeup ? '编辑补卡记录' : '新增补卡申请'} open={makeupModal} onOk={submitMakeup} onCancel={() => setMakeupModal(false)} okText="保存" cancelText="取消" destroyOnClose>
        <Form form={mkForm} layout="vertical" preserve={false}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="employeeId" label="员工" rules={[{ required: true }]}>
                <Select
                  options={employees.filter((e) => e.status !== '离职').map((e) => ({ label: `${e.name} - ${e.department}`, value: e.id }))}
                  showSearch optionFilterProp="label"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="date" label="补卡日期" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="punchType" label="打卡类型" rules={[{ required: true }]}>
                <Select options={[{ label: '上班打卡', value: 'in' }, { label: '下班打卡', value: 'out' }]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="approved" label="审批状态" rules={[{ required: true }]}>
                <Select options={[{ label: '待审批', value: false }, { label: '已通过', value: true }]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="originalTime" label="原始打卡时间">
                <TimePicker style={{ width: '100%' }} format="HH:mm" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="correctedTime" label="修正时间" rules={[{ required: true }]}>
                <TimePicker style={{ width: '100%' }} format="HH:mm" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="reason" label="补卡原因" rules={[{ required: true, message: '请填写补卡原因' }]}>
                <Input.TextArea rows={3} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="approver" label="审批人">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default ExceptionHandling;
