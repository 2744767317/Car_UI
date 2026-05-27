#!/usr/bin/env python3
"""Minimal ROS2 localization to Car UI WebSocket gateway.

This is intentionally localization-only. It converts ROS2 localization and TF
data into the frontend `ros2_gateway.v1` JSON protocol.
"""

import argparse
import asyncio
import json
import math
import sys
import threading
import time


PROTOCOL = "ros2_gateway.v1"


def stamp_to_ms(stamp):
    if stamp is None:
        return None
    sec = getattr(stamp, "sec", None)
    nanosec = getattr(stamp, "nanosec", None)
    if sec is None or nanosec is None:
        return None
    return int(sec) * 1000 + int(nanosec) / 1_000_000


def now_ms():
    return time.time() * 1000


def get_nested(obj, path):
    current = obj
    for name in path.split("."):
        if current is None or not hasattr(current, name):
            return None
        current = getattr(current, name)
    return current


def first_nested(obj, paths):
    for path in paths:
        value = get_nested(obj, path)
        if value is not None:
            return value
    return None


def quaternion_to_yaw(q):
    if q is None:
        return None
    x = float(getattr(q, "x", 0.0))
    y = float(getattr(q, "y", 0.0))
    z = float(getattr(q, "z", 0.0))
    w = float(getattr(q, "w", 1.0))
    return math.atan2(
        2 * (w * z + x * y),
        1 - 2 * (y * y + z * z),
    )


def vector_speed(v):
    if v is None:
        return None
    x = float(getattr(v, "x", 0.0))
    y = float(getattr(v, "y", 0.0))
    return math.hypot(x, y)


class LocalizationGateway:
    def __init__(self, node, args, loop, clients, msg_type, tf_msg_type):
        self.node = node
        self.args = args
        self.loop = loop
        self.clients = clients
        self.latest_pose = None
        self.latest_tf_delay_ms = None
        self.latest_child_frame_id = args.child_frame_id
        self.latest_yaw_source = "localization"

        self.node.create_subscription(
            msg_type,
            args.kinematic_topic,
            self.handle_kinematic_state,
            args.qos_depth,
        )
        self.node.create_subscription(
            tf_msg_type,
            args.tf_topic,
            self.handle_tf,
            args.qos_depth,
        )
        self.node.create_subscription(
            tf_msg_type,
            args.tf_static_topic,
            self.handle_tf,
            args.qos_depth,
        )

    def handle_tf(self, msg):
        for transform in getattr(msg, "transforms", []):
            header = getattr(transform, "header", None)
            frame_id = getattr(header, "frame_id", "")
            child_frame_id = getattr(transform, "child_frame_id", "")
            if frame_id != self.args.frame_id:
                continue
            if child_frame_id != self.args.child_frame_id:
                continue

            tf_ms = stamp_to_ms(getattr(header, "stamp", None))
            if tf_ms is not None:
                self.latest_tf_delay_ms = max(0, now_ms() - tf_ms)
            self.latest_child_frame_id = child_frame_id

    def handle_kinematic_state(self, msg):
        header = getattr(msg, "header", None)
        stamp_ms = stamp_to_ms(getattr(header, "stamp", None))
        timestamp = stamp_ms if stamp_ms is not None else now_ms()
        frame_id = getattr(header, "frame_id", "") or self.args.frame_id
        child_frame_id = (
            getattr(msg, "child_frame_id", "")
            or self.latest_child_frame_id
            or self.args.child_frame_id
        )

        position = first_nested(msg, [
            "pose.pose.position",
            "pose.position",
            "position",
        ])
        orientation = first_nested(msg, [
            "pose.pose.orientation",
            "pose.orientation",
            "orientation",
        ])
        linear = first_nested(msg, [
            "twist.twist.linear",
            "twist.linear",
            "velocity",
            "linear_velocity",
        ])

        if position is None:
            self.node.get_logger().warning("Localization message has no position")
            return

        yaw = quaternion_to_yaw(orientation)
        yaw_source = "localization" if yaw is not None else "fallback"

        packet = {
            "type": "vehicle_pose",
            "timestamp": timestamp,
            "frame_id": frame_id,
            "child_frame_id": child_frame_id,
            "x": float(getattr(position, "x", 0.0)),
            "y": float(getattr(position, "y", 0.0)),
            "z": float(getattr(position, "z", 0.0)),
            "roll": 0.0,
            "pitch": 0.0,
            "yaw": yaw if yaw is not None else 0.0,
            "speed": vector_speed(linear),
            "tf_delay_ms": self.latest_tf_delay_ms,
            "pose_age_ms": max(0, now_ms() - timestamp),
            "map_alignment": self.args.map_alignment,
            "yaw_source": yaw_source,
        }

        self.latest_pose = packet
        asyncio.run_coroutine_threadsafe(self.broadcast(packet), self.loop)

    async def broadcast(self, packet):
        if not self.clients:
            return
        payload = json.dumps(packet, ensure_ascii=False)
        stale = []
        for websocket in list(self.clients):
            try:
                await websocket.send(payload)
            except Exception:
                stale.append(websocket)
        for websocket in stale:
            self.clients.discard(websocket)


