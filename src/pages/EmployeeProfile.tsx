import { useMemo, useState } from 'react';
import {
  Table, Button, Input, Select, Modal, Form, DatePicker, Radio,
  Space, Tag, Card, Row, Col, Statistic, message, Popconfirm,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  UserOutlined, TeamOutlined, ArrowUpOutlined, ArrowDownOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAppStore } from '../store/useAppStore';
import { genId } from '../utils/calculations';
import type { Employee } from '../types';

const DEPARTMENTS = ['技术研发部', '产品运营部', '市场销售部', '财务部', '行政人事部', '全部'];

const EmployeeProfile = () => {
  const store = useAppStore();
  const { addEmployee, updateEmployee, deleteEmployee } = store;
  const employees: Employee[] = (store as any).employees || [];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form] = Form.useForm();
  const [keyword, setKeyword] = useState('');
  const [dept, setDept] = useState<string>('全部');
  const [status, setStatus] = useState<string>('全部');

  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.status === '在职').length;
    const trial = employees.filter((e) => e.status === '试用期').length;
    const left = employees.filter((e) => e.status === '离职').length;
    const avgSalary = active > 0 ? Math.round(employees.filter((e) => e.status === '在职').reduce((s, e) => s + e.baseSalary, 0) / active) : 0;
    return { total, active, trial, left, avgSalary };
  }, [employees]);

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      if (dept !== '全部' && e.department !== dept) return false;
      if (status !== '全部' && e.status !== status) return false;
      if (keyword) {
        const kw = keyword.toLowerCase();
        if (!e.name.toLowerCase().includes(kw) && !e.employeeNo.toLowerCase().includes(kw) && !e.phone.includes(kw)) return false;
      }
      return true;
    });
  }, [employees, dept, status, keyword]);

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      status: '在职',
      gender: '男',
      hireDate: dayjs(),
    });
    setOpen(true);
  };

  const openEdit = (e: Employee) => {
    setEditing(e);
    form.setFieldsValue({
      ...e,
      hireDate: e.hireDate ? dayjs(e.hireDate) : null,
      leaveDate: e.leaveDate ? dayjs(e.leaveDate) : null,
    });
    setOpen(true);
  };

  const submit = async () => {
    try {
      const values = await form.validateFields();
      const data: Employee = {
        ...values,
        hireDate: values.hireDate.format('YYYY-MM-DD'),
        leaveDate: values.leaveDate ? values.leaveDate.format('YYYY-MM-DD') : undefined,
      };
      if (editing) {
        updateEmployee(editing.id, data);
        message.success('员工信息已更新');
      } else {
        addEmployee({ ...data, id: genId('emp') });
        message.success('员工添加成功');
      }
      setOpen(false);
    } catch (e) {
      // validation error
    }
  };

  const columns = [
    { title: '工号', dataIndex: 'employeeNo', width: 100, fixed: 'left' as const },
    { title: '姓名', dataIndex: 'name', width: 100, fixed: 'left' as const,
      render: (v: string, r: Employee) => (
        <Space>
          <span style={{ width: 28, height: 28, borderRadius: '50%', background: r.gender === '男' ? '#bae0ff' : '#ffd6e7', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>
            {v[0]}
          </span>
          {v}
        </Space>
      ) },
    { title: '性别', dataIndex: 'gender', width: 70 },
    { title: '部门', dataIndex: 'department', width: 120,
      render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: '职位', dataIndex: 'position', width: 120 },
    { title: '入职日期', dataIndex: 'hireDate', width: 120 },
    { title: '离职日期', dataIndex: 'leaveDate', width: 120, render: (v: string) => v || '-' },
    { title: '状态', dataIndex: 'status', width: 90,
      render: (v: string) => (
        <Tag color={v === '在职' ? 'green' : v === '试用期' ? 'orange' : 'default'}>
          {v}
        </Tag>
      ) },
    { title: '联系电话', dataIndex: 'phone', width: 130 },
    { title: '基本工资', dataIndex: 'baseSalary', width: 110,
      render: (v: number) => <span style={{ fontWeight: 600 }}>¥{v.toLocaleString()}</span> },
    { title: '社保基数', dataIndex: 'socialBase', width: 110,
      render: (v: number) => `¥${v.toLocaleString()}` },
    { title: '公积金基数', dataIndex: 'housingFundBase', width: 110,
      render: (v: number) => `¥${v.toLocaleString()}` },
    { title: '操作', width: 140, fixed: 'right' as const,
      render: (_: any, r: Employee) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确定删除该员工?" onConfirm={() => { deleteEmployee(r.id); message.success('已删除'); }} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ) },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card bordered>
            <Statistic title={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><TeamOutlined style={{ color: '#1677ff' }} />员工总数</span>} value={stats.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered>
            <Statistic title={<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><UserOutlined style={{ color: '#52c41a' }} />在职人数</span>} value={stats.active} prefix={<ArrowUpOutlined style={{ color: '#52c41a', fontSize: 14 }} />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered>
            <Statistic title="试用期" value={stats.trial} valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered>
            <Statistic title="平均基本工资(在职)" value={stats.avgSalary} prefix="¥" suffix="/月" />
          </Card>
        </Col>
      </Row>

      <div className="page-card">
        <h2 className="page-title">员工档案管理</h2>
        <p className="page-desc">维护员工基本信息、入离职记录、薪资基数等核心数据</p>

        <div className="toolbar">
          <div className="toolbar-left">
            <Input
              prefix={<SearchOutlined />}
              placeholder="搜索工号/姓名/电话"
              style={{ width: 240 }}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              allowClear
            />
            <Select style={{ width: 160 }} value={dept} onChange={setDept} options={DEPARTMENTS.map((d) => ({ label: d, value: d }))} />
            <Select style={{ width: 140 }} value={status} onChange={setStatus} options={['全部', '在职', '试用期', '离职'].map((d) => ({ label: d, value: d }))} />
          </div>
          <div className="toolbar-right">
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>新增员工</Button>
          </div>
        </div>

        <Table
          rowKey="id"
          dataSource={filtered}
          columns={columns}
          scroll={{ x: 1500 }}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        />
      </div>

      <Modal
        title={editing ? '编辑员工' : '新增员工'}
        open={open}
        onOk={submit}
        onCancel={() => setOpen(false)}
        width={760}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="employeeNo" label="工号" rules={[{ required: true, message: '请输入工号' }]}>
                <Input placeholder="例如 EMP0001" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="gender" label="性别" rules={[{ required: true }]}>
                <Radio.Group>
                  <Radio value="男">男</Radio>
                  <Radio value="女">女</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="idCard" label="身份证号" rules={[{ required: true, message: '请输入身份证号' }]}>
                <Input placeholder="18位身份证号" maxLength={18} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="联系电话" rules={[{ required: true, message: '请输入联系电话' }]}>
                <Input placeholder="11位手机号" maxLength={11} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="department" label="所属部门" rules={[{ required: true }]}>
                <Select options={DEPARTMENTS.filter((d) => d !== '全部').map((d) => ({ label: d, value: d }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="position" label="职位" rules={[{ required: true, message: '请输入职位' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="hireDate" label="入职日期" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="leaveDate" label="离职日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="员工状态" rules={[{ required: true }]}>
                <Select options={[{ label: '在职', value: '在职' }, { label: '试用期', value: '试用期' }, { label: '离职', value: '离职' }]} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="baseSalary" label="基本工资(元)" rules={[{ required: true }]}>
                <Input type="number" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="email" label="电子邮箱">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="socialBase" label="社保缴纳基数(元)" rules={[{ required: true }]}>
                <Input type="number" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="housingFundBase" label="公积金缴纳基数(元)" rules={[{ required: true }]}>
                <Input type="number" />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="bankCard" label="银行卡号">
                <Input placeholder="工资卡账号" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="address" label="家庭住址">
                <Input.TextArea rows={2} />
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

export default EmployeeProfile;
