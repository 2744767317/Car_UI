window.PCVModules = window.PCVModules || {};
window.PCVModules.interactionPathMethods = {
worldToScreen(worldX, worldY) {
        return {
            x: worldX * this.mapScale + this.mapOffset.x,
            y: -worldY * this.mapScale + this.mapOffset.y
        };
    },

screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.mapOffset.x) / this.mapScale,
            y: -(screenY - this.mapOffset.y) / this.mapScale
        };
    },

getCanvasMousePosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    },

handleMouseDown(e) {
        if (e.button !== 0) return;
        this.isPanning = true;
        this.dragMoved = false;
        this.panStart.x = e.clientX;
        this.panStart.y = e.clientY;
        this.mapOffsetStart.x = this.mapOffset.x;
        this.mapOffsetStart.y = this.mapOffset.y;
    },

handleWindowMouseMove(e) {
        if (!this.isPanning) return;

        const dx = e.clientX - this.panStart.x;
        const dy = e.clientY - this.panStart.y;

        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
            this.dragMoved = true;
        }

        this.mapOffset.x = this.mapOffsetStart.x + dx;
        this.mapOffset.y = this.mapOffsetStart.y + dy;
        this.requestRender();
    },

handleWindowMouseUp() {
        this.isPanning = false;
    },

handleMouseWheel(e) {
        e.preventDefault();

        const mouse = this.getCanvasMousePosition(e);
        const worldBefore = this.screenToWorld(mouse.x, mouse.y);
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        const nextScale = Math.max(this.minMapScale, Math.min(this.maxMapScale, this.mapScale * zoomFactor));

        if (nextScale === this.mapScale) return;

        this.mapScale = nextScale;
        this.mapOffset.x = mouse.x - worldBefore.x * this.mapScale;
        this.mapOffset.y = mouse.y + worldBefore.y * this.mapScale;
        this.requestRender();
    },

handleCanvasClick(e) {
        if (this.dragMoved) return;
        if (this.drivingMode !== 'point-to-point') return;
        if (!this.endpointPickMode) return;

        const mouse = this.getCanvasMousePosition(e);
        const worldPosRaw = this.screenToWorld(mouse.x, mouse.y);
        const worldPos = this.clampPointToBounds(worldPosRaw);
        const wasClamped = Math.abs(worldPos.x - worldPosRaw.x) > 1e-6 || Math.abs(worldPos.y - worldPosRaw.y) > 1e-6;

        this.updateCoordinateDisplay(worldPos.x, worldPos.y, 0);
        if (wasClamped) {
            alert('点击位置超出地图边界，已自动吸附到最近有效区域');
        }

        if (!this.startPoint) {
            this.startPoint = worldPos;
            this.carPosition = { ...worldPos };
            this.currentFrame = 0;
            this.persistSceneSnapshot();
            alert(`起点已设置: (${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)})`);
            this.requestRender();
            return;
        }

        if (!this.endPoint) {
            this.endPoint = worldPos;
            this.endpointPickMode = false;
            this.updateEndpointButtonStyle();
            this.persistSceneSnapshot();
            alert(`终点已设置: (${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)})`);
            void this.calculatePath();
        } else {
            this.endPoint = worldPos;
            this.endpointPickMode = false;
            this.updateEndpointButtonStyle();
            this.persistSceneSnapshot();
            alert(`终点已更新: (${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)})`);
            void this.calculatePath();
        }
    },

handleMouseMove(e) {
        const now = performance.now();
        if (now - this.lastMouseCoordUpdateAt < this.mouseMoveThrottleMs) {
            return;
        }
        this.lastMouseCoordUpdateAt = now;

        const mouse = this.getCanvasMousePosition(e);
        const worldPos = this.screenToWorld(mouse.x, mouse.y);
        this.updateCoordinateDisplay(worldPos.x, worldPos.y, 0);
        if (this.endpointPickMode) {
            this.requestRender();
        }
    },

