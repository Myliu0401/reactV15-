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
 * 
 * @param {*} inst  组件初始化实例
 * @returns 
 */
function findParent(inst) {
 
   /* 
       循环判断有没有父节点初始化的实例，最高一层为null（包装层）, 
       只为标签组件初始化实例中有该属性，所以是遍历标签组件。
   
       遍历到inst变成最高一层的根节点组件的初始化实例
   */
  while (inst._nativeParent) {
    inst = inst._nativeParent;
  };



  /* 
      参数为根节点组件的初始化实例
      返回初始化实例对应的节点dom，也就是根节点dom
  */
  var rootNode = ReactDOMComponentTree.getNodeFromInstance(inst); 

  var container = rootNode.parentNode; // 获取该根节点的父节点

  // 获取容器初始化实例，如果没有就返回document文档节点
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
 * 会遍历找出所有的父节点，并调用 runExtractedEventsInBatch 中的 extractEvents 生成合成事件，
 * 最后调用 runEventsInBatch 执行。
 * // document进行事件分发,这样具体的React组件才能得到响应。因为DOM事件是绑定到document上的
 * @param {*} bookKeeping TopLevelCallbackBookKeeping实例
 */
function handleTopLevelImpl(bookKeeping) {
  // 找到事件触发的DOM和React Component
  var nativeEventTarget = getEventTarget(bookKeeping.nativeEvent);  // 获取事件对象的目标节点

  // 该dom节点对应的组件初始化实例
  var targetInst = ReactDOMComponentTree.getClosestInstanceFromNode(
    nativeEventTarget
  );  // 从该参数节点开始并往上找，有没有internalInstanceKey这个属性的节点，有就返回给节点，没有就返回null


  // 执行事件回调前,先由当前组件向上遍历它的所有父组件。得到ancestors这个数组。
  // 因为事件回调中可能会改变Virtual DOM结构,所以要先遍历好组件层级
  var ancestor = targetInst;

  // 循环
  do {
    bookKeeping.ancestors.push(ancestor); // 将组件初始化实例存到数组中

    // 判断该属性是否有值 有值就执行findParent函数并将组件初始化实例传进去
    ancestor = ancestor && findParent(ancestor); // 该函数会从当前触发的组件开始遍历到document

    // 所以ancestors数组中的存储从触发事件的组件开始到根节点组件的组件初始化实例
  } while (ancestor);


  
  /* 
     从当前组件向父组件遍历,依次执行注册的回调方法. 我们遍历构造ancestors数组时,
       是从当前组件向父组件回溯的,故此处事件回调也是这个顺序。
     这个顺序就是冒泡的顺序,并且我们发现不能通过stopPropagation来阻止'冒泡'。
     React自身实现了一套冒泡机制。从触发事件的对象开始，向父元素回溯，依次调用它们注册的事件callback。
    
    遍历该数组
  */
  for (var i = 0; i < bookKeeping.ancestors.length; i++) {
    targetInst = bookKeeping.ancestors[i]; // 组件初始化实例

    ReactEventListener._handleTopLevel(
      bookKeeping.topLevelType, // 映射的事件名  如： topClick
      targetInst,  // 组件初始化实例
      bookKeeping.nativeEvent, // 事件对象
      getEventTarget(bookKeeping.nativeEvent) // 触发事件目标节点的dom
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
   * @return {?object} 具有移除功能的对象移除侦听器。
   * @internal  
   */
  trapBubbledEvent: function(topLevelType, handlerBaseName, handle) {

    var element = handle;  // 将文档节点存到变量中


    if (!element) {
      return null;  // 没有文档节点直接结束
    }

    // 进行事件的注册
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



  /* 
      React 为什么需要合成事件
      减少内存消耗，提升性能，不需要注册那么多的事件了，一种事件类型只在 document 上注册一次。
      统一规范，解决 ie 事件兼容问题，简化事件逻辑。
      跨端复用。
  
  
  */


  /**
   * react绑定事件的处理函数  
   * 事件对象采用的是合成事件；事件全部挂载到 document 节点上，通过冒泡进行触发。
   * 原生事件（阻止冒泡）会阻止合成事件的执行，合成事件（阻止冒泡）不会阻止原生事件的执行。
   * 在 react 里所有事件的触发都是通过 dispatchEvent方法统一进行派发的
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
        后返回的实例
        {
          topLevelType: 参数1
          nativeEvent: 参数2
          ancestors: []
          ...原型
        }
    
    */
    var bookKeeping = TopLevelCallbackBookKeeping.getPooled(
      topLevelType,  // 映射的事件名  如： topClick
      nativeEvent    // 事件对象
    );

    try {
      /* 
         在同一周期中处理的事件队列允许`preventDefault`。
         handleTopLevel函数会遍历找出所有的父节点，
         并调用 runExtractedEventsInBatch 中的 extractEvents 生成合成事件，最后调用 runEventsInBatch 执行。
      */
      ReactUpdates.batchedUpdates(handleTopLevelImpl, bookKeeping);
    } finally {
      TopLevelCallbackBookKeeping.release(bookKeeping);
    }
  },
};

module.exports = ReactEventListener;
