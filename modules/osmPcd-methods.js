window.PCVModules = window.PCVModules || {};
window.PCVModules.osmPcdMethods = {
selectFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pcd,.txt,.osm,.xml,.geojson,.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                this.routeSelectedFile(file);
            }
        };
        input.click();
    },

async routeSelectedFile(file) {
        const lower = (file.name || '').toLowerCase();
        if (lower.endsWith('.osm') || lower.endsWith('.xml')) {
            await this.loadOsmFile(file);
            return;
        }
        if (lower.endsWith('.geojson') || lower.endsWith('.json')) {
            const shouldTreatAsOsm = confirm('检测到 .json 文件，按 OSM/GeoJSON 导入吗？\n选择“取消”则按点云文件处理。');
            if (shouldTreatAsOsm) {
                await this.loadOsmFile(file);
            } else {
                await this.loadPCDFile(file);
            }
            return;
        }
        await this.loadPCDFile(file);
    },

selectOsmFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.osm,.xml,.geojson,.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                this.loadOsmFile(file);
            }
        };
        input.click();
    },

clearOsm() {
        this.osmWays = [];
        this.osmGeoRef = null;
        this.osmBounds = null;
        this.osmCache = { key: '', worldWays: [] };
        this.currentOsmFile = '';
        this.persistSceneSnapshot();
        this.requestRender();
    },

async loadOsmFile(file) {
        try {
            const text = await file.text();
            const source = text.trim();

            let geoWays;
            if (source.startsWith('{') || source.startsWith('[')) {
                geoWays = this.parseGeoJsonWays(JSON.parse(source));
            } else {
                geoWays = this.parseOsmXmlWays(source);
            }

            if (!geoWays.length) {
                throw new Error('未解析到可绘制的道路/边界线');
            }

            this.prepareOsmGeometry(geoWays);
            this.currentOsmFile = file.name || this.currentOsmFile;
            this.persistSceneSnapshot();
            this.requestRender();
            alert(`OSM导入成功: ${file.name}\n线段数量: ${this.osmWays.length}`);
        } catch (error) {
            alert('OSM导入失败: ' + error.message);
        }
    },

parseOsmXmlWays(xmlText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, 'application/xml');

        if (doc.querySelector('parsererror')) {
            throw new Error('OSM XML格式错误');
        }

        const nodes = new Map();
        const nodeElements = doc.getElementsByTagName('node');
        for (let i = 0; i < nodeElements.length; i++) {
            const n = nodeElements[i];
            const id = n.getAttribute('id');
            if (!id) continue;

            const lat = this.parseNumericXmlAttr(n.getAttribute('lat'));
            const lon = this.parseNumericXmlAttr(n.getAttribute('lon'));
            let localX = null;
            let localY = null;

            const tags = n.getElementsByTagName('tag');
            for (let t = 0; t < tags.length; t++) {
                const k = (tags[t].getAttribute('k') || '').trim().toLowerCase();
                const v = this.parseNumericXmlAttr(tags[t].getAttribute('v'));
                if (k === 'local_x' && Number.isFinite(v)) localX = v;
                if (k === 'local_y' && Number.isFinite(v)) localY = v;
            }

            const hasGeo = Number.isFinite(lat) && Number.isFinite(lon);
            const hasLocal = Number.isFinite(localX) && Number.isFinite(localY);
            if (!hasGeo && !hasLocal) continue;

            nodes.set(id, {
                lat: hasGeo ? lat : null,
                lon: hasGeo ? lon : null,
                x: hasLocal ? localX : null,
                y: hasLocal ? localY : null
            });
        }

        const ways = [];
        const wayElements = doc.getElementsByTagName('way');
        for (let i = 0; i < wayElements.length; i++) {
            const way = wayElements[i];
            const nds = way.getElementsByTagName('nd');
            const coords = [];
            for (let j = 0; j < nds.length; j++) {
                const ref = nds[j].getAttribute('ref');
                if (!ref || !nodes.has(ref)) continue;
                coords.push(nodes.get(ref));
            }
            if (coords.length >= 2) {
                ways.push(coords);
            }
        }

        return ways;
    },

