const latlngList = [
    // { lat: 43.8747, lon: -79.4265 }, // richmond hill go station
    // { lat: 43.8375, lon: -79.4225 }, // langstaff go station
    // { lat: 43.7936, lon: -79.3714 }, // old cummer go station
    // { lat: 43.7614, lon: -79.4108 }, // yonge&sheppard
    // { lat: 43.7656, lon: -79.3647 }, // Oriole GO Station
    // { lat: 43.7814, lon: -79.4158 }, // yonge&finch
    // { lat: 43.6444, lon: -79.3872 }, // front&university (使用 Union Station 附近的坐标，即 43°38′40″N, 79°22′49″W)
    // { lat: 43.6419, lon: -79.3950 }, // front&spadina
    // { lat: 43.6567, lon: -79.3811 }, // dundas&bay (使用 Dundas Station 附近的坐标，即 43°39′24″N, 79°22′52″W)
    { "lat": 43.6449636, "lon": -79.3846864, "area": 1500 }, // OTPP
    { "lat": 43.6702466, "lon": -79.3867799, "area": 1500 }, // YB
    { "lat": 43.6643907, "lon": -79.3871406, "area": 1500 } // BW
]

const mainbody = {
    "ZoomLevel": 10,
    "CurrentPage": 2,
    "Sort": "6-D",
    "PropertyTypeGroupID": 1,
    "TransactionTypeId": 3,
    "PropertySearchTypeId": 1,
    "RentMin": 2000,
    "RentMax": 4000,
    "BedRange": "2-0",
    "BathRange": "1-0",
    "SQFTRange": "699-1299",
    "Keywords": "Pets Allowed,Garage,Carpet Free",
    "Currency": "CAD",
    "IncludeHiddenListings": false,
    "RecordsPerPage": 25,
    "ApplicationId": 1,
    "CultureId": 1,
    "Version": "7.0"
}

/**
 * 计算给定中心点和半径的外接矩形（Bounding Box）的经纬度范围。
 * @param {number} centerLat 中心点纬度 (例如: 40.0000)
 * @param {number} centerLon 中心点经度 (例如: 116.4000)
 * @param {number} radiusInMeters 半径（单位：米）(例如: 2000)
 * @returns {object} 包含 minLat, maxLat, minLon, maxLon 的对象
 */
function calculateBoundingBox(centerLat, centerLon, radiusInMeters) {
    // 地球的平均半径（米）。使用 WGS84 椭球体的近似值。
    const EARTH_RADIUS_M = 6371000;

    // 半径（度数）
    const angularRadius = radiusInMeters / EARTH_RADIUS_M;

    // --- 1. 计算纬度变化量 (Delta Latitude) ---

    // 纬度变化量（度）。
    // 转换为度数：弧度 * (180 / PI)
    const deltaLat = angularRadius * (180 / Math.PI);

    const minLat = centerLat - deltaLat;
    const maxLat = centerLat + deltaLat;

    // --- 2. 计算经度变化量 (Delta Longitude) ---

    // 中心纬度转换为弧度
    const latInRadians = centerLat * (Math.PI / 180);

    // 计算 cos(纬度)，用于修正经度变化量
    const cosLat = Math.cos(latInRadians);

    let minLon, maxLon;

    // 避免在极点附近（cosLat 接近 0）进行除法运算
    if (cosLat === 0) {
        // 如果在极点，经度没有意义，但为了返回一个有效的框，我们使用整个经度范围
        minLon = -180;
        maxLon = 180;
    } else {
        // 经度变化量（度）：
        // deltaLon = (radiusInMeters / (EARTH_RADIUS_M * cosLat)) * (180 / PI)
        const deltaLon = deltaLat / cosLat;

        minLon = centerLon - deltaLon;
        maxLon = centerLon + deltaLon;

        // 经度边界处理：确保经度在 [-180, 180] 范围内
        if (minLon < -180) {
            minLon += 360;
        }
        if (maxLon > 180) {
            maxLon -= 360;
        }
    }

    // 整理并返回结果
    return {
        // 纬度（Lat）范围
        minLatitude: minLat,
        maxLatitude: maxLat,
        // 经度（Lon）范围
        minLongitude: minLon,
        maxLongitude: maxLon
    };
}

const allConfigs = [
    ...latlngList.map(({ lat, lon, area }) => {
        const bbox = calculateBoundingBox(lat, lon, area ? area : 2000);
        return {
            "LatitudeMax": bbox.maxLatitude,
            "LongitudeMax": bbox.maxLongitude,
            "LatitudeMin": bbox.minLatitude,
            "LongitudeMin": bbox.minLongitude,
            ...mainbody,
        }
    })
]

/**
 * 导出配置
 */
module.exports = {
    allConfigs,
};
