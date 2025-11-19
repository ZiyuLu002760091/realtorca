const fs = require('fs');
const path = require('path');

/**
 * 配置名称映射（对应 configs.js 中的位置）
 */
const CONFIG_NAMES = [
    'OTPP',
    'Yonge&Bloor',
    'Bay&Wellesley',
];

/**
 * 宠物友好关键词正则表达式
 */
const PET_FRIENDLY_REGEX = /pet[-\s]*(friendly|allowed|ok|welcome)|pets?[-\s]*(friendly|allowed|ok|welcome)|dog[-\s]*(friendly|allowed|ok|welcome)|dogs?[-\s]*(allowed|ok|welcome)|cat[-\s]*(friendly|allowed|ok|welcome)|cats?[-\s]*(allowed|ok|welcome)/gi;

/**
 * 无地毯关键词正则表达式
 */
const CARPET_FREE_REGEX = /carpet[-\s]*free|no[-\s]*carpet|hardwood|laminate[-\s]*floor|tile[-\s]*floor/gi;

/**
 * 车库关键词正则表达式
 */
const GARAGE_REGEX = /garage/gi;

/**
 * Basement/地下室关键词正则表达式（用于过滤）
 * 注意：不使用 'g' 标志，避免正则表达式状态问题
 */
const BASEMENT_REGEX = /basement|bsmt\.?/i;

/**
 * 从文件名中提取 config 编号
 * 例如: "1_config1_2025-10-26T02-01-10-664Z.json" -> 1
 */
function extractConfigNumber(filename) {
    const match = filename.match(/config(\d+)/i);
    return match ? parseInt(match[1]) : null;
}

/**
 * 检查是否包含 basement/BSMT（用于过滤）
 */
function isBasement(addressText, publicRemarks) {
    const textToCheck = `${addressText} ${publicRemarks}`;
    return BASEMENT_REGEX.test(textToCheck);
}

/**
 * 将时间戳转换为年月日格式
 * @param {string} timestamp - .NET 时间戳格式 (例如: "638969156023730000")
 * @returns {string} - 格式化的日期字符串 (例如: "2025-10-24")
 */
function formatTimestamp(timestamp) {
    if (!timestamp) return '';

    try {
        // .NET 时间戳是从 0001-01-01 00:00:00 开始的 100 纳秒为单位
        // JavaScript 时间戳是从 1970-01-01 00:00:00 开始的毫秒为单位

        // .NET DateTime.Ticks 到 Unix 毫秒的转换
        // 621355968000000000 是从 0001-01-01 到 1970-01-01 的 ticks
        const dotNetTicksToUnixEpoch = 621355968000000000n;
        const ticksPerMillisecond = 10000n;

        const ticks = BigInt(timestamp);
        const unixMilliseconds = Number((ticks - dotNetTicksToUnixEpoch) / ticksPerMillisecond);

        const date = new Date(unixMilliseconds);

        // 格式化为 YYYY-MM-DD
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    } catch (error) {
        console.error(`时间戳转换失败: ${timestamp}`, error.message);
        return timestamp; // 如果转换失败，返回原始值
    }
}

/**
 * 检查文本是否包含宠物友好信息
 */
function checkPetFriendly(text) {
    if (!text) return 'unknown';
    const matches = text.match(PET_FRIENDLY_REGEX);
    return matches && matches.length > 0 ? 'y' : 'n';
}

/**
 * 检查文本是否包含无地毯信息
 */
function checkCarpetFree(text) {
    if (!text) return 'unknown';
    const matches = text.match(CARPET_FREE_REGEX);
    return matches && matches.length > 0 ? 'y' : 'n';
}

/**
 * 检查是否有车库
 */
function checkHasGarage(property) {
    if (!property) return false;

    // 检查 Parking 数组
    if (property.Parking && Array.isArray(property.Parking)) {
        const hasGarage = property.Parking.some(p =>
            p.Name && GARAGE_REGEX.test(p.Name)
        );
        if (hasGarage) return true;
    }

    // 检查 ParkingType 字符串
    if (property.ParkingType && GARAGE_REGEX.test(property.ParkingType)) {
        return true;
    }

    return false;
}

