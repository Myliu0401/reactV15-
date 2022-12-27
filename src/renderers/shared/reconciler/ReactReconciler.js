/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactReconciler
 */

'use strict';

var ReactRef = require('ReactRef');
var ReactInstrumentation = require('ReactInstrumentation');

/**
 * Helper to call ReactRef.attachRefs with this composite component, split out
 * to avoid allocations in the transaction mount-ready queue.
 */
function attachRefs() {
  ReactRef.attachRefs(this, this._currentElement);
}

var ReactReconciler = {

/**
 * 
 * @param {*} internalInstance        组件初始化的实例
 * @param {*} transaction             事务
 * @param {*} nativeParent            首次时为null
 * @param {*} nativeContainerInfo     首次为集装信息，为一个对象，存储参数的一些信息
 * @param {*} context                 上下文
 * @returns 
 */
  mountComponent: function(
    internalInstance,  // 组件初始化实例
    transaction, // 事务
    nativeParent, // 首次为null
    nativeContainerInfo, //  首次为集装信息，为一个对象，存储参数的一些信息
    context // 上下文
  ) {

    // 返回一个LazyTree对象
    var markup = internalInstance.mountComponent(
      transaction, // 事务
      nativeParent, // 首次为null
      nativeContainerInfo, // 首次为集装信息，为一个对象，存储参数的一些信息
      context // 上下文
    );
    
    if (internalInstance._currentElement && internalInstance._currentElement.ref != null) {
      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);
    }
    if (__DEV__) {
      ReactInstrumentation.debugTool.onMountComponent(internalInstance);
    }
    return markup;

  },

  /**
   * Returns a value that can be passed to
   * ReactComponentEnvironment.replaceNodeWithMarkup.
   */
  getNativeNode: function(internalInstance) {
    return internalInstance.getNativeNode();
  },

  
  /**
   * 释放“mountComponent”分配的所有资源。
   * @param {*} internalInstance   组件初始化实例
   * @param {Boolean} safely             布尔值
   */
  unmountComponent: function(internalInstance, safely) {

    /* 
        释放ref资源
        参数为 组件初始化实例、babel转义
    */
    ReactRef.detachRefs(internalInstance, internalInstance._currentElement);

    internalInstance.unmountComponent(safely);  // 卸载组件
    
    if (__DEV__) {
      ReactInstrumentation.debugTool.onUnmountComponent(internalInstance);
    }
  },

  /**
   * @param {ReactComponent} internalInstance    组件初始化实例
   * @param {ReactElement} nextElement    新节点（babel转义后）/ 组件初始化实例
   * @param {ReactReconcileTransaction} transaction  事务
   * @param {object} context  处理后的上下文
   * @internal
   */
  receiveComponent: function(
    internalInstance, nextElement, transaction, context
  ) {
    var prevElement = internalInstance._currentElement; // 获取旧节点（babel转义后）

    /* 
       新旧上下文和新旧组件是否一致
       进入该判断的就是 文本，并且是相同的文本
    */
    if (nextElement === prevElement && context === internalInstance._context) {
      return;
    };

    // 返回一个布尔值
    var refsChanged = ReactRef.shouldUpdateRefs(
      prevElement,
      nextElement
    );

    // 判断是否更新refs
    if (refsChanged) {
      ReactRef.detachRefs(internalInstance, prevElement);
    }

    /* 
        更新组件
        参数为新 babel转义、事务、上下文
    */
    internalInstance.receiveComponent(nextElement, transaction, context);

    if (refsChanged &&
        internalInstance._currentElement &&
        internalInstance._currentElement.ref != null) {
      transaction.getReactMountReady().enqueue(attachRefs, internalInstance);
    }

    if (__DEV__) {
      ReactInstrumentation.debugTool.onUpdateComponent(internalInstance);
    }
  },

  /**
   * 冲洗组件中的任何脏更改。
   *
   * @param {ReactComponent} internalInstance    组件初始化实例
   * @param {ReactReconcileTransaction} transaction  事务
   * @internal
   */
  performUpdateIfNecessary: function(
    internalInstance,
    transaction
  ) {

    internalInstance.performUpdateIfNecessary(transaction);  // 更新组件

    if (__DEV__) {
      ReactInstrumentation.debugTool.onUpdateComponent(internalInstance);
    }
  },

};

module.exports = ReactReconciler;
