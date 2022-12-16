/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule flattenChildren
 */

'use strict';

var KeyEscapeUtils = require('KeyEscapeUtils');
var traverseAllChildren = require('traverseAllChildren');
var warning = require('warning');

/**
 * @param {function} traverseContext Context passed through traversal.
 * @param {?ReactComponent} child React child component.
 * @param {!string} name String name of key path to child.
 */
function flattenSingleChildIntoContext(traverseContext, child, name) {
  // We found a component instance.
  var result = traverseContext;
  var keyUnique = (result[name] === undefined);
  if (__DEV__) {
    warning(
      keyUnique,
      'flattenChildren(...): Encountered two children with the same key, ' +
      '`%s`. Child keys must be unique; when two children share a key, only ' +
      'the first child will be used.',
      KeyEscapeUtils.unescape(name)
    );
  }
  if (keyUnique && child != null) {
    result[name] = child;
  }
}

/**
 * 处理props的children属性
 * @return {!object} dom组件的children
 */
function flattenChildren(children) {

  // 判断children是否是null
  if (children == null) {
    return children;
  };

  var result = {}; // 声明一个空对象


  // 遍历children
  traverseAllChildren(children, flattenSingleChildIntoContext, result);

  return result;
}

module.exports = flattenChildren;
