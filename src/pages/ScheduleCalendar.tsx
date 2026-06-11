import { useMemo, useState } from 'react';
import {
  Card, Row, Col, Button, Select, Modal, Form, Input, TimePicker,
  Space, Tag, Tabs, List, Popconfirm, message, Tooltip, Divider, DatePicker,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, LeftOutlined,
  RightOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAppStore } from '../store/useAppStore';
import { genId, getDateList, isWeekend } from '../utils/calculations';
import type { Shift, Schedule } from '../types';

const SHIFT_COLORS: Record<string, string> = {
  blue: '#1677ff',
  green: '#52c41a',
  purple: '#722ed1',
  orange: '#fa8c16',
  red: '#ff4d4f',
  cyan: '#13c2c2',
};

const ScheduleCalendar = () => {
  const store = useAppStore();
  const { addShift, updateShift, deleteShift, addSchedule, updateSchedule, deleteSchedule, batchAddSchedules, setCurrentMonth, isMonthLocked } = store;
  const employees: any[] = (store as any).employees || [];
  const shifts: any[] = (store as any).shifts || [];
  const schedules: any[] = (store as any).schedules || [];
  const currentMonth: string = (store as any).currentMonth || dayjs().format('YYYY-MM');
  const locked = isMonthLocked(currentMonth);
  const [shiftModal, setShiftModal] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [shiftForm] = Form.useForm();
  const [dept, setDept] = useState('全部');
  const [scheduleModal, setScheduleModal] = useState(false);
  const [schForm] = Form.useForm();
  const [editingSch, setEditingSch] = useState<Schedule | null>(null);

  const activeEmps = useMemo(() => {
    const list = employees.filter((e) => e.status === '在职' || e.status === '试用期');
    return dept === '全部' ? list : list.filter((e) => e.department === dept);
  }, [employees, dept]);

  const dates = useMemo(() => getDateList(currentMonth), [currentMonth]);
  const shiftMap = useMemo(() => new Map(shifts.map((s) => [s.id, s])), [shifts]);
  const scheduleMap = useMemo(() => {
    const m = new Map<string, Schedule>();
    schedules.forEach((s) => m.set(`${s.employeeId}_${s.date}`, s));
    return m;
  }, [schedules]);

  const departments = useMemo(() => Array.from(new Set(employees.map((e) => e.department))), [employees]);

  const changeMonth = (delta: number) => {
    setCurrentMonth(dayjs(currentMonth + '-01').add(delta, 'month').format('YYYY-MM'));
  };

  const openShiftAdd = () => {
    setEditingShift(null);
    shiftForm.resetFields();
    shiftForm.setFieldsValue({
      lateThreshold: 5,
      earlyThreshold: 5,
      workHours: 8,
      color: 'blue',
      startTime: dayjs('09:00', 'HH:mm'),
      endTime: dayjs('18:00', 'HH:mm'),
    });
    setShiftModal(true);
  };

  const openShiftEdit = (s: Shift) => {
    setEditingShift(s);
    shiftForm.setFieldsValue({
      ...s,
      startTime: dayjs(s.startTime, 'HH:mm'),
      endTime: dayjs(s.endTime, 'HH:mm'),
      restStart: s.restStart ? dayjs(s.restStart, 'HH:mm') : null,
      restEnd: s.restEnd ? dayjs(s.restEnd, 'HH:mm') : null,
    });
    setShiftModal(true);
  };

  const submitShift = async () => {
    try {
      const v = await shiftForm.validateFields();
      const data: Shift = {
        ...v,
        startTime: v.startTime.format('HH:mm'),
        endTime: v.endTime.format('HH:mm'),
        restStart: v.restStart ? v.restStart.format('HH:mm') : undefined,
        restEnd: v.restEnd ? v.restEnd.format('HH:mm') : undefined,
      };
      if (editingShift) {
        updateShift(editingShift.id, data);
        message.success('班次已更新');
      } else {
        addShift({ ...data, id: genId('shift') });
        message.success('班次已创建');
      }
      setShiftModal(false);
    } catch (e) {
      //
    }
  };

  const applyShiftToAll = (shiftId: string) => {
    const list: Schedule[] = [];
    dates.forEach((d) => {
      if (isWeekend(d)) return;
      activeEmps.forEach((emp) => {
        list.push({
          id: genId('sch'),
          employeeId: emp.id,
          date: d,
          shiftId,
          type: 'normal',
        });
      });
    });
    batchAddSchedules(list);
    message.success(`已批量应用 ${list.length} 条排班`);
  };

  const openSchEdit = (empId: string, date: string) => {
    const key = `${empId}_${date}`;
    const existing = scheduleMap.get(key);
    setEditingSch(existing || null);
    schForm.resetFields();
    schForm.setFieldsValue({
      employeeId: empId,
      date: dayjs(date),
      shiftId: existing?.shiftId,
      type: existing?.type || 'normal',
      remark: existing?.remark,
    });
    setScheduleModal(true);
  };

  const submitSch = async () => {
    try {
      const v = await schForm.validateFields();
      const data = {
        employeeId: v.employeeId,
        date: v.date.format('YYYY-MM-DD'),
        shiftId: v.shiftId,
        type: v.type,
        remark: v.remark,
      };
      if (editingSch) {
        updateSchedule(editingSch.id, data);
        message.success('排班已更新');
      } else {
        addSchedule({ ...data, id: genId('sch') });
        message.success('排班已创建');
      }
      setScheduleModal(false);
    } catch (e) {
      //
    }
  };

  const renderCell = (empId: string, date: string) => {
    const weekend = isWeekend(date);
    const today = dayjs().format('YYYY-MM-DD') === date;
    const key = `${empId}_${date}`;
    const sch = scheduleMap.get(key);
    const shift = sch ? shiftMap.get(sch.shiftId) : null;

    return (
      <div
        className="calendar-cell"
        style={{
          background: weekend ? '#fafafa' : undefined,
          borderRight: '1px solid #f0f0f0',
          borderBottom: '1px solid #f0f0f0',
        }}
        onClick={() => openSchEdit(empId, date)}
      >
        {shift ? (
          <Tooltip title={`${shift.name} ${shift.startTime}-${shift.endTime}`}>
            <span
              className="shift-tag"
              style={{
                background: `${SHIFT_COLORS[shift.color] || '#1677ff'}22`,
                color: SHIFT_COLORS[shift.color] || '#1677ff',
                border: `1px solid ${SHIFT_COLORS[shift.color] || '#1677ff'}44`,
              }}
            >
              {shift.name}
            </span>
          </Tooltip>
        ) : (
          <span style={{ fontSize: 11, color: '#d9d9d9' }}>未排班</span>
        )}
        {sch?.type === 'leave' && (
          <Tag color="red" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px', margin: '2px 0 0' }}>请假</Tag>
        )}
        {sch?.type === 'overtime' && (
          <Tag color="orange" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px', margin: '2px 0 0' }}>加班</Tag>
        )}
        {today && (
          <div style={{ position: 'absolute', top: 2, right: 4, width: 6, height: 6, borderRadius: '50%', background: '#1677ff' }} />
        )}
      </div>
    );
  };

  return (
    <div>
      <Tabs
        defaultActiveKey="calendar"
        items={[
          {
            key: 'calendar',
            label: '排班日历',
            children: (
              <div className="page-card">
                <div className="toolbar">
                  <div className="toolbar-left">
                    <Space>
                      <Button icon={<LeftOutlined />} onClick={() => changeMonth(-1)} />
                      <Space style={{ fontSize: 18, fontWeight: 600, minWidth: 140, textAlign: 'center' }}>
                        {currentMonth.replace('-', '年')}月
                      </Space>
                      <Button icon={<RightOutlined />} onClick={() => changeMonth(1)} />
                      <DatePicker
                        picker="month"
                        value={dayjs(currentMonth)}
                        onChange={(v) => v && setCurrentMonth(v.format('YYYY-MM'))}
                        style={{ width: 140 }}
                      />
                    </Space>
                    <Select style={{ width: 160 }} value={dept} onChange={setDept}
                      options={[{ label: '全部部门', value: '全部' }, ...departments.map((d) => ({ label: d, value: d }))]} />
                  </div>
                  <div className="toolbar-right">
                    <span style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>点击单元格可编辑排班</span>
                  </div>
                </div>

                <Divider style={{ margin: '8px 0 16px' }} />

                <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                  {shifts.map((s) => (
                    <div key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#fafafa', borderRadius: 4, border: '1px solid #f0f0f0' }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: SHIFT_COLORS[s.color] }} />
                      <span style={{ fontSize: 12 }}>{s.name} {s.startTime}-{s.endTime}</span>
                      <Button type="link" size="small" onClick={() => applyShiftToAll(s.id)}>应用本月工作日</Button>
                    </div>
                  ))}
                </div>

                <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 420px)' }}>
                  <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                      <tr>
                        <th style={{
                          position: 'sticky', left: 0, zIndex: 3,
                          background: '#fafafa', border: '1px solid #f0f0f0',
                          padding: '8px 6px', fontWeight: 600, fontSize: 12, minWidth: 120, textAlign: 'left',
                        }}>员工\日期</th>
                        {dates.map((d) => {
                          const weekend = isWeekend(d);
                          const today = dayjs().format('YYYY-MM-DD') === d;
                          const day = dayjs(d).format('DD');
                          const week = ['日', '一', '二', '三', '四', '五', '六'][dayjs(d).day()];
                          return (
                            <th key={d} style={{
                              background: today ? '#e6f4ff' : '#fafafa',
                              minWidth: 84, fontWeight: 600, fontSize: 12,
                              border: '1px solid #f0f0f0', padding: '6px 4px',
                              color: weekend ? '#ff4d4f' : today ? '#1677ff' : 'rgba(0,0,0,0.65)',
                            }}>
                              <div>{day}</div>
                              <div style={{ fontSize: 10, fontWeight: 400 }}>周{week}</div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {activeEmps.map((emp) => (
                        <tr key={emp.id}>
                          <td style={{
                            position: 'sticky', left: 0, zIndex: 1,
                            background: '#fff', border: '1px solid #f0f0f0',
                            padding: '4px 8px', fontSize: 12, fontWeight: 500,
                            whiteSpace: 'nowrap',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{
                                width: 22, height: 22, borderRadius: '50%',
                                background: emp.gender === '男' ? '#bae0ff' : '#ffd6e7',
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10,
                              }}>{emp.name[0]}</span>
                              <div>
                                <div>{emp.name}</div>
                                <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.45)' }}>{emp.department}</div>
                              </div>
                            </div>
                          </td>
                          {dates.map((d) => (
                            <td key={d} style={{ padding: 0, minWidth: 84 }}>
                              {renderCell(emp.id, d)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ),
          },
          {
            key: 'shift',
            label: '班次管理',
            children: (
              <div className="page-card">
                <div className="toolbar">
                  <div style={{ fontSize: 16, fontWeight: 600 }}>班次设置</div>
                  <Button type="primary" icon={<PlusOutlined />} onClick={openShiftAdd}>新增班次</Button>
                </div>
                <Row gutter={16}>
                  {shifts.map((s) => (
                    <Col span={8} key={s.id}>
                      <Card
                        style={{ marginBottom: 16, borderLeft: `4px solid ${SHIFT_COLORS[s.color] || '#1677ff'}` }}
                        actions={[
                          <span key="edit" onClick={() => openShiftEdit(s)}><EditOutlined /> 编辑</span>,
                          <Popconfirm key="del" title="确定删除该班次?" onConfirm={() => { deleteShift(s.id); message.success('已删除'); }}>
                            <span style={{ color: '#ff4d4f' }}><DeleteOutlined /> 删除</span>
                          </Popconfirm>,
                        ]}
                      >
                        <Card.Meta
                          title={
                            <Space>
                              <Tag color={s.color} style={{ fontSize: 14, padding: '4px 12px' }}>{s.name}</Tag>
                            </Space>
                          }
                          description={
                            <div style={{ fontSize: 13 }}>
                              <div>工作时间：{s.startTime} - {s.endTime}</div>
                              {s.restStart && <div>休息时间：{s.restStart} - {s.restEnd}</div>}
                              <div>标准工时：{s.workHours} 小时</div>
                              <div style={{ marginTop: 6, color: 'rgba(0,0,0,0.45)' }}>
                                迟到阈值: {s.lateThreshold}分钟 · 早退阈值: {s.earlyThreshold}分钟
                              </div>
                            </div>
                          }
                        />
                      </Card>
                    </Col>
                  ))}
                </Row>
              </div>
            ),
          },
        ]}
      />

      <Modal title={editingShift ? '编辑班次' : '新增班次'} open={shiftModal} onOk={submitShift} onCancel={() => setShiftModal(false)} okText="保存" cancelText="取消" width={520} destroyOnClose>
        <Form form={shiftForm} layout="vertical" preserve={false}>
          <Form.Item name="name" label="班次名称" rules={[{ required: true, message: '请输入班次名称' }]}>
            <Input placeholder="如 早班/中班/晚班" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="startTime" label="上班时间" rules={[{ required: true }]}>
                <TimePicker style={{ width: '100%' }} format="HH:mm" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="endTime" label="下班时间" rules={[{ required: true }]}>
                <TimePicker style={{ width: '100%' }} format="HH:mm" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="restStart" label="休息开始">
                <TimePicker style={{ width: '100%' }} format="HH:mm" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="restEnd" label="休息结束">
                <TimePicker style={{ width: '100%' }} format="HH:mm" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="workHours" label="标准工时(h)" rules={[{ required: true }]}>
                <Input type="number" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="lateThreshold" label="迟到阈值(分)" rules={[{ required: true }]}>
                <Input type="number" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="earlyThreshold" label="早退阈值(分)" rules={[{ required: true }]}>
                <Input type="number" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="color" label="显示颜色" rules={[{ required: true }]}>
            <Select options={[
              { label: '蓝色', value: 'blue' }, { label: '绿色', value: 'green' },
              { label: '紫色', value: 'purple' }, { label: '橙色', value: 'orange' },
              { label: '红色', value: 'red' }, { label: '青色', value: 'cyan' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="编辑排班" open={scheduleModal} onOk={submitSch} onCancel={() => setScheduleModal(false)} okText="保存" cancelText="取消" destroyOnClose>
        <Form form={schForm} layout="vertical" preserve={false}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="employeeId" label="员工" rules={[{ required: true }]}>
                <Select
                  options={activeEmps.map((e) => ({ label: `${e.name} - ${e.department}`, value: e.id }))}
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="date" label="日期" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="shiftId" label="班次" rules={[{ required: true }]}>
                <Select options={shifts.map((s) => ({ label: `${s.name} ${s.startTime}-${s.endTime}`, value: s.id }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="type" label="排班类型" rules={[{ required: true }]}>
                <Select options={[
                  { label: '正常上班', value: 'normal' },
                  { label: '加班', value: 'overtime' },
                  { label: '请假', value: 'leave' },
                  { label: '休息', value: 'rest' },
                ]} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="remark" label="备注">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>
          {editingSch && (
            <Popconfirm title="确定删除该排班记录?" onConfirm={() => { deleteSchedule(editingSch.id); setScheduleModal(false); message.success('已删除'); }}>
              <Button type="text" danger style={{ padding: 0 }}>删除此排班</Button>
            </Popconfirm>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default ScheduleCalendar;
