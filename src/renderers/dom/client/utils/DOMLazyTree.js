/**
 * Copyright 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule DOMLazyTree
 */

'use strict';

var createMicrosoftUnsafeLocalFunction = require('createMicrosoftUnsafeLocalFunction');
var setTextContent = require('setTextContent');

/**
 * In IE (8-11) and Edge, appending nodes with no children is dramatically
 * faster than appending a full subtree, so we essentially queue up the
 * .appendChild calls here and apply them so each node is added to its parent
 * before any children are added.
 *
 * In other browsers, doing so is slower or neutral compared to the other order
 * (in Firefox, twice as slow) so we only do this inversion in IE.
 *
 * See https://github.com/spicyj/innerhtml-vs-createelement-vs-clonenode.
 */

// enableLazy是一个变量，当前浏览器是 IE或 Edge时为 true。
var enableLazy = (typeof document !== 'undefined' && typeof document.documentMode === 'number' 
  || 
  typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string' && /\bEdge\/\d/.test(navigator.userAgent)
);


/**
 * 
 * @param {*} tree LazyTree对象
 * @returns 
 */
function insertTreeChildren(tree) {
  // 判断是否不符合浏览器环境
  if (!enableLazy) {
    return;
  };
  var node = tree.node;  // 节点dom
  var children = tree.children;   
  
  // 判断是否有子节点
  if (children.length) {
    for (var i = 0; i < children.length; i++) {
      insertTreeBefore(node, children[i], null);
    }
  } else if (tree.html != null) {
    node.innerHTML = tree.html;
  } else if (tree.text != null) { 
    setTextContent(node, tree.text);
  }
}

var insertTreeBefore = createMicrosoftUnsafeLocalFunction(
  /**
   * 
   * @param {*} parentNode      容器
   * @param {*} tree            一整棵节点树渲染后的对象 lazyTree对象
   * @param {*} referenceNode 
   */
  function(parentNode, tree, referenceNode) {
    // DocumentFragments aren't actually part of the DOM after insertion so
    // appending children won't update the DOM. We need to ensure the fragment
    // is properly populated first, breaking out of our lazy approach for just
    // this level.
    if (tree.node.nodeType === 11) {  // 判断根节点是那种类型
      insertTreeChildren(tree);
      parentNode.insertBefore(tree.node, referenceNode);
    } else {
      parentNode.insertBefore(tree.node, referenceNode);  
      // 两个节点位置互换，如果第二个参数为null，则将第一个节点插到最后面
      // 会在referenceNode之前插入tree.node节点

      insertTreeChildren(tree);  
    }
  }
);

/**
 * 
 * @param {*} oldNode 节点dom
 * @param {*} newTree LazyTree对象
 */
function replaceChildWithTree(oldNode, newTree) {

  /* 
      第一个参数节点，替换掉第二个参数节点
  */
  oldNode.parentNode.replaceChild(newTree.node, oldNode);

  insertTreeChildren(newTree);
}

function queueChild(parentTree, childTree) {

  // 判断是否是IE浏览器环境
  if (enableLazy) {
    parentTree.children.push(childTree);
  } else {
    parentTree.node.appendChild(childTree.node);
  }
};

// 参数为 lazyTree对象、__html内容
function queueHTML(tree, html) {

  // 判断window环境中是否符合条件
  if (enableLazy) {
    tree.html = html; 
  } else {
    tree.node.innerHTML = html; // 为标签的innerHTML属性注入html，相当于添加子节点
  }
}


/**
 * 
 * @param {*} tree   lazyTree对象
 * @param {*} text   文本
 */
function queueText(tree, text) {

  // 判断window环境中是否符合条件
  if (enableLazy) {
    tree.text = text;  // 将文本存到lazyTree对象中
  } else {
    setTextContent(tree.node, text); // 给标签的textContent属性设置为text参数
  }
}

// 参数为标签
function DOMLazyTree(node) {
  return {
    node: node, 
    children: [],
    html: null,
    text: null,
  };
}


// 对DOMLazyTree函数的静态属性进行扩展
DOMLazyTree.insertTreeBefore = insertTreeBefore;
DOMLazyTree.replaceChildWithTree = replaceChildWithTree;
DOMLazyTree.queueChild = queueChild;
DOMLazyTree.queueHTML = queueHTML;
DOMLazyTree.queueText = queueText;

module.exports = DOMLazyTree;
