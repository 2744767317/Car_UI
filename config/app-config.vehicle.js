(function () {
    window.APP_CONFIG = {
        modeName: 'vehicle-test',
        gpsEndpoint: '/api/gps/current',
        routeEndpoint: '/api/route/submit',
        gpsMethod: 'GET',
        headers: {},
        useGpsOnSetEndpoint: true,
        gpsSource: 'backend',
        planningMode: 'autoware',
        wsEndpoint: 'ws://192.168.1.100:8765/ws',
        planningEndpoint: 'http://192.168.1.100:8765/api/route/submit',
        realtimeAutoConnect: true,
        realtimeReconnectMs: 1500,
        realtimePoseTimeoutMs: 3000
    };
})();
