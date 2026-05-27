window.PCVModules = window.PCVModules || {};
window.PCVModules.renderMethods = {
getPointColor(point) {
        switch (this.renderMode) {
            case 'color':
                return `hsl(${180 + point.z * 60}, 70%, ${40 + point.intensity * 30}%)`;
            case 'height':
                const heightRatio = (point.z - 0) / 1;
                return `hsl(${200 + heightRatio * 80}, 70%, ${30 + heightRatio * 40}%)`;
            case 'intensity':
            default:
                const intensity = Math.floor(point.intensity * 255);
                return `rgb(${intensity}, ${intensity}, ${intensity})`;
        }
    },

requestRender() {
        if (this.renderPending) return;
        this.renderPending = true;
        requestAnimationFrame(() => {
            this.renderPending = false;
            this.render();
        });
    },

render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawGrid();
        this.drawObstacles();
        this.drawPointCloud();
        this.drawOsm();
        this.drawPathLayers();
        this.drawDetectedObjects();
        this.drawStartEndPoints();
        this.drawCar();
    },

drawGrid() {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        this.ctx.lineWidth = 1;

        const worldLeft = (0 - this.mapOffset.x) / this.mapScale;
        const worldRight = (this.canvas.width - this.mapOffset.x) / this.mapScale;
        const worldTop = (this.mapOffset.y - 0) / this.mapScale;
        const worldBottom = (this.mapOffset.y - this.canvas.height) / this.mapScale;

        const minX = Math.floor(Math.min(worldLeft, worldRight)) - 1;
        const maxX = Math.ceil(Math.max(worldLeft, worldRight)) + 1;
        const minY = Math.floor(Math.min(worldBottom, worldTop)) - 1;
        const maxY = Math.ceil(Math.max(worldBottom, worldTop)) + 1;

        const gridWorldStep = this.mapScale < 20 ? 5 : this.mapScale < 50 ? 2 : 1;

        for (let x = minX; x <= maxX; x += gridWorldStep) {
            const screenPos = this.worldToScreen(x, 0);
            this.ctx.beginPath();
            this.ctx.moveTo(screenPos.x, 0);
            this.ctx.lineTo(screenPos.x, this.canvas.height);
            this.ctx.stroke();
        }

        for (let y = minY; y <= maxY; y += gridWorldStep) {
            const screenPos = this.worldToScreen(0, y);
            this.ctx.beginPath();
            this.ctx.moveTo(0, screenPos.y);
            this.ctx.lineTo(this.canvas.width, screenPos.y);
            this.ctx.stroke();
        }

        const origin = this.worldToScreen(0, 0);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.font = '12px Arial';
        this.ctx.fillText('0', origin.x + 5, origin.y - 5);
    },

getTransformedOsmWays() {
        if (!this.osmWays.length || !this.osmGeoRef) return [];

        const key = [
            this.osmScalePercent,
            this.osmRotationDeg,
            this.osmOffsetX,
            this.osmOffsetY,
            this.osmGeoRef.fitScale,
            this.osmGeoRef.osmCenterX,
            this.osmGeoRef.osmCenterY,
            this.osmGeoRef.targetCenterX,
            this.osmGeoRef.targetCenterY,
            this.osmWays.length
        ].join('|');

        if (this.osmCache.key === key && this.osmCache.worldWays.length) {
            return this.osmCache.worldWays;
        }

        const fitScale = this.osmGeoRef.fitScale || 1;
        const userScale = (this.osmScalePercent || 100) / 100;
        const totalScale = fitScale * userScale;
        const rad = (this.osmRotationDeg || 0) * Math.PI / 180;
        const cosA = Math.cos(rad);
        const sinA = Math.sin(rad);
        const cx = this.osmGeoRef.osmCenterX || 0;
        const cy = this.osmGeoRef.osmCenterY || 0;
        const tx = (this.osmGeoRef.targetCenterX || 0) + (this.osmOffsetX || 0);
        const ty = (this.osmGeoRef.targetCenterY || 0) + (this.osmOffsetY || 0);

        const worldWays = this.osmWays.map(line => {
            const out = [];
            for (const p of line) {
                const lx = (p.x - cx) * totalScale;
                const ly = (p.y - cy) * totalScale;
                const rx = lx * cosA - ly * sinA;
                const ry = lx * sinA + ly * cosA;
                out.push({ x: tx + rx, y: ty + ry });
            }
            return out;
        });

        this.osmCache = { key, worldWays };
        return worldWays;
    },

