/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule traverseAllChildren
 */

'use strict';

var ReactCurrentOwner = require('ReactCurrentOwner');
var ReactElement = require('ReactElement');

var getIteratorFn = require('getIteratorFn');
var invariant = require('invariant');
var KeyEscapeUtils = require('KeyEscapeUtils');
var warning = require('warning');

var SEPARATOR = '.';
var SUBSEPARATOR = ':';

/**
 * TODO: Test that a single child and an array with one item have the same key
 * pattern.
 */

var didWarnAboutMaps = false;

/**
 * 生成标识集合中某个组件的键字符串。
 *
 * @param {*} component 组件
 * @param {number} index 索引
 * @return {string}
 */
function getComponentKey(component, index) {
  
  // 判断该组件是不是react组件，并且有key值
  if (component && typeof component === 'object' && component.key != null) {

    return KeyEscapeUtils.escape(component.key);  // 根据组件的key来生成一个值

  };


  // 以当前的索引变成36进制字符串返回
  return index.toString(36);  
}

/**
 * 处理子节点
 * @param {?*} children 子节点
 * @param {!string} nameSoFar 秘钥名称，首次时为空字符串
 * @param {!function} callback 回调函数
 * @param {?*} traverseContext 存储子节点初始化的实例
 * process.
 * @return {!number} The number of children in this subtree.
 */
function traverseAllChildrenImpl(
  children,
  nameSoFar,
  callback,
  traverseContext
) {
  var type = typeof children;  // 获取子节点类型

  // 判断子节点是否是这两种类型
  if (type === 'undefined' || type === 'boolean') {
    // 这两种类型会被视为无效
    children = null;
  }

  /* 
      子节点是否为null 或者 为字符串文本 或者 为数字文本 或者是react元素 （dom标签和自定义组件）
      循环子节点时，最终都会进来这里调用回调，去向traverseContext注入子节点初始化实例
  */
  if (children === null || type === 'string' || type === 'number' || ReactElement.isValidElement(children)) {

    // 该回调会向traverseContext对象注入初始化子节点实例
    callback(

      traverseContext, // 对象

      children,  // 子节点

      // 如果它是唯一的子级，则将名称视为包装在数组中所以如果孩子的数量增加，这是一致的。
      nameSoFar === '' ? SEPARATOR + getComponentKey(children, 0) : nameSoFar 

    );

    return 1;
  }



  var child;
  var nextName;
  var subtreeCount = 0; // 在当前子树中找到的子级计数.
  var nextNamePrefix = nameSoFar === '' ? SEPARATOR : nameSoFar + SUBSEPARATOR; // 秘钥

  // 判断子节点是否是数组
  if (Array.isArray(children)) {

    // 循环数组
    for (var i = 0; i < children.length; i++) {
      child = children[i];
      nextName = nextNamePrefix + getComponentKey(child, i); // 拼接字符串，表示秘钥
      subtreeCount += traverseAllChildrenImpl(
        child,
        nextName,
        callback,
        traverseContext
      );
    }

  } else {
    var iteratorFn = getIteratorFn(children);
    if (iteratorFn) {
      var iterator = iteratorFn.call(children);
      var step;
      if (iteratorFn !== children.entries) {
        var ii = 0;
        while (!(step = iterator.next()).done) {
          child = step.value;
          nextName = nextNamePrefix + getComponentKey(child, ii++);
          subtreeCount += traverseAllChildrenImpl(
            child,
            nextName,
            callback,
            traverseContext
          );
        }
      } else {
        if (__DEV__) {
          warning(
            didWarnAboutMaps,
            'Using Maps as children is not yet fully supported. It is an ' +
            'experimental feature that might be removed. Convert it to a ' +
            'sequence / iterable of keyed ReactElements instead.'
          );
          didWarnAboutMaps = true;
        }
        // Iterator will provide entry [k,v] tuples rather than values.
        while (!(step = iterator.next()).done) {
          var entry = step.value;
          if (entry) {
            child = entry[1];
            nextName = (
              nextNamePrefix +
              KeyEscapeUtils.escape(entry[0]) + SUBSEPARATOR +
              getComponentKey(child, 0)
            );
            subtreeCount += traverseAllChildrenImpl(
              child,
              nextName,
              callback,
              traverseContext
            );
          }
        }
      }
    } else if (type === 'object') {
      var addendum = '';
      if (__DEV__) {
        addendum =
          ' If you meant to render a collection of children, use an array ' +
          'instead or wrap the object using createFragment(object) from the ' +
          'React add-ons.';
        if (children._isReactElement) {
          addendum =
            ' It looks like you\'re using an element created by a different ' +
            'version of React. Make sure to use only one copy of React.';
        }
        if (ReactCurrentOwner.current) {
          var name = ReactCurrentOwner.current.getName();
          if (name) {
            addendum += ' Check the render method of `' + name + '`.';
          }
        }
      }
      var childrenString = String(children);
      invariant(
        false,
        'Objects are not valid as a React child (found: %s).%s',
        childrenString === '[object Object]' ?
          'object with keys {' + Object.keys(children).join(', ') + '}' :
          childrenString,
        addendum
      );
    }
  }

  return subtreeCount;
}

/**
 * 遍历通常指定为“props”的子对象。孩子们，但是也可以通过属性指定：
 *
 * - `traverseAllChildren(this.props.children, ...)`
 * - `traverseAllChildren(this.props.leftPanelChildren, ...)`
 *
 * “traverseContext”是一个可选参数，它通过整个遍历。它可以用来存储堆积物或任何其他回调可能与此相关。
 *
 * @param {?*} children 子节点
 * @param {!function} callback 回调
 * @param {?*} traverseContext 存储子节点实例的对象
 * @return {!number} The number of children in this subtree.
 */
function traverseAllChildren(children, callback, traverseContext) {
  // 执行这个函数的，那么子节点就是 unedfined、boolean、react组件、数组
  // 如果子节点是null,那么在_createInitialChildren函数中就被结束掉了


  // 判断子节点是否为空，如果是则返回 0
  if (children == null) {
    return 0;
  }

  return traverseAllChildrenImpl(children, '', callback, traverseContext);
}

module.exports = traverseAllChildren;
