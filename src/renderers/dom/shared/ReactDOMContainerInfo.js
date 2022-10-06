/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMContainerInfo
 */

'use strict';

var validateDOMNesting = require('validateDOMNesting');

var DOC_NODE_TYPE = 9;


/**
 * 集装信息
 * @param {*} topLevelWrapper // 组件初始化的实例
 * @param {*} node 要装入的DOM元素
 * @returns 
 */
function ReactDOMContainerInfo(topLevelWrapper, node) {
  var info = {
    _topLevelWrapper: topLevelWrapper, // 组件初始化的实例
    _idCounter: 1,

    /* 
       节点类型是否是9
       如果是，则该属性为节点。如果不是，则该属性为文档节点
    */
    _ownerDocument: node ? node.nodeType === DOC_NODE_TYPE ? node : node.ownerDocument : null, 
    _node: node, // 节点
    _tag: node ? node.nodeName.toLowerCase() : null,  // 首次为装修渲染组件的dom容器的名称
    _namespaceURI: node ? node.namespaceURI : null,   // 首次为装渲染组件的dom容器的文档url
  };
  if (__DEV__) {
    info._ancestorInfo = node ?
      validateDOMNesting.updatedAncestorInfo(null, info._tag, null) : null;
  }
  return info;
}

module.exports = ReactDOMContainerInfo;
