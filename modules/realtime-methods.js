window.PCVModules = window.PCVModules || {};
window.PCVModules.realtimeMethods = {
createRealtimeConfig() {
        const defaults = {
            endpoint: 'ws://127.0.0.1:8765/ws',
            autoConnect: false,
            reconnectMs: 1500,
            poseTimeoutMs: 3000
        };

        const source = window.APP_CONFIG && typeof window.APP_CONFIG === 'object'
            ? window.APP_CONFIG
            : {};

        return {
            endpoint: source.wsEndpoint || source.realtimeEndpoint || defaults.endpoint,
            autoConnect: source.realtimeAutoConnect !== undefined
                ? !!source.realtimeAutoConnect
                : source.enableWebSocket !== undefined
                ? !!source.enableWebSocket
                : defaults.autoConnect,
            reconnectMs: Number.isFinite(Number(source.realtimeReconnectMs))
                ? Math.max(300, Number(source.realtimeReconnectMs))
                : defaults.reconnectMs,
            poseTimeoutMs: Number.isFinite(Number(source.realtimePoseTimeoutMs))
                ? Math.max(1000, Number(source.realtimePoseTimeoutMs))
                : defaults.poseTimeoutMs
        };
    },

    initRealtimeSource() {
        this.connectionStatus = 'offline';
        this.updateRealtimeStatus('未连接', 'offline');
        this.updatePlanningModeStatus();
        this.updatePlanningStatus('待命', 'offline');
        this.updateLocalizationCheckPanel();
        this.updatePerceptionSafetyPanel();
        this.updateRealtimeButton();

        if (!this.realtimeHealthTimer) {
            this.realtimeHealthTimer = window.setInterval(() => {
                this.checkRealtimeHealth();
            }, 1000);
        }

        if (this.realtimeConfig.autoConnect) {
            this.connectRealtimeSource();
        }
    },

toggleRealtimeSource() {
        if (this.realtimeEnabled) {
            this.disconnectRealtimeSource();
            return;
        }
        this.connectRealtimeSource();
    },

    connectRealtimeSource() {
        if (!this.realtimeConfig.endpoint) {
            this.updateRealtimeStatus('未配置', 'error');
            return false;
        }
        if (typeof WebSocket === 'undefined') {
            this.updateRealtimeStatus('不支持', 'error');
            return false;
        }
        if (this.realtimeSocket && (
            this.realtimeSocket.readyState === WebSocket.OPEN ||
            this.realtimeSocket.readyState === WebSocket.CONNECTING
        )) {
            return true;
        }

        this.realtimeEnabled = true;
        this.connectionStatus = 'connecting';
        this.stopPlay();
        this.updateRealtimeStatus('连接中', 'warning');
        this.updateRealtimeButton();

        const socket = new WebSocket(this.realtimeConfig.endpoint);
        this.realtimeSocket = socket;

        socket.addEventListener('open', () => {
            if (this.realtimeSocket !== socket) return;
            this.realtimeConnected = true;
            this.connectionStatus = 'online';
            this.realtimeReconnectAttempts = 0;
            this.realtimeLastMessageAt = Date.now();
            this.realtimeLastPoseAt = 0;
            this.updateRealtimeStatus('已连接', 'normal');
            this.updateRealtimeButton();
        });

        socket.addEventListener('message', (event) => {
            if (this.realtimeSocket !== socket) return;
            this.handleRealtimeMessage(event.data);
        });

        socket.addEventListener('close', () => {
            if (this.realtimeSocket !== socket) return;
            this.realtimeConnected = false;
            this.connectionStatus = this.realtimeEnabled ? 'reconnecting' : 'offline';
            this.realtimeSocket = null;
            this.updateRealtimeButton();

            if (this.realtimeEnabled) {
                this.updateRealtimeStatus('重连中', 'warning');
                this.scheduleRealtimeReconnect();
            } else {
                this.updateRealtimeStatus('未连接', 'offline');
            }
        });

        socket.addEventListener('error', () => {
            if (this.realtimeSocket !== socket) return;
            this.realtimeConnected = false;
            this.connectionStatus = 'error';
            this.updateRealtimeStatus('连接错误', 'error');
            this.updateRealtimeButton();
        });

        return true;
    },

isAutowarePlanningMode() {
        return this.backendConfig?.planningMode === 'autoware';
    },

disconnectRealtimeSource() {
        this.realtimeEnabled = false;
        this.realtimeConnected = false;
        this.connectionStatus = 'offline';
        this.realtimeReconnectAttempts = 0;

        if (this.realtimeReconnectTimer) {
            window.clearTimeout(this.realtimeReconnectTimer);
            this.realtimeReconnectTimer = 0;
        }

        if (this.realtimeSocket) {
            const socket = this.realtimeSocket;
            this.realtimeSocket = null;
            socket.close();
        }

        this.updateRealtimeStatus('未连接', 'offline');
        this.updateRealtimeButton();
    },

scheduleRealtimeReconnect() {
        if (this.realtimeReconnectTimer || !this.realtimeEnabled) return;

        const delay = Math.min(
            8000,
            this.realtimeConfig.reconnectMs * Math.max(1, this.realtimeReconnectAttempts + 1)
        );

        this.realtimeReconnectTimer = window.setTimeout(() => {
            this.realtimeReconnectTimer = 0;
            this.realtimeReconnectAttempts += 1;
            this.connectRealtimeSource();
        }, delay);
    },

checkRealtimeHealth() {
        if (!this.realtimeEnabled || !this.realtimeConnected) return;
        const now = Date.now();

        if (this.realtimeLastPoseAt) {
            const poseAge = now - this.realtimeLastPoseAt;
            this.setLocalizationCheckValue('check-pose-age', `${Math.round(poseAge)} ms`, poseAge > this.realtimeConfig.poseTimeoutMs ? 'warning' : 'normal');

            if (poseAge > this.realtimeConfig.poseTimeoutMs) {
                this.updateRealtimeStatus('定位超时', 'warning');
                this.setStatusValue('localization-status', '超时', 'warning');
                this.connectionStatus = 'stale';
            }
            return;
        }

        if (!this.realtimeLastMessageAt) return;
        const messageAge = now - this.realtimeLastMessageAt;
        if (messageAge > this.realtimeConfig.poseTimeoutMs) {
            this.updateRealtimeStatus('数据超时', 'warning');
            this.setStatusValue('localization-status', '超时', 'warning');
            this.setLocalizationCheckValue('check-pose-age', `${Math.round(messageAge)} ms`, 'warning');
            this.connectionStatus = 'stale';
        }
    },

handleRealtimeMessage(rawData) {
        let packet = null;
        try {
            packet = JSON.parse(String(rawData || '{}'));
        } catch (error) {
            console.warn('实时数据格式错误:', error);
            return;
        }

        if (!packet || typeof packet !== 'object') return;

        this.realtimeLastMessageAt = Date.now();
        this.connectionStatus = 'online';
        this.updateRealtimeStatus('实时', 'normal');

        const type = String(packet.type || '').toLowerCase();
        const data = packet.data && typeof packet.data === 'object' ? packet.data : packet;
        this.recordRealtimeMessage(type || 'vehicle_pose');

        if (type === 'snapshot') {
            this.applyRealtimeVehicleStatus(packet.status || data.status);
            this.applyRealtimeRoute(packet.route || data.route);
            this.applyRealtimeTrajectory(packet.trajectory || data.trajectory);
            this.applyDetectedObjects(packet.objects || data.objects || packet.detectedObjects || data.detectedObjects);
            this.applyRealtimePose(packet.pose || data.pose);
            return;
        }

        if (type === 'vehicle_pose' || type === 'pose' || type === '') {
            this.applyRealtimePose(data);
        }

        if (type === 'vehicle_status' || type === 'status') {
            this.applyRealtimeVehicleStatus(data);
        }

        if (type === 'trajectory') {
            this.applyRealtimeTrajectory(data.points || data.trajectory || data);
        }

        if (type === 'route' || type === 'route_points') {
            this.applyRealtimeRoute(data.points || data.route || data);
        }

        if (type === 'perception_objects' || type === 'detected_objects' || type === 'objects') {
            this.applyDetectedObjects(data.objects || data.detectedObjects || data);
        }
    },

recordRealtimeMessage(type) {
        const key = String(type || 'unknown');
        this.realtimeMessageStats = this.realtimeMessageStats || {};
        const current = this.realtimeMessageStats[key] || { count: 0, lastAt: 0 };
        this.realtimeMessageStats[key] = {
            count: current.count + 1,
            lastAt: Date.now()
        };
    },

applyRealtimePose(rawPose) {
        if (!rawPose || typeof rawPose !== 'object') return false;

        const x = this.readRealtimeNumber(rawPose.x, rawPose.position?.x, rawPose.pose?.position?.x);
        const y = this.readRealtimeNumber(rawPose.y, rawPose.position?.y, rawPose.pose?.position?.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false;

        const z = this.readRealtimeNumber(rawPose.z, rawPose.position?.z, rawPose.pose?.position?.z);
        const roll = this.readRealtimeNumber(rawPose.roll);
        const pitch = this.readRealtimeNumber(rawPose.pitch);
        const yaw = this.readRealtimeNumber(rawPose.yaw, rawPose.heading, rawPose.theta);
        const speed = this.readRealtimeNumber(rawPose.speed, rawPose.velocity, rawPose.linearVelocity);
        const frameId = String(rawPose.frame_id || rawPose.frameId || rawPose.header?.frame_id || 'map');
        const childFrameId = String(rawPose.child_frame_id || rawPose.childFrameId || rawPose.childFrame || 'base_link');
        const timestamp = this.readRealtimeTimestamp(rawPose.timestamp, rawPose.stamp, rawPose.header?.stamp);
        const tfDelayMs = this.readRealtimeNumber(rawPose.tf_delay_ms, rawPose.tfDelayMs, rawPose.transform_delay_ms);
        const poseAgeMs = this.readRealtimeNumber(rawPose.pose_age_ms, rawPose.poseAgeMs);
        const yawSource = rawPose.yaw_source || rawPose.yawSource || rawPose.headingSource || 'localization';
        const mapAlignment = rawPose.map_alignment || rawPose.mapAlignment || rawPose.pcd_osm_alignment || rawPose.pcdOsmAlignment || '';
        const point = this.clampPointToBounds({ x, y });
        const poseTimestamp = Number.isFinite(timestamp) && timestamp > 10000000000 ? timestamp : Date.now();

        this.stopPlay();
        this.carPosition = point;
        this.vehiclePose = {
            type: 'vehicle_pose',
            frame_id: frameId,
            child_frame_id: childFrameId,
            x: point.x,
            y: point.y,
            z: Number.isFinite(z) ? z : 0,
            roll: Number.isFinite(roll) ? roll : 0,
            pitch: Number.isFinite(pitch) ? pitch : 0,
            yaw: Number.isFinite(yaw) ? yaw : null,
            speed: Number.isFinite(speed) ? speed : null,
            timestamp: poseTimestamp,
            tf_delay_ms: Number.isFinite(tfDelayMs) ? tfDelayMs : null,
            pose_age_ms: Number.isFinite(poseAgeMs) ? poseAgeMs : Math.max(0, Date.now() - poseTimestamp),
            yaw_source: String(yawSource || 'localization'),
            map_alignment: String(mapAlignment || '')
        };
        this.realtimeLastPose = this.vehiclePose;
        this.realtimeLastPoseAt = Date.now();
        this.vehicleSpeed = Number.isFinite(speed) ? speed : 0;
        this.vehiclePoseTimestamp = this.vehiclePose.timestamp;

        if (Number.isFinite(yaw)) {
            this.vehicleYaw = yaw;
        }

        this.setStatusValue('localization-status', frameId === 'map' ? '正常' : `Frame ${frameId}`, frameId === 'map' ? 'normal' : 'warning');
        this.updateRealtimePoseText();
        this.updateLocalizationCheckPanel();
        this.updatePerceptionSafety();
        this.requestRender();
        return true;
    },

applyRealtimeVehicleStatus(rawStatus) {
        if (!rawStatus || typeof rawStatus !== 'object') return false;

        const modeText = rawStatus.mode || rawStatus.drivingMode || '';
        const mode = String(modeText).toLowerCase();
        const localization = String(rawStatus.localizationStatus || rawStatus.localization || '').toLowerCase();
        const gear = rawStatus.gear || rawStatus.shift || rawStatus.driveGear;
        const battery = this.readRealtimeNumber(rawStatus.battery, rawStatus.batteryPercent, rawStatus.soc);

        if (mode) {
            const isAuto = ['auto', 'autonomous', 'smart', '智能驾驶'].includes(mode);
            const isManual = ['manual', '人工驾驶'].includes(mode);
            this.setStatusValue('drive-status', isManual ? '人工驾驶' : isAuto ? '智能驾驶' : String(modeText), isManual ? 'manual' : 'driving');
        }

        if (localization) {
            const ok = ['ok', 'normal', 'good', 'ready', '正常'].includes(localization);
            const warn = ['stale', 'timeout', 'degraded', 'warn', 'warning', '超时'].includes(localization);
            this.setStatusValue('localization-status', ok ? '正常' : warn ? '超时' : '异常', ok ? 'normal' : warn ? 'warning' : 'error');
        }

        if (Number.isFinite(battery)) {
            this.setStatusValue('battery-status', `${battery.toFixed(1)}%`, battery < 20 ? 'warning' : 'normal');
        }

        if (gear !== undefined && gear !== null && String(gear).trim()) {
            this.setStatusValue('gear-status', String(gear), 'normal');
        }

        return true;
    },

    applyRealtimeTrajectory(rawTrajectory) {
        if (!this.isAutowarePlanningMode()) return false;
        if (!Array.isArray(rawTrajectory)) return false;

        const points = rawTrajectory
            .map((point) => {
                if (!point || typeof point !== 'object') return null;
                const x = this.readRealtimeNumber(point.x, point.position?.x, point.pose?.position?.x);
                const y = this.readRealtimeNumber(point.y, point.position?.y, point.pose?.position?.y);
                if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
                const yaw = this.readRealtimeNumber(point.yaw, point.heading, point.theta);
                const velocity = this.readRealtimeNumber(point.velocity, point.speed, point.longitudinal_velocity_mps);
                return {
                    x,
                    y,
                    yaw: Number.isFinite(yaw) ? yaw : null,
                    velocity: Number.isFinite(velocity) ? velocity : null
                };
            })
            .filter(Boolean);

        if (points.length < 2) return false;

        this.trajectoryPoints = points;
        this.pathPoints = this.trajectoryPoints;
        this.currentFrame = 0;
        this.pendingAutowareGoal = null;
        this.updatePathDistance(this.trajectoryPoints);
        this.updatePlanningStatus('已接收轨迹', 'normal');
        this.updatePerceptionSafety();
        this.requestRender();
        return true;
    },

applyRealtimeRoute(rawRoute) {
        const points = this.normalizePointList(rawRoute);
        if (points.length < 2) return false;

        this.routePoints = points;
        this.updatePathDistance();
        this.requestRender();
        return true;
    },

applyDetectedObjects(rawObjects) {
        if (!Array.isArray(rawObjects)) return false;

        this.detectedObjects = rawObjects
            .map((object) => this.normalizeDetectedObject(object))
            .filter(Boolean);

        this.updatePerceptionSafety();
        this.requestRender();
        return true;
    },

normalizeDetectedObject(object) {
        if (!object || typeof object !== 'object') return null;

        const position = object.position || object.pose?.position || object.kinematics?.pose_with_covariance?.pose?.position;
        const dimensions = object.dimensions || object.shape?.dimensions || {};
        const velocity = object.velocity || object.twist || object.kinematics?.twist_with_covariance?.twist?.linear || {};
        const x = this.readRealtimeNumber(object.x, position?.x);
        const y = this.readRealtimeNumber(object.y, position?.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

        const yaw = this.readRealtimeNumber(object.yaw, object.heading, object.theta);
        const vx = this.readRealtimeNumber(object.vx, velocity?.x);
        const vy = this.readRealtimeNumber(object.vy, velocity?.y);
        const speed = this.readRealtimeNumber(object.speed);
        const predictedPath = this.normalizePredictedPath(object.predictedPath || object.predicted_path || object.predicted_paths?.[0]?.path);

        const label = this.resolveObjectLabel(object);

        return {
            id: object.id || object.uuid || object.object_id || '',
            label,
            category: this.normalizeObjectCategory(label),
            x,
            y,
            yaw: Number.isFinite(yaw) ? yaw : 0,
            length: this.readRealtimeNumber(object.length, dimensions.x, dimensions.length) || 1.2,
            width: this.readRealtimeNumber(object.width, dimensions.y, dimensions.width) || 0.7,
            speed: Number.isFinite(speed) ? speed : null,
            vx: Number.isFinite(vx) ? vx : null,
            vy: Number.isFinite(vy) ? vy : null,
            predictedPath
        };
    },

normalizePointList(rawPoints) {
        if (!Array.isArray(rawPoints)) return [];
        return rawPoints
            .map((point) => {
                if (!point || typeof point !== 'object') return null;
                const x = this.readRealtimeNumber(point.x, point.position?.x, point.pose?.position?.x);
                const y = this.readRealtimeNumber(point.y, point.position?.y, point.pose?.position?.y);
                if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
                return { x, y };
            })
            .filter(Boolean);
    },

normalizePredictedPath(path) {
        return this.normalizePointList(path);
    },

resolveObjectLabel(object) {
        const classification = Array.isArray(object.classification)
            ? object.classification[0]?.label || object.classification[0]?.type
            : object.classification;
        const label = object.label || object.type || classification || object.semantic?.type || 'object';
        return String(label || 'object');
    },

normalizeObjectCategory(label) {
        const value = String(label || '').toLowerCase();
        if (value.includes('pedestrian') || value.includes('person')) return 'pedestrian';
        if (value.includes('bicycle') || value.includes('bike') || value.includes('cyclist')) return 'bicycle';
        if (value.includes('vehicle') || value.includes('car') || value.includes('truck') || value.includes('bus')) return 'vehicle';
        return 'unknown';
    },

getVisibleDetectedObjects() {
        if (!Array.isArray(this.detectedObjects)) return [];
        return this.detectedObjects.filter((object) => {
            const category = object.category || this.normalizeObjectCategory(object.label);
            return this.objectFilters?.[category] !== false;
        });
    },

updatePerceptionSafety() {
        const objects = this.getVisibleDetectedObjects();
        const ego = this.vehiclePose || this.realtimeLastPose || this.carPosition;
        const trajectory = this.trajectoryPoints?.length ? this.trajectoryPoints : this.pathPoints;

        if (!ego || !Number.isFinite(ego.x) || !Number.isFinite(ego.y) || !objects.length) {
            this.objectSafety = {
                nearestDistance: null,
                inSafetyZone: false,
                aheadOnTrajectory: false,
                ttc: null
            };
            this.updatePerceptionSafetyPanel();
            return;
        }

        let nearestDistance = Infinity;
        let inSafetyZone = false;
        let aheadOnTrajectory = false;
        let ttc = Infinity;

        for (const object of objects) {
            const dx = object.x - ego.x;
            const dy = object.y - ego.y;
            const distance = Math.hypot(dx, dy);
            if (distance < nearestDistance) nearestDistance = distance;
            if (distance <= this.safetyZoneRadius) inSafetyZone = true;

            const ahead = this.isObjectAheadOnTrajectory(object, trajectory, ego);
            if (ahead) aheadOnTrajectory = true;

            const closingSpeed = this.estimateClosingSpeed(object, dx, dy, distance);
            if (closingSpeed > 0.05) {
                ttc = Math.min(ttc, distance / closingSpeed);
            }
        }

        this.objectSafety = {
            nearestDistance: Number.isFinite(nearestDistance) ? nearestDistance : null,
            inSafetyZone,
            aheadOnTrajectory,
            ttc: Number.isFinite(ttc) ? ttc : null
        };
        this.updatePerceptionSafetyPanel();
    },

isObjectAheadOnTrajectory(object, trajectory, ego) {
        if (!Array.isArray(trajectory) || trajectory.length < 2) return false;

        for (const point of trajectory) {
            if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
            const fromEgo = Math.hypot(point.x - ego.x, point.y - ego.y);
            if (fromEgo > this.trajectoryAheadDistance) continue;

            const lateral = Math.hypot(object.x - point.x, object.y - point.y);
            if (lateral <= this.trajectoryLateralThreshold) return true;
        }

        return false;
    },

estimateClosingSpeed(object, dx, dy, distance) {
        if (!Number.isFinite(distance) || distance <= 0.001) return null;

        const objectVx = Number.isFinite(object.vx)
            ? object.vx
            : Math.cos(object.yaw || 0) * (Number.isFinite(object.speed) ? object.speed : 0);
        const objectVy = Number.isFinite(object.vy)
            ? object.vy
            : Math.sin(object.yaw || 0) * (Number.isFinite(object.speed) ? object.speed : 0);
        const egoSpeed = Number.isFinite(this.vehicleSpeed) ? this.vehicleSpeed : 0;
        const egoYaw = Number.isFinite(this.vehicleYaw) ? this.vehicleYaw : 0;
        const egoVx = Math.cos(egoYaw) * egoSpeed;
        const egoVy = Math.sin(egoYaw) * egoSpeed;
        const unitX = dx / distance;
        const unitY = dy / distance;
        const relativeVx = objectVx - egoVx;
        const relativeVy = objectVy - egoVy;

        return -(relativeVx * unitX + relativeVy * unitY);
    },

updatePerceptionSafetyPanel() {
        const safety = this.objectSafety || {};
        const nearest = Number(safety.nearestDistance);
        const ttc = Number(safety.ttc);

        this.setSafetyValue(
            'safety-nearest-distance',
            Number.isFinite(nearest) ? `${nearest.toFixed(2)} m` : '--',
            Number.isFinite(nearest) && nearest <= this.safetyZoneRadius ? 'warning' : 'normal'
        );
        this.setSafetyValue('safety-zone-status', safety.inSafetyZone ? '是' : '否', safety.inSafetyZone ? 'error' : 'normal');
        this.setSafetyValue('safety-ahead-status', safety.aheadOnTrajectory ? '是' : '否', safety.aheadOnTrajectory ? 'warning' : 'normal');
        this.setSafetyValue(
            'safety-ttc',
            Number.isFinite(ttc) ? `${ttc.toFixed(1)} s` : '--',
            Number.isFinite(ttc) && ttc < 5 ? 'error' : Number.isFinite(ttc) && ttc < 10 ? 'warning' : 'normal'
        );
    },

setSafetyValue(id, text, tone = 'normal') {
        const el = document.getElementById(id);
        if (!el) return;

        el.textContent = text;
        el.classList.remove('warning', 'error');
        if (tone === 'warning' || tone === 'error') {
            el.classList.add(tone);
        }
    },

readRealtimeNumber(...values) {
        for (const value of values) {
            const num = Number(value);
            if (Number.isFinite(num)) return num;
        }
        return null;
    },

readRealtimeTimestamp(...values) {
        for (const value of values) {
            if (value && typeof value === 'object') {
                const sec = Number(value.sec ?? value.secs);
                const nanosec = Number(value.nanosec ?? value.nsec ?? value.nanoseconds);
                if (Number.isFinite(sec)) {
                    const msFromNs = Number.isFinite(nanosec) ? nanosec / 1_000_000 : 0;
                    return (sec * 1000) + msFromNs;
                }
            }

            const num = Number(value);
            if (!Number.isFinite(num)) continue;
            return num > 10000000000 ? num : num * 1000;
        }
        return null;
    },

updateRealtimePoseText() {
        const poseText = document.getElementById('realtime-pose');
        const speedText = document.getElementById('realtime-speed');
        const yawText = document.getElementById('realtime-yaw');
        const frameText = document.getElementById('realtime-frame');
        const pose = this.vehiclePose || this.realtimeLastPose;

        if (poseText) {
            poseText.textContent = pose
                ? `${pose.x.toFixed(2)}, ${pose.y.toFixed(2)}, ${pose.z.toFixed(2)}`
                : '--';
        }

        if (speedText) {
            speedText.textContent = pose && Number.isFinite(pose.speed)
                ? `${pose.speed.toFixed(2)} m/s`
                : '--';
        }

        if (yawText) {
            yawText.textContent = pose && Number.isFinite(pose.yaw)
                ? `${pose.yaw.toFixed(3)} rad`
                : '--';
        }

        if (frameText) {
            frameText.textContent = pose?.frame_id || '--';
        }
    },

updateLocalizationCheckPanel() {
        const pose = this.vehiclePose || this.realtimeLastPose;
        const poseFrame = pose?.frame_id || '--';
        const childFrame = pose?.child_frame_id || '--';
        const tfDelay = Number(pose?.tf_delay_ms);
        const poseAge = Number(pose?.pose_age_ms);
        const alignment = pose?.map_alignment || this.getMapAlignmentLabel();
        const yawSource = pose?.yaw_source || '--';

        this.setLocalizationCheckValue('check-pose-frame', poseFrame, poseFrame === 'map' ? 'normal' : 'warning');
        this.setLocalizationCheckValue('check-child-frame', childFrame, childFrame === 'base_link' ? 'normal' : 'warning');
        this.setLocalizationCheckValue(
            'check-tf-delay',
            Number.isFinite(tfDelay) ? `${Math.round(tfDelay)} ms` : '--',
            Number.isFinite(tfDelay) && tfDelay > 200 ? 'warning' : 'normal'
        );
        this.setLocalizationCheckValue(
            'check-pose-age',
            Number.isFinite(poseAge) ? `${Math.round(poseAge)} ms` : '--',
            Number.isFinite(poseAge) && poseAge > this.realtimeConfig.poseTimeoutMs ? 'warning' : 'normal'
        );
        this.setLocalizationCheckValue('check-map-alignment', alignment, alignment === '已校准' ? 'normal' : 'warning');
        this.setLocalizationCheckValue('check-yaw-source', yawSource, yawSource === 'fallback' ? 'warning' : 'normal');
    },

getMapAlignmentLabel() {
        const hasOffset = Number.isFinite(this.osmOffsetX)
            && Number.isFinite(this.osmOffsetY)
            && (Math.abs(this.osmOffsetX) > 0.001 || Math.abs(this.osmOffsetY) > 0.001);
        return hasOffset ? '已校准' : '未校准';
    },

setLocalizationCheckValue(id, text, tone = 'normal') {
        const el = document.getElementById(id);
        if (!el) return;

        el.textContent = text;
        el.classList.remove('warning', 'error');
        if (tone === 'warning' || tone === 'error') {
            el.classList.add(tone);
        }
    },

updateRealtimeStatus(text, tone = 'normal') {
        this.setStatusValue('realtime-status', text, tone);
    },

    updateRealtimeButton() {
        const btn = document.getElementById('toggle-realtime');
        if (!btn) return;

        btn.textContent = this.realtimeEnabled ? '断开模拟数据' : '连接模拟数据';
        btn.classList.toggle('active', !!this.realtimeEnabled);
    },

    updatePlanningModeStatus() {
        const mode = this.backendConfig?.planningMode === 'autoware' ? 'autoware_mode' : 'demo_mode';
        this.setStatusValue('planning-mode-status', mode, this.isAutowarePlanningMode() ? 'warning' : 'normal');
    },

    updatePlanningStatus(text, tone = 'normal') {
        this.setStatusValue('planning-status', text, tone);
    },

setStatusValue(id, text, tone = 'normal') {
        const el = document.getElementById(id);
        if (!el) return;

        el.textContent = text;
        el.classList.remove('driving', 'normal', 'manual', 'error', 'warning', 'offline');
        el.classList.add(tone);
    }
};
