/**
 * Curl 命令解析器
 * 用于从 curl 命令文本中提取请求配置信息
 */

const fs = require('fs');
const path = require('path');
const querystring = require('querystring');

class CurlParser {
    /**
     * 从 curl 命令文本中解析配置
     * @param {string} curlText - curl 命令文本
     * @returns {Object} 解析后的配置对象
     */
    static parseCurl(curlText, searchParamsOverride = null) {
        const config = {
            headers: {},
            cookies: '',
            searchParams: {}
        };

        // 提取 cookies
        const cookieMatch = curlText.match(/-b\s+'([^']+)'/);
        console.log('提取到的 Cookies:', cookieMatch ? cookieMatch[1] : 'N/A');
        if (cookieMatch) {
            config.cookies = cookieMatch[1];
        }

        // 提取所有 headers
        const headerRegex = /-H\s+'([^:]+):\s*([^']+)'/g;
        let match;
        while ((match = headerRegex.exec(curlText)) !== null) {
            console.log(`提取到的 Header: ${match[1]}: ${match[2]}`);
            const headerName = match[1].toLowerCase();
            const headerValue = match[2];
            config.headers[headerName] = headerValue;
        }
        if (!match) {
            console.log('未提取到任何 Headers');
        }

        // 提取 POST 数据
        const dataMatch = curlText.match(/--data-raw\s+'([^']+)'/);
        if (searchParamsOverride) {
            console.log('使用自定义搜索参数覆盖', searchParamsOverride);
            config.searchParams = searchParamsOverride;
        } else if (dataMatch) {
            console.log('提取到的 POST 数据:', dataMatch[1]);
            const data = dataMatch[1];
            config.searchParams = querystring.parse(data);

            // 转换数字类型
            for (let key in config.searchParams) {
                const value = config.searchParams[key];
                // 尝试转换为数字
                if (!isNaN(value) && value !== '') {
                    config.searchParams[key] = Number(value);
                }
                // 转换布尔值
                if (value === 'true') config.searchParams[key] = true;
                if (value === 'false') config.searchParams[key] = false;
            }
        }

        return config;
    }

    /**
     * 从文件中读取并解析 curl 命令
     * @param {string} filePath - 文件路径
     * @returns {Object} 解析后的配置对象
     */
    static parseCurlFile(filePath, searchParamsOverride = null) {
        try {
            const curlText = fs.readFileSync(filePath, 'utf-8');
            return this.parseCurl(curlText, searchParamsOverride);
        } catch (error) {
            console.error(`读取文件失败: ${filePath}`, error.message);
            throw error;
        }
    }

    /**
     * 从 curl 目录中读取所有 curl 文件
     * @param {string} dirPath - 目录路径
     * @returns {Array} 配置对象数组
     */
    static parseCurlDirectory(dirPath) {
        const configs = [];

        try {
            const files = fs.readdirSync(dirPath);

            // 按数字排序文件
            const sortedFiles = files
                .filter(file => file.endsWith('.txt'))
                .sort((a, b) => {
                    const numA = parseInt(path.basename(a, '.txt'));
                    const numB = parseInt(path.basename(b, '.txt'));
                    return numA - numB;
                });

            for (const file of sortedFiles) {
                const filePath = path.join(dirPath, file);
                const config = this.parseCurlFile(filePath);
                configs.push({
                    fileName: file,
                    config: config
                });
            }

            return configs;
        } catch (error) {
            console.error(`读取目录失败: ${dirPath}`, error.message);
            throw error;
        }
    }

    /**
     * 提取搜索区域边界
     * @param {Object} searchParams - 搜索参数
     * @returns {Object|null} 边界对象
     */
    static extractBounds(searchParams) {
        if (searchParams.LatitudeMax && searchParams.LatitudeMin &&
            searchParams.LongitudeMax && searchParams.LongitudeMin) {
            return {
                latMax: searchParams.LatitudeMax,
                latMin: searchParams.LatitudeMin,
                lngMax: searchParams.LongitudeMax,
                lngMin: searchParams.LongitudeMin
            };
        }
        return null;
    }

    /**
     * 打印配置信息（用于调试）
     * @param {Object} config - 配置对象
     */
    static printConfig(config) {
        console.log('\n========== 配置信息 ==========');
        console.log('\nCookies:');
        console.log(config.cookies ? config.cookies.substring(0, 100) + '...' : '无');

        console.log('\n关键 Headers:');
        if (config.headers['user-agent']) {
            console.log('  User-Agent:', config.headers['user-agent']);
        }
        if (config.headers['content-type']) {
            console.log('  Content-Type:', config.headers['content-type']);
        }

        console.log('\n搜索参数:');
        console.log(JSON.stringify(config.searchParams, null, 2));

        const bounds = this.extractBounds(config.searchParams);
        if (bounds) {
            console.log('\n搜索区域边界:');
            console.log(`  纬度: ${bounds.latMin} ~ ${bounds.latMax}`);
            console.log(`  经度: ${bounds.lngMin} ~ ${bounds.lngMax}`);
        }
        console.log('==============================\n');
    }
}

module.exports = CurlParser;
