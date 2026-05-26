window.PCVModules = window.PCVModules || {};
window.PCVModules.sceneMethods = {
createBackendConfig() {
        const defaults = {
            apiBaseUrl: '',
            gpsEndpoint: '/api/gps/current',
            routeEndpoint: '/api/route/submit',
            gpsMethod: 'GET',
            headers: {},
            useGpsOnSetEndpoint: true,
            gpsSource: 'backend'
        };

        if (!window.APP_CONFIG || typeof window.APP_CONFIG !== 'object') {
            return defaults;
        }

        return {
            apiBaseUrl: window.APP_CONFIG.apiBaseUrl || defaults.apiBaseUrl,
            gpsEndpoint: window.APP_CONFIG.gpsEndpoint || defaults.gpsEndpoint,
            routeEndpoint: window.APP_CONFIG.routeEndpoint || defaults.routeEndpoint,
            gpsMethod: window.APP_CONFIG.gpsMethod || defaults.gpsMethod,
            headers: window.APP_CONFIG.headers || defaults.headers,
            useGpsOnSetEndpoint: window.APP_CONFIG.useGpsOnSetEndpoint !== undefined
                ? !!window.APP_CONFIG.useGpsOnSetEndpoint
                : defaults.useGpsOnSetEndpoint,
            gpsSource: (window.APP_CONFIG.gpsSource || defaults.gpsSource).toLowerCase()
        };
    },

createScenePresetConfig() {
        const defaults = {
            pcdFile: 'pointcloud_map.pcd',
            osmFile: 'lanelet2_map.osm',
            startPoint: null,
            osmSettings: null
        };

        if (!window.APP_SCENE || typeof window.APP_SCENE !== 'object') {
            return defaults;
        }

        return {
            pcdFile: window.APP_SCENE.pcdFile || defaults.pcdFile,
            osmFile: window.APP_SCENE.osmFile || defaults.osmFile,
            startPoint: window.APP_SCENE.startPoint || defaults.startPoint,
            osmSettings: window.APP_SCENE.osmSettings || defaults.osmSettings
        };
    },

readSceneSnapshot() {
        try {
            const raw = localStorage.getItem(this.sceneStorageKey);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (error) {
            console.warn('读取场景快照失败:', error);
            return null;
        }
    },

    buildSceneSnapshot() {
        const safePoint = (p) => {
            if (!p) return null;
            if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
            return { x: Number(p.x), y: Number(p.y) };
        };

        const safePointArray = (points) => {
            if (!Array.isArray(points)) return [];
            return points
                .map(safePoint)
                .filter(Boolean);
        };

        const safeBounds = (bounds) => {
            if (!bounds || typeof bounds !== 'object') return null;
            const minX = Number(bounds.minX);
            const maxX = Number(bounds.maxX);
            const minY = Number(bounds.minY);
            const maxY = Number(bounds.maxY);
            if (![minX, maxX, minY, maxY].every(Number.isFinite)) return null;
            return { minX, maxX, minY, maxY };
        };

        const safeGeoRef = (ref) => {
            if (!ref || typeof ref !== 'object') return null;
            const lat0 = Number(ref.lat0);
            const lon0 = Number(ref.lon0);
            if (![lat0, lon0].every(Number.isFinite)) return null;

            const out = { lat0, lon0 };
            const numericKeys = ['fitScale', 'osmCenterX', 'osmCenterY', 'targetCenterX', 'targetCenterY'];
            for (const key of numericKeys) {
                const value = Number(ref[key]);
                if (Number.isFinite(value)) {
                    out[key] = value;
                }
            }
            return out;
        };

        const pathPoints = safePointArray(this.pathPoints);
        const pathDistance = pathPoints.length < 2
            ? 0
            : pathPoints.slice(1).reduce((sum, point, index) => {
                const prev = pathPoints[index];
                const dx = point.x - prev.x;
                const dy = point.y - prev.y;
                return sum + Math.sqrt(dx * dx + dy * dy);
            }, 0);

        return {
            version: 1,
            updatedAt: Date.now(),
            pcdFile: this.currentPcdFile || this.scenePreset.pcdFile || 'pointcloud_map.pcd',
            osmFile: this.currentOsmFile || this.scenePreset.osmFile || 'lanelet2_map.osm',
            startPoint: safePoint(this.startPoint),
            endPoint: safePoint(this.endPoint),
            pathPoints,
            pathDistance,
            drivingMode: this.drivingMode,
            obstacleAvoidanceEnabled: !!this.obstacleAvoidanceEnabled,
            renderMode: this.renderMode,
            pointSize: Number(this.pointSize),
            currentFrame: Number(this.currentFrame) || 0,
            isPlaying: !!this.isPlaying,
            gpsCalibration: this.gpsCalibration ? {
                lat0: Number(this.gpsCalibration.lat0),
                lon0: Number(this.gpsCalibration.lon0),
                worldX0: Number(this.gpsCalibration.worldX0),
                worldY0: Number(this.gpsCalibration.worldY0)
            } : null,
            osmGeoRef: safeGeoRef(this.osmGeoRef),
            effectiveBounds: safeBounds(this.getEffectiveBounds()),
            osmSettings: {
                visible: !!this.osmVisible,
                opacity: Number(this.osmOpacity),
                scalePercent: Number(this.osmScalePercent),
                rotationDeg: Number(this.osmRotationDeg),
                offsetX: Number(this.osmOffsetX),
                offsetY: Number(this.osmOffsetY)
            }
        };
    },

    getRuntimeSnapshot() {
        const snapshot = this.buildSceneSnapshot();
        return {
            ...snapshot,
            mapScale: Number(this.mapScale) || 0,
            mapOffset: {
                x: Number(this.mapOffset?.x) || 0,
                y: Number(this.mapOffset?.y) || 0
            },
            endpointPickMode: !!this.endpointPickMode,
            gpsTrackingEnabled: this.gpsTrackWatchId !== null
        };
    },

persistSceneSnapshot() {
        if (this.isRestoringScene) return;
        try {
            localStorage.setItem(this.sceneStorageKey, JSON.stringify(this.buildSceneSnapshot()));
        } catch (error) {
            console.warn('保存场景快照失败:', error);
        }
    },

applyOsmSettings(settings) {
        if (!settings || typeof settings !== 'object') return;

        const visible = settings.visible;
        const opacity = Number(settings.opacity);
        const scalePercent = Number(settings.scalePercent);
        const rotationDeg = Number(settings.rotationDeg);
        const offsetX = Number(settings.offsetX);
        const offsetY = Number(settings.offsetY);

        if (typeof visible === 'boolean') this.osmVisible = visible;
        if (Number.isFinite(opacity)) this.osmOpacity = Math.max(0, Math.min(1, opacity));
        if (Number.isFinite(scalePercent)) this.osmScalePercent = Math.max(1, scalePercent);
        if (Number.isFinite(rotationDeg)) this.osmRotationDeg = rotationDeg;
        if (Number.isFinite(offsetX)) this.osmOffsetX = offsetX;
        if (Number.isFinite(offsetY)) this.osmOffsetY = offsetY;

        const elVisible = document.getElementById('osm-visible');
        const elOpacity = document.getElementById('osm-opacity');
        const elScale = document.getElementById('osm-scale');
        const elRotation = document.getElementById('osm-rotation');
        const elOffsetX = document.getElementById('osm-offset-x');
        const elOffsetY = document.getElementById('osm-offset-y');

        if (elVisible) elVisible.checked = this.osmVisible;
        if (elOpacity) elOpacity.value = String(Math.round(this.osmOpacity * 100));
        if (elScale) elScale.value = String(Math.round(this.osmScalePercent));
        if (elRotation) elRotation.value = String(Math.round(this.osmRotationDeg));
        if (elOffsetX) elOffsetX.value = String(this.osmOffsetX);
        if (elOffsetY) elOffsetY.value = String(this.osmOffsetY);
    },

applyStartPoint(point) {
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
        this.stopPlay();
        this.startPoint = { x: Number(point.x), y: Number(point.y) };
        this.endPoint = null;
        this.pathPoints = [];
        this.currentFrame = 0;
        this.carPosition = { ...this.startPoint };
        this.updateCoordinateDisplay(this.startPoint.x, this.startPoint.y, 0);
        this.requestRender();
        return true;
    },

applyGpsCalibration(calibration) {
        if (!calibration || typeof calibration !== 'object') return false;
        const lat0 = Number(calibration.lat0);
        const lon0 = Number(calibration.lon0);
        const worldX0 = Number(calibration.worldX0);
        const worldY0 = Number(calibration.worldY0);
        if (!Number.isFinite(lat0) || !Number.isFinite(lon0) || !Number.isFinite(worldX0) || !Number.isFinite(worldY0)) {
            return false;
        }
        this.gpsCalibration = { lat0, lon0, worldX0, worldY0 };
        return true;
    },

async loadPCDFromUrl(url, fallbackToMock = false) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const buffer = await response.arrayBuffer();
            this.parsePCDBuffer(buffer);
            this.currentPcdFile = url;
            return true;
        } catch (error) {
            if (fallbackToMock) {
                this.generateMockPointCloud();
                return false;
            }
            throw error;
        }
    },

