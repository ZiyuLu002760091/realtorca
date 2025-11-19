/**
 * Realtor.ca 搜索工具使用示例
 * 展示各种搜索场景的用法
 */

const { RealtorSearch } = require('./realtor-search');

/**
 * 示例 1: 基础搜索 - 按区域查找房产
 */
async function example1_BasicSearch() {
    console.log('\n========== 示例 1: 基础区域搜索 ==========');

    const searcher = new RealtorSearch();

    searcher.setBounds({
        latMax: 43.74766,
        latMin: 43.73225,
        lngMax: -79.59291,
        lngMin: -79.63192
    });

    const results = await searcher.search();
    console.log(`找到 ${results.Paging?.TotalRecords || 0} 条结果`);

    return results;
}

/**
 * 示例 2: 价格范围搜索
 */
async function example2_PriceRangeSearch() {
    console.log('\n========== 示例 2: 价格范围搜索 ==========');

    const searcher = new RealtorSearch();

    searcher
        .setBounds({
            latMax: 43.74766,
            latMin: 43.73225,
            lngMax: -79.59291,
            lngMin: -79.63192
        })
        .setPriceRange(600000, 900000) // 60万到90万
        .setRecordsPerPage(50);

    const results = await searcher.search();
    console.log(`价格范围 $600,000 - $900,000，找到 ${results.Results?.length || 0} 条结果`);

    return results;
}

/**
 * 示例 3: 卧室和浴室数量筛选
 */
async function example3_BedroomBathroomSearch() {
    console.log('\n========== 示例 3: 卧室和浴室筛选 ==========');

    const searcher = new RealtorSearch();

    searcher
        .setBounds({
            latMax: 43.74766,
            latMin: 43.73225,
            lngMax: -79.59291,
            lngMin: -79.63192
        })
        .setBedroomRange(3, 5) // 3-5 卧室
        .setBathroomRange(2, 3) // 2-3 浴室
        .setSort('1-A'); // 价格从低到高

    const results = await searcher.search();
    console.log(`3-5 卧室, 2-3 浴室，找到 ${results.Results?.length || 0} 条结果`);

    return results;
}

/**
 * 示例 4: 出租房产搜索
 */
async function example4_RentalSearch() {
    console.log('\n========== 示例 4: 出租房产搜索 ==========');

    const searcher = new RealtorSearch();

    searcher
        .setBounds({
            latMax: 43.74766,
            latMin: 43.73225,
            lngMax: -79.59291,
            lngMin: -79.63192
        })
        .setTransactionType(3) // 3 = 出租
        .setPriceRange(2000, 4000) // 租金范围
        .setSort('6-D'); // 最新上架

    const results = await searcher.search();
    console.log(`出租房产，找到 ${results.Results?.length || 0} 条结果`);

    return results;
}

/**
 * 示例 5: 分页获取所有结果
 */
async function example5_PaginatedSearch() {
    console.log('\n========== 示例 5: 分页获取所有结果 ==========');

    const searcher = new RealtorSearch();

    searcher
        .setBounds({
            latMax: 43.74766,
            latMin: 43.73225,
            lngMax: -79.59291,
            lngMin: -79.63192
        })
        .setRecordsPerPage(20);

    // 获取第一页
    let results = await searcher.search();
    const totalRecords = results.Paging?.TotalRecords || 0;
    const recordsPerPage = results.Paging?.RecordsPerPage || 20;
    const totalPages = Math.ceil(totalRecords / recordsPerPage);

    console.log(`总共 ${totalRecords} 条记录，分 ${totalPages} 页`);

    let allResults = [...(results.Results || [])];

    // 获取后续页面（示例：只获取前3页）
    const maxPages = Math.min(3, totalPages);
    for (let page = 2; page <= maxPages; page++) {
        console.log(`正在获取第 ${page} 页...`);
        searcher.setPage(page);
        results = await searcher.search();
        allResults.push(...(results.Results || []));

        // 添加延迟避免请求过快
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`共获取 ${allResults.length} 条房产信息`);

    return allResults;
}

/**
 * 示例 6: 自定义高级搜索
 */
async function example6_CustomSearch() {
    console.log('\n========== 示例 6: 自定义高级搜索 ==========');

    const searcher = new RealtorSearch({
        searchParams: {
            // 可以在初始化时设置自定义参数
            ZoomLevel: 12,
            RecordsPerPage: 100
        }
    });

    searcher
        .setBounds({
            latMax: 43.74766,
            latMin: 43.73225,
            lngMax: -79.59291,
            lngMin: -79.63192
        })
        .setCustomParams({
            // 添加更多自定义参数
            OpenHouse: 1, // 只显示有开放参观的房产
            Keywords: 'renovated' // 关键词搜索
        });

    searcher.printParams(); // 打印搜索参数

    const results = await searcher.search();
    console.log(`自定义搜索，找到 ${results.Results?.length || 0} 条结果`);

    return results;
}

/**
 * 示例 7: 提取和显示详细信息
 */
async function example7_DetailedResults() {
    console.log('\n========== 示例 7: 详细结果展示 ==========');

    const searcher = new RealtorSearch();

    searcher
        .setBounds({
            latMax: 43.74766,
            latMin: 43.73225,
            lngMax: -79.59291,
            lngMin: -79.63192
        })
        .setRecordsPerPage(5); // 只获取5条

    const results = await searcher.search();

    if (results.Results && results.Results.length > 0) {
        console.log('\n详细房产信息:');
        results.Results.forEach((property, index) => {
            const addr = property.Property?.Address;
            const building = property.Building;
            const land = property.Land;

            console.log(`\n--- 房产 ${index + 1} ---`);
            console.log(`地址: ${addr?.AddressText || 'N/A'}`);
            console.log(`价格: $${property.Property?.Price?.toLocaleString() || 'N/A'}`);
            console.log(`卧室: ${building?.Bedrooms || 'N/A'}`);
            console.log(`浴室: ${building?.BathroomTotal || 'N/A'}`);
            console.log(`面积: ${building?.SizeInterior || land?.SizeTotal || 'N/A'}`);
            console.log(`物业类型: ${building?.Type || 'N/A'}`);
            console.log(`MLS编号: ${property.MlsNumber || 'N/A'}`);
            console.log(`链接: https://www.realtor.ca${property.RelativeDetailsURL || ''}`);
        });
    }

    return results;
}

/**
 * 主函数 - 运行所有示例
 */
async function main() {
    console.log('========================================');
    console.log('Realtor.ca 搜索工具示例集');
    console.log('========================================');

    try {
        // 选择要运行的示例（取消注释来运行）

        // await example1_BasicSearch();
        // await example2_PriceRangeSearch();
        // await example3_BedroomBathroomSearch();
        // await example4_RentalSearch();
        // await example5_PaginatedSearch();
        // await example6_CustomSearch();
        await example7_DetailedResults();

        console.log('\n示例执行完成！');
    } catch (error) {
        console.error('\n执行示例时出错:', error.message);
    }
}

// 运行主函数
if (require.main === module) {
    main();
}

module.exports = {
    example1_BasicSearch,
    example2_PriceRangeSearch,
    example3_BedroomBathroomSearch,
    example4_RentalSearch,
    example5_PaginatedSearch,
    example6_CustomSearch,
    example7_DetailedResults
};