async calculatePath() {
        if (!this.startPoint || !this.endPoint) return;

        if (!this.isPointInBounds(this.startPoint) || !this.isPointInBounds(this.endPoint)) {
            alert('起点或终点超出点云地图范围，请重新设置');
            this.endpointPickMode = true;
            this.updateEndpointButtonStyle();
            this.requestRender();
            return;
        }

        if (this.isPointNearWall(this.startPoint) || this.isPointNearWall(this.endPoint)) {
            alert('起点或终点过于靠近障碍/墙体，请稍微偏移后重试');
            this.endpointPickMode = true;
            this.updateEndpointButtonStyle();
            this.requestRender();
            return;
        }

        this.stopPlay();
        this.playbackSegmentIndex = 0;
        this.playbackSegmentT = 0;
        this.playbackLastTimestamp = 0;
        const path = this.aStar(this.startPoint, this.endPoint);
        
        if (path && path.length >= 2) {
            this.pathPoints = path;
            this.carPosition = { ...this.pathPoints[0] };
            this.currentFrame = 0;
            this.updatePathDistance();
            this.persistSceneSnapshot();
            this.requestRender();
            void this.submitRouteToBackend();
            alert('路径规划完成，点击播放按钮开始模拟行驶');
        } else if (path && path.length === 1) {
            this.pathPoints = path;
            this.currentFrame = 0;
            this.carPosition = { ...path[0] };
            this.updatePathDistance();
            this.persistSceneSnapshot();
            this.requestRender();
            alert('起点与终点在同一网格，车辆无需移动');
        } else {
            alert('无法找到可行路径');
            this.pathPoints = [];
            this.currentFrame = 0;
            this.carPosition = { ...this.startPoint };
            this.endpointPickMode = true;
            this.updateEndpointButtonStyle();
            this.persistSceneSnapshot();
            this.requestRender();
        }
    },

updatePathDistance() {
        if (this.pathPoints.length < 2) {
            document.getElementById('path-distance').textContent = '0.00';
            return;
        }

        let distance = 0;
        for (let i = 1; i < this.pathPoints.length; i++) {
            const dx = this.pathPoints[i].x - this.pathPoints[i-1].x;
            const dy = this.pathPoints[i].y - this.pathPoints[i-1].y;
            distance += Math.sqrt(dx * dx + dy * dy);
        }
        
        document.getElementById('path-distance').textContent = distance.toFixed(2);
    },

isPointNearWall(point) {
        const threshold = 0.55;
        for (const p of this.points) {
            if (Math.abs(p.x - point.x) <= threshold && Math.abs(p.y - point.y) <= threshold) {
                return true;
            }
        }
        return false;
    },

isPointInBounds(point) {
        if (!point) return false;
        const margin = 0.4;
        const b = this.getEffectiveBounds();
        return point.x >= b.minX + margin && point.x <= b.maxX - margin &&
            point.y >= b.minY + margin && point.y <= b.maxY - margin;
    },

clampPointToBounds(point) {
        const margin = 0.4;
        const b = this.getEffectiveBounds();
        return {
            x: Math.max(b.minX + margin, Math.min(b.maxX - margin, point.x)),
            y: Math.max(b.minY + margin, Math.min(b.maxY - margin, point.y))
        };
    },

