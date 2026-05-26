# CAR Frontend (Vue Engineering Baseline)

本目录是项目工程化第一步：使用 Vue3 + Vite + TypeScript 建立前端工程基线，
并将旧版原型页面以 Legacy 方式挂载，确保业务不中断。

## Quick Start

```bash
cd frontend
npm install
npm run dev
```

开发服务器启动后：
- `/`：工程化首页
- `/legacy`：旧版可视化页面（当前业务仍可用）

## Directory

- `src/`：新的 Vue 应用代码
- `src/config/app-config.ts`：环境变量解析与统一配置中心
- `src/views/LegacyVisualizerView.vue`：Legacy 页面容器
- `public/legacy/`：旧版原型文件快照（index/styles/app/modules/map assets）

## Environment Config

复制示例文件并按机器环境调整：

```bash
cp .env.example .env.local
```

主要变量：
- `VITE_API_BASE_URL`：后端基础地址（如 `http://127.0.0.1:8080`）
- `VITE_GPS_ENDPOINT`：GPS 接口路径
- `VITE_ROUTE_ENDPOINT`：路线提交接口路径
- `VITE_GPS_SOURCE`：`browser` 或 `backend`
- `VITE_USE_GPS_ON_SET_ENDPOINT`：设置终点时是否先拉取 GPS
- `VITE_API_HEADERS_JSON`：请求头 JSON（如鉴权）

## Phase-1 Goal

1. 先稳定在 Vue 工程中运行旧版页面。
2. 后续分批迁移为 Vue 组件与 service 层，不一次性推翻重写。
3. 为下一阶段 ROS2/Autoware 对接预留统一协议层。
