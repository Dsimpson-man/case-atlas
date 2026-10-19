# 案例图谱 · Design Case Atlas

一个用于**拆解商业与设计案例**的静态网站。

每个案例都按同一套结构记录：它靠什么定位、分几个阶段起来、需要哪些资源（以及门槛多高）、什么能学、什么学不来。

> 目标不是收藏链接，而是建立一套**可复用的判断框架**：看到一个品牌、一个团队、一门生意，能快速拆出它的结构和门槛。

---

## 怎么用

```bash
# 项目根目录执行
python -m http.server 8080
# 打开 http://localhost:8080
```

不要直接双击 `index.html`——浏览器会以 `file://` 打开，`fetch` 读取 JSON 会被拦截。

## 目录结构

```
case-atlas/
├── index.html          页面骨架
├── assets/
│   ├── style.css       全部样式（含深色模式）
│   └── app.js          渲染、筛选、搜索、详情
├── data/
│   └── cases.json      ★ 唯一的数据库，加案例只改这里
├── .nojekyll           让 GitHub Pages 跳过 Jekyll
└── README.md
```

零依赖、零构建。改完刷新即可。

## 新增一个案例

在 `data/cases.json` 的 `cases` 数组里追加一个对象，然后刷新页面。

最小可用版本：

```json
{
  "id": "unique-id",
  "name": "品牌名",
  "industry": "行业",
  "oneLiner": "一句话说清它是做什么的"
}
```

完整字段说明：

| 字段 | 类型 | 作用 |
| --- | --- | --- |
| `id` | string | 唯一标识，用于 `#case/<id>` 链接，建议英文小写 |
| `name` | string | 品牌 / 项目名 |
| `nameEn` | string | 英文名，可省略，会参与搜索 |
| `industry` | string | 行业，自动生成顶部筛选项 |
| `type` | string | 类型标签，如 `设计品牌型`、`个人工作室型`、`平台型` |
| `location` | string | 地区 |
| `founded` | string | 创立时间，可写「约 2010」 |
| `tags` | string[] | 关键词，参与搜索 |
| `oneLiner` | string | 卡片上的一句话定位 |
| `model` | string | 商业模式一句话 |
| `scale` | string | 量级描述，如「百万级资金 · 4 个以上职能」 |
| `snapshot` | `{label, value}[]` | 卡片上的关键数字，建议 2–3 个 |
| `positioning` | string | 详情页「定位」段落 |
| `growth` | `{phase, title, detail}[]` | 成长路径时间线 |
| `resources` | `{name, need, level, note}[]` | 资源需求；`level` 为 1–5 的门槛等级 |
| `learnable` | string[] | 可迁移的做法 |
| `notLearnable` | string[] | 不可迁移、需要警惕照搬的部分 |
| `takeaway` | string | 一句话结论，详情页大字展示 |
| `fitFor` | string | 这个案例适合谁参考 |
| `sources` | `{label, url}[]` | 信息来源链接 |

### 写作原则

1. **结论先行**：每段第一句就是判断，不要铺垫。
2. **区分「能学」和「学不来」**：这是这个库最有价值的部分。门槛往往藏在资金、供应链、渠道里，而不是方法论里。
3. **门槛要打分**：`level: 5` 意味着「没有它这事根本做不成」，不要全部打 5。
4. **可验证**：`sources` 放真实链接；不确定的年份写「约」。
5. **说人话**：不写「赋能」「闭环」「抓手」。

## 筛选与分享

- 顶部按行业筛选，搜索框匹配品牌名、行业、标签、定位
- 每个案例有独立地址：`#case/ziinlife`，可直接分享或收藏

## 部署到 GitHub Pages

仓库已开启 Pages（`main` 分支根目录）。推送到 `main` 后约一分钟生效。

```bash
git add .
git commit -m "add case: xxx"
git push
```

## 许可

内容为个人研究笔记，引用请注明来源。
