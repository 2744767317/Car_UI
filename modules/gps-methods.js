window.PCVModules = window.PCVModules || {};
window.PCVModules.gpsMethods = {
async syncStartPointFromBackendGPS(showError = true) {
        if (!this.backendConfig.gpsEndpoint) {
            return false;
        }

        try {
            const response = await fetch(this.backendConfig.gpsEndpoint, {
                method: this.backendConfig.method || 'GET',
                headers: this.backendConfig.headers || {}
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const mapped = this.mapBackendGpsPayload(data);
            if (!mapped) {
                throw new Error('后端GPS格式不匹配，未找到 x/y 或 lon/lat');
            }

            const worldPos = this.clampPointToBounds(mapped);
            this.stopPlay();
            this.startPoint = { ...worldPos };
            this.carPosition = { ...worldPos };
            this.currentFrame = 0;
            this.updateCoordinateDisplay(worldPos.x, worldPos.y, 0);
            this.persistSceneSnapshot();
            this.requestRender();
            return true;
        } catch (error) {
            if (showError) {
                alert(`后端GPS同步失败: ${error.message}`);
            }
            return false;
        }
    },

getCurrentBrowserGeolocation(options = null) {
        const mergedOptions = {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 2000,
            ...(options || {})
        };

        return new Promise((resolve, reject) => {
            if (!this.browserGpsSupported) {
                reject(new Error('当前浏览器不支持地理定位'));
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve(pos),
                (err) => reject(new Error(err.message || '地理定位失败')),
                mergedOptions
            );
        });
    },

applyBrowserGpsPosition(position, options = {}) {
        const {
            stopPlayback = true,
            persist = true,
            rerender = true,
            warnOnLowAccuracy = true
        } = options;

        if (!position || !position.coords) {
            throw new Error('定位数据无效');
        }

        const lat = Number(position.coords.latitude);
        const lon = Number(position.coords.longitude);
        const worldPos = this.browserGeoToWorld(lon, lat);
        if (!worldPos) {
            throw new Error('未完成GPS校准，请先点击“校准GPS到当前点”');
        }

        const bounded = this.clampPointToBounds(worldPos);
        const accuracy = Number(position.coords.accuracy);
        const warnThreshold = Number(this.gpsLocateOptions?.warnAccuracyThreshold) || 20;
        if (warnOnLowAccuracy && Number.isFinite(accuracy) && accuracy > warnThreshold) {
            console.warn(`浏览器GPS精度较差: ±${accuracy.toFixed(1)}m`);
        }

        if (stopPlayback) {
            this.stopPlay();
        }
        this.startPoint = { ...bounded };
        this.carPosition = { ...bounded };
        this.currentFrame = 0;
        this.updateCoordinateDisplay(bounded.x, bounded.y, 0);

        if (persist) {
            this.persistSceneSnapshot();
        }
        if (rerender) {
            this.requestRender();
        }

        return { bounded, accuracy };
    },

async getBestEffortBrowserGeolocation() {
        const coarseOptions = this.gpsLocateOptions?.coarse || { enableHighAccuracy: false, timeout: 12000, maximumAge: 15000 };
        const fineOptions = this.gpsLocateOptions?.fine || { enableHighAccuracy: true, timeout: 30000, maximumAge: 2000 };

        let coarsePosition = null;
        let coarseError = null;
        try {
            coarsePosition = await this.getCurrentBrowserGeolocation(coarseOptions);
            const coarseAccuracy = Number(coarsePosition?.coords?.accuracy);
            if (!Number.isFinite(coarseAccuracy) || coarseAccuracy <= (this.gpsLocateOptions?.warnAccuracyThreshold || 20)) {
                return coarsePosition;
            }
        } catch (error) {
            coarseError = error;
        }

        try {
            return await this.getCurrentBrowserGeolocation(fineOptions);
        } catch (fineError) {
            if (coarsePosition) {
                console.warn('高精度定位失败，回退使用粗定位:', fineError?.message || fineError);
                return coarsePosition;
            }
            if (coarseError) {
                throw coarseError;
            }
            throw fineError;
        }
    },

upgradeGpsAfterCoarseFix() {
        const fineOptions = this.gpsLocateOptions?.fine || { enableHighAccuracy: true, timeout: 30000, maximumAge: 2000 };
        this.getCurrentBrowserGeolocation(fineOptions)
            .then((finePosition) => {
                if (!finePosition || !finePosition.coords) return;
                const fineAccuracy = Number(finePosition.coords.accuracy);
                const currentAccuracy = Number(this.lastGpsAccuracy);
                const hasBetterAccuracy = Number.isFinite(fineAccuracy) && (!Number.isFinite(currentAccuracy) || fineAccuracy <= currentAccuracy);
                if (!hasBetterAccuracy) return;

                const { accuracy } = this.applyBrowserGpsPosition(finePosition, {
                    stopPlayback: false,
                    persist: true,
                    rerender: true,
                    warnOnLowAccuracy: false
                });
                this.lastGpsAccuracy = Number.isFinite(accuracy) ? accuracy : this.lastGpsAccuracy;
            })
            .catch((error) => {
                console.warn('高精度GPS二次定位失败:', error?.message || error);
            });
    },

browserGeoToWorld(lon, lat) {
        if (!this.gpsCalibration) return null;
        const { lat0, lon0, worldX0, worldY0 } = this.gpsCalibration;
        if (!Number.isFinite(lat0) || !Number.isFinite(lon0)) return null;
        const R = 6378137;
        const dLon = (lon - lon0) * Math.PI / 180;
        const dLat = (lat - lat0) * Math.PI / 180;
        const x = dLon * R * Math.cos(lat0 * Math.PI / 180);
        const y = dLat * R;
        return { x: worldX0 + x, y: worldY0 + y };
    },

async syncStartPointFromBrowserGPS(showError = true) {
        try {
            const position = await this.getBestEffortBrowserGeolocation();
            const accuracy = this.applyBrowserGpsPosition(position, {
                stopPlayback: true,
                persist: true,
                rerender: true,
                warnOnLowAccuracy: true
            }).accuracy;
            this.lastGpsAccuracy = Number.isFinite(accuracy) ? accuracy : Infinity;
            this.upgradeGpsAfterCoarseFix();
            return true;
        } catch (error) {
            if (showError) {
                alert(`浏览器GPS同步失败: ${error.message}`);
            }
            return false;
        }
    },

async updateStartPointFromConfiguredGPS(showError = true) {
        const source = this.backendConfig.gpsSource === 'browser' ? 'browser' : 'backend';
        if (source === 'browser') {
            return this.syncStartPointFromBrowserGPS(showError);
        }
        return this.syncStartPointFromBackendGPS(showError);
    },

async calibrateGpsAtCurrentCoordinate() {
        const x = Number(document.getElementById('coord-x').value);
        const y = Number(document.getElementById('coord-y').value);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            alert('当前坐标无效，请先在地图上确认目标点');
            return;
        }

        try {
            const position = await this.getBestEffortBrowserGeolocation();
            this.gpsCalibration = {
                lat0: position.coords.latitude,
                lon0: position.coords.longitude,
                worldX0: x,
                worldY0: y
            };
            this.persistSceneSnapshot();
            alert(`GPS校准完成\nGPS: (${this.gpsCalibration.lat0.toFixed(7)}, ${this.gpsCalibration.lon0.toFixed(7)})\n地图: (${x.toFixed(3)}, ${y.toFixed(3)})`);
        } catch (error) {
            alert(`GPS校准失败: ${error.message}`);
        }
    },

toggleGpsTracking() {
        const btn = document.getElementById('toggle-gps-track');
        if (!btn) return;

        if (this.gpsTrackWatchId !== null) {
            navigator.geolocation.clearWatch(this.gpsTrackWatchId);
            this.gpsTrackWatchId = null;
            btn.textContent = '开启GPS跟踪';
            return;
        }

        if (!this.browserGpsSupported) {
            alert('当前浏览器不支持地理定位');
            return;
        }
        if (!this.gpsCalibration) {
            alert('请先点击“校准GPS到当前点”完成一次标定');
            return;
        }

        this.gpsTrackWatchId = navigator.geolocation.watchPosition(
            (pos) => {
                const worldPosRaw = this.browserGeoToWorld(pos.coords.longitude, pos.coords.latitude);
                if (!worldPosRaw) return;
                const worldPos = this.clampPointToBounds(worldPosRaw);
                if (!worldPos) return;
                this.startPoint = { ...worldPos };
                this.carPosition = { ...worldPos };
                this.currentFrame = 0;
                this.updateCoordinateDisplay(worldPos.x, worldPos.y, 0);
                this.persistSceneSnapshot();
                this.requestRender();
            },
            (err) => {
                alert(`GPS跟踪失败: ${err.message || '未知错误'}`);
                if (this.gpsTrackWatchId !== null) {
                    navigator.geolocation.clearWatch(this.gpsTrackWatchId);
                    this.gpsTrackWatchId = null;
                }
                btn.textContent = '开启GPS跟踪';
            },
            this.gpsLocateOptions?.watch || { enableHighAccuracy: true, timeout: 30000, maximumAge: 5000 }
        );
        btn.textContent = '关闭GPS跟踪';
    },

mapBackendGpsPayload(data) {
        if (!data || typeof data !== 'object') return null;

        const xCandidates = [
            data.x, data.posX, data.positionX, data.east, data.easting, data.lng, data.lon, data.longitude
        ];
        const yCandidates = [
            data.y, data.posY, data.positionY, data.north, data.northing, data.lat, data.latitude
        ];

        let x = null;
        let y = null;
        let xKind = '';
        let yKind = '';

        for (const c of xCandidates) {
            const n = Number(c);
            if (Number.isFinite(n)) {
                x = n;
                if (c === data.lng || c === data.lon || c === data.longitude) {
                    xKind = 'geo';
                } else {
                    xKind = 'metric';
                }
                break;
            }
        }

        for (const c of yCandidates) {
            const n = Number(c);
            if (Number.isFinite(n)) {
                y = n;
                if (c === data.lat || c === data.latitude) {
                    yKind = 'geo';
                } else {
                    yKind = 'metric';
                }
                break;
            }
        }

        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return null;
        }

        if (xKind === 'geo' && yKind === 'geo') {
            const world = this.convertGeoToWorld(x, y);
            if (!world) {
                throw new Error('GPS返回经纬度，但当前OSM缺少地理锚点（lat/lon），无法映射到本地坐标系');
            }
            return world;
        }

        if (xKind === 'geo' || yKind === 'geo') {
            throw new Error('GPS返回坐标字段不完整（经纬度或平面坐标需成对）');
        }

        return { x, y };
    },

convertGeoToWorld(lon, lat) {
        if (!this.osmGeoRef) return null;
        if (!Number.isFinite(this.osmGeoRef.lat0) || !Number.isFinite(this.osmGeoRef.lon0)) return null;
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;

        const local = this.projectLonLatToLocal(lon, lat, this.osmGeoRef);
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

        const lx = (local.x - cx) * totalScale;
        const ly = (local.y - cy) * totalScale;
        const rx = lx * cosA - ly * sinA;
        const ry = lx * sinA + ly * cosA;
        return { x: tx + rx, y: ty + ry };
    },

async submitRouteToBackend() {
        if (!this.backendConfig.routeEndpoint) return;
        if (!this.startPoint || !this.endPoint || this.pathPoints.length < 2) return;

        const payload = {
            start: this.startPoint,
            end: this.endPoint,
            path: this.pathPoints,
            timestamp: Date.now()
        };

        try {
            await fetch(this.backendConfig.routeEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.backendConfig.headers || {})
                },
                body: JSON.stringify(payload)
            });
        } catch (error) {
            console.warn('路径提交后端失败:', error);
        }
    }
};

