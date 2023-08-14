---
layout: post
title: 2023-08-14-React Scheduler调度器学习前的一些前置知识
subtitle: 事件循环与任务调度
date: 2023-08-14
author: EWL
header-img: img/home-bg-art.jpg
catalog: true
tags:
  - React
  - 源码
  - 事件循环
---

## 学习内容

- 宏任务
  - setTimeout
  - setImmediate(Node.js/old IE)
  - requestAnimationFrame
  - MessageChannel
  - requestIdleCallback
- 微任务
  - Promise
  - MutationObserver

## 屏幕刷新

大多数设备的屏幕刷新率为60次每秒，当刷新频率低于这个值的时候，用户开始察觉到卡顿。
也就是说，每帧的最多预算时间是1000ms/60，也就是16.66ms。因此在代码中，要避免一
帧所耗费的时长小于16ms。
每一帧，浏览器都会做以下操作：
- 执行宏任务、用户事件等
- 执行 requestAnimationFrame
- 执行样式计算、布局和绘制
- 如果还有空闲时间，则执行 requestIdleCallback
- 如果某个任务执行时间过长，则当前帧不会绘制，会造成掉帧的现象



