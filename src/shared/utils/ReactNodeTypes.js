/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactNodeTypes
 */

'use strict';

var ReactElement = require('ReactElement');

var invariant = require('invariant');

var ReactNodeTypes = {
  NATIVE: 0, // 空组件
  COMPOSITE: 1, // 自定义组件
  EMPTY: 2,  // dom组件，也就是标签

  getType: function(node) {

    // 判断是否是空节点
    if (node === null || node === false) {

      return ReactNodeTypes.EMPTY;

    } else if (ReactElement.isValidElement(node)) { // 判断是否是 标签节点和组件节点

      if (typeof node.type === 'function') {  // 判断是否是组件节点

        return ReactNodeTypes.COMPOSITE;

      } else {

        return ReactNodeTypes.NATIVE;

      }
    }
    invariant(false, 'Unexpected node: %s', node);
  },
};

module.exports = ReactNodeTypes;
