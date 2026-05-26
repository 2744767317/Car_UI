window.PCVModules = window.PCVModules || {};
window.PCVModules.coreMethods = {
init() {
        this.resizeCanvas();
        this.setupEventListeners();
        this.syncControlStateFromUI();
        this.initRealtimeSource();
        void this.loadStartupScene();
        this.requestRender();
    },

resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.updateView();
    },

async loadDefaultPCD() {
        await this.loadPCDFromUrl('example.pcd', true);
    },

generateMockPointCloud() {
        const points = [];
        const gridSize = 0.5;
        const minX = -5, maxX = 5;
        const minY = -5, maxY = 5;

        for (let x = minX; x <= maxX; x += gridSize) {
            for (let y = minY; y <= maxY; y += gridSize) {
                let z = 0;
                let intensity = 0.3;
                
                if ((Math.abs(x) > 3 || Math.abs(y) > 3)) {
                    z = 0.5 + Math.random() * 0.3;
                    intensity = 0.8 + Math.random() * 0.2;
                } else if ((Math.abs(x) > 1 && Math.abs(x) < 2.5) || (Math.abs(y) > 1 && Math.abs(y) < 2.5)) {
                    z = 0.1 + Math.random() * 0.1;
                    intensity = 0.6 + Math.random() * 0.2;
                } else if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5) {
                    z = 0.3 + Math.random() * 0.2;
                    intensity = 0.9 + Math.random() * 0.1;
                } else {
                    z = 0.05 + Math.random() * 0.05;
                    intensity = 0.4 + Math.random() * 0.2;
                }

                if (Math.random() > 0.1) {
                    points.push({ x, y, z, intensity });
                }
            }
        }

        this.points = points;
        this.calculateBounds();
        this.updateView();
        this.generateObstacles();
    },

calculateBounds() {
        if (this.points.length === 0) return;

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        for (const p of this.points) {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        }

        this.bounds.minX = minX;
        this.bounds.maxX = maxX;
        this.bounds.minY = minY;
        this.bounds.maxY = maxY;
        this.operationalBounds = this.computeOperationalBounds();
    },

computeOperationalBounds() {
        if (!this.points.length) return null;

        const xs = this.points.map(p => p.x).sort((a, b) => a - b);
        const ys = this.points.map(p => p.y).sort((a, b) => a - b);

        const q = (arr, ratio) => {
            if (!arr.length) return 0;
            const idx = Math.max(0, Math.min(arr.length - 1, Math.floor((arr.length - 1) * ratio)));
            return arr[idx];
        };

        // Use a robust bounding box to avoid outliers pulling the effective map limits.
        const minX = q(xs, 0.01);
        const maxX = q(xs, 0.99);
        const minY = q(ys, 0.01);
        const maxY = q(ys, 0.99);

        return {
            minX: Number.isFinite(minX) ? minX : this.bounds.minX,
            maxX: Number.isFinite(maxX) ? maxX : this.bounds.maxX,
            minY: Number.isFinite(minY) ? minY : this.bounds.minY,
            maxY: Number.isFinite(maxY) ? maxY : this.bounds.maxY
        };
    },

getEffectiveBounds() {
        return this.operationalBounds || this.bounds;
    },

updateView() {
        const centerX = (this.bounds.minX + this.bounds.maxX) / 2;
        const centerY = (this.bounds.minY + this.bounds.maxY) / 2;
        
        this.mapOffset.x = this.canvas.width / 2 - centerX * this.mapScale;
        this.mapOffset.y = this.canvas.height / 2 + centerY * this.mapScale;
    },

generateObstacles() {
        this.obstacles = [];
        
        const obstacleAreas = [
            { x: -2.5, y: -2.5, width: 1, height: 1 },
            { x: 1.5, y: -2, width: 1, height: 1 },
            { x: -1.5, y: 1.5, width: 1, height: 1 },
            { x: 2, y: 2, width: 1, height: 1 },
            { x: 0, y: -1, width: 0.5, height: 1.5 }
        ];

        obstacleAreas.forEach(area => {
            for (let x = area.x; x < area.x + area.width; x += 0.2) {
                for (let y = area.y; y < area.y + area.height; y += 0.2) {
                    this.obstacles.push({ x, y });
                }
            }
        });
    }
};