/**
 * 将平方英尺转换为数字
 * 支持格式: "1000+ sqft", "1000-1199 sqft", "1000 sqft"
 */
function parseSqft(sqftString) {
    if (!sqftString) return 0;

    // 移除所有非数字和非连字符的字符
    const cleaned = sqftString.replace(/[^\d-]/g, '');

    // 如果包含范围，取平均值
    if (cleaned.includes('-')) {
        const [min, max] = cleaned.split('-').map(Number);
        return (min + max) / 2;
    }

    // 否则直接转换
    return Number(cleaned) || 0;
}

/**
 * 从 Building 对象中提取面积（平方英尺）
 */
function extractSqft(building) {
    if (!building) return 0;

    // 尝试从 FloorAreaMeasurements 获取
    if (building.FloorAreaMeasurements && Array.isArray(building.FloorAreaMeasurements)) {
        for (const measurement of building.FloorAreaMeasurements) {
            if (measurement.AreaUnformatted || measurement.Area) {
                const sqft = parseSqft(measurement.AreaUnformatted || measurement.Area);
                if (sqft > 0) return sqft;
            }
        }
    }

    return 0;
}

/**
 * 从租金字符串中提取数字
 * 例如: "$3,000/Monthly" -> 3000
 */
function extractPrice(priceString) {
    if (!priceString) return 0;
    const cleaned = priceString.replace(/[^\d]/g, '');
    return Number(cleaned) || 0;
}

/**
 * 处理单个 listing 数据
 */
function processListing(result, configNumber) {
    const building = result.Building || {};
    const property = result.Property || {};
    const address = property.Address || {};
    const land = result.Land || {};

    // 提取基础信息
    const mlsNumber = result.MlsNumber || '';
    const addressText = address.AddressText || '';
    const rent = property.LeaseRent || property.Price || '';
    const bedrooms = building.Bedrooms || '';
    const bathrooms = building.BathroomTotal || '';
    const propertyType = building.Type || '';
    const sizeInterior = building.SizeInterior || '';
    const landSize = land.SizeTotal || land.SizeFrontage || '';
    const insertedDate = result.InsertedDateUTC || '';
    const insertedDateFormatted = formatTimestamp(insertedDate); // 格式化时间戳
    const timeOnRealtor = result.TimeOnRealtor || '';
    const link = result.RelativeURLEn
        ? `https://www.realtor.ca${result.RelativeURLEn}`
        : '';

    // 提取停车位数量
    const parkingSpaces = property.ParkingSpaceTotal || '0';

    // 检查是否有车库
    const hasGarage = checkHasGarage(property);

    // 检查宠物友好（从 PublicRemarks 和关键词检查）
    const publicRemarks = result.PublicRemarks || '';
    const petFriendlyFromRemarks = checkPetFriendly(publicRemarks);
    const petFriendly = petFriendlyFromRemarks;

    // 检查无地毯
    const carpetFree = checkCarpetFree(publicRemarks);

    // 提取面积（sqft）
    const sqft = extractSqft(building);

    // 计算租金数字
    const rentValue = extractPrice(rent);

    // 计算性价比（每平方英尺价格）
    const pricePerSqft = sqft > 0 ? (rentValue / sqft).toFixed(2) : 'N/A';

    // 获取配置名称
    const locationName = configNumber && configNumber >= 1 && configNumber <= CONFIG_NAMES.length
        ? CONFIG_NAMES[configNumber - 1]
        : 'Unknown Location';

    // 优先级评分（用于排序）
    let priorityScore = 0;

    // 宠物友好 +100 分
    if (petFriendly === 'y') priorityScore += 100;

    // 有车库 +100 分
    if (hasGarage) priorityScore += 100;

    // 无地毯 +50 分
    if (carpetFree === 'y') priorityScore += 50;

    // 面积 >= 700 sqft +10 分
    if (sqft >= 700) priorityScore += 10;

    // 性价比（价格越低，分数越高，按每平方英尺价格的倒数计算）
    if (sqft > 0 && rentValue > 0) {
        // 价格越低，分数越高（使用 10000 / pricePerSqft 作为分数）
        priorityScore += Math.round(10000 / parseFloat(pricePerSqft));
    }

    return {
        mlsNumber,
        addressText,
        rent,
        bedrooms,
        bathrooms,
        propertyType,
        sizeInterior,
        sqft,
        landSize,
        insertedDate: insertedDateFormatted, // 使用格式化后的日期
        timeOnRealtor,
        link,
        locationName,
        parkingSpaces,
        petFriendly,
        carpetFree,
        hasGarage: hasGarage ? 'y' : 'n',
        rentValue,
        pricePerSqft,
        priorityScore,
        publicRemarks, // 保留原始描述以便查看
        isBasement: isBasement(addressText, publicRemarks) // 标记是否为地下室
    };
}