async loadOsmFromUrl(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const text = await response.text();
            const source = text.trim();
            const geoWays = (source.startsWith('{') || source.startsWith('['))
                ? this.parseGeoJsonWays(JSON.parse(source))
                : this.parseOsmXmlWays(source);
            if (!geoWays.length) throw new Error('未解析到可绘制的道路/边界线');
            this.prepareOsmGeometry(geoWays);
            this.currentOsmFile = url;
            return true;
        } catch (error) {
            console.warn('自动加载OSM失败:', error);
            return false;
        }
    },

async loadStartupScene() {
        this.isRestoringScene = true;
        try {
            const snapshot = this.readSceneSnapshot();

            const pcdFile = (snapshot && snapshot.pcdFile)
                || this.scenePreset.pcdFile
                || 'pointcloud_map.pcd';
            const loadedPCD = await this.loadPCDFromUrl(pcdFile, false).catch(() => false);
            if (!loadedPCD) {
                await this.loadDefaultPCD();
            }

            const osmFile = (snapshot && snapshot.osmFile)
                || this.scenePreset.osmFile
                || 'lanelet2_map.osm';
            if (osmFile) {
                await this.loadOsmFromUrl(osmFile);
            }

            const sceneOsmSettings = (snapshot && snapshot.osmSettings) || this.scenePreset.osmSettings;
            this.applyOsmSettings(sceneOsmSettings);

            const sceneStart = (snapshot && snapshot.startPoint) || this.scenePreset.startPoint;
            if (sceneStart) {
                this.applyStartPoint(sceneStart);
            }

            const sceneCalibration = (snapshot && snapshot.gpsCalibration) || null;
            if (sceneCalibration) {
                this.applyGpsCalibration(sceneCalibration);
            }

            this.requestRender();
        } finally {
            this.isRestoringScene = false;
            this.persistSceneSnapshot();
        }
    }
};
