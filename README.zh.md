<div align="center">

# dsh-model-order

> **在 DeepSeek Harness 里调整模型顺序 —— 就在能看见它们的地方调。**
> 消息框的模型菜单会跟着变，因为那本来就是同一个顺序。

[![topic: dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-7B68EE.svg)](https://github.com/topics/dsh-plugin)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![DSH](https://img.shields.io/badge/DeepSeek%20Harness-0.2.0--rc.2-4C9AFF.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org)

[English](README.md) | **中文**

</div>

`dsh-model-order` 在**设置 → 模型**页里，为每个 `llm-pi-ai` 路由的 provider 卡片加一块排序区。上移、下移、置顶、置底，按名称排序，或者恢复原样。你在这里定的顺序，就是消息框模型菜单显示的顺序。

[功能](#功能) · [兼容性](#兼容性) · [安装](#安装--卸载) · [快速开始](#快速开始) · [配置](#配置) · [权限与数据](#权限与数据) · [实现原理](#实现原理) · [排错](#排错) · [开发](#开发)

---

## 功能

| 功能 | 说明 |
| --- | --- |
| ↕ 单步移动 | 上移 / 下移，与相邻模型互换位置 |
| ⇈ 移到两端 | 一次置顶或置底 |
| 🔤 按名称排序 | 自然序，`m2` 排在 `m10` 前；大小写不敏感且稳定 |
| ↩ 撤销 / 恢复 | 把顺序还原 —— 见[两条恢复路径](#两条恢复路径) |
| 🔒 顺序就存在你的配置里 | 顺序**就是**你已有的 `models` 数组，没有第二份需要同步 |
| 🧩 不改任何官方文件 | 通过官方 Models 页对外开放的插槽接入 |

### 顺序来自哪里

在 DSH 里，模型顺序**只有一个**事实来源：provider 配置里的 `models` 数组。下游每一层都保持它：

```
cordis.patch.yml  providers.<route>.models: [ … ]
        │
        ▼  dsh-llm-pi-ai · resolveRouteModels()   保持配置的顺序
        ▼  ctx.llm.listModels(provider)           保持
        ▼  buildModelCatalog()                    保持，且按 provider 分组
        ▼  设置 → 模型页                           按此渲染，并标出序号 1、2、3 …
        ▼  消息框模型菜单                          按此渲染；「组内模型顺序不变」
```

所以设置页的列表和消息框的菜单并不是两套需要保持一致的东西 —— 它们是同一个顺序被读了两次。这也是为什么在设置里改顺序，消息框就会跟着变，以及为什么本插件**完全不需要去动消息框**。

### 两条恢复路径

「恢复」在不同路由上含义不同，而决定权在 DSH 自己的适配器手里：

| 路由类型 | 按钮 | 行为 |
| --- | --- | --- |
| pi-ai 内置目录覆盖的路由（`anthropic`、`openai` 等） | **恢复默认顺序** | 移除该路由的 `models` 列表，回落到 pi-ai 内置目录 |
| 手写声明的路由（`router`、中转、自建端点） | **撤销本次更改** | 把列表还原成打开卡片时的顺序，不删除任何内容 |

第二行是安全闸，不是功能缺失。对内置目录不描述的路由，pi-ai 适配器明确拒绝解析空的模型列表（*"the installed catalog does not describe this route, so its models must be listed in configuration"*）。对这类路由执行 unset 会让它**一个模型都不剩**并报 catalog error。因此本插件只在真正安全的地方提供破坏性重置，在其余地方提供非破坏性的撤销。若确实要对声明路由做真正的重置，请自行删除其 `models` 配置项 —— 一旦不可行，你会立刻看到报错。

## 兼容性

| 项 | 值 |
| --- | --- |
| DSH | web 与 desktop profile，`>=0.2.0-rc.1 <0.3.0-0`（已对 `0.2.0-rc.2` 验证） |
| Node | `>=20`（仅构建需要；插件直接发布预构建产物） |
| 依赖 | `dsh-client-ui-settings-models`（声明插槽）、`dsh-client-ui-settings`（设置读写）、`dsh-client-ui-renderer`（插槽注册表） |
| 作用范围 | `llm-pi-ai` 路由。DeepSeek 官方、DeepSeek 账号与第三方适配器家族均不受影响 |

## 安装 / 卸载

```sh
# 从 GitHub 安装（lib/ 已入库提交，无需本地构建）
dsh plugin --profile desktop add github:Wany-i/dsh-model-order

# 或从本地检出安装
npm install && npm run build
dsh plugin --profile desktop add file:/absolute/path/to/dsh-model-order
```

装完重启 DeepSeek Harness，然后硬刷新页面（`Ctrl+F5`）以重新拉取浏览器半边。

| 操作 | 命令 |
| --- | --- |
| 升级 | 重新执行 `add`，然后重启 |
| 卸载 | `dsh plugin --profile desktop remove dsh-model-order` |

## 快速开始

1. 打开**设置 → 模型**。
2. 找到你已经配置过模型的某个路由（例如 `router`），展开它的卡片。
3. 用箭头移动模型，或点**按名称排序**。
4. 打开消息框的模型菜单 —— 顺序已经一致。

> 如果某张卡片显示的是「*该路由没有自己的模型列表…*」而不是排序区，说明该路由在你的配置里没有 `models` 列表，它在沿用 pi-ai 内置目录。在为它声明模型之前没有可排序的内容 —— 见上文。

## 配置

没有。本插件没有自己的设置命名空间，也没有任何持久化偏好：它编辑的顺序**就是**你的配置，所以没有别的东西需要配置或同步。

增删模型请在同一张卡片里用官方编辑器完成；本插件只改它们的先后次序。

## 权限与数据

- **无网络访问。** 插件不会建立任何连接。
- **不新增存储。** 除了你所排序的那个路由的 `models` 数组，不写任何内容。
- **不修改任何模型字段。** 每个操作都是对你配置里既有条目对象的重新排列：`id`、`name`、`contextWindow`、`maxTokens`、`input`，以及本插件根本不认识的任何字段，都逐字原样保留。不新增，也不删除。
- **写入带 revision 栅栏。** 每次写入都携带编辑前读到的设置 revision，因此来自另一个标签页或外部 `cordis.patch.yml` 编辑的并发改动会被拒绝，而不是被静默覆盖。
- **只读部署保持只读。** 控件会禁用并给出说明。

## 实现原理

1. 官方 Models 页对外开放了 `settings.models.provider-card` 插槽，专供仓库外的插件使用；凡渲染 provider 行的卡片都会以 `entryKey = settingsNs` 派发它。
2. 本插件在 pi-ai 家族的命名空间（`llm-pi-ai`）下注册一个 keyed 条目。不修改任何官方文件；未组合该家族的部署根本不会派发到这块区域。
3. 排序区通过 `ctx.configForms` 读取该路由**用户层**的 `models` 数组，并以单条 `{ op: 'set', path: ['providers', route, 'models'], value: [...] }` 写回。
4. 整数组替换不是取巧 —— 它是设置层唯一支持的方式。其路径操作只做一层浅比较、不下钻数组节点，官方编辑器写模型列表时也是同样做法。

纯逻辑部分（`src/order.ts`、`src/client/section.ts`）不含 React、不含 DOM，因此可被直接测试；`tsconfig` 要求源码只使用可擦除语法，这样 `node` 无需构建即可直接运行它们。

## 排错

| 现象 | 原因与处理 |
| --- | --- |
| 完全没有出现排序区 | 浏览器半边未加载。重新执行 `dsh plugin --profile desktop add <spec>`，重启 DSH，再硬刷新页面。 |
| 任何卡片上都不出现 | pi-ai 家族被组合在 `llm-pi-ai` 以外的设置 entry id 下。派发键就是这个 id，需在 `src/client/index.ts` 的 `PROVIDER_NAMESPACES` 里写上它。此时插件不会渲染，也不会误动作。 |
| 我的路由上有，但某个未配置的内置路由上没有 | 符合预期：你从未配置过的路由不会显示说明，以免整页被提示淹没。 |
| 显示「该路由没有自己的模型列表」 | 符合预期：该路由沿用 pi-ai 内置目录。为它声明 `models` 后即可排序。 |
| 控件被禁用 | 设置文档为只读，或客户端处于 memory 模式（非 loopback 浏览器且无 Host 持久化）。 |
| 提示「设置在别处被改动…」 | 另一写入方推进了 revision，列表已刷新。请在刷新后的列表上重试。 |
| 排序结果看起来不对 | 采用自然序、大小写不敏感，优先按 `name`，否则按 `id`。 |
| 我的路由没有「恢复」入口 | 它是手写声明路由；请改用**撤销本次更改**，或自行删除 `models`。 |

## 开发

```sh
npm install
npm run verify     # 类型检查 + 构建 + 全部测试
npm run watch      # 变更即重建
```

| 路径 | 内容 |
| --- | --- |
| `src/order.ts` | 纯排序：移动、按名称排序、还原到捕获顺序 |
| `src/client/section.ts` | 纯形状知识：`models` 在哪、写入 op 长什么样 |
| `src/client/ModelOrderCard.tsx` | 插槽贡献组件 |
| `src/client/index.ts` | 注册与设置读写面 |
| `src/index.ts` | 宿主半边 —— 刻意留空 |
| `test/order.spec.mjs`、`test/section.spec.mjs` | 纯模块的行为契约 |
| `test/patch.spec.mjs` | 打包契约：patch ↔ manifest ↔ bundle |
| `test/bundle.spec.mjs` | 集成：加载构建产物并跑通注册链路 |

集成面的类型声明来自官方已发布包，并锁定为与运行时相同的版本。若要适配另一个 DSH 版本，请同步对齐 `@deepseek-ai/*` 这批 devDependency 的版本。

`package.json` 里的仓库地址指向 `Wany-i/dsh-model-order`；若你在别的账号下发布，请一并修改。

## 许可证

[MIT](LICENSE)
