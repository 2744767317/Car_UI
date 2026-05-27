# Car UI

车载点对点控制与地图可视化前端原型。

当前主版本采用原生 HTML + CSS + JavaScript + Canvas 实现，核心目标是先跑通点云地图、OSM 图层、坐标选择、路径规划演示和后续实时数据接入链路。Vue 工程版本暂时作为下一阶段工程化参考保留，当前阶段不作为主线改造目标。

## Current Baseline

- 主入口: `index.html`
- 样式: `styles.css`
- 主逻辑: `app.js`
- 功能模块: `modules/`
- 点云地图: `pointcloud_map.pcd`
- OSM 地图: `lanelet2_map.osm`

当前能力:

- 加载并渲染 PCD 点云地图
- 叠加 OSM 道路线层
- 支持地图拖拽、缩放、点选坐标
- 支持设置起点、终点
- 支持前端 A* 路径规划演示
- 支持模拟车辆沿路径播放
- 支持本地 WebSocket 模拟实时定位数据
- 支持浏览器 GPS / HTTP GPS 接口的基础接入预留
- 支持场景状态保存到 `localStorage`

## Run

当前版本是纯前端静态页面，可以直接打开 `index.html`。

如果浏览器因为本地文件安全策略限制 PCD/OSM 加载，建议在项目根目录启动一个静态服务:

```bash
python -m http.server 5173
```

然后访问:

```text
http://127.0.0.1:5173
```

## Runtime Config

运行配置已从 `index.html` 拆到 `config/` 目录:

- `config/app-config.demo.js`: 离线演示配置，默认加载
- `config/app-config.autoware-local.js`: 本地 ROS 2 Gateway / mock Autoware 联调配置
- `config/app-config.vehicle.js`: 真实测试车配置模板

默认访问:

```text
http://127.0.0.1:5173
```

等同于:

```text
http://127.0.0.1:5173?appConfig=demo
```

切换到本地 Autoware/mock 联调:

```text
http://127.0.0.1:5173?appConfig=autoware-local
```

切换到测试车配置:

```text
http://127.0.0.1:5173?appConfig=vehicle
```

## Mock WebSocket

Phase 2 已加入本地 WebSocket 模拟数据源，用于在接 Autoware 前验证实时数据链路。

启动模拟 WebSocket:

```bash
node tools/mock-ws-server.js
```

默认地址:

```text
ws://127.0.0.1:8765/ws
```

再启动静态页面服务:

```bash
python -m http.server 5173
```

打开页面后点击左侧面板的 `连接模拟数据`。

默认 `realtimeAutoConnect: false`，所以页面刚打开时不会自动连接实时数据。这样保留原来的离线 demo 行为。

操作变化:

- 原演示流程不变: 点地图设置起点和终点，`planningMode: 'demo'` 时前端会运行 `runGridAStar()`
- 新实时流程: 启动 mock WebSocket 后点击 `连接模拟数据`，车辆位置、yaw、速度、frame、感知对象会实时更新
- 新 Autoware 模拟流程: 将 `planningMode` 改成 `autoware` 后，设置终点时前端只发送 `set_goal`，等待 WebSocket 推送 `trajectory`
- 路径图层变化: demo 路径是绿色虚线，route 是蓝色粗线，trajectory 是绿色实线
- 感知图层变化: 连接实时数据后会显示黄色目标框、类别、速度箭头、预测轨迹

模拟服务会持续推送:

- `vehicle_pose`: 车辆实时位置、朝向、速度、frame
- `vehicle_status`: 驾驶模式、电量、定位状态、档位
- `trajectory`: 一条模拟轨迹，用于验证轨迹显示

示例消息:

```json
{
  "type": "vehicle_pose",
  "timestamp": 1710000000000,
  "frame_id": "map",
  "x": 23.5,
  "y": 14.9,
  "z": 0.0,
  "roll": 0.0,
  "pitch": 0.0,
  "yaw": 1.57,
  "speed": 1.2
}
```

## Planning Modes

Phase 3 已将路径规划拆成两种模式。

在 `config/` 目录的 profile 文件中切换，或通过 URL 参数选择:

