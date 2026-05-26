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
        this.drawPath();
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

drawPath() {
        if (this.pathPoints.length < 2) return;
        
        this.ctx.beginPath();
        this.ctx.strokeStyle = 'rgba(0, 255, 136, 0.8)';
        this.ctx.lineWidth = 4;
        this.ctx.setLineDash([12, 6]);

        const first = this.worldToScreen(this.pathPoints[0].x, this.pathPoints[0].y);
        this.ctx.moveTo(first.x, first.y);

        for (let i = 1; i < this.pathPoints.length; i++) {
            const screenPos = this.worldToScreen(this.pathPoints[i].x, this.pathPoints[i].y);
            this.ctx.lineTo(screenPos.x, screenPos.y);
        }
        
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        this.pathPoints.forEach((point, index) => {
            if (index % 3 === 0) {
                const screenPos = this.worldToScreen(point.x, point.y);
                this.ctx.fillStyle = 'rgba(0, 255, 136, 0.9)';
                this.ctx.beginPath();
                this.ctx.arc(screenPos.x, screenPos.y, 5, 0, Math.PI * 2);
                this.ctx.fill();
            }
        });
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
        if (this.pathPoints.length > 1 && this.currentFrame > 0 && this.currentFrame < this.pathPoints.length) {
            const prev = this.pathPoints[this.currentFrame - 1];
            const curr = this.pathPoints[this.currentFrame];
            angle = Math.atan2(curr.y - prev.y, curr.x - prev.x);
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

