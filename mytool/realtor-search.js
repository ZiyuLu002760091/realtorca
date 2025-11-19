const axios = require('axios');
const querystring = require('querystring');

/**
 * 可配置化的 Realtor.ca 房产搜索脚本
 * 基于 realtor.ca API 的属性搜索功能
 */

// 默认配置
const DEFAULT_CONFIG = {
    // API 端点
    apiUrl: 'https://api2.realtor.ca/Listing.svc/PropertySearch_Post',

    // 请求头配置
    headers: {
        'accept': '*/*',
        'accept-language': 'en-CA,en-GB;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6,zh;q=0.5',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'origin': 'https://www.realtor.ca',
        'referer': 'https://www.realtor.ca/',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
    },

    // 搜索参数默认值
    searchParams: {
        ZoomLevel: 15,
        CurrentPage: 1,
        Sort: '6-D', // 6-D = 最新上架
        PropertyTypeGroupID: 1, // 1 = 住宅
        TransactionTypeId: 2, // 2 = 出售
        PropertySearchTypeId: 0,
        Currency: 'CAD',
        IncludeHiddenListings: false,
        RecordsPerPage: 12,
        ApplicationId: 1,
        CultureId: 1,
        Version: '7.0'
    }
};

/**
 * Realtor.ca 搜索类
 */
class RealtorSearch {
    constructor(customConfig = {}) {
        // 合并自定义配置
        this.config = {
            apiUrl: customConfig.apiUrl || DEFAULT_CONFIG.apiUrl,
            headers: { ...DEFAULT_CONFIG.headers, ...customConfig.headers },
            searchParams: { ...DEFAULT_CONFIG.searchParams, ...customConfig.searchParams }
        };

        // 如果提供了 cookies，添加到 headers
        if (customConfig.cookies) {
            this.config.headers['cookie'] = customConfig.cookies;
        }
    }

    /**
     * 设置搜索区域（通过经纬度边界）
     * @param {Object} bounds - 边界对象
     * @param {number} bounds.latMax - 最大纬度
     * @param {number} bounds.latMin - 最小纬度
     * @param {number} bounds.lngMax - 最大经度
     * @param {number} bounds.lngMin - 最小经度
     */
    setBounds(bounds) {
        this.config.searchParams.LatitudeMax = bounds.latMax;
        this.config.searchParams.LatitudeMin = bounds.latMin;
        this.config.searchParams.LongitudeMax = bounds.lngMax;
        this.config.searchParams.LongitudeMin = bounds.lngMin;
        return this;
    }

    /**
     * 设置价格范围
     * @param {number} min - 最低价格
     * @param {number} max - 最高价格
     */
    setPriceRange(min, max) {
        if (min !== undefined) this.config.searchParams.PriceMin = min;
        if (max !== undefined) this.config.searchParams.PriceMax = max;
        return this;
    }

    /**
     * 设置卧室数量范围
     * @param {number} min - 最少卧室数
     * @param {number} max - 最多卧室数
     */
    setBedroomRange(min, max) {
        if (min !== undefined) this.config.searchParams.BedRange = `${min}-${max || 0}`;
        return this;
    }

    /**
     * 设置浴室数量范围
     * @param {number} min - 最少浴室数
     * @param {number} max - 最多浴室数
     */
    setBathroomRange(min, max) {
        if (min !== undefined) this.config.searchParams.BathRange = `${min}-${max || 0}`;
        return this;
    }

    /**
     * 设置当前页码
     * @param {number} page - 页码
     */
    setPage(page) {
        this.config.searchParams.CurrentPage = page;
        return this;
    }

    /**
     * 设置每页记录数
     * @param {number} records - 记录数
     */
    setRecordsPerPage(records) {
        this.config.searchParams.RecordsPerPage = records;
        return this;
    }

    /**
     * 设置排序方式
     * @param {string} sort - 排序方式
     *   '6-D' = 最新上架（降序）
     *   '6-A' = 最旧上架（升序）
     *   '1-D' = 价格从高到低
     *   '1-A' = 价格从低到高
     */
    setSort(sort) {
        this.config.searchParams.Sort = sort;
        return this;
    }