parseNumericXmlAttr(value) {
        if (value === null || value === undefined) return null;
        const trimmed = String(value).trim();
        if (!trimmed) return null;
        const num = Number(trimmed);
        return Number.isFinite(num) ? num : null;
    },

parseGeoJsonWays(data) {
        if (!data) return [];

        const features = Array.isArray(data.features) ? data.features : Array.isArray(data) ? data : [data];
        const ways = [];

        const pushLine = (coords) => {
            if (!Array.isArray(coords) || coords.length < 2) return;
            const line = [];
            for (const c of coords) {
                if (!Array.isArray(c) || c.length < 2) continue;
                const lon = Number(c[0]);
                const lat = Number(c[1]);
                if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
                line.push({ lat, lon });
            }
            if (line.length >= 2) ways.push(line);
        };

        for (const feature of features) {
            const geometry = feature && feature.type === 'Feature' ? feature.geometry : feature.geometry ? feature.geometry : feature;
            if (!geometry || !geometry.type) continue;

            if (geometry.type === 'LineString') {
                pushLine(geometry.coordinates);
            } else if (geometry.type === 'MultiLineString') {
                for (const line of geometry.coordinates || []) pushLine(line);
            } else if (geometry.type === 'Polygon') {
                for (const ring of geometry.coordinates || []) pushLine(ring);
            } else if (geometry.type === 'MultiPolygon') {
                for (const polygon of geometry.coordinates || []) {
                    for (const ring of polygon || []) pushLine(ring);
                }
            }
        }

        return ways;
    },

prepareOsmGeometry(geoWays) {
        let geoCount = 0;
        let localCount = 0;
        let latSum = 0;
        let lonSum = 0;

        for (const way of geoWays) {
            for (const p of way) {
                if (Number.isFinite(p.lat) && Number.isFinite(p.lon)) {
                    geoCount++;
                    latSum += p.lat;
                    lonSum += p.lon;
                }
                if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
                    localCount++;
                }
            }
        }

        const useLocal = localCount > 0 && localCount >= geoCount;
        if (!useLocal && geoCount === 0) {
            throw new Error('OSM点坐标为空（缺少 lat/lon 或 local_x/local_y）');
        }

        if (useLocal) {
            this.osmGeoRef = {};
        } else {
            const lat0 = latSum / geoCount;
            const lon0 = lonSum / geoCount;
            this.osmGeoRef = { lat0, lon0 };
        }

        const localWays = [];
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        for (const way of geoWays) {
            const localLine = [];
            for (const p of way) {
                let local = null;
                if (useLocal) {
                    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
                    local = { x: p.x, y: p.y };
                } else {
                    if (!Number.isFinite(p.lon) || !Number.isFinite(p.lat)) continue;
                    local = this.projectLonLatToLocal(p.lon, p.lat, this.osmGeoRef);
                }
                localLine.push(local);
                if (local.x < minX) minX = local.x;
                if (local.x > maxX) maxX = local.x;
                if (local.y < minY) minY = local.y;
                if (local.y > maxY) maxY = local.y;
            }
            if (localLine.length >= 2) localWays.push(localLine);
        }

        this.osmWays = localWays;
        this.osmBounds = { minX, maxX, minY, maxY };
        this.osmCache = { key: '', worldWays: [] };
        this.fitOsmToPointCloud();
    },

projectLonLatToLocal(lon, lat, ref) {
        const R = 6378137;
        const dLon = (lon - ref.lon0) * Math.PI / 180;
        const dLat = (lat - ref.lat0) * Math.PI / 180;
        const x = dLon * R * Math.cos(ref.lat0 * Math.PI / 180);
        const y = dLat * R;
        return { x, y };
    },

