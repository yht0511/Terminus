# Terminus 架构说明文档

## 项目概述

Terminus 是一个基于 Web 技术的 3D 游戏引擎核心，采用模块化设计，支持资源管理、场景管理、脚本系统等功能。

## 核心架构

### 1. 目录结构

```
Terminus/
├── assets/               # 静态资源
│   ├── images/          # 图片资源
│   ├── models/          # 3D模型
│   │   ├── enemies/     # 敌人模型
│   │   └── facilities/  # 设施模型
│   └── sounds/          # 音频资源
│
├── core/                # 核心代码
│   ├── main.js         # 主入口
│   ├── managers/       # 管理器
│   ├── modules/        # 功能模块
│   └── utils/          # 工具函数
│
└── scripts/            # 业务脚本
    ├── main.json      # 主配置
    └── src/           # 源代码
        ├── enemies/   # 敌人逻辑
        ├── layers/    # 界面层
        └── renderers/ # 渲染器
```

### 2. 核心模块

#### 2.1 管理器 (Managers)

- **LayerManager**: 场景层级管理
- **ResourceManager**: 资源加载与管理
- **ScriptManager**: 脚本调度与执行

#### 2.2 功能模块 (Modules)

- **Scene**: 场景管理与切换
- **Player**: 玩家控制与状态
- **DevelopTool**: 开发调试工具

#### 2.3 脚本系统 (Scripts)

- 支持动态加载和执行
- JSON 配置驱动
- 模块化脚本组织

## 主要流程

1. 初始化流程

   - DOM 加载完成
   - 创建 Core 实例
   - 初始化管理器
   - 加载主脚本
   - 预加载资源
   - 加载依赖
   - 执行脚本

2. 存档系统

   - 支持自动存档
   - 手动存档/读档
   - 存档数据本地化

3. 资源管理
   - 异步加载
   - 缓存机制
   - 预加载支持

## 扩展机制

1. 脚本扩展
2. 渲染器扩展
3. UI 层扩展
