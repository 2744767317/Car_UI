window.PCVModules = window.PCVModules || {};
window.PCVModules.controlsMethods = {
setupEventListeners() {
        window.addEventListener('resize', () => this.resizeCanvas());
        
        document.getElementById('render-mode').addEventListener('change', (e) => {
            this.renderMode = e.target.value;
            this.persistSceneSnapshot();
        });
        
        document.getElementById('point-size').addEventListener('input', (e) => {
            this.pointSize = parseInt(e.target.value);
        });

        document.getElementById('view-distance').addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.viewDistanceScaleFactor = Math.max(0.2, value / 10);
        });

        document.getElementById('fixed-route').addEventListener('click', () => {
            this.setDrivingMode('fixed-route');
        });

        document.getElementById('point-to-point').addEventListener('click', () => {
            this.setDrivingMode('point-to-point');
        });

        document.getElementById('enable-obstacle').addEventListener('click', () => {
            this.toggleObstacleAvoidance();
        });

        document.getElementById('return-start').addEventListener('click', () => {
            this.returnToStart();
        });

        document.getElementById('set-endpoint').addEventListener('click', () => {
            this.toggleEndpointPickMode();
        });

        document.getElementById('send-coord').addEventListener('click', () => {
            this.sendCoordinates();
        });

        document.getElementById('calibrate-gps').addEventListener('click', () => {
            this.calibrateGpsAtCurrentCoordinate();
        });

        document.getElementById('update-start-from-gps').addEventListener('click', () => {
            void this.updateStartPointFromConfiguredGPS(true);
        });

        document.getElementById('toggle-gps-track').addEventListener('click', () => {
            this.toggleGpsTracking();
        });

        document.getElementById('close-driving').addEventListener('click', () => {
            this.closeDriving();
        });

        document.getElementById('exit-program').addEventListener('click', () => {
            this.exitProgram();
        });

        document.getElementById('select-file').addEventListener('click', () => {
            this.selectFile();
        });

        document.getElementById('select-osm-file').addEventListener('click', () => {
            this.selectOsmFile();
        });

        document.getElementById('clear-osm-file').addEventListener('click', () => {
            this.clearOsm();
        });

        document.getElementById('play').addEventListener('click', () => {
            this.play();
        });
        
        document.getElementById('stop-play').addEventListener('click', () => {
            this.stopPlay();
        });
        
        document.getElementById('prev-frame').addEventListener('click', () => {
            this.prevFrame();
        });
        
        document.getElementById('next-frame').addEventListener('click', () => {
            this.nextFrame();
        });
        
        document.getElementById('path-management').addEventListener('click', () => {
            this.openPathManagement();
        });
        
        document.getElementById('upload-points').addEventListener('click', () => {
            this.uploadPoints();
        });
        
        document.getElementById('settings').addEventListener('click', () => {
            this.openSettings();
        });

        document.getElementById('osm-visible').addEventListener('change', (e) => {
            this.osmVisible = !!e.target.checked;
            this.persistSceneSnapshot();
            this.requestRender();
        });

        document.getElementById('osm-opacity').addEventListener('input', (e) => {
            this.osmOpacity = Math.max(0, Math.min(1, Number(e.target.value) / 100));
            this.persistSceneSnapshot();
            this.requestRender();
        });

        document.getElementById('osm-scale').addEventListener('input', (e) => {
            this.osmScalePercent = Math.max(1, Number(e.target.value) || 100);
            this.persistSceneSnapshot();
            this.requestRender();
        });

        document.getElementById('osm-rotation').addEventListener('input', (e) => {
            this.osmRotationDeg = Number(e.target.value) || 0;
            this.persistSceneSnapshot();
            this.requestRender();
        });

        document.getElementById('osm-offset-x').addEventListener('input', (e) => {
            this.osmOffsetX = Number(e.target.value) || 0;
            this.persistSceneSnapshot();
            this.requestRender();
        });

        document.getElementById('osm-offset-y').addEventListener('input', (e) => {
            this.osmOffsetY = Number(e.target.value) || 0;
            this.persistSceneSnapshot();
            this.requestRender();
        });

        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('wheel', (e) => this.handleMouseWheel(e), { passive: false });
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        window.addEventListener('mousemove', (e) => this.handleWindowMouseMove(e));
        window.addEventListener('mouseup', () => this.handleWindowMouseUp());

        this.canvas.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e);
        });

        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    },

