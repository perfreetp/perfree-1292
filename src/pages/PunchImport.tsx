import { useMemo, useState } from 'react';
import {
  Table, Button, Upload, Input, Select, DatePicker, Space, Tag,
  Card, Row, Col, Statistic, message, Tooltip, Modal, Form, TimePicker,
  Divider,
} from 'antd';
import {
  UploadOutlined, PlusOutlined, SearchOutlined, FileTextOutlined,
  CheckCircleOutlined, WarningOutlined, EditOutlined, DeleteOutlined,
  DownloadOutlined, ClockCircleOutlined, LogoutOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { useAppStore } from '../store/useAppStore';
import { genId, parseExcelDateToStr, parseExcelTimeToStr, analyzeAttendanceExceptions } from '../utils/calculations';
import type { PunchRecord } from '../types';

const PunchImport = () => {
  const store = useAppStore();
  const { batchImportPunch, addPunch, updatePunch, deletePunch, batchAddExceptions, isMonthLocked } = store;
  const employees: any[] = (store as any).employees || [];
  const punchRecords: any[] = (store as any).punchRecords || [];
  const schedules: any[] = (store as any).schedules || [];
  const shifts: any[] = (store as any).shifts || [];
  const exceptions: any[] = (store as any).exceptions || [];
  const currentMonth: string = (store as any).currentMonth || dayjs().subtract(1, 'month').format('YYYY-MM');
  const locked = isMonthLocked(currentMonth);
  const [keyword, setKeyword] = useState('');
  const [dept, setDept] = useState('全部');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [onlyAbnormal, setOnlyAbnormal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editing, setEditing] = useState<PunchRecord | null>(null);
  const [editForm] = Form.useForm();
  const [previewModal, setPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);

  const empMap = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const departments = useMemo(() => Array.from(new Set(employees.map((e) => e.department))), [employees]);

  const excForPunchMap = useMemo(() => {
    const m = new Map<string, any[]>();
    exceptions.forEach((e) => {
      const k = `${e.employeeId}_${e.date}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    });
    return m;
  }, [exceptions]);

  const stats = useMemo(() => {
    const inMonth = punchRecords.filter((p) => p.date.startsWith(currentMonth));
    const hasBoth = inMonth.filter((p) => p.punchIn && p.punchOut).length;
    const missingIn = inMonth.filter((p) => !p.punchIn).length;
    const missingOut = inMonth.filter((p) => !p.punchOut).length;
    return { total: inMonth.length, hasBoth, missingIn, missingOut };
  }, [punchRecords, currentMonth]);

  const filtered = useMemo(() => {
    let list = punchRecords;
    if (dateRange) {
      const s = dateRange[0].format('YYYY-MM-DD');
      const e = dateRange[1].format('YYYY-MM-DD');
      list = list.filter((p) => p.date >= s && p.date <= e);
    } else {
      list = list.filter((p) => p.date.startsWith(currentMonth));
    }
    if (onlyAbnormal) {
      list = list.filter((p) => !p.punchIn || !p.punchOut);
    }
    if (keyword || dept !== '全部') {
      list = list.filter((p) => {
        const emp = empMap.get(p.employeeId);
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
  }, [punchRecords, dateRange, onlyAbnormal, keyword, dept, currentMonth, empMap]);

  const handleUpload: UploadProps['beforeUpload'] = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { raw: true });
        const parsed: any[] = [];
        json.forEach((row: any) => {
          const keys = Object.keys(row);
          const findKey = (keywords: string[]) => keys.find((k) => keywords.some((kw) => k.includes(kw)));
          const noKey = findKey(['工号', '编号', 'employeeNo', 'no']);
          const nameKey = findKey(['姓名', 'name']);
          const dateKey = findKey(['日期', 'date']);
          const inKey = findKey(['上班', '签到', 'in', '打卡(上)']);
          const outKey = findKey(['下班', '签退', 'out', '打卡(下)']);
          const timeKey = findKey(['时间', 'time']);

          if (!row) return;
          const no = row[noKey || ''] || '';
          const employee = employees.find((e) => e.employeeNo === String(no) || (nameKey && e.name === row[nameKey]));
          if (!employee) return;

          let date: string = '';
          if (dateKey && row[dateKey]) {
            date = parseExcelDateToStr(row[dateKey]);
          } else if (timeKey && row[timeKey]) {
            date = parseExcelDateToStr(row[timeKey]);
          }

          if (!date) return;

          let punchIn: string | undefined;
          let punchOut: string | undefined;

          if (timeKey && row[timeKey]) {
            const time = parseExcelTimeToStr(row[timeKey]);
            if (time) {
              const hour = parseInt(time.split(':')[0], 10);
              if (hour < 14) punchIn = time;
              else punchOut = time;
            }
          }
          if (inKey && row[inKey]) {
            const t = parseExcelTimeToStr(row[inKey]);
            if (t) punchIn = t;
          }
          if (outKey && row[outKey]) {
            const t = parseExcelTimeToStr(row[outKey]);
            if (t) punchOut = t;
          }

          parsed.push({
            id: genId('punch'),
            employeeId: employee.id,
            date,
            punchIn,
            punchOut,
            source: 'import',
            _empName: employee.name,
            _empNo: employee.employeeNo,
            _dept: employee.department,
          });
        });

        setPreviewData(parsed);
        setPreviewModal(true);
      } catch (err) {
        message.error('Excel解析失败，请检查文件格式');
      }
    };
    reader.readAsArrayBuffer(file);
    return false;
  };

  const confirmImport = () => {
    const real = previewData.map((d) => ({
      id: d.id,
      employeeId: d.employeeId,
      date: d.date,
      punchIn: d.punchIn,
      punchOut: d.punchOut,
      source: d.source,
    }));
    batchImportPunch(real);
    try {
      const existingKeys = new Set(punchRecords.map((x) => `${x.employeeId}_${x.date}`));
      const imported = real.filter((x) => !existingKeys.has(`${x.employeeId}_${x.date}`));
      const combinedPunches = [...punchRecords, ...imported];
      const monthSet = new Set<string>();
      imported.forEach((p) => {
        if (p.date) monthSet.add(p.date.slice(0, 7));
      });
      const allNewExceptions: any[] = [];
      monthSet.forEach((m) => {
        const anal = analyzeAttendanceExceptions({
          punchRecords: combinedPunches,
          schedules,
          shifts,
          month: m,
        });
        const priorKeys = new Set(
          exceptions
            .filter((e) => e.date.startsWith(m))
            .map((e: any) => `${e.employeeId}_${e.date}_${e.type}`)
        );
        anal.forEach((e: any) => {
          const k = `${e.employeeId}_${e.date}_${e.type}`;
          if (!priorKeys.has(k)) {
            priorKeys.add(k);
            allNewExceptions.push(e);
          }
        });
      });
      if (allNewExceptions.length) batchAddExceptions(allNewExceptions);
      message.success(`成功导入 ${imported.length} 条打卡，新增 ${allNewExceptions.length} 条考勤异常`);
    } catch (e: any) {
      message.success(`成功导入 ${real.length} 条打卡记录`);
    }
    setPreviewModal(false);
    setPreviewData([]);
  };

  const downloadTemplate = () => {
    const data = [
      { '工号': 'EMP0001', '姓名': '张三', '日期': '2025-05-05', '上班打卡': '08:55', '下班打卡': '18:05' },
      { '工号': 'EMP0002', '姓名': '李四', '日期': '2025-05-05', '上班打卡': '09:20', '下班打卡': '18:30' },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '打卡数据');
    XLSX.writeFile(wb, '打卡数据导入模板.xlsx');
  };

  const openEdit = (r: PunchRecord) => {
    setEditing(r);
    editForm.resetFields();
    editForm.setFieldsValue({
      employeeId: r.employeeId,
      date: dayjs(r.date),
      punchIn: r.punchIn ? dayjs(r.punchIn, 'HH:mm') : null,
      punchOut: r.punchOut ? dayjs(r.punchOut, 'HH:mm') : null,
      remark: r.remark,
    });
    setEditModal(true);
  };

  const openAdd = () => {
    setEditing(null);
    editForm.resetFields();
    editForm.setFieldsValue({ date: dayjs() });
    setEditModal(true);
  };

  const submitEdit = async () => {
    try {
      const v = await editForm.validateFields();
      const data = {
        employeeId: v.employeeId,
        date: v.date.format('YYYY-MM-DD'),
        punchIn: v.punchIn ? v.punchIn.format('HH:mm') : undefined,
        punchOut: v.punchOut ? v.punchOut.format('HH:mm') : undefined,
        remark: v.remark,
        source: 'manual' as const,
      };
      if (editing) {
        updatePunch(editing.id, data);
        message.success('已更新');
      } else {
        addPunch({ ...data, id: genId('punch') });
        message.success('已添加');
      }
      setEditModal(false);
    } catch (e) {
      //
    }
  };

  const columns = [
    { title: '日期', dataIndex: 'date', width: 120, fixed: 'left' as const },
    { title: '工号', width: 100, render: (_: any, r: PunchRecord) => empMap.get(r.employeeId)?.employeeNo },
    { title: '姓名', width: 100, render: (_: any, r: PunchRecord) => empMap.get(r.employeeId)?.name },
    { title: '部门', width: 120, render: (_: any, r: PunchRecord) => {
      const e = empMap.get(r.employeeId);
      return e ? <Tag color="blue">{e.department}</Tag> : null;
    } },
    { title: '上班打卡', dataIndex: 'punchIn', width: 110,
      render: (v: string, r: PunchRecord) => {
        const list = excForPunchMap.get(`${r.employeeId}_${r.date}`) || [];
        const hasLate = list.some((e) => e.type === 'late');
        const tagColor = v ? (hasLate ? 'orange' : 'green') : 'red';
        const icon = v ? (hasLate ? <ClockCircleOutlined /> : <CheckCircleOutlined />) : <WarningOutlined />;
        return v ? <Tag color={tagColor} icon={icon}>{v}{hasLate ? ` (迟到${list.find((x) => x.type === 'late')?.minutes || 0}分)` : ''}</Tag> : <Tag color="red" icon={<WarningOutlined />}>缺卡</Tag>;
      } },
    { title: '下班打卡', dataIndex: 'punchOut', width: 130,
      render: (v: string, r: PunchRecord) => {
        const list = excForPunchMap.get(`${r.employeeId}_${r.date}`) || [];
        const hasEarly = list.some((e) => e.type === 'early');
        const tagColor = v ? (hasEarly ? 'orange' : 'green') : 'red';
        return v ? <Tag color={tagColor} icon={hasEarly ? <LogoutOutlined /> : <CheckCircleOutlined />}>{v}{hasEarly ? ` (早退${list.find((x) => x.type === 'early')?.minutes || 0}分)` : ''}</Tag> : <Tag color="red" icon={<WarningOutlined />}>缺卡</Tag>;
      } },
    { title: '考勤异常', width: 180,
      render: (_: any, r: PunchRecord) => {
        const list = excForPunchMap.get(`${r.employeeId}_${r.date}`) || [];
        if (!list.length) return <Tag color="success">正常</Tag>;
        return (
          <Space size={4} wrap>
            {list.map((e) => {
              const labelMap: Record<string, string> = { late: '迟到', early: '早退', absent: '旷工', missing_punch: '缺卡' };
              const colorMap: Record<string, string> = { late: 'orange', early: 'orange', absent: 'red', missing_punch: 'warning' };
              const text = e.type === 'late' || e.type === 'early' ? `${labelMap[e.type]}${e.minutes}分` : labelMap[e.type];
              return <Tag key={e.id} color={e.handled ? 'default' : colorMap[e.type]} style={e.handled ? { textDecoration: 'line-through' } : {}}>{text}{e.handled ? '(已处理)' : ''}</Tag>;
            })}
          </Space>
        );
      } },
    { title: '状态', width: 100,
      render: (_: any, r: PunchRecord) => {
        if (r.punchIn && r.punchOut) return <Tag icon={<CheckCircleOutlined />} color="success">完整</Tag>;
        if (r.punchIn || r.punchOut) return <Tag color="warning">部分缺失</Tag>;
        return <Tag color="error">完全缺失</Tag>;
      } },
    { title: '数据来源', dataIndex: 'source', width: 100,
      render: (v: string) => v === 'import' ? <Tag>批量导入</Tag> : <Tag color="purple">人工补录</Tag> },
    { title: '备注', dataIndex: 'remark', render: (v: string) => v || '-' },
    { title: '操作', width: 150, fixed: 'right' as const,
      render: (_: any, r: PunchRecord) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EditOutlined />} disabled={locked} onClick={() => { if (locked) return message.warning('本月已结账'); openEdit(r); }}>编辑</Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={locked} onClick={() => { if (locked) return message.warning('本月已结账'); deletePunch(r.id); message.success('已删除'); }}>删除</Button>
        </Space>
      ) },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card bordered>
            <Statistic title={<span><FileTextOutlined style={{ color: '#1677ff' }} /> 本月打卡记录</span>} value={stats.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered>
            <Statistic title={<span><CheckCircleOutlined style={{ color: '#52c41a' }} /> 完整记录</span>} value={stats.hasBoth} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered>
            <Statistic title={<span><WarningOutlined style={{ color: '#fa8c16' }} /> 缺上班打卡</span>} value={stats.missingIn} valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered>
            <Statistic title={<span><WarningOutlined style={{ color: '#ff4d4f' }} /> 缺下班打卡</span>} value={stats.missingOut} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
      </Row>

      <div className="page-card">
        <h2 className="page-title">打卡数据管理</h2>
        <p className="page-desc">批量导入考勤机打卡数据，支持手动补录和修正</p>

        <div className="toolbar">
          <div className="toolbar-left">
            <Input prefix={<SearchOutlined />} placeholder="搜索姓名/工号" style={{ width: 200 }} value={keyword} onChange={(e) => setKeyword(e.target.value)} allowClear />
            <Select style={{ width: 150 }} value={dept} onChange={setDept} options={[{ label: '全部部门', value: '全部' }, ...departments.map((d) => ({ label: d, value: d }))]} />
            <DatePicker.RangePicker
              value={dateRange}
              onChange={(v) => setDateRange(v as [dayjs.Dayjs, dayjs.Dayjs] | null)}
              defaultPickerValue={[dayjs(currentMonth + '-01'), dayjs(currentMonth + '-01').endOf('month')]}
            />
            <Select
              style={{ width: 140 }}
              value={onlyAbnormal ? 'abnormal' : 'all'}
              onChange={(v) => setOnlyAbnormal(v === 'abnormal')}
              options={[{ label: '全部记录', value: 'all' }, { label: '仅异常记录', value: 'abnormal' }]}
            />
          </div>
          <div className="toolbar-right">
            <Button icon={<DownloadOutlined />} onClick={downloadTemplate}>下载模板</Button>
            <Upload beforeUpload={handleUpload} showUploadList={false} accept=".xlsx,.xls">
              <Button type="primary" icon={<UploadOutlined />} disabled={locked} onClick={(e) => { if (locked) { message.warning('本月已结账，无法导入'); return e?.preventDefault?.(); } }}>导入Excel</Button>
            </Upload>
            <Button icon={<PlusOutlined />} onClick={() => { if (locked) return message.warning('本月已结账，无法补录'); openAdd(); }} disabled={locked}>手工补录</Button>
          </div>
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          scroll={{ x: 1700 }}
          pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        />
      </div>

      <Modal
        title={`预览导入数据 (${previewData.length} 条)`}
        open={previewModal}
        onOk={confirmImport}
        onCancel={() => { setPreviewModal(false); setPreviewData([]); }}
        okText="确认导入"
        cancelText="取消"
        width={900}
      >
        <Divider style={{ margin: '0 0 12px' }} />
        <Table
          size="small"
          rowKey="id"
          dataSource={previewData}
          pagination={{ pageSize: 8 }}
          columns={[
            { title: '日期', dataIndex: 'date', width: 120 },
            { title: '工号', dataIndex: '_empNo', width: 100 },
            { title: '姓名', dataIndex: '_empName', width: 100 },
            { title: '部门', dataIndex: '_dept', width: 140 },
            { title: '上班打卡', dataIndex: 'punchIn', render: (v: string) => v || <span style={{ color: '#ff4d4f' }}>缺失</span> },
            { title: '下班打卡', dataIndex: 'punchOut', render: (v: string) => v || <span style={{ color: '#ff4d4f' }}>缺失</span> },
          ]}
        />
      </Modal>

      <Modal title={editing ? '编辑打卡记录' : '补录打卡记录'} open={editModal} onOk={submitEdit} onCancel={() => setEditModal(false)} okText="保存" cancelText="取消" destroyOnClose>
        <Form form={editForm} layout="vertical" preserve={false}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="employeeId" label="员工" rules={[{ required: true }]}>
                <Select
                  options={employees.map((e) => ({ label: `${e.employeeNo} - ${e.name} (${e.department})`, value: e.id }))}
                  showSearch optionFilterProp="label"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="date" label="日期" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="punchIn" label="上班打卡时间">
                <TimePicker style={{ width: '100%' }} format="HH:mm" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="punchOut" label="下班打卡时间">
                <TimePicker style={{ width: '100%' }} format="HH:mm" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="remark" label="备注">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default PunchImport;