async def handle_client(websocket, gateway):
    gateway.clients.add(websocket)
    try:
        if gateway.latest_pose:
            await websocket.send(json.dumps({
                "type": "snapshot",
                "protocol": PROTOCOL,
                "pose": gateway.latest_pose,
            }, ensure_ascii=False))
        async for _message in websocket:
            pass
    finally:
        gateway.clients.discard(websocket)


def make_ws_handler(gateway):
    async def handler(websocket, _path=None):
        await handle_client(websocket, gateway)

    return handler


def parse_args():
    parser = argparse.ArgumentParser(description="ROS2 localization to Car UI gateway")
    parser.add_argument("--ws-host", default="127.0.0.1")
    parser.add_argument("--ws-port", type=int, default=8765)
    parser.add_argument("--kinematic-topic", default="/localization/kinematic_state")
    parser.add_argument("--kinematic-type", default="nav_msgs/msg/Odometry")
    parser.add_argument("--tf-topic", default="/tf")
    parser.add_argument("--tf-static-topic", default="/tf_static")
    parser.add_argument("--frame-id", default="map")
    parser.add_argument("--child-frame-id", default="base_link")
    parser.add_argument("--map-alignment", default="未校准")
    parser.add_argument("--qos-depth", type=int, default=10)
    return parser.parse_args()


async def main_async(args):
    try:
        import rclpy
        from rclpy.node import Node
        from rosidl_runtime_py.utilities import get_message
        from tf2_msgs.msg import TFMessage
        import websockets
    except ImportError as error:
        print(f"Missing dependency: {error}", file=sys.stderr)
        print("Run this inside a ROS2 environment with rclpy, tf2_msgs, and websockets.", file=sys.stderr)
        raise SystemExit(2)

    rclpy.init()
    node = Node("car_ui_localization_gateway")
    clients = set()
    loop = asyncio.get_running_loop()
    msg_type = get_message(args.kinematic_type)
    gateway = LocalizationGateway(node, args, loop, clients, msg_type, TFMessage)

    spin_thread = threading.Thread(target=rclpy.spin, args=(node,), daemon=True)
    spin_thread.start()

    print(f"ROS2 Localization Gateway listening on ws://{args.ws_host}:{args.ws_port}/ws")
    print(f"Protocol: {PROTOCOL}")
    print(f"Topic: {args.kinematic_topic} ({args.kinematic_type})")

    try:
        async with websockets.serve(make_ws_handler(gateway), args.ws_host, args.ws_port):
            await asyncio.Future()
    finally:
        node.destroy_node()
        rclpy.shutdown()


def main():
    args = parse_args()
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