setDrivingMode(mode) {
        this.drivingMode = mode;
        this.endpointPickMode = false;
        this.updateEndpointButtonStyle();
        
        document.getElementById('fixed-route').classList.remove('active');
        document.getElementById('point-to-point').classList.remove('active');
        document.getElementById(mode).classList.add('active');
        
        if (mode === 'fixed-route') {
            this.startPoint = { x: -4, y: -4 };
            this.endPoint = { x: 4, y: 4 };
            this.carPosition = { ...this.startPoint };
            this.currentFrame = 0;
            void this.calculatePath();
        } else {
            this.startPoint = null;
            this.endPoint = null;
            this.pathPoints = [];
            this.currentFrame = 0;
        }
        this.persistSceneSnapshot();
        this.requestRender();
    },

toggleObstacleAvoidance() {
        this.obstacleAvoidanceEnabled = !this.obstacleAvoidanceEnabled;
        const btn = document.getElementById('enable-obstacle');
        
        if (this.obstacleAvoidanceEnabled) {
            btn.style.background = 'linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)';
            btn.style.color = '#1a1a2e';
        } else {
            btn.style.background = 'rgba(255, 255, 255, 0.1)';
            btn.style.color = '#fff';
        }
        this.requestRender();
    },

returnToStart() {
        if (this.startPoint) {
            this.stopPlay();
            this.carPosition = { ...this.startPoint };
            this.currentFrame = 0;
            this.persistSceneSnapshot();
            this.requestRender();
        }
    },

sendCoordinates() {
        const x = document.getElementById('coord-x').value;
        const y = document.getElementById('coord-y').value;
        const worldPos = { x: parseFloat(x), y: parseFloat(y) };
        
        if (!this.startPoint) {
            this.stopPlay();
            this.startPoint = worldPos;
            this.carPosition = { ...worldPos };
            this.currentFrame = 0;
            this.persistSceneSnapshot();
            alert(`起点已设置: (${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)})`);
            this.requestRender();
        } else if (this.endpointPickMode || !this.endPoint) {
            this.endPoint = worldPos;
            this.endpointPickMode = false;
            this.updateEndpointButtonStyle();
            this.persistSceneSnapshot();
            alert(`终点已设置: (${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)})`);
            void this.calculatePath();
        } else {
            this.stopPlay();
            this.startPoint = worldPos;
            this.endPoint = null;
            this.pathPoints = [];
            this.currentFrame = 0;
            this.carPosition = { ...worldPos };
            this.persistSceneSnapshot();
            alert(`起点已重置: (${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)})`);
            this.requestRender();
        }
    },

closeDriving() {
        document.querySelector('.status-item:nth-child(1) .value').textContent = '人工驾驶';
        document.querySelector('.status-item:nth-child(1) .value').classList.remove('driving');
        document.querySelector('.status-item:nth-child(1) .value').classList.add('manual');
        this.stopPlay();
        this.requestRender();
    },

exitProgram() {
        if (confirm('确定要结束程序吗？')) {
            window.close();
        }
    },

async toggleEndpointPickMode() {
        if (this.drivingMode !== 'point-to-point') return;
        const willEnable = !this.endpointPickMode;
        this.endpointPickMode = willEnable;
        this.updateEndpointButtonStyle();
        this.requestRender();

        if (willEnable && this.backendConfig.useGpsOnSetEndpoint) {
            const gpsReady = await this.updateStartPointFromConfiguredGPS(false);
            if (!gpsReady && !this.startPoint) {
                alert('未获取到后端GPS起点，请先点击地图设置起点，或检查 GPS 接口');
            }
        }
    },

