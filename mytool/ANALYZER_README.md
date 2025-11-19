# Realtor.ca 数据分析器使用说明

## 功能概述

`analyzer.js` 是一个智能房产数据分析工具，用于处理 `output` 文件夹中的 JSON 数据，并生成优化排序的 CSV 分析报告。

## 主要功能

### 1. 智能筛选

- **面积过滤**：自动过滤掉面积小于 700 平方英尺的房源
- **宠物友好检测**：使用正则表达式检测以下关键词：
  - pet-friendly, pet friendly, pets allowed, pet-allowed, pets-friendly
  - dog-friendly, dogs allowed, dog friendly
  - cat-friendly, cats allowed, cat friendly
  - pet ok, pets ok, pet welcome, pets welcome
  
- **车库检测**：自动识别包含车库的房源（至少 1 个车库）

- **无地毯检测**：识别以下关键词：
  - carpet free, no carpet
  - hardwood, laminate floor, tile floor

### 2. 优先级评分系统

程序会根据以下标准为每个房源打分（分数越高越优先）：

| 标准                                   | 加分      |
| -------------------------------------- | --------- |
| Pet Friendly                           | +100 分   |
| 有车库                                 | +100 分   |
| Carpet Free                            | +50 分    |
| 面积 ≥ 700 sqft                        | +10 分    |
| 性价比（每平方英尺价格越低，分数越高） | +动态分数 |

### 3. 性价比计算

- 自动计算 **每平方英尺价格** = 租金 ÷ 面积
- 价格越低，性价比越高，排名越靠前

### 4. 位置标记

根据 config 编号自动标记对应的车站/位置：

| Config  | 位置名称                           |
| ------- | ---------------------------------- |
| config1 | Richmond Hill GO Station           |
| config2 | Langstaff GO Station               |
| config3 | Old Cummer GO Station              |
| config4 | Yonge & Sheppard                   |
| config5 | Oriole GO Station                  |
| config6 | Yonge & Finch                      |
| config7 | Front & University (Union Station) |
| config8 | Front & Spadina                    |
| config9 | Dundas & Bay                       |

## 使用方法

### 运行分析器

```bash
node analyzer.js
```

### 输出结果

分析后的 CSV 文件将保存在 `analyzed` 文件夹中，文件名格式：
```
analyzed_2025-10-26T02-24-39-267Z.csv
```

## CSV 输出字段说明

| 字段名           | 说明                                  |
| ---------------- | ------------------------------------- |
| MLS编号          | 房源的 MLS 编号                       |
| 地址             | 完整地址                              |
| 租金/价格        | 月租金（格式：$X,XXX/Monthly）        |
| 卧室             | 卧室数量                              |
| 浴室             | 浴室数量                              |
| 物业类型         | 如 Apartment, House, Row/Townhouse 等 |
| 建筑面积         | 平方米单位的面积                      |
| 面积(sqft)       | 平方英尺单位的面积                    |
| 土地面积         | 土地尺寸（如适用）                    |
| 上架日期         | 房源上架的时间戳                      |
| 时间标签         | 如"1 day ago", "2 days ago"           |
| 链接             | Realtor.ca 的房源详情页链接           |
| 位置/车站        | 对应的地铁站/GO站名称                 |
| 停车位数量       | 可用停车位数量                        |
| 是否Pet Friendly | y / n / unknown                       |
| 是否Carpet Free  | y / n / unknown                       |
| 是否有车库       | y / n                                 |
| 租金数值         | 纯数字租金（用于计算）                |
| 每平方英尺价格   | 租金 ÷ 面积                           |
| 优先级评分       | 综合评分（越高越好）                  |
| 描述             | 房源的详细描述（PublicRemarks）       |

## 排序逻辑

所有符合条件的房源按 **优先级评分** 从高到低排序，确保：
1. Pet Friendly 的房源优先
2. 有车库的房源优先
3. Carpet Free 的房源优先
4. 性价比高（每平方英尺价格低）的房源优先

## 运行示例

```bash
$ node analyzer.js

🚀 开始分析 Realtor.ca 数据...

📂 找到 10 个 JSON 文件
📄 处理文件: 1_config1_2025-10-26T02-01-10-664Z.json
  ✅ 已处理 66 条记录
...

📊 总共处理了 463 条唯一记录

🔍 开始筛选数据...
  ✅ 筛选后剩余 349 条记录（面积 >= 700 sqft）
  ✅ 已按优先级排序

📝 生成 CSV 文件...
  ✅ CSV 文件已保存: analyzed/analyzed_2025-10-26T02-24-39-267Z.csv

📊 统计信息:
  - 总记录数: 463
  - 筛选后记录数: 349
  - Pet Friendly: 1 条
  - 有车库: 347 条
  - Carpet Free: 97 条

🏆 前 5 条最优记录:
...
```

## 自定义配置

如需修改筛选条件，可以编辑 `analyzer.js` 中的以下常量：

```javascript
// 修改最小面积要求（当前为 700 sqft）
const MIN_SQFT = 700;

// 修改优先级评分权重
priorityScore += 100;  // Pet Friendly
priorityScore += 100;  // 有车库
priorityScore += 50;   // Carpet Free
```

## 注意事项

1. 程序会自动去重，同一个 MLS 编号只会出现一次
2. 如果房源描述中没有明确提及宠物/地毯信息，将标记为 "unknown"
3. 优先处理 JSON 文件而非 CSV 文件
4. 所有数据来源于 `output` 文件夹中的 JSON 文件

## 故障排查

### 问题：没有找到 JSON 文件
**解决**：确保 `output` 文件夹中有 `.json` 文件

### 问题：筛选后没有数据
**解决**：检查是否所有房源面积都小于 700 sqft，可以降低 `MIN_SQFT` 的值

### 问题：Pet Friendly 识别不准确
**解决**：可以在 `PET_FRIENDLY_REGEX` 中添加更多关键词模式

## 未来改进

- [ ] 支持命令行参数自定义筛选条件
- [ ] 添加距离计算功能
- [ ] 支持多种输出格式（JSON, Excel）
- [ ] 添加可视化图表生成
- [ ] 支持实时数据更新通知
