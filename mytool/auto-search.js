/**
 * 自动化搜索脚本
 * 从 curls 文件夹中读取 curl 命令文件，自动执行搜索
 */
const { allConfigs } = require('./configs');
const fs = require('fs');
const path = require('path');
const { RealtorSearch } = require('./realtor-search');
const CurlParser = require('./curl-parser');

/**
 * 自动化搜索配置
 */
const AUTO_SEARCH_CONFIG = {
    // curls 文件夹路径
    curlsDir: path.join(__dirname, 'curls'),

    // 输出文件夹路径
    outputDir: path.join(__dirname, 'output'),

    // 是否保存结果到文件
    saveToFile: true,

    // 是否打印详细信息
    verbose: true,

    // 请求之间的最小延迟（毫秒）
    minDelayBetweenRequests: 2000,

    // 请求之间的最大延迟（毫秒）
    maxDelayBetweenRequests: 5000,

    // 是否获取多页结果
    fetchMultiplePages: false,

    // 最多获取多少页（0 表示获取全部）
    maxPages: 0,

    // 是否自动获取所有页面
    fetchAllPages: false,

    // 是否使用 configs.js 中的配置列表
    useConfigList: true
};

/**
 * 自动化搜索管理器
 */
class AutoSearchManager {
    constructor(config = {}) {
        this.config = { ...AUTO_SEARCH_CONFIG, ...config };

        // 确保输出目录存在
        if (this.config.saveToFile && !fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
        }
    }

