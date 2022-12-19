/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMIDOperations
 */

'use strict';

var DOMChildrenOperations = require('DOMChildrenOperations');
var ReactDOMComponentTree = require('ReactDOMComponentTree');
var ReactPerf = require('ReactPerf');

/**
 * Operations used to process updates to DOM nodes.
 */
var ReactDOMIDOperations = {

  /**
   * 通过处理一系列更新来更新组件的子级。 
   * @param {*} parentInst   组件初始化实例
   * @param {*} updates      数组
   */
  dangerouslyProcessChildrenUpdates: function(parentInst, updates) {
    var node = ReactDOMComponentTree.getNodeFromInstance(parentInst); // 获取组件对应的dom节点

    /* 参数为  节点、数组 */
    DOMChildrenOperations.processUpdates(node, updates);
  },
};

ReactPerf.measureMethods(ReactDOMIDOperations, 'ReactDOMIDOperations', {
  dangerouslyProcessChildrenUpdates: 'dangerouslyProcessChildrenUpdates',
});

module.exports = ReactDOMIDOperations;