fitOsmToPointCloud() {
        if (!this.osmBounds) return;

        const osmWidth = Math.max(0.001, this.osmBounds.maxX - this.osmBounds.minX);
        const osmHeight = Math.max(0.001, this.osmBounds.maxY - this.osmBounds.minY);
        const pointWidth = Math.max(0.001, this.bounds.maxX - this.bounds.minX);
        const pointHeight = Math.max(0.001, this.bounds.maxY - this.bounds.minY);

        const fitScaleX = pointWidth / osmWidth;
        const fitScaleY = pointHeight / osmHeight;
        const fitScale = Math.max(0.000001, Math.min(fitScaleX, fitScaleY) * 0.92);

        const osmCenterX = (this.osmBounds.minX + this.osmBounds.maxX) / 2;
        const osmCenterY = (this.osmBounds.minY + this.osmBounds.maxY) / 2;
        const pointCenterX = (this.bounds.minX + this.bounds.maxX) / 2;
        const pointCenterY = (this.bounds.minY + this.bounds.maxY) / 2;

        this.osmGeoRef.fitScale = fitScale;
        this.osmGeoRef.osmCenterX = osmCenterX;
        this.osmGeoRef.osmCenterY = osmCenterY;
        this.osmGeoRef.targetCenterX = pointCenterX;
        this.osmGeoRef.targetCenterY = pointCenterY;
        this.osmCache = { key: '', worldWays: [] };
    },

async loadPCDFile(file) {
        try {
            const buffer = await file.arrayBuffer();
            this.parsePCDBuffer(buffer);
            this.currentPcdFile = file.name || this.currentPcdFile;
            this.persistSceneSnapshot();
            alert(`成功加载点云文件: ${file.name}\n点数量: ${this.points.length}`);
        } catch (error) {
            alert('加载文件失败: ' + error.message);
        }
    },

parsePCD(text) {
        const encoded = new TextEncoder().encode(text);
        this.parsePCDBuffer(encoded.buffer);
    },

parsePCDBuffer(buffer) {
        const header = this.parsePCDHeader(buffer);
        let points = [];

        if (header.data === 'ascii') {
            points = this.parsePCDAscii(buffer, header);
        } else if (header.data === 'binary') {
            points = this.parsePCDBinary(buffer, header);
        } else if (header.data === 'binary_compressed') {
            throw new Error('当前版本不支持 DATA binary_compressed');
        } else {
            throw new Error(`不支持的 DATA 类型: ${header.data}`);
        }

        this.applyParsedPoints(points);
    },

parsePCDHeader(buffer) {
        const bytes = new Uint8Array(buffer);
        const previewLength = Math.min(bytes.length, 1024 * 1024);
        const previewText = new TextDecoder('ascii').decode(bytes.slice(0, previewLength));
        const dataMatch = previewText.match(/(^|\r?\n)DATA\s+([a-zA-Z_]+)\s*\r?\n/i);

        if (!dataMatch) {
            throw new Error('PCD 头部缺少 DATA 字段');
        }

        const matchStart = dataMatch.index + dataMatch[1].length;
        const lineText = dataMatch[0].slice(dataMatch[1].length);
        const headerEndCharIndex = matchStart + lineText.length;
        const headerText = previewText.slice(0, headerEndCharIndex);
        const lines = headerText.split(/\r?\n/);
        const header = {
            fields: [],
            sizes: [],
            types: [],
            counts: [],
            width: 0,
            height: 1,
            points: 0,
            data: dataMatch[2].toLowerCase(),
            dataOffset: headerEndCharIndex
        };

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || line.startsWith('#')) continue;

            const parts = line.split(/\s+/);
            const key = parts[0].toUpperCase();
            const values = parts.slice(1);

            if (key === 'FIELDS') {
                header.fields = values;
            } else if (key === 'SIZE') {
                header.sizes = values.map(v => parseInt(v, 10));
            } else if (key === 'TYPE') {
                header.types = values.map(v => v.toUpperCase());
            } else if (key === 'COUNT') {
                header.counts = values.map(v => parseInt(v, 10));
            } else if (key === 'WIDTH') {
                header.width = parseInt(values[0], 10);
            } else if (key === 'HEIGHT') {
                header.height = parseInt(values[0], 10);
            } else if (key === 'POINTS') {
                header.points = parseInt(values[0], 10);
            }
        }

        if (!header.fields.length) {
            throw new Error('PCD 头部缺少 FIELDS');
        }

        if (!header.counts.length) {
            header.counts = new Array(header.fields.length).fill(1);
        }

        while (header.sizes.length < header.fields.length) header.sizes.push(4);
        while (header.types.length < header.fields.length) header.types.push('F');
        while (header.counts.length < header.fields.length) header.counts.push(1);

        if (!header.points || Number.isNaN(header.points)) {
            header.points = (header.width || 0) * (header.height || 1);
        }

        return header;
    },

