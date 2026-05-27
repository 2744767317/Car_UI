(function () {
    window.APP_CONFIG = {
        modeName: 'autoware-local',
        gpsEndpoint: '/api/gps/current',
        routeEndpoint: '/api/route/submit',
        gpsMethod: 'GET',
        headers: {},
        useGpsOnSetEndpoint: true,
        gpsSource: 'backend',
        planningMode: 'autoware',
        wsEndpoint: 'ws://127.0.0.1:8765/ws',
        planningEndpoint: 'http://127.0.0.1:8765/api/route/submit',
        realtimeAutoConnect: false,
        realtimeReconnectMs: 1500,
        realtimePoseTimeoutMs: 3000
    };
})();
