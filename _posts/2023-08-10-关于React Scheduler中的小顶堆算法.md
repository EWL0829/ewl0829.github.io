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
方法参考`React`源码中来实现，包括之前提到过的位运算也会一并使用，其中会拼贴一些
`React Scheduler`的源码片段，可以稍作参考。

在`React`源码(scheduler文件中的unstable_scheduleCallback方法)中数组节点的结构大致如下：
```typescript
interface ITask {
  id: number;
  callback: () => {};
  priorityLevel: number;
  startTime: number;
  expirationTime: number;
  sortIndex: number;
}
```

在实际参与大小比较的属性只有`id`以及`sortIndex`，所以简化一下，单个`node`
改写为
```typescript
interface ITask {
  id: number;
  sortIndex: number;
}
```

`React`源码中包括了`push`、`pop`、`peek`、`compare`、`siftUp`以及`siftDown`
几个方法，首先来实现最简单的`push`方法。

1. push
    往`MinHeap`中`push`节点时，每一次都需要进行排序，且总是从数组的末尾添加节点，所以
    `push`的代码很简单：
    ```javascript
    function push(heap, node) {
      heap.push(node);
    }
    ```
    然而，每一次的push完成后，都必须保证当前的heap是符合小顶堆的格式要求的，所以每一次
    push中都必须要做排序处理，所以代码变成了下面这样：
    ```javascript
    function push(heap, node) {
      var index = heap.length;
      heap.push(node);
      siftUp(heap, node, index);
    }
    ```
    其中的siftUp方法就是用于排序处理的，但是这里有一个点需要注意，index是在push之前
    完成的，也就是说siftUp的第三个参数是node在进入heap之前的长度。那么来看一下React
    是如何实现siftUp的

2. siftUp
    
   在看React源码对于siftUp的实现之前，可以先来理一下siftUp中可能会出现的逻辑，
首先，已知的条件是当前heap的长度，以及当前要插入node的值的大小，结合上面提到的
父节点与左右子节点之间的大小关系可以得知，在插入动作发生时，被插入的node需要从
最末尾的节点开始进行对比，而且是逐层向上进行，直到根节点也就是数组的第一个节点。


    




// parentNodeIndex = array[(i-1)/2] 无符号右移本质上就是在做除以2取整的操作，无符号右移总是返回一个正整数





##