    /**
     * 生成随机延迟时间（毫秒）
     * @returns {number} - 随机延迟时间
     */
    getRandomDelay() {
        const min = this.config.minDelayBetweenRequests;
        const max = this.config.maxDelayBetweenRequests;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * 执行单个搜索
     * @param {Object} searchConfig - 搜索配置对象（可以是 curlConfig 或纯 searchParams）
     * @param {string|number} identifier - 配置标识（文件名或索引）
     * @returns {Promise<Object>} 搜索结果
     */
    async executeSearch(searchConfig, identifier) {
        console.log(`\n========== 执行搜索: ${identifier} ==========`);

        // 创建搜索实例，确保 CurrentPage 重置为 1
        const searcher = new RealtorSearch({
            cookies: searchConfig.cookies,
            headers: searchConfig.headers,
            searchParams: {
                ...searchConfig.searchParams,
                CurrentPage: 1  // 重置页码为 1
            }
        });

        if (this.config.verbose) {
            console.log('\n搜索参数:');
            searcher.printParams();
        }

        try {
            // 执行第一页搜索
            const results = await searcher.search();

            const totalRecords = results.Paging?.TotalRecords || 0;
            const currentResults = results.Results?.length || 0;

            console.log(`\n✓ 搜索成功!`);
            console.log(`  总记录数: ${totalRecords}`);
            console.log(`  当前页结果: ${currentResults}`);

            // 如果需要获取多页
            if ((this.config.fetchMultiplePages || this.config.fetchAllPages) && totalRecords > currentResults) {
                const recordsPerPage = results.Paging?.RecordsPerPage || 12;
                const totalPages = Math.ceil(totalRecords / recordsPerPage);

                // 如果 fetchAllPages 为 true 或 maxPages 为 0，则获取所有页面
                const pagesToFetch = (this.config.fetchAllPages || this.config.maxPages === 0)
                    ? totalPages
                    : Math.min(this.config.maxPages, totalPages);

                console.log(`\n正在获取额外页面 (总共 ${totalPages} 页，将获取前 ${pagesToFetch} 页)...`);

                for (let page = 2; page <= pagesToFetch; page++) {
                    try {
                        console.log(`  获取第 ${page} 页...`);

                        // 随机延迟
                        const delay = this.getRandomDelay();
                        console.log(`  延迟 ${delay}ms...`);
                        await this.delay(delay);

                        // 更新页码
                        searcher.setPage(page);
                        const pageResults = await searcher.search();

                        // 合并结果
                        if (pageResults.Results && pageResults.Results.length > 0) {
                            results.Results.push(...pageResults.Results);
                            console.log(`  ✓ 第 ${page} 页完成 (${pageResults.Results?.length || 0} 条)`);
                        } else {
                            console.log(`  ⚠ 第 ${page} 页没有返回数据，可能已到达最后一页`);
                            break; // 如果没有数据了，停止获取
                        }
                    } catch (pageError) {
                        console.error(`  ✗ 第 ${page} 页获取失败: ${pageError.message}`);

                        // 判断错误类型
                        if (pageError.message.includes('redirect')) {
                            console.log(`  ⚠ 检测到重定向错误，可能触发了反爬虫机制，停止获取更多页面`);
                            break; // 遇到重定向错误，停止继续获取
                        } else if (pageError.response?.status === 429) {
                            console.log(`  ⚠ 请求过于频繁，停止获取更多页面`);
                            break;
                        } else {
                            console.log(`  ⚠ 跳过第 ${page} 页，继续尝试下一页...`);
                            // 其他错误，继续尝试下一页
                        }
                    }
                }

                console.log(`\n总共成功获取 ${results.Results.length} 条房产信息`);
            }

            // 打印摘要
            this.printSummary(results);

            return results;
        } catch (error) {
            console.error(`\n✗ 搜索失败: ${error.message}`);
            throw error;
        }
    }

    /**
     * 执行指定编号的搜索
     * @param {number} number - 文件编号
     */
    async executeByNumber(number) {
        const fileName = `${number}.txt`;
        const filePath = path.join(this.config.curlsDir, fileName);

        if (!fs.existsSync(filePath)) {
            throw new Error(`文件不存在: ${fileName}`);
        }

        console.log(`执行搜索 #${number}...\n`);

        const allResults = [];
        const failedConfigs = [];

        // 使用 for...of 循环来正确处理异步操作
        for (let i = 0; i < allConfigs.length; i++) {
            const conf = allConfigs[i];
            console.log(`\n========== 配置 #${i + 1}/${allConfigs.length} ==========`);

            try {
                console.log(`配置详情:`, conf);
                const config = CurlParser.parseCurlFile(filePath, conf);
                console.log(`解析后的配置:`, config);

                // 执行搜索
                const result = await this.executeSearch(config, `${fileName}_config${i + 1}`);
                allResults.push(result);

                // 保存结果
                if (this.config.saveToFile) {
                    const outputFileName = `${number}_config${i + 1}`;
                    await this.saveResults(result, outputFileName);
                }

                console.log(`✓ 配置 #${i + 1} 执行成功`);
            } catch (error) {
                console.error(`\n✗ 配置 #${i + 1} 执行失败: ${error.message}`);
                failedConfigs.push({
                    index: i + 1,
                    config: conf,
                    error: error.message
                });
                // 将失败信息也记录到结果中
                allResults.push({
                    success: false,
                    configIndex: i + 1,
                    error: error.message
                });
            }

            // 添加延迟（除了最后一个）
            if (i < allConfigs.length - 1) {
                const delay = this.getRandomDelay();
                console.log(`\n延迟 ${delay}ms 后执行下一个配置...`);
                await this.delay(delay);
            }
        }

        // 打印执行摘要
        console.log(`\n========== 执行摘要 ==========`);
        console.log(`总配置数: ${allConfigs.length}`);
        console.log(`成功: ${allConfigs.length - failedConfigs.length}`);
        console.log(`失败: ${failedConfigs.length}`);

        if (failedConfigs.length > 0) {
            console.log(`\n失败的配置:`);
            failedConfigs.forEach(({ index, error }) => {
                console.log(`  - 配置 #${index}: ${error}`);
            });
        }

        console.log(`\n✓ 所有配置执行完成！`);
        return allResults;
    }

    /**
     * 保存结果到文件
     * @param {Object} results - 搜索结果
     * @param {string} sourceFileName - 源文件名
     */
    async saveResults(results, sourceFileName) {
        const baseName = path.basename(sourceFileName, '.txt');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        // 保存完整 JSON
        const jsonFileName = `${baseName}_${timestamp}.json`;
        const jsonPath = path.join(this.config.outputDir, jsonFileName);
        fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
        console.log(`\n结果已保存: ${jsonFileName}`);

        // 保存简化的 CSV 格式（房产列表）
        if (results.Results && results.Results.length > 0) {
            const csvFileName = `${baseName}_${timestamp}.csv`;
            const csvPath = path.join(this.config.outputDir, csvFileName);
            this.saveAsCSV(results.Results, csvPath);
            console.log(`CSV 已保存: ${csvFileName}`);
        }
    }

    /**
     * 保存为 CSV 格式
     * @param {Array} properties - 房产列表
     * @param {string} filePath - 文件路径
     */
    saveAsCSV(properties, filePath) {
        const headers = [
            'MLS编号',
            '地址',
            '租金/价格',
            '卧室',
            '浴室',
            '物业类型',
            '建筑面积',
            '土地面积',
            '上架日期',
            '时间标签',
            '链接'
        ];

        const rows = properties.map(property => {
            const addr = property.Property?.Address;
            const building = property.Building;
            const land = property.Land;
            const priceOrRent = property.Property?.LeaseRent ||
                (property.Property?.Price ? `$${property.Property.Price}` : '');

            return [
                property.MlsNumber || '',
                addr?.AddressText || '',
                priceOrRent,
                building?.Bedrooms || '',
                building?.BathroomTotal || '',
                building?.Type || '',
                building?.SizeInterior || '',
                land?.SizeTotal || '',
                property.InsertedDateUTC || '',
                property.TimeOnRealtor || '',
                `https://www.realtor.ca${property.RelativeDetailsURL || ''}`
            ];
        });

        const csv = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        fs.writeFileSync(filePath, csv);
    }

    /**
     * 打印搜索结果摘要
     * @param {Object} results - 搜索结果
     */
    printSummary(results) {
        if (!results.Results || results.Results.length === 0) {
            console.log('\n没有找到房产信息');
            return;
        }

        console.log('\n========== 房产摘要 (前5条) ==========');

        results.Results.slice(0, 5).forEach((property, index) => {
            const addr = property.Property?.Address;
            const building = property.Building;
            const priceOrRent = property.Property?.LeaseRent ||
                (property.Property?.Price ? `$${property.Property.Price}` : 'N/A');

            console.log(`\n${index + 1}. ${addr?.AddressText || 'N/A'}`);
            console.log(`   租金/价格: ${priceOrRent}`);
            console.log(`   卧室: ${building?.Bedrooms || 'N/A'} | 浴室: ${building?.BathroomTotal || 'N/A'}`);
            console.log(`   类型: ${building?.Type || 'N/A'}`);
            console.log(`   MLS: ${property.MlsNumber || 'N/A'}`);
            if (property.TimeOnRealtor) {
                console.log(`   上架时间: ${property.TimeOnRealtor}`);
            }
        });

        if (results.Results.length > 5) {
            console.log(`\n... 还有 ${results.Results.length - 5} 条结果`);
        }
        console.log('\n=====================================');
    }

    /**
     * 延迟函数
     * @param {number} ms - 毫秒数
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * 命令行接口
 */
async function main() {
    // 解析命令行参数
    const args = process.argv.slice(2);

    const config = {
        ...AUTO_SEARCH_CONFIG
    };

    // 解析参数
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--all' || arg === '-a') {
            // 执行所有搜索
            config.executeAll = true;
        } else if (arg === '--number' || arg === '-n') {
            // 执行指定编号的搜索
            config.number = parseInt(args[++i]);
        } else if (arg === '--pages' || arg === '-p') {
            // 获取多页结果
            const pageArg = args[++i];
            config.fetchMultiplePages = true;
            if (pageArg === 'all' || pageArg === '0') {
                config.fetchAllPages = true;
                config.maxPages = 0;
            } else {
                config.maxPages = parseInt(pageArg) || 3;
            }
        } else if (arg === '--all-pages') {
            // 获取所有页面
            config.fetchAllPages = true;
            config.fetchMultiplePages = true;
            config.maxPages = 0;
        } else if (arg === '--verbose' || arg === '-v') {
            config.verbose = true;
        } else if (arg === '--quiet' || arg === '-q') {
            config.verbose = false;
        } else if (arg === '--no-save') {
            config.saveToFile = false;
        } else if (arg === '--help' || arg === '-h') {
            printHelp();
            return;
        }
    }