```js
window.APP_CONFIG = {
  modeName: 'demo',
  planningMode: 'demo', // demo | autoware
  wsEndpoint: 'ws://127.0.0.1:8765/ws',
  realtimeAutoConnect: false,
  planningEndpoint: 'http://127.0.0.1:8765/api/route/submit',
  routeEndpoint: '/api/route/submit'
};
```

### demo_mode

`planningMode: 'demo'`

行为:

- 前端继续使用当前 A* 计算路径
- `pathPoints` 由前端生成
- 播放按钮仍然按前端路径做模拟行驶
- 可选地把 demo 路径提交到 `routeEndpoint`

适合:

- 离线演示
- 前端地图调试
- 不依赖后端 / Autoware 的 UI 验证

### autoware_mode

`planningMode: 'autoware'`

行为:

- 前端不调用 A*
- 前端只提交 `set_goal`
- 提交接口优先使用 `planningEndpoint`，未配置时回退到 `routeEndpoint`
- 前端等待 WebSocket 推送 `trajectory`
- 收到 `trajectory` 后再更新地图路径

目标点提交格式:

```json
{
  "type": "set_goal",
  "protocol": "ros2_gateway.v1",
  "source": "car_ui",
  "frame_id": "map",
  "start": {
    "x": 20.0,
    "y": 13.5,
    "z": 0,
    "yaw": 0,
    "frame_id": "map"
  },
  "goal": {
    "x": 23.5,
    "y": 14.9,
    "z": 0,
    "yaw": 0,
    "frame_id": "map"
  },
  "timestamp": 1710000000000
}
```

适合:

- 模拟 ROS 2 Gateway 行为
- 后续对接 Autoware goal / route / trajectory
- 验证真实规划链路

本地模拟 autoware 流程:

1. 将 `planningMode` 改为 `autoware`
2. 启动 `node tools/mock-ws-server.js`
3. 启动 `python -m http.server 5173`
4. 打开页面并点击 `连接模拟数据`
5. 设置起点和终点
6. 前端提交 goal 到 mock server
7. mock server 通过 WebSocket 推送 trajectory

## Architecture

当前代码按功能拆在 `modules/` 目录:

- `core-methods.js`: 初始化、画布尺寸、地图边界、基础状态
- `controls-methods.js`: UI 控件和按钮事件
- `gps-methods.js`: GPS、后端定位接口、坐标转换、路线提交
- `realtime-methods.js`: WebSocket 实时数据接入、车辆状态更新
- `scene-methods.js`: 场景配置、默认资源、快照持久化
- `interactionPath-methods.js`: 地图交互、点选、路径规划、播放
- `render-methods.js`: Canvas 渲染
- `osmPcd-methods.js`: PCD / OSM / GeoJSON 加载与解析

ROS2 Gateway WebSocket 协议见:

- `docs/ros2-gateway-protocol.md`
- `docs/bridge-options.md`

### Autoware 定位接入顺序

第一批建议只接定位，不接感知对象。Gateway 优先订阅:

- `/localization/kinematic_state`
- `/tf`
- `/tf_static`

`/localization/kinematic_state` 在不同 Autoware 版本里的消息类型可能不同，上车前以实际命令为准:

```bash
ros2 topic info -v /localization/kinematic_state
```

四元数到 yaw 的转换必须在 Gateway 完成，前端只接收 `yaw`。上线前必须确认 PCD map、Lanelet2 / OSM、Autoware `map` frame、`odom`、`base_link` 和 Canvas world 坐标一致。

本仓库提供了一个最小 Python 定位网关骨架:

```bash
python tools/ros2-localization-gateway.py \
  --kinematic-topic /localization/kinematic_state \
  --kinematic-type nav_msgs/msg/Odometry \
  --ws-host 127.0.0.1 \
  --ws-port 8765
```

如果车上的 `/localization/kinematic_state` 不是 `nav_msgs/msg/Odometry`，先用 `ros2 topic info -v` 查明类型，再通过 `--kinematic-type` 指定，必要时只改 Gateway 的字段提取逻辑，前端协议保持不变。

前端左侧已预留“坐标系检查”面板，显示:

