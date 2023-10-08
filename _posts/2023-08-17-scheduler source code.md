---
layout: post
title: 2023-08-17-Scheduler source code
subtitle: 带有注释的React Scheduler源码 
date: 2023-08-15
author: EWL
header-img: img/home-bg-art.jpg
catalog: true
tags:
  - React
  - 源码 
---

```javascript
/**
 * @license React
 * scheduler.development.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

if (process.env.NODE_ENV !== "production") {
  (function() {

    'use strict';

    /* global __REACT_DEVTOOLS_GLOBAL_HOOK__ */
    // __REACT_DEVTOOLS_GLOBAL_HOOK__ 是React开发者工具提供的全局变量，用于和React应用程序之间做交互和调试。
    if (
      typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined' &&
      typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart ===
      'function'
    ) {
      __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(new Error());
    }
    let enableSchedulerDebugging = false; // 是否允许调度器进行debug
    let enableProfiling = false; // 是否允许启用性能分析
    let frameYieldMs = 5; // 控制权交还给主进程的时间限制 5ms

    // 小顶堆排序算法与相关的一些操作方法
    function push(heap, node) {
      let index = heap.length;
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

      let first = heap[0];
      let last = heap.pop();

      if (last !== first) {
        heap[0] = last;
        siftDown(heap, last, 0);
      }

      return first;
    }
    function siftUp(heap, node, i) {
      let index = i;

      while (index > 0) {
        let parentIndex = index - 1 >>> 1;
        let parent = heap[parentIndex];

        if (compare(parent, node) > 0) {
          // The parent is larger. Swap positions.
          heap[parentIndex] = node;
          heap[index] = parent;
          index = parentIndex;
        } else {
          // The parent is smaller. Exit.
          return;
        }
      }
    }
    function siftDown(heap, node, i) {
      let index = i;
      let length = heap.length;
      let halfLength = length >>> 1;

      while (index < halfLength) {
        let leftIndex = (index + 1) * 2 - 1; // left child 2*index+1
        let left = heap[leftIndex];
        let rightIndex = leftIndex + 1; // right child 2*index+2
        let right = heap[rightIndex]; // If the left or right node is smaller, swap with the smaller of those.

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
      let diff = a.sortIndex - b.sortIndex;
      return diff !== 0 ? diff : a.id - b.id;
    }


    // TODO: Use symbols? This line of comment was written by React developers.
    let ImmediatePriority = 1; // 立即执行优先级 -1ms 立刻过期
    let UserBlockingPriority = 2; // 用户阻塞优先级 250ms后过期
    let NormalPriority = 3; // 普通优先级, 作为默认值在预设的时候使用 5000ms后过期
    let LowPriority = 4; // 低优先级 10000ms后过期
    let IdlePriority = 5; // 线程空闲优先级 maxSigned31BitInt永不过期 2**30 - 1 表示最低优先级，通常用于处理一些可以延迟执行的任务，例如除了用户交互以外的后台计算、网络请求

    // this function was just put here and did nothing
    function markTaskErrored(task, ms) {
    }

    // 当前performance功能及相关的now函数是否可以使用
    let hasPerformanceNow = typeof performance === 'object' && typeof performance.now === 'function';

    if (hasPerformanceNow) {
      let localPerformance = performance;

      // 在浏览器中，`performance.now()`方法返回的是一个`DOMHighResTimeStamp`，它表示当前时间与性能测量时钟开始的时间之间的毫秒数。这个返回值精确到微秒级别，并且是一个浮点数。
      // `performance.now()`方法通常被用于进行性能测量和计时，特别是在浏览器中执行的代码的执行时间。它可以用来测量函数执行时间、操作的持续时间，或者用来比较不同算法或方法的性能。
      // 需要注意的是，`performance.now()`返回的值是相对于性能测量开始时的时间，并不与系统的实际时间或日期相关。而且，它是以浏览器启动后的某一点为基准的，浏览器重启会重置这一起点。
      // 所以，`performance.now()`的返回值在不同的浏览器上可能有差异，并且不能用于获取精确的日期和时间。
      // 如果需要获取当前的系统日期和时间，应该使用`Date`对象，而不是`performance.now()`方法。
      exports.unstable_now = function () {
        return localPerformance.now();
      };
    } else {
      // 不支持performance的情况下回退到Date对象
      let localDate = Date;
      let initialTime = localDate.now(); // 先记录一个scheduler开始执行的时间，然后将函数执行到的当前时间与之相减得到差值

      exports.unstable_now = function () {
        return localDate.now() - initialTime;
      };
    } // Max 31 bit integer. The max integer size in V8 for 32-bit systems.
      // Math.pow(2, 30) - 1
      // 0b111111111111111111111111111111


    // 和优先级对应的一系列超时时间
    let maxSigned31BitInt = 1073741823; // Times out immediately 立即超时 (2**30 - 1 === 1073741823) 0b01000000000000000000000000000000
    let IMMEDIATE_PRIORITY_TIMEOUT = -1; // Eventually times out
    let USER_BLOCKING_PRIORITY_TIMEOUT = 250; // 用户操作优先级超时时间
    let NORMAL_PRIORITY_TIMEOUT = 5000; // 正常优先级超时时间
    let LOW_PRIORITY_TIMEOUT = 10000; // Never times out -- Maybe 低优先级永远不会超时？？
    let IDLE_PRIORITY_TIMEOUT = maxSigned31BitInt; // Tasks are stored on a min heap

    // 维护两个队列，一个为普通任务队列，一个为延迟任务队列
    let taskQueue = [];
    let timerQueue = []; // Incrementing id counter. Used to maintain insertion order.

    let taskIdCounter = 1; // 任务被加到队列中的顺序 Pausing the scheduler is useful for debugging.
    let currentTask = null;
    let currentPriorityLevel = NormalPriority; //* 默认的优先级 This is set while performing work, to prevent re-entrance.

    let isPerformingWork = false; // 当前调度器是否正在调度任务中
    let isHostCallbackScheduled = false; // 调度器是否已经安排了一个hostCallback
    let isHostTimeoutScheduled = false; //* 调度器是否已经安排了一个超时的hostCallback. Capture local references to native APIs, in case a polyfill overrides them.

    let localSetTimeout = typeof setTimeout === 'function' ? setTimeout : null;
    let localClearTimeout = typeof clearTimeout === 'function' ? clearTimeout : null;
    let localSetImmediate = typeof setImmediate !== 'undefined' ? setImmediate : null; // IE and Node.js + jsdom

    // The isInputPending() method of the Scheduling interface allows you to check whether there are pending input
    // events in the event queue, indicating that the user is attempting to interact with the page
    // unused variable
    let isInputPending = typeof navigator !== 'undefined' && navigator.scheduling !== undefined && navigator.scheduling.isInputPending !== undefined ? navigator.scheduling.isInputPending.bind(navigator.scheduling) : null;

    // ===== 从延时任务队列中不断取出到期需要触发的延时任务，将其放到普通任务队列中等待被取出执行 =====
    function advanceTimers(currentTime) {
      // Check for tasks that are no longer delayed and add them to the queue.
      let timer = peek(timerQueue);

      while (timer !== null) {
        if (timer.callback === null) {
          // Timer was cancelled. 延时任务被取消了，那么就将该任务直接从队列中pop出去即可
          // unstable_cancelCallback方法就是用来做任务取消的，具体的操作就是将task置为null
          pop(timerQueue);
        } else if (timer.startTime <= currentTime) {
          // Timer fired. Transfer to the task queue. 延时任务已经被触发了，将延时任务从延时任务队列中pop出来
          // 延时任务队列中任务是以开始时间进行排序的，而普通任务队列中是以过期时间进行排序的，过期时间越小的排在越靠前的位置

          pop(timerQueue);
          timer.sortIndex = timer.expirationTime;
          push(taskQueue, timer);
        } else {
          // Timer还没有到被触发的时间，需要继续处于pending状态
          // Remaining timers are pending.
          return;
        }

        // 从延时任务队列中获取新的延时任务并循环上述逻辑，直到延时任务队列为空队列为止
        timer = peek(timerQueue);
      }
    }

    // ===== 处理超时任务 =====
    function handleTimeout(currentTime) {
      isHostTimeoutScheduled = false; // 将「当前是否安排了一个超时的hostCallback」设置为false
      advanceTimers(currentTime); // 将延时任务队列中需要被取出执行的延时任务放到普通任务队列中

      if (!isHostCallbackScheduled) {
        // heap的特点是如果根节点为空，则说明整棵树都是空的，可以拿来做整个队列是否为空的判断依据
        if (peek(taskQueue) !== null) { // 当普通任务队列不为空时
          isHostCallbackScheduled = true; // 将「调度器是否安排了一个hostCallback」置为true
          requestHostCallback(flushWork); // 这里会发起一系列的逻辑，简单来讲就是调用了 performWorkUntilDeadline
        } else {
          let firstTimer = peek(timerQueue);

          if (firstTimer !== null) {
            // setTimeout(handleTimeout, firstTimer.startTime - currentTime);
            requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
          }
        }
      }
    }

    // ===== 用于手动触发调度器立即执行所有待处理的任务 =====
    function flushWork(hasTimeRemaining, initialTime) {
      isHostCallbackScheduled = false;
      // 有超时任务被安排上
      if (isHostTimeoutScheduled) {
        // We scheduled a timeout but it's no longer needed. Cancel it.
        isHostTimeoutScheduled = false;
        cancelHostTimeout(); // callback = null
      }

      isPerformingWork = true;
      let previousPriorityLevel = currentPriorityLevel; // 当前执行的任务的优先级

      try {
        // 如果允许进行性能分析
        if (enableProfiling) {
          try {
            return workLoop(hasTimeRemaining, initialTime);
          } catch (error) {

            // ===== 这块是给enableProfiling用的，暂时先不看 =====
            if (currentTask !== null) {
              let currentTime = exports.unstable_now();
              markTaskErrored(currentTask, currentTime);
              currentTask.isQueued = false;
            }

            throw error;
            // ===== 这块是给enableProfiling用的，暂时先不看 =====
          }
        } else {
          // No catch in prod code path.
          return workLoop(hasTimeRemaining, initialTime);
        }
      } finally {
        currentTask = null;
        currentPriorityLevel = previousPriorityLevel;
        isPerformingWork = false;
      }
    }

    // ===== 实现调度器的工作循环 =====
    function workLoop(hasTimeRemaining, initialTime) {
      let currentTime = initialTime;
      advanceTimers(currentTime); // 从timerQueue中获取peek 然后塞到taskQueue中
      currentTask = peek(taskQueue); // 从taskQueue中获取peek，二叉树顶部的根节点

      // enableSchedulerDebugging是一个用于调试调度程序行为的函数。它允许开发人员查看调度器内部的一些信息，以便更好地理解调度器的工作原理。
      /* import React from 'react';
      /* import { enableSchedulerDebugging } from 'react-dom';
      /*
      /* 调用enableSchedulerDebugging函数
      /* enableSchedulerDebugging();
      /*
      /* // 渲染您的应用程序根节点
      /* ReactDOM.render(<App />, document.getElementById('root'));
      **/
      while (currentTask !== null && !(enableSchedulerDebugging )) {
        if (currentTask.expirationTime > currentTime && (!hasTimeRemaining || shouldYieldToHost())) {
          // This currentTask hasn't expired, and we've reached the deadline.
          // 当前的任务并没有过期，但是我们没有剩余时间或者执行任务耗费的时间已经超过了5ms（frameInterval），需要将控制权还给主进程，跳出循环并且返回true
          break;
        }

        let callback = currentTask.callback; // 先取值保存到callback中然后将currentTask.callback置空

        if (typeof callback === 'function') {
          currentTask.callback = null;
          currentPriorityLevel = currentTask.priorityLevel;
          let didUserCallbackTimeout = currentTask.expirationTime <= currentTime; // 当前Task的过期时间小于当前时间，说明该任务已经过期了，也就是超时了

          let continuationCallback = callback(didUserCallbackTimeout);
          currentTime = exports.unstable_now();

          // Here we see why the return value of tasks matter
          // See that under this branch, the task is not popped!
          // continuationCallback为函数时，currentTask.callback再被赋回原值，并且不会被pop出去
          // 如果不为函数，则
          if (typeof continuationCallback === 'function') {
            currentTask.callback = continuationCallback;
          } else {
            // 这里为什么还要做一次判断
            if (currentTask === peek(taskQueue)) {
              pop(taskQueue);
            }
          }

          advanceTimers(currentTime); // 从timerQueue中获取peek 然后塞到taskQueue中
        } else {
          // ===== 当callback不为function时，说明该任务已经被cancel掉了？ =====
          pop(taskQueue);
        }

        currentTask = peek(taskQueue);
      } // Return whether there's additional work


      if (currentTask !== null) {
        return true;
      } else {
        let firstTimer = peek(timerQueue);

        if (firstTimer !== null) {
          // 这里实际做的操作就是setTimeout(handleTimeout, firstTimer.startTime - currentTime)
          requestHostTimeout(handleTimeout, firstTimer.startTime - currentTime);
        }

        return false;
      }
    }

    // ===== 手动指定一个优先级来执行回调函数 =====
    function unstable_runWithPriority(priorityLevel, eventHandler) {
      switch (priorityLevel) {
        case ImmediatePriority:
        case UserBlockingPriority:
        case NormalPriority:
        case LowPriority:
        case IdlePriority:
          break;
        // 没有命中默认给出的这些特殊优先级值时，就直接使用默认的NormalPriority
        default:
          priorityLevel = NormalPriority;
      }

      let previousPriorityLevel = currentPriorityLevel; // 将上一次执行的task的优先级记录下来
      currentPriorityLevel = priorityLevel;

      try {
        // 使用指定的priorityLevel来执行eventHandler
        return eventHandler();
      } finally {
        // ===== 在执行完eventHandler之后需要手动将优先级恢复到执行该指定优先级的回调任务之前 =====
        // ===== 猜测这个是可以用来插入新任务的API =====
        currentPriorityLevel = previousPriorityLevel;
      }
    }

    // ===== 用于表示下一个调度任务优先级的标识 =====
    function unstable_next(eventHandler) {
      let priorityLevel;

      // ===== priorityLevel总是使用小于等于NormalPriority的优先级 =====
      switch (currentPriorityLevel) {
        case ImmediatePriority: // ===== -1 =====
        case UserBlockingPriority: // ===== 250ms =====
        case NormalPriority: // ===== 5000ms =====
          // Shift down to normal priority
          priorityLevel = NormalPriority;
          break;

        // ===== LowPriority 和 IdlePriority 都会被直接使用到priorityLevel上 =====
        default:
          // Anything lower than normal priority should remain at the current level.
          priorityLevel = currentPriorityLevel;
          break;
      }

      // ===== 这一类的操作都是类似的，先记录下执行eventHandler之前的优先级，然后在finally中将优先级恢复 =====
      let previousPriorityLevel = currentPriorityLevel;
      currentPriorityLevel = priorityLevel;

      try {
        // 执行eventHandler的时候，优先级已经被降低到了NormalPriority及以下
        return eventHandler();
      } finally {
        currentPriorityLevel = previousPriorityLevel;
      }
    }

    // ===== 是一个返回闭包的runWithPriority，没有什么大的差别 =====
    function unstable_wrapCallback(callback) {
      let parentPriorityLevel = currentPriorityLevel;
      return function () {
        // This is a fork of runWithPriority, inlined for performance.
        let previousPriorityLevel = currentPriorityLevel;
        // 返回了一个闭包函数，保存了parentPriorityLevel，然后使用parentPriorityLevel来标记callback的执行优先级
        currentPriorityLevel = parentPriorityLevel;

        try {
          return callback.apply(this, arguments);
        } finally {
          currentPriorityLevel = previousPriorityLevel;
        }
      };
    }

    // ===== 使用固定的优先级/延迟时间来调度callback函数，注意这里是调度而非执行 =====
    // 根据任务的优先级来计算任务的超时时间
    // priorityLevel是优先级，callback是任务，options可以通过指定delay来延迟执行我们的任务
    function unstable_scheduleCallback(priorityLevel, callback, options) {
      let currentTime = exports.unstable_now(); // 调用unstable_scheduleCallback的时间
      let startTime;

      // 当options中有合法的delay属性值时，startTime = currentTime + delay
      if (typeof options === 'object' && options !== null) {
        let delay = options.delay;

        if (typeof delay === 'number' && delay > 0) {
          startTime = currentTime + delay;
        } else {
          startTime = currentTime;
        }
      } else {
        startTime = currentTime;
      }

      let timeout;

      switch (priorityLevel) {
        case ImmediatePriority:
          timeout = IMMEDIATE_PRIORITY_TIMEOUT;
          break;

        case UserBlockingPriority:
          timeout = USER_BLOCKING_PRIORITY_TIMEOUT;
          break;

        case IdlePriority:
          timeout = IDLE_PRIORITY_TIMEOUT;
          break;

        case LowPriority:
          timeout = LOW_PRIORITY_TIMEOUT;
          break;

        case NormalPriority:
        default:
          timeout = NORMAL_PRIORITY_TIMEOUT;
          break;
      }

      let expirationTime = startTime + timeout; // 过期时间 === 调用调度函数的时间 + 不同优先级的超时时间 + options中主动delay的时间

      // newTask可能会有两种存储去向，一种是普通任务，一种是延迟任务
      // 普通任务要求立即执行，则进入普通任务队列，以过期时间expirationTime进行排序，expirationTime最小(越小越早过期)的需要最先调度执行
      // 延迟任务需要进入延迟队列，且在指定的delay之后才开始调度执行，同时按照startTime进行排序，startTime最小(越小越快到达开始时间)的需要最先调度执行
      let newTask = {
        id: taskIdCounter++,
        callback: callback,
        priorityLevel: priorityLevel,
        startTime: startTime,
        expirationTime: expirationTime,
        sortIndex: -1,
      };

      if (startTime > currentTime) {
        // delay为非空合法值
        // This is a delayed task.
        newTask.sortIndex = startTime;
        // 维护的延时队列timerQueue
        push(timerQueue, newTask);

        // [补充] 小顶堆中根节点为空表示整个小顶堆为空，因为小顶堆的特性要求根节点始终是最小的元素。如果根节点为空，那么堆中没有任何元素。

        // 调用peek从小顶堆中获取堆顶的元素，如果该元素为空，说明整个小顶堆都是空的
        // 以及从延迟任务队列中调用peek获取堆顶元素，发现和刚才刚push进去并且重新堆化后的新任务完全一致，那这就说明，刚才进入延迟队列的任务需要被拿出来放到task队列中了
        if (peek(taskQueue) === null && newTask === peek(timerQueue)) {
          // All tasks are delayed, and this is the task with the earliest delay.
          if (isHostTimeoutScheduled) {
            // Cancel an existing timeout.
            cancelHostTimeout();
          } else {
            isHostTimeoutScheduled = true;
          } // Schedule a timeout.

          // 延迟队列的任务使用setTimeout执行
          requestHostTimeout(handleTimeout, startTime - currentTime); // startTime - currentTime === delay + timeout 且差值必大于0
        }
      } else {
        newTask.sortIndex = expirationTime;
        // 维护的已就绪任务队列taskQueue
        push(taskQueue, newTask);
        // wait until the next time we yield.


        if (!isHostCallbackScheduled && !isPerformingWork) {
          isHostCallbackScheduled = true;
          // 普通队列的任务通过MessageChannel执行
          requestHostCallback(flushWork);
        }
      }

      return newTask;
    }

    // 空函数
    function unstable_pauseExecution() {
    }

    // ===== 取消打断状态，使 scheduler 恢复处理任务节点 =====
    function unstable_continueExecution() {
      if (!isHostCallbackScheduled && !isPerformingWork) {
        isHostCallbackScheduled = true;
        // ===== 直接触发所有待处理的任务 =====
        requestHostCallback(flushWork);
      }
    }

    // 返回taskQueue普通任务队列的根节点
    function unstable_getFirstCallbackNode() {
      return peek(taskQueue);
    }

    // 取消任务且remove from the queue because you can't remove arbitrary nodes from an array based heap, only the first one.
    function unstable_cancelCallback(task) {
      // remove from the queue because you can't remove arbitrary nodes from an array based heap, only the first one.)
      task.callback = null;
    }

    // ===== 获取当前的任务优先级 =====
    function unstable_getCurrentPriorityLevel() {
      return currentPriorityLevel;
    }

    let isMessageLoopRunning = false;
    let scheduledHostCallback = null;
    // 调度器定期让出执行权，以防止主线程上有其他任务，比如用户事件。默认情况下，它在每一帧中多次让出执行权。它不试图与帧边界对齐，因为大多数任务不需要与帧对齐。对于需要与帧对齐的任务，请使用 requestAnimationFrame。
    let taskTimeoutID = -1; // Scheduler periodically yields in case there is other work on the main thread, like user events. By default, it yields multiple times per frame. It does not attempt to align with frame boundaries, since most tasks don't need to be frame aligned; for those that do, use requestAnimationFrame.

    let frameInterval = frameYieldMs;
    let startTime = -1;

    // ===== 是否将控制权交还给主线程(防止渲染被阻塞，导致掉帧卡顿) =====
    function shouldYieldToHost() {
      // 时间流逝 timeElapsed = 当前时间 - 起始时间 如果时间差值大于5ms则需要将控制权交还给主线程
      let timeElapsed = exports.unstable_now() - startTime;

      if (timeElapsed < frameInterval) {
        // The main thread has only been blocked for a really short amount of time;
        // smaller than a single frame. Don't yield yet.
        return false;
      } // The main thread has been blocked for a non-negligible amount of time. We


      return true;
    }

    // 空函数
    function requestPaint() {

    }

    // 强制切换frameInterval，在指定的帧率下需要做细微的调整
    function forceFrameRate(fps) {
      if (fps < 0 || fps > 125) {
        // Using console['error'] to evade Babel and ESLint
        console['error']('forceFrameRate takes a positive int between 0 and 125, ' + 'forcing frame rates higher than 125 fps is not supported');
        return;
      }

      if (fps > 0) {
        // fps
        // 例如fps 为 60 frame/s时，frameInterval = 16
        frameInterval = Math.floor(1000 / fps);
      } else {
        // reset the framerate
        frameInterval = frameYieldMs;
      }
    }

    // ===== 在截止时间之前执行work =====
    let performWorkUntilDeadline = function () {
      if (scheduledHostCallback !== null) {
        let currentTime = exports.unstable_now(); // Keep track of the start time so we can measure how long the main thread has been blocked. 不断跟踪开始时间我们才能测量出主线程被阻塞的时间

        startTime = currentTime;
        let hasTimeRemaining = true; // If a scheduler task throws, exit the current browser task so the
        // error can be observed.
        //
        // Intentionally not using a try-catch, since that makes some debugging
        // techniques harder. Instead, if `scheduledHostCallback` errors, then
        // `hasMoreWork` will remain true, and we'll continue the work loop.

        let hasMoreWork = true;

        try {
          // 这里真正执行的 scheduledHostCallback 是flushWork，因为 requestHostCallback(flushWork) 的调用会将
          // flushWork赋值给scheduledHostCallback，而hasTimeRemaining为true， currentTime为performance.now()
          // 或者Date对象计算出的差值
          hasMoreWork = scheduledHostCallback(hasTimeRemaining, currentTime);
        } finally {
          // 无论try语句模块成功与否以及hasMoreWork有没有被置为true，都是需要执行下列逻辑
          if (hasMoreWork) {
            // If there's more work, schedule the next message event at the end of the preceding one.
            // 实际上在执行这行代码 port.postMessage(null); 然后继续执行自身 performWorkUntilDeadline()
            schedulePerformWorkUntilDeadline();
          } else {
            isMessageLoopRunning = false;
            scheduledHostCallback = null;
          }
        }
      } else {
        isMessageLoopRunning = false;
      } // Yielding to the browser will give it a chance to paint, so we can
    };

    let schedulePerformWorkUntilDeadline;

    if (typeof localSetImmediate === 'function') {
      // Node.js and old IE.
      // There's a few reasons for why we prefer setImmediate.
      //
      // Unlike MessageChannel, it doesn't prevent a Node.js process from exiting.
      // (Even though this is a DOM fork of the Scheduler, you could get here
      // with a mix of Node.js 15+, which has a MessageChannel, and jsdom.)
      // https://github.com/facebook/react/issues/20756
      //
      // But also, it runs earlier which is the semantic we want.
      // If other browsers ever implement it, it's better to use it.
      // Although both of these would be inferior to native scheduling.
      schedulePerformWorkUntilDeadline = function () {
        localSetImmediate(performWorkUntilDeadline);
      };
    } else if (typeof MessageChannel !== 'undefined') {
      // DOM and Worker environments.
      // “clamping” 是一个计算机术语，通常指的是将数值限制在一个特定范围内

      // 为什么不选择setTimeout或者rAF???（setTimeout是因为间隔不稳定且会造成浪费，而rAF则是因为调用发生在渲染前，而渲染具体在何时发生是不清楚的，浏览器也并没有对需要做渲染的时刻做出明确规定，所以rAF是不稳定的）
      // We prefer MessageChannel because of the 4ms setTimeout clamping. 这里的注释来源于React源码作者，表明了使用MessageChannel是因为浏览器有4ms的间隔限制，所以没有使用setTimeout而是使用了
      // MessageChannel去创建新的宏任务。MessageChannel在一帧内的调用频率很高，且两次调用的时间间隔极短。
      // 如果使用 setTimeout(fn, 0) 实现 Scheduler，就会浪费 4 毫秒。因为 60 FPS 要求每帧间隔不超过 16.66 ms，所以 4ms 是不容忽视的浪费。

      // MessageChannel：这是另一种 HTML5 提供的机制，通过创建一个双向通信通道，允许在同一窗口或 Web Worker 内的不同上下文之间进行通信。它提供了更灵活的消息传递方式。

      // MessageChannel的适用场景：
      // - 在同一窗口或 Web Worker 内的不同上下文之间进行双向通信。
      // - 在父级窗口与子级窗口（iframe）之间进行通信。
      // - 在多个 Web Worker 之间进行通信。

      // 使用 MessageChannel 的步骤如下：
      // 创建一个 MessageChannel 对象：使用 new MessageChannel() 创建一个新的 MessageChannel 实例。
      // 获取 MessagePort 对象：通过 channel.port1 和 channel.port2 获取两个端口对象，一个用于发送消息，另一个用于接收消息。
      // 发送消息：使用 port.postMessage(message) 方法将消息发送到另一个端口。
      // 接收消息：为接收端口添加消息事件处理程序，通过监听 'message' 事件来接收来自另一个端口的消息，写作port1.onmessage = fn。
      let channel = new MessageChannel();
      let port = channel.port2; // port2用于发消息
      channel.port1.onmessage = performWorkUntilDeadline; // port1用于收消息

      // 在requestHostCallback中会直接调用schedulePerformWorkUntilDeadline进行消息发送，此时port1会响应onmessage的监听事件，performWorkUntilDeadline会直接被调用
      schedulePerformWorkUntilDeadline = function () {
        port.postMessage(null);
      };
    } else {
      // 非浏览器环境会fallback到这里
      // We should only fallback here in non-browser environments.
      schedulePerformWorkUntilDeadline = function () {
        localSetTimeout(performWorkUntilDeadline, 0);
      };
    }

    function requestHostCallback(callback) {
      scheduledHostCallback = callback;

      if (!isMessageLoopRunning) {
        isMessageLoopRunning = true;
        schedulePerformWorkUntilDeadline();
      }
    }

    // ===== 延迟执行callback (setTimeout执行) =====
    function requestHostTimeout(callback, ms) {
      taskTimeoutID = localSetTimeout(function () {
        callback(exports.unstable_now());
      }, ms);
    }

    // ===== 取消延迟执行callback的定时器 =====
    function cancelHostTimeout() {
      localClearTimeout(taskTimeoutID);
      taskTimeoutID = -1;
    }

    let unstable_requestPaint = requestPaint;
    let unstable_Profiling =  null;

    exports.unstable_IdlePriority = IdlePriority;
    exports.unstable_ImmediatePriority = ImmediatePriority;
    exports.unstable_LowPriority = LowPriority;
    exports.unstable_NormalPriority = NormalPriority;
    exports.unstable_Profiling = unstable_Profiling;
    exports.unstable_UserBlockingPriority = UserBlockingPriority;
    exports.unstable_cancelCallback = unstable_cancelCallback;
    exports.unstable_continueExecution = unstable_continueExecution;
    exports.unstable_forceFrameRate = forceFrameRate;
    exports.unstable_getCurrentPriorityLevel = unstable_getCurrentPriorityLevel;
    exports.unstable_getFirstCallbackNode = unstable_getFirstCallbackNode;
    exports.unstable_next = unstable_next;
    exports.unstable_pauseExecution = unstable_pauseExecution;
    exports.unstable_requestPaint = unstable_requestPaint;
    exports.unstable_runWithPriority = unstable_runWithPriority;
    exports.unstable_scheduleCallback = unstable_scheduleCallback;
    exports.unstable_shouldYield = shouldYieldToHost;
    exports.unstable_wrapCallback = unstable_wrapCallback;
    /* global __REACT_DEVTOOLS_GLOBAL_HOOK__ */
    if (
      typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined' &&
      typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop ===
      'function'
    ) {
      __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(new Error());
    }

  })();
}
```
