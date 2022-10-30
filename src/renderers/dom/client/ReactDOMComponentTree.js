/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMComponentTree
 */

'use strict';

var DOMProperty = require('DOMProperty');
var ReactDOMComponentFlags = require('ReactDOMComponentFlags');

var invariant = require('invariant');

var ATTR_NAME = DOMProperty.ID_ATTRIBUTE_NAME;
var Flags = ReactDOMComponentFlags;

var internalInstanceKey = '__reactInternalInstance$' + Math.random().toString(36).slice(2);

/**
 * Drill down (through composites and empty components) until we get a native or
 * native text component.
 *
 * This is pretty polymorphic but unavoidable with the current structure we have
 * for `_renderedChildren`.
 */
function getRenderedNativeOrTextFromComponent(component) {
  var rendered;
  while ((rendered = component._renderedComponent)) {
    component = rendered;
  }
  return component;
}

/**
 * 使用给定的DOM节点。传递的“inst”可以是复合的。
 * 该函数会在ReactDOMComponent模块中的mountComponent函数中被调用
 */
function precacheNode(inst, node) {
  var nativeInst = getRenderedNativeOrTextFromComponent(inst); // 返回处理后的inst参数
  nativeInst._nativeNode = node; // 给实例添加_nativeNode属性，为标签
  node[internalInstanceKey] = nativeInst; // 将组件实例存到标签的随机生成的属性中
}

function uncacheNode(inst) {
  var node = inst._nativeNode;
  if (node) {
    delete node[internalInstanceKey];
    inst._nativeNode = null;
  }
}

/**
 * Populate `_nativeNode` on each child of `inst`, assuming that the children
 * match up with the DOM (element) children of `node`.
 *
 * We cache entire levels at once to avoid an n^2 problem where we access the
 * children of a node sequentially and have to walk from the start to our target
 * node every time.
 *
 * Since we update `_renderedChildren` and the actual DOM at (slightly)
 * different times, we could race here and see a newer `_renderedChildren` than
 * the DOM nodes we see. To avoid this, ReactMultiChild calls
 * `prepareToManageChildren` before we change `_renderedChildren`, at which
 * time the container's child nodes are always cached (until it unmounts).
 */
function precacheChildNodes(inst, node) {
  if (inst._flags & Flags.hasCachedChildNodes) {
    return;
  }
  var children = inst._renderedChildren;
  var childNode = node.firstChild;
  outer: for (var name in children) {
    if (!children.hasOwnProperty(name)) {
      continue;
    }
    var childInst = children[name];
    var childID = getRenderedNativeOrTextFromComponent(childInst)._domID;
    if (childID == null) {
      // We're currently unmounting this child in ReactMultiChild; skip it.
      continue;
    }
    // We assume the child nodes are in the same order as the child instances.
    for (; childNode !== null; childNode = childNode.nextSibling) {
      if ((childNode.nodeType === 1 &&
           childNode.getAttribute(ATTR_NAME) === String(childID)) ||
          (childNode.nodeType === 8 &&
           childNode.nodeValue === ' react-text: ' + childID + ' ') ||
          (childNode.nodeType === 8 &&
           childNode.nodeValue === ' react-empty: ' + childID + ' ')) {
        precacheNode(childInst, childNode);
        continue outer;
      }
    }
    // We reached the end of the DOM children without finding an ID match.
    invariant(false, 'Unable to find element with ID %s.', childID);
  }
  inst._flags |= Flags.hasCachedChildNodes;
}


/**
 * 
 * @param {*} node 根节点dom的父节点
 * @returns 
 */
function getClosestInstanceFromNode(node) {
  /* 
    internalInstanceKey为随机的字符串 '__reactInternalInstance$' + Math.random().toString(36).slice(2)
    从该参数节点开始往上 有该属性的节点就返回该节点
  */

  // 判断参数节点是否有该属性，节点中该属性存储的是对应的组件初始化实例
  if (node[internalInstanceKey]) {
    return node[internalInstanceKey]; // 返回该节点中的属性
  };


  // 沿着树向上走，直到找到我们缓存了其实例的祖先。
  var parents = []; // 该数组将存储节点，从节点本身开始往上存，存到最顶层（document文档节点）
  while (!node[internalInstanceKey]) { // 进入循环,如果从节点本身往上找，如果有节点有该属性，就不进入循环

    parents.push(node); // 将节点存进去

    // 判断是否有父节点
    if (node.parentNode) { 

      node = node.parentNode; // 将其父节点存

    } else {

     // 树的顶端。此节点不能是反应树的一部分（或可能未安装）。
      return null; // 没有父节点则直接返回null

    }
  }

  // 下面的操作是，参数节点往上的父级节点有该internalInstanceKey属性情况下的操作

  var closest;
  var inst;
  for (; node && (inst = node[internalInstanceKey]); node = parents.pop()) {
    closest = inst;
    if (parents.length) {
      precacheChildNodes(inst, node);
    }
  }

  return closest;
};


/**
 * 给定DOM节点，返回ReactDOMComponent或ReactDOMTextComponent实例，或者如果节点不是由此React呈现，则为null。
 */
function getInstanceFromNode(node) {

  /* 
       寻找node节点及以上有internalInstanceKey属性的节点并返回，如果到最顶层没有，则返回null
  
  */
  var inst = getClosestInstanceFromNode(node); 

  if (inst != null && inst._nativeNode === node) {
    return inst;
  } else {
    return null;
  }
}

/**
 *
 * @param {Object} inst 根节点组件的初始化实例
 * @returns node  节点dom
 */
function getNodeFromInstance(inst) {
  
  invariant(
    inst._nativeNode !== undefined,
    'getNodeFromInstance: Invalid argument.'
  );

  // 判断该实例中有没有存储对应节点dom
  if (inst._nativeNode) {
    return inst._nativeNode;  // 有值就直接返回
  }

  // 沿着树向上走，直到找到我们缓存了其DOM节点的祖先。
  var parents = [];


  while (!inst._nativeNode) {
    parents.push(inst); 
    invariant(
      inst._nativeParent,
      'React DOM tree root should always have a node reference.'
    );
    inst = inst._nativeParent;
  };

  // Now parents contains each ancestor that does *not* have a cached native
  // node, and `inst` is the deepest ancestor that does.
  for (; parents.length; inst = parents.pop()) {
    precacheChildNodes(inst, inst._nativeNode);
  }

  return inst._nativeNode;
}

var ReactDOMComponentTree = {
  getClosestInstanceFromNode: getClosestInstanceFromNode,
  getInstanceFromNode: getInstanceFromNode,
  getNodeFromInstance: getNodeFromInstance,
  precacheChildNodes: precacheChildNodes,
  precacheNode: precacheNode,
  uncacheNode: uncacheNode,
};

module.exports = ReactDOMComponentTree;
