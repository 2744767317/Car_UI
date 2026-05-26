#!/usr/bin/env node

const crypto = require('node:crypto');
const http = require('node:http');

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
    const item = process.argv[i];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const next = process.argv[i + 1];
    if (next && !next.startsWith('--')) {
        args.set(key, next);
        i += 1;
    } else {
        args.set(key, 'true');
    }
}

const port = Number(args.get('port') || process.env.MOCK_WS_PORT || 8765);
const host = args.get('host') || process.env.MOCK_WS_HOST || '127.0.0.1';
const tickMs = Number(args.get('tick-ms') || process.env.MOCK_WS_TICK_MS || 100);

const clients = new Set();
const startTime = Date.now();
let latestGoal = null;

const route = [
    { x: 23.58353111862323, y: 14.975903991841252 },
    { x: 26.0, y: 15.5 },
    { x: 28.2, y: 18.0 },
    { x: 25.5, y: 20.3 },
    { x: 21.8, y: 18.2 },
    { x: 22.3, y: 16.1 },
    { x: 23.58353111862323, y: 14.975903991841252 }
];

function createAcceptKey(key) {
    return crypto
        .createHash('sha1')
        .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
        .digest('base64');
}

function encodeFrame(text) {
    const payload = Buffer.from(text);
    const length = payload.length;

    if (length < 126) {
        return Buffer.concat([Buffer.from([0x81, length]), payload]);
    }

    if (length < 65536) {
        const header = Buffer.alloc(4);
        header[0] = 0x81;
        header[1] = 126;
        header.writeUInt16BE(length, 2);
        return Buffer.concat([header, payload]);
    }

    const header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
    return Buffer.concat([header, payload]);
}

function send(socket, packet) {
    if (!socket.writable || socket.destroyed) return;
    socket.write(encodeFrame(JSON.stringify(packet)));
}

function distance(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function buildRouteMetrics(points) {
    const lengths = [];
    let total = 0;

    for (let i = 1; i < points.length; i += 1) {
        const len = distance(points[i - 1], points[i]);
        lengths.push(len);
        total += len;
    }

    return { lengths, total };
}

const routeMetrics = buildRouteMetrics(route);

function getPose(now) {
    const elapsed = (now - startTime) / 1000;
    const speed = 1.35;
    const loopDistance = (elapsed * speed) % routeMetrics.total;
    let cursor = 0;

    for (let i = 1; i < route.length; i += 1) {
        const segmentLength = routeMetrics.lengths[i - 1];
        if (loopDistance <= cursor + segmentLength) {
            const a = route[i - 1];
            const b = route[i];
            const t = segmentLength <= 0 ? 0 : (loopDistance - cursor) / segmentLength;
            const x = a.x + (b.x - a.x) * t;
            const y = a.y + (b.y - a.y) * t;
            const yaw = Math.atan2(b.y - a.y, b.x - a.x);
            return {
                type: 'vehicle_pose',
                timestamp: now,
                frame_id: 'map',
                x,
                y,
                z: 0,
                roll: 0,
                pitch: 0,
                yaw,
                speed
            };
        }
        cursor += segmentLength;
    }

    const last = route[route.length - 1];
    return {
        type: 'vehicle_pose',
        timestamp: now,
        frame_id: 'map',
        x: last.x,
        y: last.y,
        z: 0,
        roll: 0,
        pitch: 0,
        yaw: 0,
        speed
    };
}

function getStatus(now) {
    const battery = 54.4 - (((now - startTime) / 1000) * 0.002);
    return {
        mode: 'auto',
        battery: Math.max(10, battery),
        localizationStatus: 'normal',
        gear: '自动'
    };
}

function createSnapshot(now) {
    return {
        type: 'snapshot',
        pose: getPose(now),
        status: getStatus(now)
    };
}

function buildTrajectoryFromGoal(goal) {
    const start = goal?.start || getPose(Date.now());
    const end = goal?.goal || goal?.end;
    if (!end || !Number.isFinite(Number(end.x)) || !Number.isFinite(Number(end.y))) {
        return route.map((point) => ({
            x: point.x,
            y: point.y,
            yaw: 0,
            velocity: 1.2
        }));
    }

    const sx = Number(start.x);
    const sy = Number(start.y);
    const ex = Number(end.x);
    const ey = Number(end.y);
    const points = [];
    const count = 24;

    for (let i = 0; i <= count; i += 1) {
        const t = i / count;
        const bend = Math.sin(t * Math.PI) * 1.2;
        const x = sx + (ex - sx) * t;
        const y = sy + (ey - sy) * t + bend;
        const nextT = Math.min(1, (i + 1) / count);
        const nx = sx + (ex - sx) * nextT;
        const ny = sy + (ey - sy) * nextT + Math.sin(nextT * Math.PI) * 1.2;
        points.push({
            x,
            y,
            yaw: Math.atan2(ny - y, nx - x),
            velocity: 1.2
        });
    }

    return points;
}

const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/route/submit') {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk.toString('utf8');
        });
        req.on('end', () => {
            try {
                latestGoal = JSON.parse(body || '{}');
            } catch {
                latestGoal = null;
            }

            const trajectory = buildTrajectoryFromGoal(latestGoal);
            const packet = { type: 'trajectory', points: trajectory, goal: latestGoal, timestamp: Date.now() };
            for (const socket of clients) {
                send(socket, packet);
            }

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ ok: true, trajectoryPoints: trajectory.length }));
        });
        return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
        name: 'car-ui-mock-ws-server',
        websocket: `ws://${host}:${port}/ws`,
        routeEndpoint: `http://${host}:${port}/api/route/submit`,
        clients: clients.size
    }));
});