/**
 * 读取并处理所有 JSON 文件
 */
function processAllJsonFiles(outputDir) {
    const files = fs.readdirSync(outputDir);

    // 筛选出所有 JSON 文件
    const jsonFiles = files.filter(file =>
        file.endsWith('.json') && !file.startsWith('.')
    );

    if (jsonFiles.length === 0) {
        console.log('❌ 未找到任何 JSON 文件');
        return [];
    }

    console.log(`📂 找到 ${jsonFiles.length} 个 JSON 文件`);

    const allListings = [];
    const seenMlsNumbers = new Set();

    // 处理每个 JSON 文件
    for (const file of jsonFiles) {
        const filePath = path.join(outputDir, file);
        console.log(`📄 处理文件: ${file}`);

        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(content);

            // 提取 config 编号
            const configNumber = extractConfigNumber(file);

            // 处理 Results 数组
            if (data.Results && Array.isArray(data.Results)) {
                for (const result of data.Results) {
                    // 去重：如果已经处理过这个 MLS 编号，跳过
                    if (seenMlsNumbers.has(result.MlsNumber)) {
                        continue;
                    }
                    seenMlsNumbers.add(result.MlsNumber);

                    const listing = processListing(result, configNumber);
                    allListings.push(listing);
                }
            }

            console.log(`  ✅ 已处理 ${data.Results?.length || 0} 条记录`);
        } catch (error) {
            console.error(`  ❌ 处理文件失败: ${file}`, error.message);
        }
    }

    console.log(`\n📊 总共处理了 ${allListings.length} 条唯一记录`);
    return allListings;
}

/**
 * 筛选和排序数据
 */
function filterAndSortListings(listings) {
    console.log(`\n🔍 开始筛选数据...`);

    // 筛选：面积 >= 700 sqft，且不是地下室
    const filtered = listings.filter(listing => {
        return listing.sqft >= 700 && !listing.isBasement;
    });

    console.log(`  ✅ 筛选后剩余 ${filtered.length} 条记录（面积 >= 700 sqft，已排除 basement/BSMT）`);

    // 排序：优先级评分从高到低
    filtered.sort((a, b) => b.priorityScore - a.priorityScore);

    console.log(`  ✅ 已按优先级排序`);

    return filtered;
}

/**
 * 将数据转换为 CSV 格式
 */
