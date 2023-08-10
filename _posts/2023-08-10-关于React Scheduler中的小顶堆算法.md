---
layout: post
title: 2023-08-11-关于React Scheduler中的小顶堆算法
subtitle: React调度器中使用到的算法
date: 2023-08-11
author: EWL
header-img: img/post-bg-coffee.jpg
catalog: true
tags:
  - 算法
  - React源码
  - 小顶堆
  - 位运算
  - 源码
---

## 概念描述

> 在`digitalOcean`中是这样描述小顶堆的，`A Min Heap Binary Tree is a Binary
> Tree where the root node has the minimum key in the tree.`

这也就是说，首先小顶堆是一个二叉树，而且这棵二叉树的根节点拥有最小的key，通常是使用
数组来表示小顶堆的，格式如下：

|     node     | indexed value |
|:------------:|:-------------:|
| current Node |    arr[i]     |
| Parent Node  | arr[(i-1)/2]  |
|  Left Node   | arr[(2*i)+1]  |
|  Right Node  | arr[(2*i)+2]  |

整棵树的根节点就是`arr[0]`，根据`digitalOcean`的描述可知，每一层的父节点
值必须小于等于左右子节点。根据上述表格中索引值的表达式可以推导出如下关系:

`arr[i] <= arr[(a*i)+1] && arr[i] <= arr[(a*i)+1]`

使用一组数组进行举例，数组如下图所示：
![img01.png](https://journaldev.nyc3.digitaloceanspaces.com/2020/02/min_heap_array.png)

该数组的二叉树为

![img02.png](https://journaldev.nyc3.digitaloceanspaces.com/2020/02/min_heap_binary_tree_index.png)


## 手动实现

跟随`digitalOcean`的示例，可以手动实现一个小顶堆，因为原文中不是使用`JavaScript`
实现的，所以这里根据示例的设计方式改成`JavaScript`来实现，并且小顶堆本身的一些
方法参考`React`源码中来实现，包括之前提到过的位运算也会一并使用。





##


