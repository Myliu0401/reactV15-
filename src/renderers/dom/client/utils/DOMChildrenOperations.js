/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule DOMChildrenOperations
 */

'use strict';

var DOMLazyTree = require('DOMLazyTree');
var Danger = require('Danger');
var ReactMultiChildUpdateTypes = require('ReactMultiChildUpdateTypes');
var ReactPerf = require('ReactPerf');

var createMicrosoftUnsafeLocalFunction = require('createMicrosoftUnsafeLocalFunction');
var setInnerHTML = require('setInnerHTML');
var setTextContent = require('setTextContent');


/**
 * 
 * @param {*} parentNode 父dom节点
 * @param {*} node    上一个dom节点
 * @returns 
 */
function getNodeAfter(parentNode, node) {
  // 返回[open，close]注释的文本组件的特殊情况来自getNativeNode。

  // 判断上一个dom节点是否为数组
  if (Array.isArray(node)) {
    node = node[1];
  }

  /* 
     nextSibling为 元素之后紧跟的元素（处于同一树层级中）。如果无此节点，则属性返回 null。

     firstChild为 第一个子节点

     react创建dom，添加时都是这样的 <div></div><div></div>  不会这样的<div></div>  <div></div>
     所以nextSibling下一个元素就为dom节点或null
  */
  return node ? node.nextSibling : parentNode.firstChild;
}

/**
 * 在“索引”处插入“childNode”作为“parentNode”的子级。
 *
 * @param {DOMElement} parentNode 父dom节点
 * @param {DOMElement} childNode 当前子节点
 * @param {number} index Index at which to insert the child.
 * @internal
 */
var insertChildAt = createMicrosoftUnsafeLocalFunction(
  function(parentNode, childNode, referenceNode) {

 
    /* 
         insertBefore()方法将把一个给定的节点插入到一个给定元素节点的给定子节点前面
         参数为  将要插入的节点、被参照的节点（即要插在该节点之前）
         相当于替换位置，childNode和referenceNode 位置互换
    */
    parentNode.insertBefore(childNode, referenceNode);
  }
);

function insertLazyTreeChildAt(parentNode, childTree, referenceNode) {
  DOMLazyTree.insertTreeBefore(parentNode, childTree, referenceNode);
}


/**
 * 
 * @param {*} parentNode  父dom节点
 * @param {*} childNode   当前dom节点
 * @param {*} referenceNode 父dom节点的第一个子节点 或 当前dom节点的后一个元素，如果没有则为null
 */
function moveChild(parentNode, childNode, referenceNode) {
  if (Array.isArray(childNode)) {
    moveDelimitedText(parentNode, childNode[0], childNode[1], referenceNode);
  } else {

    // 对节点进行移动
    insertChildAt(parentNode, childNode, referenceNode); 
  }
}

function removeChild(parentNode, childNode) {
  if (Array.isArray(childNode)) {
    var closingComment = childNode[1];
    childNode = childNode[0];
    removeDelimitedText(parentNode, childNode, closingComment);
    parentNode.removeChild(closingComment);
  }
  parentNode.removeChild(childNode);
}

function moveDelimitedText(
  parentNode,
  openingComment,
  closingComment,
  referenceNode
) {
  var node = openingComment;
  while (true) {
    var nextNode = node.nextSibling;
    insertChildAt(parentNode, node, referenceNode);
    if (node === closingComment) {
      break;
    }
    node = nextNode;
  }
}

function removeDelimitedText(parentNode, startNode, closingComment) {
  while (true) {
    var node = startNode.nextSibling;
    if (node === closingComment) {
      // The closing comment is removed by ReactMultiChild.
      break;
    } else {
      parentNode.removeChild(node);
    }
  }
}

function replaceDelimitedText(openingComment, closingComment, stringText) {
  var parentNode = openingComment.parentNode;
  var nodeAfterComment = openingComment.nextSibling;
  if (nodeAfterComment === closingComment) {
    // There are no text nodes between the opening and closing comments; insert
    // a new one if stringText isn't empty.
    if (stringText) {
      insertChildAt(
        parentNode,
        document.createTextNode(stringText),
        nodeAfterComment
      );
    }
  } else {
    if (stringText) {
      // Set the text content of the first node after the opening comment, and
      // remove all following nodes up until the closing comment.
      setTextContent(nodeAfterComment, stringText);
      removeDelimitedText(parentNode, nodeAfterComment, closingComment);
    } else {
      removeDelimitedText(parentNode, openingComment, closingComment);
    }
  }
}

/**
 * Operations for updating with DOM children.
 */
var DOMChildrenOperations = {

  dangerouslyReplaceNodeWithMarkup: Danger.dangerouslyReplaceNodeWithMarkup,

  replaceDelimitedText: replaceDelimitedText,

  /**
   * 通过处理一系列更新来更新组件的子级。这个更新配置均应具有“parentNode”属性。
   * @param {*} parentNode 父dom节点
   * @param {*} updates    数组
   */
  processUpdates: function(parentNode, updates) {

    // 循环数组
    for (var k = 0; k < updates.length; k++) {

      var update = updates[k]; // 获取数组的每一项

      // 判断类型、如要移动的类型为 MOVE_EXISTING
      switch (update.type) {
        case ReactMultiChildUpdateTypes.INSERT_MARKUP:
          insertLazyTreeChildAt(
            parentNode,
            update.content,
            getNodeAfter(parentNode, update.afterNode)
          );
          break;
        case ReactMultiChildUpdateTypes.MOVE_EXISTING:

          /* 
          
              参数为 父dom节点、当前项组件对应的dom节点、紧跟的元素
          */                                      // 参数为 父dom节点、上一个dom节点， 返回紧跟的元素
          moveChild( parentNode, update.fromNode, getNodeAfter(parentNode, update.afterNode) );

          break;
        case ReactMultiChildUpdateTypes.SET_MARKUP:
          setInnerHTML(
            parentNode,
            update.content
          );
          break;
        case ReactMultiChildUpdateTypes.TEXT_CONTENT:
          setTextContent(
            parentNode,
            update.content
          );
          break;
        case ReactMultiChildUpdateTypes.REMOVE_NODE:
          removeChild(parentNode, update.fromNode);
          break;
      }
    }
  },

};

ReactPerf.measureMethods(DOMChildrenOperations, 'DOMChildrenOperations', {
  replaceDelimitedText: 'replaceDelimitedText',
});

module.exports = DOMChildrenOperations;