- `pose.frame_id`
- `child_frame_id`
- `map->base_link TF 延迟`
- `pose age`
- `PCD/OSM 偏移`
- `yaw 来源`

### 感知对象接入

定位链路稳定后，可以接:

- `/perception/object_recognition/objects`

Gateway 将 Autoware detected objects 转成前端协议 `perception_objects`。前端已经支持对象矩形框、标签、速度箭头和预测轨迹显示，并新增对象筛选:

- `vehicle`
- `pedestrian`
- `bicycle`
- `unknown`

前端左侧“感知对象”面板会显示调试用安全提示:

- 最近障碍物距离
- 是否进入安全区域
- 是否在 trajectory 前方
- TTC 预估

这些安全提示只用于可视化和测试记录，真实安全决策仍应由 Autoware / Gateway / 车辆控制链路负责。

## Roadmap

### Phase 1: Keep Native Frontend And Document Baseline

保留当前原生 HTML + Canvas 架构，不急于 Vue 化。

目标:

- 补齐 README 和工程说明
- 明确当前功能边界
- 明确当前数据流
- 保证现有演示功能稳定可运行

### Phase 2: Add Local WebSocket Mock Data

先不直接接 Autoware，先加入本地 WebSocket 模拟数据源。

目标:

- 用本地 WebSocket 推送车辆定位（已完成）
- 用实时数据更新车辆当前位置（已完成）
- 从“播放模拟”逐步切到“实时状态驱动”（已完成基础链路）
- 验证前端对实时数据的渲染、节流、断线处理和状态显示（已完成基础状态）

建议模拟数据:

- vehicle pose: `{ x, y, yaw, speed, timestamp }`
- vehicle status: `{ mode, battery, localizationStatus }`
- trajectory: `[{ x, y, yaw, velocity }]`

### Phase 3: Split Planning Modes

路径规划拆成两种模式:

- `demo_mode`: 前端使用 A* 自己计算路径，适合演示和离线调试（已完成）
- `autoware_mode`: 前端只发送 goal，等待后端 / ROS 2 Gateway 返回 trajectory（已完成基础链路）

目标:

- 保留前端 A* 作为演示模式（已完成）
- 新增目标点下发接口（已完成）
- 明确 goal、route、trajectory 的数据结构（已完成基础协议）
- UI 上区分“演示规划”和“真实规划”（已完成）

### Phase 4: Connect Autoware Localization

在本地 WebSocket 链路稳定后，再接 Autoware 定位。

第一批接定位，不接感知对象。

建议后端 / ROS 2 Gateway 读取:

- `/localization/kinematic_state`
- `/tf`

然后向前端推送标准化 JSON:

```json
{
  "type": "vehicle_pose",
  "timestamp": 1710000000000,
  "frame_id": "map",
  "x": 23.5,
  "y": 14.9,
  "z": 0.0,
  "roll": 0.0,
  "pitch": 0.0,
  "yaw": 1.57,
  "speed": 1.2
}
```

前端显示:

- 车辆位置: `x / y / z`
- 车辆朝向: `yaw`
- 速度: `speed`
- 定位坐标系: `frame_id`
- 定位状态: `map` 为正常，其他 frame 先标记为提醒

车辆绘制朝向优先级:

```js
if (this.vehicleYaw !== null) {
  angle = this.vehicleYaw;
} else {
  // fallback: 根据路径点计算方向
}
```

目标:

- 通过 ROS 2 Gateway 或 rosbridge 接收定位 topic（前端标准协议已完成）
- 对接 `map` 坐标系下的车辆位姿（前端显示和状态已完成）
- 处理 `map / odom / base_link` frame 关系（后端待接）
- 校验 PCD 地图坐标与 Autoware 定位坐标一致（联调待验证）
- 实时更新车辆位置和定位状态（前端已完成）

### Phase 5: Connect Autoware Trajectory

定位稳定后，再接 Autoware 规划结果。

后端 / ROS 2 Gateway 订阅:

- `/planning/scenario_planning/trajectory`

前端接收:

```json
{
  "type": "trajectory",
  "points": [
    { "x": 1.0, "y": 2.0, "yaw": 0.1, "velocity": 1.5 },
    { "x": 1.5, "y": 2.2, "yaw": 0.2, "velocity": 1.6 }
  ]
}
```