    /**
     * 设置物业类型
     * @param {number} typeId - 类型 ID
     *   1 = 住宅
     *   2 = 公寓/联排别墅
     *   3 = 农场
     */
    setPropertyType(typeId) {
        this.config.searchParams.PropertyTypeGroupID = typeId;
        return this;
    }

    /**
     * 设置交易类型
     * @param {number} typeId - 交易类型 ID
     *   2 = 出售
     *   3 = 出租
     */
    setTransactionType(typeId) {
        this.config.searchParams.TransactionTypeId = typeId;
        return this;
    }

    /**
     * 设置关键词筛选
     * @param {string|Array<string>} keywords - 关键词，可以是字符串或数组
     *   例如: "Pets Allowed,Garage,Carpet Free" 或 ["Pets Allowed", "Garage", "Carpet Free"]
     */
    setKeywords(keywords) {
        if (Array.isArray(keywords)) {
            this.config.searchParams.Keywords = keywords.join(',');
        } else {
            this.config.searchParams.Keywords = keywords;
        }
        return this;
    }

    /**
     * 设置自定义搜索参数
     * @param {Object} params - 参数对象
     */
    setCustomParams(params) {
        this.config.searchParams = { ...this.config.searchParams, ...params };
        return this;
    }

    /**
     * 执行搜索
     * @returns {Promise} - 返回搜索结果
     */
    async search() {
        try {
            const response = await axios({
                method: 'POST',
                url: this.config.apiUrl,
                headers: this.config.headers,
                data: querystring.stringify(this.config.searchParams),
                maxRedirects: 5, // 最大重定向次数
                timeout: 30000, // 30秒超时
                validateStatus: (status) => {
                    // 只接受 200-299 的状态码
                    return status >= 200 && status < 300;
                }
            });

            return response.data;
        } catch (error) {
            console.error('搜索失败:', error.message);
            if (error.response) {
                console.error('响应状态:', error.response.status);
                console.error('响应数据:', error.response.data);
            }
            throw error;
        }
    }

    /**
     * 获取当前配置
     * @returns {Object} - 当前配置对象
     */
    getConfig() {
        return this.config;
    }

    /**
     * 打印当前搜索参数（调试用）
     */
    printParams() {
        console.log('当前搜索参数:');
        console.log(JSON.stringify(this.config.searchParams, null, 2));
    }
}

/**
 * 使用示例
 */
async function example() {
    // 创建搜索实例
    const searcher = new RealtorSearch({
        // 可选：添加自定义 cookies（如果需要认证）
        cookies: 'your_cookies_here'
    });

    // 配置搜索条件
    searcher
        .setBounds({
            latMax: 43.74766,
            latMin: 43.73225,
            lngMax: -79.59291,
            lngMin: -79.63192
        })
        .setPriceRange(500000, 1000000) // 价格范围：50万到100万
        .setBedroomRange(2, 4) // 2-4 卧室
        .setPage(1) // 第一页
        .setRecordsPerPage(20) // 每页20条
        .setSort('6-D'); // 按最新上架排序

    // 打印参数（可选）
    searcher.printParams();

    try {
        // 执行搜索
        const results = await searcher.search();
        console.log('搜索成功！');
        console.log('结果数量:', results.Results?.length || 0);
        console.log('总记录数:', results.Paging?.TotalRecords || 0);

        // 打印前几条结果
        if (results.Results && results.Results.length > 0) {
            console.log('\n前3条房源:');
            results.Results.slice(0, 3).forEach((property, index) => {
                console.log(`\n${index + 1}. ${property.Property?.Address?.AddressText || 'N/A'}`);
                console.log(`   MLS: ${property.MlsNumber || 'N/A'}`);
                console.log(`   租金/价格: ${property.Property?.LeaseRent || property.Property?.Price || 'N/A'}`);
                console.log(`   卧室: ${property.Building?.Bedrooms || 'N/A'}`);
                console.log(`   浴室: ${property.Building?.BathroomTotal || 'N/A'}`);
                console.log(`   物业类型: ${property.Building?.Type || 'N/A'}`);
            });
        }

        return results;
    } catch (error) {
        console.error('执行搜索时出错:', error.message);
    }
}

// 导出类和示例函数
module.exports = {
    RealtorSearch,
    example,
    DEFAULT_CONFIG
};

// 如果直接运行此文件，执行示例
if (require.main === module) {
    example();
}
