const {
    coreMethods = {},
    controlsMethods = {},
    gpsMethods = {},
    realtimeMethods = {},
    sceneMethods = {},
    interactionPathMethods = {},
    renderMethods = {},
    osmPcdMethods = {}
} = (window.PCVModules || {});

class PointCloudVisualizer {
    constructor() {
        this.canvas = document.getElementById('point-cloud-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.points = [];
        this.pathPoints = [];
        this.demoPathPoints = [];
        this.routePoints = [];
        this.trajectoryPoints = [];
        this.detectedObjects = [];
        this.renderMode = 'intensity';
        this.pointSize = 3;
        this.isPlaying = false;
        this.currentFrame = 0;
        this.carPosition = { x: 0, y: 0 };
        this.playbackRafId = 0;
        this.playbackSegmentIndex = 0;
        this.playbackSegmentT = 0;
        this.playbackLastTimestamp = 0;
        this.playbackSpeed = 2.4;
        this.startPoint = null;
        this.endPoint = null;
        this.mapOffset = { x: 0, y: 0 };
        this.mapScale = 30;
        this.maxRenderPoints = 90000;
        this.interactionRenderPoints = 22000;
        this.viewDistanceScaleFactor = 1.5;
        this.minMapScale = 5;
        this.maxMapScale = 300;
        this.carBaseScale = 0.72;
        this.carMinScale = 0.52;
        this.carMaxScale = 1.05;
        this.carScaleWithZoom = true;
        this.isPanning = false;
        this.dragMoved = false;
        this.panStart = { x: 0, y: 0 };
        this.mapOffsetStart = { x: 0, y: 0 };
        this.endpointPickMode = false;
        this.renderPending = false;
        this.bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        this.operationalBounds = null;
        this.obstacles = [];
        this.obstacleAvoidanceEnabled = false;
        this.drivingMode = 'point-to-point';
        this.mouseMoveThrottleMs = 33;
        this.lastMouseCoordUpdateAt = 0;
        this.vehicleYaw = null;
        this.vehicleSpeed = 0;
        this.vehiclePoseTimestamp = 0;
        this.vehiclePose = null;
        this.connectionStatus = 'offline';
        this.selectedGoalYaw = 0;

        this.osmWays = [];
        this.osmGeoRef = null;
        this.osmBounds = null;
        this.osmVisible = true;
        this.osmOpacity = 0.8;
        this.osmScalePercent = 100;
        this.osmRotationDeg = 0;
        this.osmOffsetX = 0;
        this.osmOffsetY = 0;
        this.osmCache = { key: '', worldWays: [] };

        this.backendConfig = this.createBackendConfig();
        this.realtimeConfig = this.createRealtimeConfig();
        this.realtimeSocket = null;
        this.realtimeEnabled = false;
        this.realtimeConnected = false;
        this.realtimeReconnectTimer = 0;
        this.realtimeReconnectAttempts = 0;
        this.realtimeHealthTimer = 0;
        this.realtimeLastMessageAt = 0;
        this.realtimeLastPose = null;
        this.sceneStorageKey = 'point_cloud_scene_v1';
        this.scenePreset = this.createScenePresetConfig();
        this.currentPcdFile = this.scenePreset.pcdFile || 'pointcloud_map.pcd';
        this.currentOsmFile = this.scenePreset.osmFile || 'lanelet2_map.osm';
        this.isRestoringScene = false;
        this.browserGpsSupported = typeof navigator !== 'undefined' && !!navigator.geolocation;
        this.gpsTrackWatchId = null;
        this.gpsCalibration = null;
        this.lastGpsAccuracy = Infinity;
        this.gpsLocateOptions = {
            coarse: { enableHighAccuracy: false, timeout: 12000, maximumAge: 15000 },
            fine: { enableHighAccuracy: true, timeout: 30000, maximumAge: 2000 },
            watch: { enableHighAccuracy: true, timeout: 30000, maximumAge: 5000 },
            warnAccuracyThreshold: 20
        };
        this.init();
    }
}

Object.assign(
    PointCloudVisualizer.prototype,
    coreMethods,
    controlsMethods,
    gpsMethods,
    realtimeMethods,
    sceneMethods,
    interactionPathMethods,
    renderMethods,
    osmPcdMethods
);

document.addEventListener('DOMContentLoaded', () => {
    new PointCloudVisualizer();
});
