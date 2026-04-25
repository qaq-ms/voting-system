# 投票系统 (Voting System)

一个轻量级的实时投票系统，支持多议题、分组管理和实时结果推送。适合小型团队、社区组织进行民主决策。

## 功能特性

- **多议题管理**：管理员可创建、编辑、删除投票议题
- **分组系统**：按话题分类管理议题
- **实时推送**：基于 SSE (Server-Sent Events) 的实时结果更新
- **权限控制**：管理员分级权限管理
- **防重复投票**：每个用户每个议题只能投票一次
- **响应式设计**：支持桌面和移动设备

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React + Vite |
| 后端 | Node.js + Express |
| 数据库 | SQLite (sql.js) |
| 实时通信 | Server-Sent Events (SSE) |

## 快速开始

### 环境要求

- Node.js >= 16.0
- npm >= 8.0

### 安装步骤

1. **克隆仓库**
```bash
git clone https://github.com/YOUR_USERNAME/voting-system.git
cd voting-system
```

2. **安装后端依赖**
```bash
npm install
```

3. **安装前端依赖**
```bash
cd frontend
npm install
cd ..
```

4. **配置环境变量（可选）**
```bash
# 复制示例环境文件
cp .env.example .env
# 编辑 .env 文件设置管理员密码
```

5. **启动服务**
```bash
# 启动后端（端口 3001）
node server.js

# 新终端中启动前端
cd frontend
npm run dev
```

6. **访问应用**
- 前端：`http://localhost:5173`
- 后端 API：`http://localhost:3001`

### 默认账户

- 管理员用户名：`admin`
- 初始密码：通过环境变量 `ADMIN_PASSWORD` 设置，默认为 `ChangeMe123!`

**重要**：首次登录后请立即修改默认密码！

## 项目结构

```
.
├── server.js              # 主服务器入口
├── database.js            # 数据库操作封装
├── eventHub.js            # SSE 事件推送
├── middleware/            # 中间件
│   ├── auth.js            #   用户认证
│   ├── adminAuth.js       #   管理员认证
│   ├── permission.js      #   权限验证
│   ├── validator.js       #   参数验证
│   ├── security.js        #   安全响应头
│   └── inputSanitizer.js  #   输入过滤
├── services/              # 业务逻辑层
│   ├── pollService.js     #   投票业务
│   ├── userService.js     #   用户业务
│   ├── adminService.js    #   管理员业务
│   └── groupService.js    #   分组业务
├── routes/                # 路由层
└── frontend/              # React 前端
```

## API 文档

### 用户接口

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/users/login` | 用户登录 |
| GET  | `/api/users/:userId/status` | 获取用户状态 |
| GET  | `/api/users/:userId/voting-status` | 获取投票状态 |

### 议题接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET  | `/api/polls` | 获取议题列表 |
| GET  | `/api/polls/:id` | 获取议题详情 |
| POST | `/api/polls/:id/vote` | 进行投票 |
| GET  | `/api/polls/:id/results` | 获取投票结果 |

### 管理员接口

| 方法 | 路径 | 权限要求 | 描述 |
|------|------|---------|------|
| POST | `/api/admin/login` | - | 管理员登录 |
| POST | `/api/admin/polls/create` | `create_poll` | 创建议题 |
| PUT  | `/api/admin/polls/:id/status` | `create_poll` | 修改议题状态 |
| DELETE | `/api/admin/polls/:id` | `create_poll` | 删除议题 |

## 安全说明

### 已实施的安全措施

- 密码哈希存储（SHA-256）
- 参数化查询防止 SQL 注入
- XSS 输入过滤
- 安全响应头配置
- 管理员权限分级控制
- 操作日志记录

### 生产环境建议

- 使用 HTTPS 部署
- 配置强密码策略
- 定期备份数据库文件
- 限制 API 访问频率

## 许可证

本项目采用 [MIT 许可证](LICENSE)。

## 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request