aStar(start, end) {
        const gridSize = 0.3;
        const startGrid = this.worldToGrid(start, gridSize);
        const endGrid = this.worldToGrid(end, gridSize);

        const openSet = [startGrid];
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();

        const startKey = this.gridKey(startGrid);
        gScore.set(startKey, 0);
        fScore.set(startKey, this.heuristic(startGrid, endGrid));

        const directions = [
            { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
            { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
            { dx: 1, dy: 1 }, { dx: 1, dy: -1 },
            { dx: -1, dy: 1 }, { dx: -1, dy: -1 }
        ];

        let iterations = 0;
        const maxIterations = 12000;

        while (openSet.length > 0) {
            iterations++;
            if (iterations > maxIterations) {
                return null;
            }

            openSet.sort((a, b) => (fScore.get(this.gridKey(a)) ?? Infinity) - (fScore.get(this.gridKey(b)) ?? Infinity));
            const current = openSet.shift();
            const currentKey = this.gridKey(current);

            if (current.x === endGrid.x && current.y === endGrid.y) {
                return this.reconstructPath(cameFrom, current, gridSize);
            }

            for (const dir of directions) {
                const neighbor = { x: current.x + dir.dx, y: current.y + dir.dy };
                const neighborKey = this.gridKey(neighbor);
                
                if (this.isObstacle(neighbor, gridSize)) continue;

                const tentativeG = (gScore.get(currentKey) ?? Infinity) + this.distance(current, neighbor);
                
                if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
                    cameFrom.set(neighborKey, current);
                    gScore.set(neighborKey, tentativeG);
                    fScore.set(neighborKey, tentativeG + this.heuristic(neighbor, endGrid));
                    
                    if (!openSet.some(n => n.x === neighbor.x && n.y === neighbor.y)) {
                        openSet.push(neighbor);
                    }
                }
            }
        }

        return null;
    },

worldToGrid(pos, gridSize) {
        return {
            x: Math.floor(pos.x / gridSize),
            y: Math.floor(pos.y / gridSize)
        };
    },

gridToWorld(grid, gridSize) {
        return {
            x: grid.x * gridSize + gridSize / 2,
            y: grid.y * gridSize + gridSize / 2
        };
    },

gridKey(grid) {
        return `${grid.x},${grid.y}`;
    },

heuristic(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    },

distance(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    },

isObstacle(grid, gridSize) {
        const worldPos = this.gridToWorld(grid, gridSize);
        const b = this.getEffectiveBounds();

        if (worldPos.x < b.minX || worldPos.x > b.maxX ||
            worldPos.y < b.minY || worldPos.y > b.maxY) {
            return true;
        }

        if (!this.obstacleAvoidanceEnabled) return false;
        
        for (const obs of this.obstacles) {
            const dist = Math.sqrt(Math.pow(worldPos.x - obs.x, 2) + Math.pow(worldPos.y - obs.y, 2));
            if (dist < 0.3) return true;
        }

        return false;
    },

reconstructPath(cameFrom, current, gridSize) {
        const path = [this.gridToWorld(current, gridSize)];
        let key = this.gridKey(current);
        
        while (cameFrom.has(key)) {
            current = cameFrom.get(key);
            path.unshift(this.gridToWorld(current, gridSize));
            key = this.gridKey(current);
        }
        
        return path;
    },

play() {
        if (this.isPlaying || this.pathPoints.length < 2) return;
        this.isPlaying = true;
        this.playbackSegmentIndex = 0;
        this.playbackSegmentT = 0;
        this.playbackLastTimestamp = 0;
        this.currentFrame = 0;
        this.carPosition = { ...this.pathPoints[0] };
        this.requestRender();
        this.animateCar();
    },

stopPlay() {
        this.isPlaying = false;
        if (this.playbackRafId) {
            cancelAnimationFrame(this.playbackRafId);
            this.playbackRafId = 0;
        }
        this.requestRender();
    },

animateCar(timestamp = performance.now()) {
        if (!this.isPlaying) return;

        if (!this.playbackLastTimestamp) {
            this.playbackLastTimestamp = timestamp;
        }

        const dt = Math.max(0, (timestamp - this.playbackLastTimestamp) / 1000);
        this.playbackLastTimestamp = timestamp;

        let remain = dt * this.playbackSpeed;
        while (remain > 0 && this.playbackSegmentIndex < this.pathPoints.length - 1) {
            const a = this.pathPoints[this.playbackSegmentIndex];
            const b = this.pathPoints[this.playbackSegmentIndex + 1];
            const segLen = Math.max(0.000001, this.distance(a, b));
            const segRemain = segLen * (1 - this.playbackSegmentT);

            if (remain >= segRemain) {
                remain -= segRemain;
                this.playbackSegmentIndex++;
                this.playbackSegmentT = 0;
                this.currentFrame = this.playbackSegmentIndex;
                this.carPosition = { ...this.pathPoints[this.playbackSegmentIndex] };
            } else {
                this.playbackSegmentT += remain / segLen;
                remain = 0;
                this.currentFrame = this.playbackSegmentIndex;
                this.carPosition = {
                    x: a.x + (b.x - a.x) * this.playbackSegmentT,
                    y: a.y + (b.y - a.y) * this.playbackSegmentT
                };
            }
        }

        if (this.playbackSegmentIndex >= this.pathPoints.length - 1) {
            this.isPlaying = false;
            this.requestRender();
            alert('到达终点');
            return;
        }

        this.requestRender();
        this.playbackRafId = requestAnimationFrame((nextTs) => this.animateCar(nextTs));
    },

prevFrame() {
        if (this.pathPoints.length === 0) return;
        this.currentFrame = Math.max(0, this.currentFrame - 3);
        this.carPosition = { ...this.pathPoints[this.currentFrame] };
        this.requestRender();
    },

nextFrame() {
        if (this.pathPoints.length === 0) return;
        this.currentFrame = Math.min(this.pathPoints.length - 1, this.currentFrame + 3);
        this.carPosition = { ...this.pathPoints[this.currentFrame] };
        this.requestRender();
    }
};

