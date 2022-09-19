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

    var markup = internalInstance.mountComponent(
      transaction, // 事务
      nativeParent, // 首次为null
      nativeContainerInfo, // 首次为集装信息，为一个对象，存储参数的一些信息
      context // 上下文
    );
    
    if (internalInstance._currentElement &&
        internalInstance._currentElement.ref != null) {
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
   * Releases any resources allocated by `mountComponent`.
   *
   * @final
   * @internal
   */
  unmountComponent: function(internalInstance, safely) {
    ReactRef.detachRefs(internalInstance, internalInstance._currentElement);
    internalInstance.unmountComponent(safely);
    if (__DEV__) {
      ReactInstrumentation.debugTool.onUnmountComponent(internalInstance);
    }
  },

  /**
   * @param {ReactComponent} internalInstance    组件入口实例
   * @param {ReactElement} nextElement    新节点
   * @param {ReactReconcileTransaction} transaction  事务
   * @param {object} context  处理后的上下文
   * @internal
   */
  receiveComponent: function(
    internalInstance, nextElement, transaction, context
  ) {
    var prevElement = internalInstance._currentElement; // 获取旧节点

    //新旧上下文和新旧节点是否一致
    if (nextElement === prevElement &&
        context === internalInstance._context
      ) {
      return;
    }

    var refsChanged = ReactRef.shouldUpdateRefs(
      prevElement,
      nextElement
    );

    if (refsChanged) {
      ReactRef.detachRefs(internalInstance, prevElement);
    }

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
   * Flush any dirty changes in a component.
   *
   * @param {ReactComponent} internalInstance
   * @param {ReactReconcileTransaction} transaction
   * @internal
   */
  performUpdateIfNecessary: function(
    internalInstance,
    transaction
  ) {
    internalInstance.performUpdateIfNecessary(transaction);
    if (__DEV__) {
      ReactInstrumentation.debugTool.onUpdateComponent(internalInstance);
    }
  },

};

module.exports = ReactReconciler;
