/**
 * Copyright 2014-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactChildReconciler
 */

'use strict';

var ReactReconciler = require('ReactReconciler');

var instantiateReactComponent = require('instantiateReactComponent');
var KeyEscapeUtils = require('KeyEscapeUtils');
var shouldUpdateReactComponent = require('shouldUpdateReactComponent');
var traverseAllChildren = require('traverseAllChildren');
var warning = require('warning');


/**
 * 做子节点组件初始化并注入到对象中
 * @param {*} childInstances   存储子节点初始化实例的对象
 * @param {*} child            子节点 
 * @param {*} name             秘钥名称
 */
function instantiateChild(childInstances, child, name) {
  // We found a component instance.
  var keyUnique = (childInstances[name] === undefined);

  if (__DEV__) {
    warning(
      keyUnique,
      'flattenChildren(...): Encountered two children with the same key, ' +
      '`%s`. Child keys must be unique; when two children share a key, only ' +
      'the first child will be used.',
      KeyEscapeUtils.unescape(name)
    );
  }

  // 判断是否有子节点并且有对象中目前没有该实例
  if (child != null && keyUnique) {
    childInstances[name] = instantiateReactComponent(child); // 初始化子节点，并存储到对象中
  }
}

/**
 * ReactChildReconciler provides helpers for initializing or updating a set of
 * children. Its output is suitable for passing it onto ReactMultiChild which
 * does diffed reordering and insertion.
 */
var ReactChildReconciler = {
  /**
   * 
   * @param {*} nestedChildNodes 子节点
   * @param {*} transaction      事务
   * @param {*} context          上下文
   * @returns 
   */
  instantiateChildren: function(nestedChildNodes, transaction, context) {
    // 判断子节点是否为空，为空则直接结束
    if (nestedChildNodes == null) {
      return null;
    };

    // 创建一个对象，用来存储子节点初始化的实例
    var childInstances = {};

    /* 
         nestedChildNodes参数为子节点
         instantiateChild参数为回调，该回调会向childInstances对象注入子节点初始化的实例
         childInstances存储子节点初始化的实例对象
    */
    traverseAllChildren(nestedChildNodes, instantiateChild, childInstances);  // 处理子节点

    return childInstances;  // 返回存储子节点初始化的实例的对象
  },

  /**
   * Updates the rendered children and returns a new set of children.
   *
   * @param {?object} prevChildren Previously initialized set of children.
   * @param {?object} nextChildren Flat child element maps.
   * @param {ReactReconcileTransaction} transaction
   * @param {object} context
   * @return {?object} A new set of child instances.
   * @internal
   */
  updateChildren: function(
    prevChildren,
    nextChildren,
    removedNodes,
    transaction,
    context) {
    // We currently don't have a way to track moves here but if we use iterators
    // instead of for..in we can zip the iterators and check if an item has
    // moved.
    // TODO: If nothing has changed, return the prevChildren object so that we
    // can quickly bailout if nothing has changed.
    if (!nextChildren && !prevChildren) {
      return;
    }
    var name;
    var prevChild;
    for (name in nextChildren) {
      if (!nextChildren.hasOwnProperty(name)) {
        continue;
      }
      prevChild = prevChildren && prevChildren[name];
      var prevElement = prevChild && prevChild._currentElement;
      var nextElement = nextChildren[name];
      if (prevChild != null &&
          shouldUpdateReactComponent(prevElement, nextElement)) {
        ReactReconciler.receiveComponent(
          prevChild, nextElement, transaction, context
        );
        nextChildren[name] = prevChild;
      } else {
        if (prevChild) {
          removedNodes[name] = ReactReconciler.getNativeNode(prevChild);
          ReactReconciler.unmountComponent(prevChild, false);
        }
        // The child must be instantiated before it's mounted.
        var nextChildInstance = instantiateReactComponent(nextElement);
        nextChildren[name] = nextChildInstance;
      }
    }
    // Unmount children that are no longer present.
    for (name in prevChildren) {
      if (prevChildren.hasOwnProperty(name) &&
          !(nextChildren && nextChildren.hasOwnProperty(name))) {
        prevChild = prevChildren[name];
        removedNodes[name] = ReactReconciler.getNativeNode(prevChild);
        ReactReconciler.unmountComponent(prevChild, false);
      }
    }
  },

  /**
   * Unmounts all rendered children. This should be used to clean up children
   * when this component is unmounted.
   *
   * @param {?object} renderedChildren Previously initialized set of children.
   * @internal
   */
  unmountChildren: function(renderedChildren, safely) {
    for (var name in renderedChildren) {
      if (renderedChildren.hasOwnProperty(name)) {
        var renderedChild = renderedChildren[name];
        ReactReconciler.unmountComponent(renderedChild, safely);
      }
    }
  },

};

module.exports = ReactChildReconciler;