    const manager = new AutoSearchManager(config);

    try {
        await manager.executeByNumber(config.number);
    } catch (error) {
        console.error('\n执行失败:', error.message);
        process.exit(1);
    }
}

/**
 * 打印帮助信息
 */
function printHelp() {
    console.log(`
Realtor.ca 自动化搜索工具

用法:
  node auto-search.js [选项]

选项:
  -a, --all              执行 curls 文件夹中的所有搜索 (默认)
  -n, --number <num>     执行指定编号的搜索 (例如: -n 1 执行 1.txt)
  -p, --pages <num>      获取多页结果，指定最大页数 (例如: -p 3)
                         使用 'all' 或 '0' 获取所有页面 (例如: -p all)
  --all-pages            获取所有页面（不限制页数）
  -v, --verbose          显示详细信息 (默认)
  -q, --quiet            静默模式，减少输出
  --no-save              不保存结果到文件
  -h, --help             显示帮助信息

示例:
  node auto-search.js                    # 执行所有搜索
  node auto-search.js -n 1               # 只执行 1.txt
  node auto-search.js -n 1 -p 5          # 执行 1.txt 并获取前5页
  node auto-search.js -n 1 -p all        # 执行 1.txt 并获取所有页面
  node auto-search.js -n 1 --all-pages   # 执行 1.txt 并获取所有页面
  node auto-search.js -a -q --no-save    # 静默执行所有，不保存文件
  `);
}

// 导出
module.exports = {
    AutoSearchManager,
    AUTO_SEARCH_CONFIG
};

// 如果直接运行此文件
if (require.main === module) {
    main();
}