drawOsm() {
        if (!this.osmVisible) return;
        if (!this.osmWays.length) return;

        const ways = this.getTransformedOsmWays();
        if (!ways.length) return;

        this.ctx.save();
        this.ctx.globalAlpha = this.osmOpacity;
        this.ctx.strokeStyle = 'rgba(42, 218, 255, 0.95)';
        this.ctx.lineWidth = Math.max(1, this.pointSize * 0.8);
        this.ctx.lineJoin = 'round';
        this.ctx.lineCap = 'round';

        for (const line of ways) {
            if (line.length < 2) continue;

            this.ctx.beginPath();
            const first = this.worldToScreen(line[0].x, line[0].y);
            this.ctx.moveTo(first.x, first.y);

            for (let i = 1; i < line.length; i++) {
                const sp = this.worldToScreen(line[i].x, line[i].y);
                this.ctx.lineTo(sp.x, sp.y);
            }
            this.ctx.stroke();
        }
        this.ctx.restore();
    },

drawObstacles() {
        if (!this.obstacleAvoidanceEnabled) return;
        
        this.ctx.fillStyle = 'rgba(255, 100, 100, 0.6)';
        
        this.obstacles.forEach(obs => {
            const screenPos = this.worldToScreen(obs.x, obs.y);
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, 5, 0, Math.PI * 2);
            this.ctx.fill();
        });
    },

drawPointCloud() {
        const zoomFactor = Math.max(0.5, Math.min(2, this.mapScale / 30));
        const zoomAdjustedBudget = Math.floor(this.maxRenderPoints / zoomFactor);
        const renderBudget = (this.isPanning || this.isPlaying)
            ? this.interactionRenderPoints
            : Math.max(15000, zoomAdjustedBudget);
        const step = Math.max(1, Math.ceil(this.points.length / renderBudget));
        const pointRadius = this.pointSize * this.viewDistanceScaleFactor;
        const pointSizePx = Math.max(1, Math.round(pointRadius * 2));

        for (let i = 0; i < this.points.length; i += step) {
            const point = this.points[i];
            const screenPos = this.worldToScreen(point.x, point.y);
            
            if (screenPos.x > -50 && screenPos.x < this.canvas.width + 50 &&
                screenPos.y > -50 && screenPos.y < this.canvas.height + 50) {
                this.ctx.fillStyle = this.getPointColor(point);
                this.ctx.fillRect(
                    Math.round(screenPos.x - pointSizePx / 2),
                    Math.round(screenPos.y - pointSizePx / 2),
                    pointSizePx,
                    pointSizePx
                );
            }
        }
    },

drawPathLayers() {
        this.drawPolylineLayer(this.routePoints, {
            strokeStyle: 'rgba(0, 153, 255, 0.82)',
            lineWidth: 6,
            dash: [],
            waypointEvery: 0
        });

        this.drawPolylineLayer(this.demoPathPoints, {
            strokeStyle: 'rgba(0, 255, 136, 0.76)',
            lineWidth: 4,
            dash: [12, 6],
            waypointEvery: 3
        });

        this.drawPolylineLayer(this.trajectoryPoints, {
            strokeStyle: 'rgba(57, 255, 126, 0.95)',
            lineWidth: 4,
            dash: [],
            waypointEvery: 6
        });
    },

