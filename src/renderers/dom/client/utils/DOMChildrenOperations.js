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

  // 文本组件的返回格式 [open, close] comments，需要做特殊处理 
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
         insertBefore()方法将把一个给定的节点插入到另一个给定节点前面
         当传入null时，新插入的元素将会插入到父元素的子元素列表末尾。
         参数为  将要插入的节点、被参照的节点（即要插在该节点之前）
         相当于替换位置，childNode和referenceNode 位置互换
         如果第二个参数为null,则会将第一个参数插到最后面
    */
    parentNode.insertBefore(childNode, referenceNode);
  }
);


/**
 * 
 * @param {*} parentNode     父节点
 * @param {*} childTree      添加的内容
 * @param {*} referenceNode  紧跟的元素
 */
function insertLazyTreeChildAt(parentNode, childTree, referenceNode) {
  DOMLazyTree.insertTreeBefore(parentNode, childTree, referenceNode);
}


/**
 * 移动已有节点的操作
 * @param {*} parentNode  父dom节点
 * @param {*} childNode   当前dom节点
 * @param {*} referenceNode 父dom节点的第一个子节点 或 当前dom节点的后一个元素，如果没有则为null
 */
function moveChild(parentNode, childNode, referenceNode) {

  // 判断是否是数组
  if (Array.isArray(childNode)) {
    moveDelimitedText(parentNode, childNode[0], childNode[1], referenceNode);
  } else {

    // 对节点进行移动
    insertChildAt(parentNode, childNode, referenceNode); 
  }
};


/**
 * 卸载节点
 * @param {*} parentNode 父节点
 * @param {*} childNode  要卸载的节点
 */
function removeChild(parentNode, childNode) {
  
  // 判断是否为数组
  if (Array.isArray(childNode)) {
    var closingComment = childNode[1];
    childNode = childNode[0];
    removeDelimitedText(parentNode, childNode, closingComment);
    parentNode.removeChild(closingComment);
  };

  // 卸载节点
  parentNode.removeChild(childNode);
};



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


/**
 * 
 * @param {*} parentNode     父节点
 * @param {*} startNode      旧文本几点
 * @param {*} closingComment  尾注释
 */
function removeDelimitedText(parentNode, startNode, closingComment) {
  while (true) {
    var node = startNode.nextSibling;  // 下一个节点（尾注释节点）
    if (node === closingComment) {
      // The closing comment is removed by ReactMultiChild.
      break;
    } else {
      parentNode.removeChild(node);
    }
  }
}


/**
 * 
 * @param {*} openingComment    头注释
 * @param {*} closingComment    尾注释
 * @param {*} stringText        文本
 */
function replaceDelimitedText(openingComment, closingComment, stringText) {
  var parentNode = openingComment.parentNode; // 头注释的父节点  （dom节点）
  var nodeAfterComment = openingComment.nextSibling; // 头注释的下个节点 （文本节点）

  // 尾注释和文本是否一致 （如果一致，那么文本为空字符串）
  if (nodeAfterComment === closingComment) {

    if (stringText) {
      // 参数为 父节点  新创建的文本节点  旧文本节点
      insertChildAt(parentNode, document.createTextNode(stringText), nodeAfterComment);
      // 将新创建的文本节点插到旧文本节点之前
    }
  } else {

    // 判断是否不为空
    if (stringText) {
     
      // 参数为 旧文本节点、新文本字符串
      setTextContent(nodeAfterComment, stringText); // 将旧文本节点的textContent属性置为新文本

      // 参数为 父节点 旧文本节点 尾注释
      removeDelimitedText(parentNode, nodeAfterComment, closingComment); // 如果 旧文本节点下个节点不是尾注释节点，则删除尾注释节点
    } else {

      // 如果 旧文本节点下个节点不是尾注释节点，则删除尾注释节点
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

          /* 
             添加

             参数为 父dom节点、节点内容（dom、文本）
          */                                                 // 参数为 父dom节点、上一个dom节点， 返回紧跟的元素
          insertLazyTreeChildAt(parentNode, update.content, getNodeAfter(parentNode, update.afterNode));
          break;
        case ReactMultiChildUpdateTypes.MOVE_EXISTING:

          /* 
              移动

              参数为 父dom节点、当前项组件对应的dom节点、紧跟的元素
          */                                      // 参数为 父dom节点、上一个dom节点， 返回紧跟的元素
          moveChild(parentNode, update.fromNode, getNodeAfter(parentNode, update.afterNode));

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
          
          /* 
              卸载
              
              参数为 父dom节点、组件对应的dom节点
          */
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