server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) {
        socket.destroy();
        return;
    }

    const acceptKey = createAcceptKey(key);
    socket.write([
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${acceptKey}`,
        '',
        ''
    ].join('\r\n'));

    clients.add(socket);
    send(socket, createSnapshot(Date.now()));

    socket.on('data', (chunk) => {
        const opcode = chunk[0] & 0x0f;
        if (opcode === 0x8) {
            socket.end();
        }
    });

    socket.on('close', () => clients.delete(socket));
    socket.on('error', () => clients.delete(socket));
});

setInterval(() => {
    const now = Date.now();
    for (const socket of clients) {
        send(socket, { type: 'vehicle_pose', data: getPose(now) });
        send(socket, { type: 'vehicle_status', data: getStatus(now) });
        send(socket, { type: 'perception_objects', objects: getPerceptionObjects(now) });
    }
}, Math.max(50, tickMs));

function getPerceptionObjects(now) {
    const t = (now - startTime) / 1000;
    const baseX = 25 + Math.sin(t * 0.45) * 1.4;
    const baseY = 17 + Math.cos(t * 0.38) * 1.1;
    const yaw = t * 0.25;

    return [
        {
            id: 'mock-car-1',
            label: 'vehicle',
            x: baseX,
            y: baseY,
            yaw,
            length: 1.4,
            width: 0.8,
            speed: 0.7,
            vx: Math.cos(yaw) * 0.7,
            vy: Math.sin(yaw) * 0.7,
            predictedPath: [
                { x: baseX, y: baseY },
                { x: baseX + Math.cos(yaw) * 0.8, y: baseY + Math.sin(yaw) * 0.8 },
                { x: baseX + Math.cos(yaw) * 1.6, y: baseY + Math.sin(yaw) * 1.6 }
            ]
        },
        {
            id: 'mock-ped-1',
            label: 'pedestrian',
            x: 22.8 + Math.sin(t * 0.6) * 0.5,
            y: 18.6,
            yaw: Math.PI / 2,
            length: 0.5,
            width: 0.5,
            speed: 0.35,
            vx: 0,
            vy: 0.35,
            predictedPath: [
                { x: 22.8, y: 18.6 },
                { x: 22.8, y: 19.1 },
                { x: 22.8, y: 19.6 }
            ]
        }
    ];
}

server.listen(port, host, () => {
    console.log(`Mock WebSocket server listening on ws://${host}:${port}`);
    console.log('Open index.html via a local static server, then click "连接模拟数据".');
});
