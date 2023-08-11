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

这也就是说，首先小顶堆是一个二叉树，而且这棵二叉树的根节点拥有最小的`key`，通常是使用
数组来表示小顶堆的，格式如下(其中所有的索引运算必须向下取整)：

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

## 过程理解
为了理解整个小顶堆排序的流程，可以跟着`digitalOcean`上的例子过一遍细节。

先给树中放一个元素，值为`10`，如下图所示：

![img03.png](https://journaldev.nyc3.digitaloceanspaces.com/2020/02/min_heap_one_element.png)

然后在树中插入一个新的元素`40`，此时的树是满足以小顶堆的父子节点大小关系的，所以本次插入不需要
进行节点的交换，如下图所示：

![img04.png](https://journaldev.nyc3.digitaloceanspaces.com/2020/02/min_heap_two_elements.png)

接下里再插入一个新的元素`50`， 仍旧是满足小顶堆的节点大小关系，无需交换，如下图：

![img05.png](https://journaldev.nyc3.digitaloceanspaces.com/2020/02/min_heap_three_elements.png)

此时，我们继续插入新元素`5`，在实际表现的数据结构中`5`是在数组的末位，在树的结构中，元素5是
元素`40`的左子节点，`5`小于`40`显然是不满足小顶堆的节点关系了，我们需要做一次数据交换，代码如下：

```javascript
const minHeap = [10, 40, 50];
const newNode = 5;
let newNodeIndex = 3; // newNode即将插入的索引值,恰好与原有的minHeapLen相等

// 这里的parentNodeIndex的索引值计算参考上面的表格，自己推导也可以
// 在源码中为了提升性能，一般会使用位运算，所以这里会改写为 newNodeIndex - 1 >>> 1;
const parentNodeIndex = Math.floor((newNodeIndex - 1) / 2);

// 已知父子节点的索引值，直接将其交换即可
minHeap[parentNodeIndex] = newNode;
minHeap[newNodeIndex] = parentNode; // JavaScript中一般不需要预设数组的长度
```

根据上面的流程我们交换完`40`与`5`之后，整棵树仍然不满足小顶堆的节点关系，所以，我们需要
继续向上直到到达整棵树的根节点，所以我们需要在`5`和`10`之间再进行一次与上面代码完全相同的
数值交换，故而在上一步代码中，我们还需要在最后加上`newNodeIndex = parentNodeIndex;`
这样才能继续在`5`和`10`之间进行交换（此时`5`的索引是原本`40`的索引，也就是`1`），完成`10`和`5`的
交换后，树的结构就会变成下图所示的样子：

![img06.png](https://journaldev.nyc3.digitaloceanspaces.com/2020/02/min_heap_after_swapping.png)

这里给出排序的实现代码如下(详细逻辑参考`digitalOcean`)：

```javascript
function insert(heap, node) {
  heap.push(node);
  var curr = heap.length - 1;
  while(curr > 0 && heap[(curr-1)>>>1] > heap[curr]) {
    var temp = heap[(curr-1)>>>1];
    heap[(curr-1)>>>1] = heap[curr];
    heap[curr] = temp;
    curr = (curr-1)>>>1;
  }

  return heap;
}
```

给出一组测试数据，可以验证一下流程：
```javascript
var heap = [];
insert(heap, 10);
insert(heap, 40);
insert(heap, 50);
insert(heap, 5);
insert(heap, 3);
insert(heap, 1);
insert(heap, 0);

console.log(heap); // [0, 5, 1, 40, 10, 50, 3]
```

![img07.jpeg](https://i.miji.bid/2023/08/11/ff323de627b78fa0725841b4c4dc1604.jpeg)

>Tips: 起初在看到这个二叉树的图时，会稍微有一点疑惑，因为`3`的位置让我以为是否是
> 代码编写有问题，但是后来仔细阅读了小顶堆的定义，其中仅强调了父节点和左右子节点
> 之间的大小关系，所以即使图中第三层的叶子节点中的3是小于左子树中第二层的`5`，也仍
> 然是满足小顶堆的，所以归根结底，这里会有这样的疑问是因为我提前将堆排序的内容和
> 小/大顶堆的逻辑混淆了。 so just forget it~
> 

## 参考资料
- [Min Heap in JavaScript](https://www.geeksforgeeks.org/min-heap-in-javascript/)
- [Min Heap Binary Tree](https://www.digitalocean.com/community/tutorials/min-heap-binary-tree)

额外备注一个仓库[JavaScript Algorithms](https://github.com/sisterAn/JavaScript-Algorithms)
，看更新时间和`issues`数量，应该还不错。

