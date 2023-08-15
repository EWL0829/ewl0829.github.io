---
layout: post
title: 2023-08-14-React Scheduler中使用小顶堆相关算法的代码解析
subtitle: React Scheduler 小顶堆算法使用
date: 2023-08-15
author: EWL
header-img: img/home-bg-art.jpg
catalog: true
tags:
  - React
  - 源码
  - 算法
  - 小顶堆 
---

## React源码

在`scheduler.development.js`中，可以找到几个看起来和调度并不直接相关的方法函数，
分别是`push`/`pook`/`pop`/`siftUp`/`siftDown`/`compare`。

源码如下：
```javascript
function push(heap, node) {
  var index = heap.length;
  heap.push(node);
  siftUp(heap, node, index);
}
function peek(heap) {
  return heap.length === 0 ? null : heap[0];
}
function pop(heap) {
  if (heap.length === 0) {
    return null;
  }

  var first = heap[0];
  var last = heap.pop();

  if (last !== first) {
    heap[0] = last;
    siftDown(heap, last, 0);
  }

  return first;
}
function siftUp(heap, node, i) {
  var index = i;

  while (index > 0) {
    var parentIndex = index - 1 >>> 1;
    var parent = heap[parentIndex];

    if (compare(parent, node) > 0) {
      heap[parentIndex] = node;
      heap[index] = parent;
      index = parentIndex;
    } else {
      return;
    }
  }
}
function siftDown(heap, node, i) {
  var index = i;
  var length = heap.length;
  var halfLength = length >>> 1;

  while (index < halfLength) {
    var leftIndex = (index + 1) * 2 - 1; // left child 2*index+1
    var left = heap[leftIndex];
    var rightIndex = leftIndex + 1; // right child 2*index+2
    var right = heap[rightIndex]; // If the left or right node is smaller, swap with the smaller of those.

    if (compare(left, node) < 0) {
      if (rightIndex < length && compare(right, left) < 0) {
        heap[index] = right;
        heap[rightIndex] = node;
        index = rightIndex;
      } else {
        heap[index] = left;
        heap[leftIndex] = node;
        index = leftIndex;
      }
    } else if (rightIndex < length && compare(right, node) < 0) {
      heap[index] = right;
      heap[rightIndex] = node;
      index = rightIndex;
    } else {
      // Neither child is smaller. Exit.
      return;
    }
  }
}
function compare(a, b) {
  // Compare sort index first, then task id.
  // sortIndex是过期时间
  // 优先级越高，过期时间越小。当然有可能两个任务的过期时间一样，那这个时候就要看是谁先进的任务池了，也就是newTask中的id
  var diff = a.sortIndex - b.sortIndex;
  return diff !== 0 ? diff : a.id - b.id;
}
```

## compare方法

首先从最简单的`compare`方法说起，这个方法其实很眼熟，和`Array.sort`中传入的参数
方法类似，根据返回值的正负来决定正序排列或倒序排列。此处的判定标准有2条，一个是传入
值的`sortIndex`，当`sortIndex`相同时，则使用传入值的`id`来进行判断。

> 一些可以提前了解的Tips:
> 此处的`a`和`b`其实就是React调度器中的`Task`，每一个`Task`都会有自己的sortIndex。
> 普通的需要立即被执行的Task使用开始调度时间作为排序的索引，也就是sortIndex。而可能会
> 发生延后执行或超时的任务会被放入延时队列中，这些Task会使用过期时间作为自己的排序索引。
> 但是当无法通过sortIndex进行排序时，id作为任务进入任务池的顺序编号，此时就派上用场了。

```javascript
const taskA = { id: 0, sortIndex: 1692085480154 };
const taskB = { id: 1, sortIndex: 1692085479154 };
const taskC = { id: 2, sortIndex: 1692085478154 };
const taskD = { id: 3, sortIndex: 1692085478154 };
const taskE = { id: 4, sortIndex: 1692085476154 };

const taskQueue = [taskD, taskA, taskC, taskB, taskE,];
const sortArr = taskQueue.sort(compare);

// sortArr [E, C, D, B, A] 结果符合预期
```

