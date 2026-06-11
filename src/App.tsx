import { Layout, Menu, Avatar, Dropdown, Badge, Space } from 'antd';
import {
  TeamOutlined, CalendarOutlined, FileExcelOutlined, WarningOutlined,
  ClockCircleOutlined, CalculatorOutlined, FileTextOutlined, BarChartOutlined,
  UserOutlined, BellOutlined, SettingOutlined, LogoutOutlined,
} from '@ant-design/icons';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import EmployeeProfile from './pages/EmployeeProfile';
import ScheduleCalendar from './pages/ScheduleCalendar';
import PunchImport from './pages/PunchImport';
import ExceptionHandling from './pages/ExceptionHandling';
import LeaveOvertime from './pages/LeaveOvertime';
import SalaryCalculation from './pages/SalaryCalculation';
import PayslipPreview from './pages/PayslipPreview';
import SummaryExport from './pages/SummaryExport';

const { Header, Sider, Content } = Layout;

const MENU_ITEMS = [
  { key: '/employee', label: '员工档案', icon: <TeamOutlined /> },
  { key: '/schedule', label: '排班日历', icon: <CalendarOutlined /> },
  { key: '/punch', label: '打卡导入', icon: <FileExcelOutlined /> },
  { key: '/exception', label: '异常处理', icon: <WarningOutlined /> },
  { key: '/leave', label: '请假加班', icon: <ClockCircleOutlined /> },
  { key: '/salary', label: '薪资计算', icon: <CalculatorOutlined /> },
  { key: '/payslip', label: '工资单预览', icon: <FileTextOutlined /> },
  { key: '/summary', label: '汇总导出', icon: <BarChartOutlined /> },
];

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const userMenu = {
    items: [
      { key: 'profile', icon: <UserOutlined />, label: '个人设置' },
      { key: 'setting', icon: <SettingOutlined />, label: '系统配置' },
      { type: 'divider' as const },
      { key: 'logout', icon: <LogoutOutlined />, label: '退出登录' },
    ],
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider className="menu-sider" theme="dark" width={220} breakpoint="lg" collapsedWidth={0}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: 'linear-gradient(135deg, #1677ff, #69b1ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>
              H
            </div>
            <span style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>HRMS 薪资系统</span>
          </div>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={MENU_ITEMS}
          onClick={({ key }) => navigate(key)}
          style={{ border: 'none' }}
        />
      </Sider>
      <Layout>
        <Header className="layout-header" style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '0 24px' }}>
          <div>
            <h2 className="layout-title" style={{ color: 'rgba(0,0,0,0.88)' }}>
              <span>员工考勤薪资管理系统</span>
            </h2>
          </div>
          <div className="layout-header-right">
            <Space size={16}>
              <Badge count={3} size="small">
                <BellOutlined style={{ fontSize: 18, cursor: 'pointer', color: 'rgba(0,0,0,0.65)' }} />
              </Badge>
              <span style={{ color: 'rgba(0,0,0,0.65)', fontSize: 13 }}>
                今天 {dayjs().format('YYYY年MM月DD日')}
              </span>
              <Dropdown menu={userMenu} placement="bottomRight">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <Avatar size="small" style={{ background: '#1677ff' }} icon={<UserOutlined />} />
                  <span style={{ color: 'rgba(0,0,0,0.85)', fontSize: 13 }}>人事管理员</span>
                </div>
              </Dropdown>
            </Space>
          </div>
        </Header>
        <Content style={{ margin: 0, overflow: 'auto', background: '#f0f2f5' }}>
          <div className="page-container">
            <Routes>
              <Route path="/" element={<EmployeeProfile />} />
              <Route path="/employee" element={<EmployeeProfile />} />
              <Route path="/schedule" element={<ScheduleCalendar />} />
              <Route path="/punch" element={<PunchImport />} />
              <Route path="/exception" element={<ExceptionHandling />} />
              <Route path="/leave" element={<LeaveOvertime />} />
              <Route path="/salary" element={<SalaryCalculation />} />
              <Route path="/payslip" element={<PayslipPreview />} />
              <Route path="/summary" element={<SummaryExport />} />
            </Routes>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