drawPolylineLayer(points, options = {}) {
        if (!Array.isArray(points) || points.length < 2) return;

        const {
            strokeStyle = 'rgba(0, 255, 136, 0.8)',
            lineWidth = 4,
            dash = [],
            waypointEvery = 0
        } = options;

        this.ctx.beginPath();
        this.ctx.strokeStyle = strokeStyle;
        this.ctx.lineWidth = lineWidth;
        this.ctx.setLineDash(dash);

        const first = this.worldToScreen(points[0].x, points[0].y);
        this.ctx.moveTo(first.x, first.y);

        for (let i = 1; i < points.length; i++) {
            const screenPos = this.worldToScreen(points[i].x, points[i].y);
            this.ctx.lineTo(screenPos.x, screenPos.y);
        }
        
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        if (waypointEvery > 0) {
            points.forEach((point, index) => {
                if (index % waypointEvery !== 0) return;
                const screenPos = this.worldToScreen(point.x, point.y);
                this.ctx.fillStyle = strokeStyle;
                this.ctx.beginPath();
                this.ctx.arc(screenPos.x, screenPos.y, 4, 0, Math.PI * 2);
                this.ctx.fill();
            });
        }
    },

drawDetectedObjects() {
        if (!Array.isArray(this.detectedObjects) || this.detectedObjects.length === 0) return;

        for (const object of this.getVisibleDetectedObjects()) {
            this.drawDetectedObject(object);
        }
    },

drawDetectedObject(object) {
        if (!object || !Number.isFinite(object.x) || !Number.isFinite(object.y)) return;

        const center = this.worldToScreen(object.x, object.y);
        const yaw = Number.isFinite(object.yaw) ? object.yaw : 0;
        const length = Math.max(0.4, Number(object.length) || 1.2);
        const width = Math.max(0.3, Number(object.width) || 0.7);
        const screenLength = length * this.mapScale;
        const screenWidth = width * this.mapScale;

        this.ctx.save();
        this.ctx.translate(center.x, center.y);
        this.ctx.rotate(-yaw);
        this.ctx.strokeStyle = 'rgba(255, 196, 0, 0.95)';
        this.ctx.lineWidth = 2;
        this.ctx.fillStyle = 'rgba(255, 196, 0, 0.12)';
        this.ctx.beginPath();
        this.ctx.rect(-screenLength / 2, -screenWidth / 2, screenLength, screenWidth);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();

        const label = object.label || object.type || object.classification || 'object';
        const speed = Number.isFinite(object.speed) ? ` ${object.speed.toFixed(1)}m/s` : '';
        this.ctx.fillStyle = '#ffc400';
        this.ctx.font = '12px Arial';
        this.ctx.fillText(`${label}${speed}`, center.x + 8, center.y - 8);

        if (Number.isFinite(object.vx) || Number.isFinite(object.vy) || Number.isFinite(object.speed)) {
            const vx = Number.isFinite(object.vx) ? object.vx : Math.cos(yaw) * (object.speed || 0);
            const vy = Number.isFinite(object.vy) ? object.vy : Math.sin(yaw) * (object.speed || 0);
            this.drawVelocityArrow(object.x, object.y, vx, vy);
        }

        if (Array.isArray(object.predictedPath) && object.predictedPath.length >= 2) {
            this.drawPolylineLayer(object.predictedPath, {
                strokeStyle: 'rgba(255, 196, 0, 0.46)',
                lineWidth: 2,
                dash: [4, 4],
                waypointEvery: 0
            });
        }
    },

drawVelocityArrow(x, y, vx, vy) {
        const start = this.worldToScreen(x, y);
        const end = this.worldToScreen(x + vx, y + vy);
        const angle = Math.atan2(end.y - start.y, end.x - start.x);

        this.ctx.strokeStyle = 'rgba(255, 196, 0, 0.9)';
        this.ctx.fillStyle = 'rgba(255, 196, 0, 0.9)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(end.x, end.y);
        this.ctx.lineTo(end.x - Math.cos(angle - 0.45) * 8, end.y - Math.sin(angle - 0.45) * 8);
        this.ctx.lineTo(end.x - Math.cos(angle + 0.45) * 8, end.y - Math.sin(angle + 0.45) * 8);
        this.ctx.closePath();
        this.ctx.fill();
    },