## peek方法

`peek`本意是指瞄一眼，该方法就是从堆上“瞄一眼”，抓取堆顶部的元素，并将该元素返回。

> 补充：React中用到小顶堆，实现的数据形式是数组，所以数组的第一个元素就是堆里面
> 最小的那个值，peek返回的也正是这个最小值


## push方法和siftUp方法

push方法和siftUp方法放在一起讲是为了解释清楚，在每次堆更新后是需要再进行一次数据的
移动排序的。使用push将新的元素放在数组的尾部，此时原本小顶堆的排序可能会被新元素打破
，所以当新的元素被push进数组尾部后需要将该数据上移(so the name of siftUp does 
make sense)。

使用二叉树绘图来理解一下这个流程：

#### 首先将0push到数组末尾，如下图

![img01.png](https://ice.frostsky.com/2023/08/15/4e233c2c8034de2449e050a4ebcb4b0a.png)

此时数组的结构为 `[1,2,3,4,5,6, 0]`，很明显不符合小顶堆的节点大小规则，需要在整个
小顶堆中将刚才插入进去的这个元素进行提升(有点像往有序的数组中插入新元素，然后重新排序
，对吗？)

#### 调用siftUp方法堆化被插入新元素的heap

先不看siftUp的详细代码，先简单想象一下提升这个元素会做什么？
1. 对比插入的新节点和自己父节点的大小关系，如果新节点小于父节点，则将父节点和新节点交换位置（二者的索引计算参考上一篇博文）
2. 循环第一步，直到自己的父节点和当前节点的关系满足小顶堆的要求(父节点大小<=左右子节点)，循环停止


![步骤01.png](https://ice.frostsky.com/2023/08/15/6f8c639d0e70b1815cd534e54ff88435.png)
![步骤02.png](https://ice.frostsky.com/2023/08/15/8f008134241c2533f7bbfca9d50d6911.png)

以上两张图分别表示了步骤1和步骤2。

回到siftUp的代码本身，其中heap代表的是被插入新节点的堆，node表示新节点，i则是当前新节点的位置(此时一定是heap
数组的最后一位)。通过公式可以计算出，父节点的索引为`Math.floor((i-1)/2)`，在React源码中类似的除以2并且向下取
整的操作都是使用位运算做的，所以写作`i-1>>>1`(使用无符号右移做除以2运算)。当父节点大于新节点时，while循环持续
交换父节点和新节点的位置，此时新节点的索引值就是原本父节点的索引值。当排序操作提升的新节点到达顶端或者整个堆已经
在中间某一次的排序中达到小顶堆要求，那么此时提升排序结束。

## pop方法和siftDown方法

pop要比push的内容更多一些，pop会将数组中最后一个元素(此处标记为last) pop出来，然后和数组的第一个元素进行比较，如果二者不相等，那么
就将last赋值给heap[0]，流程如下：

```javascript
const heap = [0, 2, 1, 4, 5, 6, 3];
var first = heap[0]; // 0
var last = heap.pop(); // 3

// first !== last
heap[0] = last; // [3, 2, 1, 4, 5, 6]
siftDown(heap, last, 0);
```

**此处，React的处理是将first return掉，那么pop这个方法本身就是将数组的头部节点返回，此时的二叉树会失去根节点，所以
我推测，此处heap[0] = last的原因在于将一个残缺的二叉树先补全，最快的方式当然是直接将尾部的节点补到二叉树顶点，然后
调用siftDown将这个乱序的二叉树重新堆化并排序**

![步骤03.png](https://ice.frostsky.com/2023/08/15/cb47ac06719139a0e83585b98fce879c.png)
![步骤04.png](https://ice.frostsky.com/2023/08/15/473340d88bff9222b12962ad1202cff9.png)

根据上面第二张图的信息可以知道，此时二叉树顶部的节点是需要向下挪动才能满足小顶堆要求，所以siftDown方法该起作用了。
排序流程正好和siftUp相反，步骤如下：


