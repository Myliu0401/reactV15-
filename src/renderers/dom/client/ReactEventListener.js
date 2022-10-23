/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactEventListener
 */

'use strict';

var EventListener = require('EventListener');
var ExecutionEnvironment = require('ExecutionEnvironment');
var PooledClass = require('PooledClass');
var ReactDOMComponentTree = require('ReactDOMComponentTree');
var ReactUpdates = require('ReactUpdates');

var getEventTarget = require('getEventTarget');
var getUnboundedScrollPosition = require('getUnboundedScrollPosition');

/**
 * Find the deepest React component completely containing the root of the
 * passed-in instance (for use when entire React trees are nested within each
 * other). If React trees are not nested, returns null.
 */
function findParent(inst) {
  // TODO: It may be a good idea to cache this to prevent unnecessary DOM
  // traversal, but caching is difficult to do correctly without using a
  // mutation observer to listen for all DOM changes.
  while (inst._nativeParent) {
    inst = inst._nativeParent;
  }
  var rootNode = ReactDOMComponentTree.getNodeFromInstance(inst);
  var container = rootNode.parentNode;
  return ReactDOMComponentTree.getClosestInstanceFromNode(container);
}

// Used to store ancestor hierarchy in top level callback
function TopLevelCallbackBookKeeping(topLevelType, nativeEvent) {
  this.topLevelType = topLevelType;
  this.nativeEvent = nativeEvent;
  this.ancestors = [];
}

Object.assign(TopLevelCallbackBookKeeping.prototype, {
  destructor: function() {
    this.topLevelType = null;
    this.nativeEvent = null;
    this.ancestors.length = 0;
  },
});



/* 
  对TopLevelCallbackBookKeeping函数的静态属性进行扩展
  扩展后该函数的静态成员将增加以下属性
  instancePool为数组
  getPooled为PooledClass模块的twoArgumentPooler函数
  poolSize为10
  release为PooledClass模块的standardReleaser函数

*/
PooledClass.addPoolingTo(
  TopLevelCallbackBookKeeping,
  PooledClass.twoArgumentPooler
);


/**
 * 
 * @param {*} bookKeeping TopLevelCallbackBookKeeping实例
 */
function handleTopLevelImpl(bookKeeping) {

  var nativeEventTarget = getEventTarget(bookKeeping.nativeEvent);  // 获取事件对象的目标节点

  var targetInst = ReactDOMComponentTree.getClosestInstanceFromNode(
    nativeEventTarget
  );  // 从该参数节点开始并往上找，有没有internalInstanceKey这个属性的节点，有就返回给节点，没有就返回null

  // 
  var ancestor = targetInst;
  do {
    bookKeeping.ancestors.push(ancestor);
    ancestor = ancestor && findParent(ancestor);
  } while (ancestor);

  for (var i = 0; i < bookKeeping.ancestors.length; i++) {
    targetInst = bookKeeping.ancestors[i];
    ReactEventListener._handleTopLevel(
      bookKeeping.topLevelType,
      targetInst,
      bookKeeping.nativeEvent,
      getEventTarget(bookKeeping.nativeEvent)
    );
  }
}

function scrollValueMonitor(cb) {
  var scrollPosition = getUnboundedScrollPosition(window);
  cb(scrollPosition);
}

var ReactEventListener = {
  _enabled: true,
  _handleTopLevel: null,  // 为ReactEventEmitterMixin模块中的handleTopLevel函数

  WINDOW_HANDLE: ExecutionEnvironment.canUseDOM ? window : null,

  setHandleTopLevel: function(handleTopLevel) {
    ReactEventListener._handleTopLevel = handleTopLevel;  // 该_handleTopLevel属性为ReactEventEmitterMixin模块中的handleTopLevel函数
  },

  setEnabled: function(enabled) {
    ReactEventListener._enabled = !!enabled;
  },

  isEnabled: function() {
    return ReactEventListener._enabled;
  },


  /**
   * 使用事件冒泡捕获顶级事件。
   *
   * @param {string} topLevelType 源码中的事件名 如： topClick 
   * @param {string} handlerBaseName 对应的原生事件名  如: click
   * @param {object} handle 文档节点
   * @return {?object} An object with a remove function which will forcefully
   *                  remove the listener.
   * @internal
   */
  trapBubbledEvent: function(topLevelType, handlerBaseName, handle) {

    var element = handle;  // 将文档节点存到变量中


    if (!element) {
      return null;  // 没有文档节点直接结束
    }


    return EventListener.listen( 
      element,        // 文档节点
      handlerBaseName, // 对应原生事件名

      // 生成一个函数，该函数this为null, 参数为topLevelType
      ReactEventListener.dispatchEvent.bind(null, topLevelType)
    );
    /* 
        // 三个参数为 Document（挂载节点）、原生 DOM Event、事件绑定函数

     listen: function listen(target, eventType, callback) {

         // 去除浏览器兼容部分，留下核心后
         target.addEventListener(eventType, callback, false);  // 绑定事件

         // 返回一个解绑的函数
         return {
             remove: function remove() {
                 target.removeEventListener(eventType, callback, false);  // 解绑事件
             }

         }

     }
    
    
    */
  },





  /**
   * Traps a top-level event by using event capturing.
   *
   * @param {string} topLevelType Record from `EventConstants`.
   * @param {string} handlerBaseName Event name (e.g. "click").
   * @param {object} handle Element on which to attach listener.
   * @return {?object} An object with a remove function which will forcefully
   *                  remove the listener.
   * @internal
   */
  trapCapturedEvent: function(topLevelType, handlerBaseName, handle) {
    var element = handle;
    if (!element) {
      return null;
    }
    return EventListener.capture(
      element,
      handlerBaseName,
      ReactEventListener.dispatchEvent.bind(null, topLevelType)
    );
  },

  monitorScrollValue: function(refresh) {
    var callback = scrollValueMonitor.bind(null, refresh);
    EventListener.listen(window, 'scroll', callback);
  },

  /**
   * 
   * @param {*} topLevelType   映射的事件名  如  topClick
   * @param {*} nativeEvent    事件对象
   * @returns 
   */
  dispatchEvent: function(topLevelType, nativeEvent) {

    // 判断是否已启用
    if (!ReactEventListener._enabled) {
      return;
    };
  
    /* 
        如果TopLevelCallbackBookKeeping函数的静态属性instancePool数组没有项则会 new TopLevelCallbackBookKeeping函数
        new TopLevelCallbackBookKeeping函数后返回的实例
        {
          topLevelType: 参数1
          nativeEvent: 参数2
          ancestors: []
          ...原型
        }
    
    */
    var bookKeeping = TopLevelCallbackBookKeeping.getPooled(
      topLevelType,  // 映射的事件名  如： topClick
      nativeEvent    // undefined
    );

    try {
      /* 
         在同一周期中处理的事件队列允许`preventDefault`。
      */
      ReactUpdates.batchedUpdates(handleTopLevelImpl, bookKeeping);
    } finally {
      TopLevelCallbackBookKeeping.release(bookKeeping);
    }
  },
};

module.exports = ReactEventListener;