updateEndpointButtonStyle() {
        const btn = document.getElementById('set-endpoint');
        if (!btn) return;

        if (this.endpointPickMode) {
            btn.style.background = 'linear-gradient(135deg, #ffaa00 0%, #ff6b00 100%)';
            btn.style.color = '#1a1a2e';
        } else {
            btn.style.background = 'rgba(255, 255, 255, 0.1)';
            btn.style.color = '#fff';
        }
        this.requestRender();
    },

syncControlStateFromUI() {
        const osmVisible = document.getElementById('osm-visible');
        const osmOpacity = document.getElementById('osm-opacity');
        const osmScale = document.getElementById('osm-scale');
        const osmRotation = document.getElementById('osm-rotation');
        const osmOffsetX = document.getElementById('osm-offset-x');
        const osmOffsetY = document.getElementById('osm-offset-y');

        if (osmVisible) this.osmVisible = !!osmVisible.checked;
        if (osmOpacity) this.osmOpacity = Math.max(0, Math.min(1, Number(osmOpacity.value) / 100));
        if (osmScale) this.osmScalePercent = Math.max(1, Number(osmScale.value) || 100);
        if (osmRotation) this.osmRotationDeg = Number(osmRotation.value) || 0;
        if (osmOffsetX) this.osmOffsetX = Number(osmOffsetX.value) || 0;
        if (osmOffsetY) this.osmOffsetY = Number(osmOffsetY.value) || 0;
    },

updateCoordinateDisplay(x, y, z) {
        document.getElementById('coord-x').value = x.toFixed(15);
        document.getElementById('coord-y').value = y.toFixed(15);
        document.getElementById('coord-z').value = z.toFixed(15);
    },

openPathManagement() {
        const startText = this.startPoint ? `(${this.startPoint.x.toFixed(2)}, ${this.startPoint.y.toFixed(2)})` : "未设置";
        const endText = this.endPoint ? `(${this.endPoint.x.toFixed(2)}, ${this.endPoint.y.toFixed(2)})` : "未设置";
        const obstacleText = this.obstacleAvoidanceEnabled ? "开启" : "关闭";
        alert(`路径管理\n起点: ${startText}\n终点: ${endText}\n路径点数量: ${this.pathPoints.length}\n绕障模式: ${obstacleText}`);
    },

uploadPoints() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt,.csv';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                this.loadWaypoints(file);
            }
        };
        input.click();
    },

async loadWaypoints(file) {
        try {
            const text = await file.text();
            const lines = text.split('\n');
            const waypoints = [];
            
            lines.forEach(line => {
                const trimmed = line.trim();
                if (trimmed) {
                    const parts = trimmed.split(/[, \t]+/);
                    if (parts.length >= 2) {
                        waypoints.push({
                            x: parseFloat(parts[0]),
                            y: parseFloat(parts[1])
                        });
                    }
                }
            });
            
            if (waypoints.length >= 2) {
                this.startPoint = waypoints[0];
                this.endPoint = waypoints[waypoints.length - 1];
                this.carPosition = { ...this.startPoint };
                this.currentFrame = 0;
                await this.calculatePath();
                alert(`成功加载 ${waypoints.length} 个站点`);
            }
        } catch (error) {
            alert('加载站点失败: ' + error.message);
        }
    },

openSettings() {
        const modeText = this.drivingMode === "point-to-point" ? "点对点" : "固定线路";
        const obstacleText = this.obstacleAvoidanceEnabled ? "开启" : "关闭";
        const saved = confirm(
            `设置面板\n\n渲染模式: ${this.renderMode}\n点大小: ${this.pointSize}\n地图缩放: ${this.mapScale}\n驾驶模式: ${modeText}\n绕障模式: ${obstacleText}\n\n点击“确定”保存当前场景快照`
        );
        if (saved) {
            this.persistSceneSnapshot();
            alert('当前场景已保存，下次打开网页将自动恢复');
        }
    }
};