drawStartEndPoints() {
        if (this.startPoint) {
            const screenPos = this.worldToScreen(this.startPoint.x, this.startPoint.y);
            this.ctx.fillStyle = 'rgba(0, 200, 255, 0.9)';
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, 12, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('S', screenPos.x, screenPos.y);
        }

        if (this.endPoint) {
            const screenPos = this.worldToScreen(this.endPoint.x, this.endPoint.y);
            this.ctx.fillStyle = 'rgba(255, 100, 200, 0.9)';
            this.ctx.beginPath();
            this.ctx.arc(screenPos.x, screenPos.y, 12, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('E', screenPos.x, screenPos.y);
        }
    },

drawCar() {
        const carScreen = this.worldToScreen(this.carPosition.x, this.carPosition.y);
        const { x, y } = carScreen;
        
        this.ctx.save();
        this.ctx.translate(x, y);
        
        let angle = 0;
        if (this.vehicleYaw !== null && Number.isFinite(this.vehicleYaw)) {
            angle = this.vehicleYaw;
        } else {
            const fallbackPath = this.pathPoints || this.demoPathPoints || this.trajectoryPoints || [];
            if (fallbackPath.length > 1 && this.currentFrame > 0 && this.currentFrame < fallbackPath.length) {
            const prev = fallbackPath[this.currentFrame - 1];
            const curr = fallbackPath[this.currentFrame];
            angle = Math.atan2(curr.y - prev.y, curr.x - prev.x);
            }
        }
        this.ctx.rotate(angle);

        const zoomRelative = this.mapScale / 30;
        let carScale = this.carBaseScale;
        if (this.carScaleWithZoom) {
            carScale *= Math.pow(zoomRelative, 0.3);
        }
        carScale = Math.max(this.carMinScale, Math.min(this.carMaxScale, carScale));
        this.ctx.scale(carScale, carScale);

        // chassis shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        this.ctx.beginPath();
        this.ctx.roundRect(-26, -19, 52, 38, 8);
        this.ctx.fill();

        // main white base
        this.ctx.fillStyle = '#f6f7fa';
        this.ctx.strokeStyle = '#d8dce4';
        this.ctx.lineWidth = 1.4;
        this.ctx.beginPath();
        this.ctx.roundRect(-24, -17, 48, 34, 7);
        this.ctx.fill();
        this.ctx.stroke();

        // front bumper
        this.ctx.fillStyle = '#1f2228';
        this.ctx.beginPath();
        this.ctx.roundRect(-23, -22, 46, 5, 2);
        this.ctx.fill();

        // middle body (polygon-like stacked modules)
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.roundRect(-16, -10, 32, 20, 5);
        this.ctx.fill();
        this.ctx.strokeStyle = '#d3d8e2';
        this.ctx.stroke();

        this.ctx.fillStyle = '#fcfcfd';
        this.ctx.beginPath();
        this.ctx.roundRect(-11, -4, 22, 13, 4);
        this.ctx.fill();
        this.ctx.stroke();

        // side round modules
        this.ctx.fillStyle = '#2f333a';
        this.ctx.beginPath();
        this.ctx.arc(-20, 2, 4.4, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(20, 2, 4.4, 0, Math.PI * 2);
        this.ctx.fill();

        // lidar mast
        this.ctx.fillStyle = '#eef1f6';
        this.ctx.beginPath();
        this.ctx.roundRect(-2.4, -17, 4.8, 12, 2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#cfd5df';
        this.ctx.stroke();

        // lidar top
        this.ctx.fillStyle = '#20242b';
        this.ctx.beginPath();
        this.ctx.roundRect(-5.8, -21, 11.6, 5.5, 2);
        this.ctx.fill();
        this.ctx.fillStyle = '#7f8793';
        this.ctx.fillRect(-5.8, -20.3, 11.6, 1);

        // sensor bar
        this.ctx.fillStyle = '#0f1116';
        this.ctx.beginPath();
        this.ctx.roundRect(-13, -11.8, 26, 3.5, 1.5);
        this.ctx.fill();

        // dual front sensor dots
        this.ctx.fillStyle = '#4e5562';
        this.ctx.beginPath();
        this.ctx.arc(-4.4, -19.4, 1.1, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(4.4, -19.4, 1.1, 0, Math.PI * 2);
        this.ctx.fill();

        // heading marker
        this.ctx.fillStyle = '#00b7ff';
        this.ctx.beginPath();
        this.ctx.moveTo(0, -15.6);
        this.ctx.lineTo(-2.2, -12);
        this.ctx.lineTo(2.2, -12);
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.restore();
    }
};

