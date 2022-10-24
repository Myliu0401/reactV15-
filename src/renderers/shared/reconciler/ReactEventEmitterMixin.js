/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactEventEmitterMixin
 */

'use strict';

var EventPluginHub = require('EventPluginHub');

function runEventQueueInBatch(events) {
  // 先将events事件放入队列中
  EventPluginHub.enqueueEvents(events);

  // 再处理队列中的事件,包括之前未处理完的。先入先处理原则
  EventPluginHub.processEventQueue(false);
}

var ReactEventEmitterMixin = {

  /**
   * React事件调用的入口。DOM事件绑定在了document原生对象上,每次事件触发,都会调用到handleTopLevel
   * handleTopLevel方法是事件callback调用的核心。
   * 它主要做两件事情，一方面利用浏览器回传的原生事件构造出React合成事件，另一方面采用队列的方式处理events。
   * @param {*} topLevelType 
   * @param {*} targetInst 
   * @param {*} nativeEvent 
   * @param {*} nativeEventTarget 
   */
  handleTopLevel: function(topLevelType, targetInst, nativeEvent, nativeEventTarget) {

     // 采用对象池的方式构造出合成事件对象。不同的eventType的合成事件可能不同
    var events = EventPluginHub.extractEvents(
      topLevelType,
      targetInst,
      nativeEvent,
      nativeEventTarget
    );

    // 批处理队列中的events
    runEventQueueInBatch(events);
  },
};

module.exports = ReactEventEmitterMixin;
