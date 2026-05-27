# Bridge Options For Autoware Localization

The current frontend already consumes a stable JSON protocol over `window.APP_CONFIG.wsEndpoint`. That means ROS2 integration can live behind a bridge without adding ROS-specific logic to the browser.

## Recommendation

Use a custom Python ROS2 Gateway first.

Reasons:

- It can subscribe to ROS2 topics directly with `rclpy`.
- It can normalize Autoware message variants before the browser sees them.
- It owns quaternion-to-yaw conversion, TF checks, timestamp conversion, and map-frame validation.
- It can publish exactly the frontend protocol documented in `docs/ros2-gateway-protocol.md`.
- It keeps the frontend independent from rosbridge protocol details.

## Option Comparison

| Option | Feasible | Best Use | Main Risk |
| --- | --- | --- | --- |
| Custom Python ROS2 Gateway | Yes | First real localization integration | Needs deployment on a ROS2 machine |
| Custom Node.js Gateway | Yes | Non-ROS host proxy, dashboards, HTTP tooling | Native ROS2 support is weaker than Python |
| rosbridge websocket direct to frontend | Possible | Fast topic inspection and prototypes | Frontend would need rosbridge protocol handling |
| rosbridge plus adapter service | Yes | When rosbridge is already deployed | Adds one more moving part |

## Why Not Direct rosbridge First

rosbridge uses messages such as:

```json
{
  "op": "subscribe",
  "topic": "/localization/kinematic_state",
  "type": "nav_msgs/Odometry"
}
```

Incoming topic messages are then wrapped in rosbridge envelopes. The current frontend expects:

```json
{
  "type": "vehicle_pose",
  "frame_id": "map",
  "child_frame_id": "base_link",
  "x": 23.5,
  "y": 14.9,
  "yaw": 1.57,
  "speed": 1.2
}
```

So direct rosbridge would require frontend changes. Keeping an adapter lets the frontend remain a vehicle debug UI instead of becoming a ROS client.

## Localization Bridge Contract

The first bridge should subscribe to:

- `/localization/kinematic_state`
- `/tf`
- `/tf_static`

The bridge should publish:

- `vehicle_pose`

Recommended command for checking the deployed topic type:

```bash
ros2 topic info -v /localization/kinematic_state
```

If the topic is `nav_msgs/msg/Odometry`, the included `tools/ros2-localization-gateway.py` can be used as the first implementation.

If the topic is a custom Autoware type, keep the frontend protocol unchanged and adapt only the extraction paths in the gateway.

## Frontend Configuration

For local ROS2 Gateway testing:

```text
http://127.0.0.1:5173?appConfig=autoware-local
```

Expected config:

```js
window.APP_CONFIG = {
  planningMode: 'autoware',
  wsEndpoint: 'ws://127.0.0.1:8765/ws',
  planningEndpoint: 'http://127.0.0.1:8765/api/route/submit',
  realtimeAutoConnect: false
};
```

## Minimal Test Plan

1. Start Autoware or replay a rosbag with localization topics.
2. Run `ros2 topic info -v /localization/kinematic_state`.
3. Start the Python Gateway.
4. Open the frontend with `?appConfig=autoware-local`.
5. Click `连接模拟数据`.
6. Confirm the vehicle moves and the coordinate check panel shows:
   - `pose.frame_id: map`
   - `child_frame_id: base_link`
   - fresh `pose age`
   - reasonable `map->base_link TF 延迟`

## Future Services

Once localization is stable, the same Gateway can add:

- HTTP `POST /api/route/submit` for `set_goal`
- WebSocket `route`
- WebSocket `trajectory`
- WebSocket `vehicle_status`
- WebSocket `perception_objects`
- HTTP `GET /health` for frontend/operator diagnostics