parsePCDAscii(buffer, header) {
        const bytes = new Uint8Array(buffer, header.dataOffset);
        const text = new TextDecoder('utf-8').decode(bytes);
        const lines = text.split(/\r?\n/);
        const points = [];

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;

            const values = line.split(/\s+/);
            const point = {};
            let cursor = 0;

            for (let i = 0; i < header.fields.length; i++) {
                const field = header.fields[i];
                const count = header.counts[i] || 1;

                if (count === 1) {
                    point[field] = parseFloat(values[cursor]);
                } else {
                    const arr = [];
                    for (let c = 0; c < count; c++) {
                        arr.push(parseFloat(values[cursor + c]));
                    }
                    point[field] = arr;
                }

                cursor += count;
            }

            points.push(point);
        }

        return points;
    },

parsePCDBinary(buffer, header) {
        const fields = [];
        let pointStep = 0;

        for (let i = 0; i < header.fields.length; i++) {
            const field = {
                name: header.fields[i],
                size: header.sizes[i],
                type: header.types[i],
                count: header.counts[i],
                offset: pointStep
            };
            fields.push(field);
            pointStep += field.size * field.count;
        }

        if (pointStep <= 0) {
            throw new Error('PCD 点步长无效');
        }

        const availableBytes = buffer.byteLength - header.dataOffset;
        let pointCount = header.points;
        if (!pointCount || pointCount <= 0) {
            pointCount = Math.floor(availableBytes / pointStep);
        } else {
            pointCount = Math.min(pointCount, Math.floor(availableBytes / pointStep));
        }

        const points = [];
        const view = new DataView(buffer, header.dataOffset);

        for (let i = 0; i < pointCount; i++) {
            const baseOffset = i * pointStep;
            const point = {};

            for (const field of fields) {
                const valueOffset = baseOffset + field.offset;
                if (field.count === 1) {
                    point[field.name] = this.parsePCDBinaryValue(view, valueOffset, field.type, field.size);
                } else {
                    const arr = [];
                    for (let c = 0; c < field.count; c++) {
                        arr.push(this.parsePCDBinaryValue(view, valueOffset + c * field.size, field.type, field.size));
                    }
                    point[field.name] = arr;
                }
            }

            points.push(point);
        }

        return points;
    },

parsePCDBinaryValue(view, offset, type, size) {
        if (type === 'F') {
            if (size === 4) return view.getFloat32(offset, true);
            if (size === 8) return view.getFloat64(offset, true);
        } else if (type === 'U') {
            if (size === 1) return view.getUint8(offset);
            if (size === 2) return view.getUint16(offset, true);
            if (size === 4) return view.getUint32(offset, true);
        } else if (type === 'I') {
            if (size === 1) return view.getInt8(offset);
            if (size === 2) return view.getInt16(offset, true);
            if (size === 4) return view.getInt32(offset, true);
        }

        throw new Error(`不支持字段类型: ${type}${size}`);
    },

applyParsedPoints(rawPoints) {
        const points = [];

        for (const raw of rawPoints) {
            const x = Number(raw.x);
            const y = Number(raw.y);

            if (!Number.isFinite(x) || !Number.isFinite(y)) {
                continue;
            }

            const z = Number.isFinite(Number(raw.z)) ? Number(raw.z) : 0;
            let intensity = Number(raw.intensity);

            if (!Number.isFinite(intensity)) {
                intensity = 0.5;
            }

            points.push({ x, y, z, intensity });
        }

        if (points.length === 0) {
            throw new Error('未解析到有效点坐标（x/y）');
        }

        this.points = points;
        this.calculateBounds();
        this.updateView();
        this.generateObstacles();
        this.pathPoints = [];
        this.startPoint = null;
        this.endPoint = null;
        this.endpointPickMode = false;
        this.updateEndpointButtonStyle();
        this.carPosition = { x: 0, y: 0 };
        this.currentFrame = 0;
        this.persistSceneSnapshot();
        this.requestRender();
    }
};

