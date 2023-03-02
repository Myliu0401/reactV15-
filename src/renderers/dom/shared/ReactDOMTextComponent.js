/**
 * Copyright 2013-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule ReactDOMTextComponent
 */

'use strict';

var DOMChildrenOperations = require('DOMChildrenOperations');
var DOMLazyTree = require('DOMLazyTree');
var ReactDOMComponentTree = require('ReactDOMComponentTree');
var ReactPerf = require('ReactPerf');

var escapeTextContentForBrowser = require('escapeTextContentForBrowser');
var invariant = require('invariant');
var validateDOMNesting = require('validateDOMNesting');

/**
 * Text nodes violate a couple assumptions that React makes about components:
 *
 *  - When mounting text into the DOM, adjacent text nodes are merged.
 *  - Text nodes cannot be assigned a React root ID.
 *
 * This component is used to wrap strings between comment nodes so that they
 * can undergo the same reconciliation that is applied to elements.
 *
 * TODO: Investigate representing React components in the DOM with text nodes.
 *
 * @class ReactDOMTextComponent
 * @extends ReactComponent
 * @internal
 */
var ReactDOMTextComponent = function(text) {
  // TODO: 这实际上是一个ReactText（ReactNode），而不是ReactElement
  this._currentElement = text;  // 文本
 

  this._stringText = '' + text; // 将文本以字符串形式存储
  
  this._nativeNode = null;
  this._nativeParent = null;

  // Properties
  this._domID = null;
  this._mountIndex = 0;
  this._closingComment = null;
  this._commentNodes = null;
};

Object.assign(ReactDOMTextComponent.prototype, {

  

  /**
   * 渲染文本组件
   * @param {*} transaction                 事务
   * @param {*} nativeParent                父组件初始化实例
   * @param {*} nativeContainerInfo         集装信息，为一个对象，存储一些基础信息
   * @param {*} context                     上下文
   * @returns 
   */
  mountComponent: function(
    transaction,
    nativeParent,
    nativeContainerInfo,
    context
  ) {
    

    var domID = nativeContainerInfo._idCounter++;    // 递增集装对象的_idCounter属性
    var openingValue = ' react-text: ' + domID + ' '; // 声明一个开始字符串
    var closingValue = ' /react-text '; // 声明一个结束字符串

    this._domID = domID;  // 将递增的值存到实例中

    this._nativeParent = nativeParent; // 将父组件初始化实例存到 实例中（dom组件）

    // 判断事务中有没有该属性
    if (transaction.useCreateElement) {
      var ownerDocument = nativeContainerInfo._ownerDocument; // 获取文档节点
      var openingComment = ownerDocument.createComment(openingValue);  // 创建一个开始的html的注释
      var closingComment = ownerDocument.createComment(closingValue);  // 创建一个结束的html的注释

      

      /* 
        参数为一虚拟的节点对象
        生成一个lazyTree对象
        {
          node: node, 
          children: [],
          html: null,
          text: null,
        };
      
      */
      var lazyTree = DOMLazyTree(ownerDocument.createDocumentFragment());

      // 会将第二个参数对象中的节点，插入到第一个参数对象的节点中
      DOMLazyTree.queueChild(lazyTree, DOMLazyTree(openingComment));

      // 判断是否有文本
      if (this._stringText) {

        // 会将第二个参数对象中的节点，插入到第一个参数对象的节点中
        DOMLazyTree.queueChild(
          lazyTree,
          DOMLazyTree(ownerDocument.createTextNode(this._stringText))
        );
      }

      // 会将第二个参数对象中的节点，插入到第一个参数对象的节点中
      DOMLazyTree.queueChild(lazyTree, DOMLazyTree(closingComment));

      // 参数为 组件初始化实例、开始html注释
      ReactDOMComponentTree.precacheNode(this, openingComment);
      /* 
            nativeInst._nativeNode = node; // 给实例添加_nativeNode属性，为标签
            node[internalInstanceKey] = nativeInst; // 将组件实例存到标签的随机生成的属性中
      
      */


      // 将结束的html注释存到组件初始化实例中
      this._closingComment = closingComment;

      
      return lazyTree;
    } else {
      var escapedText = escapeTextContentForBrowser(this._stringText);

      if (transaction.renderToStaticMarkup) {
        // Normally we'd wrap this between comment nodes for the reasons stated
        // above, but since this is a situation where React won't take over
        // (static pages), we can simply return the text as it is.
        return escapedText;
      }

      return (
        '<!--' + openingValue + '-->' + escapedText +
        '<!--' + closingValue + '-->'
      );
    }
  },

  /**
   * 更新组件
   * @param {*} nextText   新文本 
   * @param {*} transaction 事务
   */
  receiveComponent: function(nextText, transaction) {
    if (nextText !== this._currentElement) {
      this._currentElement = nextText;
      var nextStringText = '' + nextText;
      if (nextStringText !== this._stringText) {
        // TODO: Save this as pending props and use performUpdateIfNecessary
        // and/or updateComponent to do the actual update for consistency with
        // other component types?
        this._stringText = nextStringText;
        var commentNodes = this.getNativeNode(); // 得到一个数组，数组中为 头和尾注释

        //  参数为  头注释、尾注释、文本
        DOMChildrenOperations.replaceDelimitedText(commentNodes[0], commentNodes[1], nextStringText);
      }
    }
  },

  getNativeNode: function() {
    var nativeNode = this._commentNodes;
    if (nativeNode) {
      return nativeNode;
    }
    if (!this._closingComment) {
      var openingComment = ReactDOMComponentTree.getNodeFromInstance(this); // 获取 头的注释
      var node = openingComment.nextSibling; // 头注释的下一节点，也就是文本节点

      // 循环将node变量变为 尾注释 为止
      while (true) {
        invariant(
          node != null,
          'Missing closing comment for text component %s',
          this._domID
        );
        if (node.nodeType === 8 && node.nodeValue === ' /react-text ') {
          this._closingComment = node;
          break;
        }
        node = node.nextSibling;
      }
    }

    nativeNode = [this._nativeNode, this._closingComment];  // 数组中为 头注释、尾注释
    this._commentNodes = nativeNode; 
    return nativeNode;
  },

  // 卸载
  unmountComponent: function() {
    this._closingComment = null;
    this._commentNodes = null;
    ReactDOMComponentTree.uncacheNode(this);
  },

});

ReactPerf.measureMethods(
  ReactDOMTextComponent.prototype,
  'ReactDOMTextComponent',
  {
    mountComponent: 'mountComponent',
    receiveComponent: 'receiveComponent',
  }
);

module.exports = ReactDOMTextComponent;