function convertToCSV(listings) {
    if (listings.length === 0) {
        return '';
    }

    // CSV 表头
    const headers = [
        'MLS编号',
        '地址',
        '租金/价格',
        '卧室',
        '浴室',
        '物业类型',
        '建筑面积',
        '面积(sqft)',
        '土地面积',
        '上架日期',
        '时间标签',
        '链接',
        '位置/车站',
        '停车位数量',
        '是否Pet Friendly',
        '是否Carpet Free',
        '是否有车库',
        '租金数值',
        '每平方英尺价格',
        '优先级评分',
        '描述'
    ];

    // 转义 CSV 字段（处理引号和逗号）
    const escapeCSV = (value) => {
        if (value == null) return '';
        const str = String(value);
        if (str.includes('"') || str.includes(',') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    // 构建 CSV 内容
    const rows = [headers.map(escapeCSV).join(',')];

    for (const listing of listings) {
        const row = [
            listing.mlsNumber,
            listing.addressText,
            listing.rent,
            listing.bedrooms,
            listing.bathrooms,
            listing.propertyType,
            listing.sizeInterior,
            listing.sqft,
            listing.landSize,
            listing.insertedDate,
            listing.timeOnRealtor,
            listing.link,
            listing.locationName,
            listing.parkingSpaces,
            listing.petFriendly,
            listing.carpetFree,
            listing.hasGarage,
            listing.rentValue,
            listing.pricePerSqft,
            listing.priorityScore,
            listing.publicRemarks
        ];

        rows.push(row.map(escapeCSV).join(','));
    }

    return rows.join('\n');
}

/**
 * 主函数
 */
function main() {
    console.log('🚀 开始分析 Realtor.ca 数据...\n');

    const outputDir = path.join(__dirname, 'output');
    const analyzedDir = path.join(__dirname, 'analyzed');

    // 确保 analyzed 目录存在
    if (!fs.existsSync(analyzedDir)) {
        fs.mkdirSync(analyzedDir, { recursive: true });
        console.log(`📁 已创建目录: ${analyzedDir}\n`);
    }

    // 处理所有 JSON 文件
    const allListings = processAllJsonFiles(outputDir);

    if (allListings.length === 0) {
        console.log('❌ 没有数据可处理');
        return;
    }

    // 筛选和排序
    const filteredListings = filterAndSortListings(allListings);

    if (filteredListings.length === 0) {
        console.log('❌ 筛选后没有符合条件的数据');
        return;
    }

    // 转换为 CSV
    console.log(`\n📝 生成 CSV 文件...`);
    const csv = convertToCSV(filteredListings);

    // 保存 CSV 文件
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(analyzedDir, `analyzed_${timestamp}.csv`);
    fs.writeFileSync(outputFile, csv, 'utf8');

    console.log(`  ✅ CSV 文件已保存: ${outputFile}`);

    // 打印统计信息
    console.log(`\n📊 统计信息:`);
    console.log(`  - 总记录数: ${allListings.length}`);
    console.log(`  - 筛选后记录数: ${filteredListings.length}`);

    const petFriendlyCount = filteredListings.filter(l => l.petFriendly === 'y').length;
    const hasGarageCount = filteredListings.filter(l => l.hasGarage === 'y').length;
    const carpetFreeCount = filteredListings.filter(l => l.carpetFree === 'y').length;

    console.log(`  - Pet Friendly: ${petFriendlyCount} 条`);
    console.log(`  - 有车库: ${hasGarageCount} 条`);
    console.log(`  - Carpet Free: ${carpetFreeCount} 条`);

    // 显示前 5 条最优记录
    console.log(`\n🏆 前 5 条最优记录:`);
    filteredListings.slice(0, 5).forEach((listing, index) => {
        console.log(`\n${index + 1}. ${listing.addressText}`);
        console.log(`   MLS: ${listing.mlsNumber}`);
        console.log(`   租金: ${listing.rent} | 面积: ${listing.sqft} sqft | 每sqft价格: $${listing.pricePerSqft}`);
        console.log(`   Pet Friendly: ${listing.petFriendly} | 车库: ${listing.hasGarage} | Carpet Free: ${listing.carpetFree}`);
        console.log(`   优先级评分: ${listing.priorityScore}`);
        console.log(`   链接: ${listing.link}`);
    });

    console.log(`\n✅ 分析完成！`);
}

// 如果直接运行此文件，执行主函数
if (require.main === module) {
    main();
}

// 导出函数供其他模块使用
module.exports = {
    processAllJsonFiles,
    filterAndSortListings,
    convertToCSV,
    main
};