路径数据分层:

- `demoPathPoints`: 前端 A* demo 路径
- `routePoints`: 后端 / Autoware route
- `trajectoryPoints`: Autoware trajectory
- `pathPoints`: 短期保留为播放兼容字段，长期不作为真实规划数据源

Canvas 图层:

- `demoPathPoints`: 绿色虚线
- `routePoints`: 蓝色粗线
- `trajectoryPoints`: 绿色实线

目标:

- 前端发送目标点或任务请求
- 后端 / Gateway 转换为 Autoware 可接受的 goal
- 前端接收 Autoware trajectory（已完成基础协议）
- 在地图上显示真实轨迹（已完成分层显示）
- 车辆位置按定位实时更新，而不是按前端动画伪播放

### Phase 6: Connect Perception Objects

最后接感知对象，不提前扩大复杂度。

后端 / ROS 2 Gateway 订阅:

- `/perception/object_recognition/objects`

前端新增:

```js
this.detectedObjects = [];
```

前端接收:

```json
{
  "type": "perception_objects",
  "objects": [
    {
      "id": "obj-1",
      "label": "vehicle",
      "x": 24.2,
      "y": 16.8,
      "yaw": 0.4,
      "length": 1.4,
      "width": 0.8,
      "speed": 1.1,
      "vx": 1.0,
      "vy": 0.2,
      "predictedPath": [
        { "x": 24.2, "y": 16.8 },
        { "x": 25.0, "y": 17.0 }
      ]
    }
  ]
}
```

目标:

- 接收障碍物、车辆、行人等感知对象（已完成基础协议）
- 在 Canvas 上显示对象位置、朝向、速度和类别（已完成矩形框、标签、速度箭头）
- 区分静态地图、规划轨迹、实时定位、感知对象图层（已完成基础分层）
- 为后续避障状态和安全提示做准备

## Vue Version

`frontend/` 目录中保留了 Vue + Vite 工程化版本。

当前策略:

- 当前阶段主线仍然使用原生 HTML + Canvas
- 先跑通功能和数据链路
- 下一版本加入 WebSocket 模拟数据
- 再下一版本接 ROS 2 Gateway
- 功能稳定后，再决定是否 Vue 化

这样可以避免在数据协议尚未稳定时同时承担框架迁移成本。

## Runtime State Notes

当前车辆真实状态字段:

```js
this.vehicleYaw = null;
this.vehicleSpeed = 0;
this.vehiclePoseTimestamp = 0;
this.connectionStatus = 'offline';
```

规划相关命名约定:

- `calculatePath()`: UI 入口，根据 `planningMode` 分流
- `calculateDemoPath()`: demo 模式路径规划
- `runGridAStar()`: 前端网格 A*，只用于演示
- `requestAutowareTrajectory()`: autoware 模式下发 goal 并等待 trajectory

## Key Technical Decisions

### Browser Does Not Directly Connect To ROS 2 DDS

浏览器前端不直接接 ROS 2 DDS。

后续真实接入建议通过:

- ROS 2 Gateway
- rosbridge websocket
- 自定义 Node/Python 后端桥接服务

### Coordinate System First

接 Autoware 前必须先确认坐标系:

- PCD 点云地图坐标
- OSM 经纬度 / 本地坐标
- 前端 Canvas world 坐标
- Autoware `map` frame
- `odom` / `base_link` 关系

定位数据能显示不代表定位正确，坐标系一致才是接入成功的标准。

### Planning Result Should Come From Backend In Autoware Mode

在 `autoware_mode` 下，前端不负责真实路径规划。

前端职责:

- 选择目标点
- 下发 goal
- 展示 trajectory
- 展示车辆实时位置
- 展示任务状态

后端 / Autoware 职责:

- 接收 goal
- 规划 route / trajectory
- 返回规划结果
- 控制车辆执行

## Next Step

下一步建议进入 Phase 2:

1. 新增本地 WebSocket mock server
2. 定义 mock 消息协议
3. 前端新增实时数据连接模块
4. 让车辆位置由 WebSocket 数据驱动更新
5. 保留当前播放按钮作为 `demo_mode` 能力
